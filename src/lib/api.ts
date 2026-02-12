import { supabase } from '@/lib/supabase'
import { Project } from '@/types/database'
import type { Polygon } from 'geojson'
import { geoJSONToWKT } from '@/lib/geo/areaCalculator'

export async function fetchProjects(): Promise<Project[]> {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching projects:', error)
        return []
    }

    return data as Project[] || []
}

/**
 * Fetch the currently active project/campaign
 * Looks for projects with status='open' and is_closed=false
 */
export async function fetchActiveProject(): Promise<Project | null> {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'open')
        .eq('is_closed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (error) {
        // No active project found is not necessarily an error
        if (error.code === 'PGRST116') {
            console.log('No active project found')
            return null
        }
        console.error('Error fetching active project:', error)
        return null
    }

    return data as Project
}

/**
 * Fetch total applied area for a campaign
 */
export async function fetchCampaignTotalArea(campaignId: string): Promise<number> {
    const { data, error } = await supabase
        .from('bookings')
        .select('area_10r')
        .eq('campaign_id', campaignId)
        .neq('status', 'canceled')

    if (error) {
        console.error('Error fetching campaign total area:', error)
        return 0
    }

    const total = data?.reduce((sum, booking) => sum + (booking.area_10r || 0), 0) || 0
    return total
}

export interface BookingData {
    campaign_id: string
    farmer_name: string
    phone: string
    email: string
    desired_start_date: string
    desired_end_date: string
    field_polygon: Polygon
    area_10r: number
    locked_price: number
}

/**
 * Create a new booking/reservation
 */
export async function createBooking(bookingData: BookingData): Promise<{ success: boolean; error?: string; bookingId?: string }> {
    try {
        // Convert GeoJSON polygon to WKT for PostGIS
        const polygonWKT = geoJSONToWKT(bookingData.field_polygon)

        // Generate a unique ID (you might want to use UUID here)
        const bookingId = `BK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const { data, error } = await supabase
            .from('bookings')
            .insert({
                id: bookingId,
                campaign_id: bookingData.campaign_id,
                farmer_name: bookingData.farmer_name,
                phone: bookingData.phone,
                email: bookingData.email,
                desired_start_date: bookingData.desired_start_date,
                desired_end_date: bookingData.desired_end_date,
                field_polygon: polygonWKT,
                area_10r: bookingData.area_10r,
                locked_price: bookingData.locked_price,
                status: 'pending',
                applied_at: new Date().toISOString(),
            })
            .select('id')
            .single()

        if (error) {
            console.error('Error creating booking:', error)
            return { success: false, error: error.message }
        }

        return { success: true, bookingId: data?.id || bookingId }
    } catch (error) {
        console.error('Unexpected error creating booking:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
    }
}

export interface CampaignCreateData {
    // Category
    cropId: string
    categoryId: string
    detailId: string

    // Location & Schedule
    location: string
    startDate: string
    endDate: string

    // Pesticide info
    pesticide: string
    dilutionRate: string
    amountPer10r: string

    // Pricing
    basePrice: number
    minPrice: number

    // Area
    minTargetArea10r: number
    targetArea10r: number

    // Optional
    confirmationDeadlineDays: number

    // Polygon
    targetAreaPolygon: Polygon
}

/**
 * Create a new campaign (provider-facing)
 */
export async function createCampaign(campaignData: CampaignCreateData): Promise<{ success: boolean; error?: string; campaignId?: string }> {
    try {
        // Convert GeoJSON polygon to WKT for PostGIS
        const polygonWKT = geoJSONToWKT(campaignData.targetAreaPolygon)

        // Generate a unique campaign ID
        const campaignId = `C_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // Map form data to database schema
        const { data, error } = await supabase
            .from('projects')
            .insert({
                id: campaignId,
                // TODO: Get provider_id from session/auth
                provider_id: 'P001', // Hardcoded for now

                // Location & Schedule
                location: campaignData.location,
                start_date: campaignData.startDate,
                end_date: campaignData.endDate,

                // Category (mapped to master IDs)
                target_crop_id: campaignData.cropId || null,
                task_category_id: campaignData.categoryId || null,
                task_detail_id: campaignData.detailId || null,

                // Pesticide info
                pesticide_name: campaignData.pesticide || null,
                dilution_rate: campaignData.dilutionRate ? parseFloat(campaignData.dilutionRate) : null,
                amount_per_10r: campaignData.amountPer10r ? parseFloat(campaignData.amountPer10r) : null,

                // Pricing
                base_price: campaignData.basePrice,
                min_price: campaignData.minPrice,

                // Area
                min_target_area_10r: campaignData.minTargetArea10r || null,
                target_area_10r: campaignData.targetArea10r,

                // Optional
                confirmation_deadline_days: campaignData.confirmationDeadlineDays || null,

                // Polygon (WKT format for PostGIS)
                target_area_polygon: polygonWKT,

                // Initial status
                status: 'open',
                is_closed: false,

                // Timestamps
                created_at: new Date().toISOString(),
            })
            .select('id')
            .single()

        if (error) {
            console.error('Error creating campaign:', error)
            return { success: false, error: error.message }
        }

        return { success: true, campaignId: data?.id || campaignId }
    } catch (error) {
        console.error('Unexpected error creating campaign:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
    }
}
