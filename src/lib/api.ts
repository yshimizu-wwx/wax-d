import { supabase } from '@/lib/supabase'
import { Project } from '@/types/database'
import type { Polygon } from 'geojson'
import { geoJSONToWKT } from '@/lib/geo/areaCalculator'
import { validateApplicationArea, calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator'

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
    /** ログインしている農家のID。ある場合は bookings.farmer_id に保存する */
    farmer_id?: string | null
    farmer_name: string
    phone: string
    email: string
    desired_start_date: string
    desired_end_date: string
    field_polygon: Polygon
    area_10r: number
    /** 申込時点の暫定単価（円/10R）。必ず保存する */
    locked_price: number
}

/** GAS Application.js isCampaignClosed 相当: 募集終了かどうか */
function isCampaignClosed(project: { is_closed?: boolean; status?: string; end_date?: string | null }): boolean {
    const todayStr = new Date().toISOString().slice(0, 10)
    return (
        project.is_closed === true ||
        String(project.status) === 'closed' ||
        String(project.status) === 'completed' ||
        String(project.status) === 'unformed' ||
        !!(project.end_date && String(project.end_date).slice(0, 10) < todayStr)
    )
}

/**
 * Create a new booking/reservation
 * GAS submitApplication に準拠: 案件存在・募集終了・残り面積チェックを行う。
 */
export async function createBooking(bookingData: BookingData): Promise<{ success: boolean; error?: string; bookingId?: string }> {
    try {
        // 1. 案件取得とバリデーション（GAS submitApplication 手順3）
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, is_closed, status, end_date, max_target_area_10r, target_area_10r')
            .eq('id', bookingData.campaign_id)
            .single()

        if (projectError || !project) {
            return { success: false, error: '案件が見つかりません' }
        }

        if (isCampaignClosed(project as { is_closed?: boolean; status?: string; end_date?: string | null })) {
            return { success: false, error: 'この案件は募集終了しています' }
        }

        // 2. 残り面積チェック（GAS Application.js:99-112）
        const currentTotal = await fetchCampaignTotalArea(bookingData.campaign_id)
        const maxAreaNum = Number((project as { max_target_area_10r?: number }).max_target_area_10r) > 0
            ? Number((project as { max_target_area_10r?: number }).max_target_area_10r)
            : Number((project as { target_area_10r?: number }).target_area_10r) || 1
        const validation = validateApplicationArea(
            bookingData.area_10r,
            currentTotal,
            maxAreaNum
        )
        if (!validation.isValid) {
            return { success: false, error: validation.errorMessage ?? '申込面積が上限を超えています' }
        }

        // Convert GeoJSON polygon to WKT for PostGIS
        const polygonWKT = geoJSONToWKT(bookingData.field_polygon)

        // Generate a unique ID (you might want to use UUID here)
        const bookingId = `BK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const insertPayload: Record<string, unknown> = {
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
            status: 'confirmed',
            work_status: 'pending',
            invoice_status: 'unbilled',
            applied_at: new Date().toISOString(),
        }
        if (bookingData.farmer_id != null && bookingData.farmer_id !== '') {
            insertPayload.farmer_id = bookingData.farmer_id
        }

        const { data, error } = await supabase
            .from('bookings')
            .insert(insertPayload)
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
    /** 満額ライン面積（10R）。未指定時は targetArea10r と同義で扱う場合あり */
    maxTargetArea10r?: number
    /** 成立時単価（最低成立面積達成時の単価）。パターンAで使用 */
    executionPrice?: number

    // Optional
    confirmationDeadlineDays: number

    // Polygon
    targetAreaPolygon: Polygon
}

/**
 * Create a new campaign (provider-facing).
 * providerId should be the current user's id when role is provider.
 */
export async function createCampaign(
    campaignData: CampaignCreateData,
    providerId?: string
): Promise<{ success: boolean; error?: string; campaignId?: string }> {
    try {
        const polygonWKT = geoJSONToWKT(campaignData.targetAreaPolygon)
        const campaignId = `C_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const { data, error } = await supabase
            .from('projects')
            .insert({
                id: campaignId,
                provider_id: providerId || null,

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
                max_target_area_10r: campaignData.maxTargetArea10r ?? campaignData.targetArea10r ?? null,
                execution_price: campaignData.executionPrice ?? null,

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

/** Campaign status flow: open -> applied (optional) -> closed -> completed */

/**
 * 募集締切: status=closed, is_closed=true にし、
 * その時点の申込合計面積で計算した単価を final_unit_price に保存し、
 * 当該案件の全 bookings の locked_price に反映する。
 */
export async function closeCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
    const { data: project, error: fetchErr } = await supabase
        .from('projects')
        .select('id, base_price, min_price, target_area_10r, min_target_area_10r, max_target_area_10r, execution_price')
        .eq('id', campaignId)
        .single()
    if (fetchErr || !project) return { success: false, error: '案件が見つかりません' }

    const totalArea = await fetchCampaignTotalArea(campaignId)
    const pricing = {
        base_price: Number((project as { base_price?: number }).base_price) || 0,
        min_price: Number((project as { min_price?: number }).min_price) || 0,
        target_area_10r: Number((project as { target_area_10r?: number }).target_area_10r) || 0,
        min_target_area_10r: (project as { min_target_area_10r?: number }).min_target_area_10r,
        max_target_area_10r: (project as { max_target_area_10r?: number }).max_target_area_10r,
        execution_price: (project as { execution_price?: number }).execution_price,
    }
    const result = calculateCurrentUnitPrice(pricing, totalArea)
    const finalUnitPrice =
        result.currentPrice ??
        (pricing.min_price || pricing.base_price) ??
        0

    const { error: updateProjectErr } = await supabase
        .from('projects')
        .update({
            status: 'closed',
            is_closed: true,
            final_unit_price: finalUnitPrice,
        })
        .eq('id', campaignId)
    if (updateProjectErr) return { success: false, error: updateProjectErr.message }

    const { error: updateBookingsErr } = await supabase
        .from('bookings')
        .update({ locked_price: finalUnitPrice })
        .eq('campaign_id', campaignId)
        .neq('status', 'canceled')
    if (updateBookingsErr) return { success: false, error: updateBookingsErr.message }

    return { success: true }
}

export async function setCampaignCompleted(campaignId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('projects')
        .update({ status: 'completed' })
        .eq('id', campaignId)
    if (error) return { success: false, error: error.message }
    return { success: true }
}
