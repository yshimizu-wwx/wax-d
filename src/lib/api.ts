import { supabase } from '@/lib/supabase'
import { Project, type WorkRequest, type Field } from '@/types/database'
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
 * Fetch open campaigns for public list (status=open, is_closed=false)
 */
export async function fetchOpenCampaigns(): Promise<Project[]> {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'open')
        .eq('is_closed', false)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching open campaigns:', error)
        return []
    }
    return (data as Project[]) || []
}

/**
 * 農家の申込一覧（申込履歴）。farmer_id で紐づく予約を案件情報付きで取得。
 */
export interface FarmerBookingItem {
    id: string
    campaign_id: string
    area_10r: number
    status: string
    work_status?: string
    locked_price?: number
    created_at?: string
    project?: Pick<Project, 'id' | 'location' | 'campaign_title' | 'start_date' | 'end_date' | 'status' | 'is_closed'>
}

export async function fetchBookingsByFarmer(farmerId: string): Promise<FarmerBookingItem[]> {
    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, campaign_id, area_10r, status, work_status, locked_price, created_at')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching farmer bookings:', error)
        return []
    }

    const list = (bookings || []) as Array<{ id: string; campaign_id: string; area_10r?: number; status?: string; work_status?: string; locked_price?: number; created_at?: string }>
    if (list.length === 0) return []

    const campaignIds = [...new Set(list.map((b) => b.campaign_id))]
    const { data: projects } = await supabase
        .from('projects')
        .select('id, location, campaign_title, start_date, end_date, status, is_closed')
        .in('id', campaignIds)

    const projectMap = new Map<string, FarmerBookingItem['project']>()
    ;(projects || []).forEach((p: Record<string, unknown>) => {
        projectMap.set(p.id as string, {
            id: p.id as string,
            location: (p.location as string) || '',
            campaign_title: p.campaign_title as string | undefined,
            start_date: p.start_date as string | undefined,
            end_date: p.end_date as string | undefined,
            status: p.status as string | undefined,
            is_closed: p.is_closed as boolean | undefined,
        })
    })

    return list.map((row) => ({
        id: row.id,
        campaign_id: row.campaign_id,
        area_10r: Number(row.area_10r) || 0,
        status: (row.status as string) || '',
        work_status: row.work_status,
        locked_price: row.locked_price != null ? Number(row.locked_price) : undefined,
        created_at: row.created_at,
        project: projectMap.get(row.campaign_id),
    }))
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

// --- 作業依頼（work_requests） ---

export interface WorkRequestData {
    farmer_id: string
    location?: string
    crop_name_free_text?: string
    task_category_free_text?: string
    task_detail_free_text?: string
    desired_start_date?: string
    desired_end_date?: string
    estimated_area_10r?: number
    desired_price?: number
    notes?: string
    /** 対象畑ID（任意） */
    field_id?: string | null
}

export async function createWorkRequest(data: WorkRequestData): Promise<{ success: boolean; error?: string; requestId?: string }> {
    try {
        const id = `WR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const { data: row, error } = await supabase
            .from('work_requests')
            .insert({
                id,
                farmer_id: data.farmer_id,
                location: data.location || null,
                crop_name_free_text: data.crop_name_free_text || null,
                task_category_free_text: data.task_category_free_text || null,
                task_detail_free_text: data.task_detail_free_text || null,
                desired_start_date: data.desired_start_date || null,
                desired_end_date: data.desired_end_date || null,
                estimated_area_10r: data.estimated_area_10r ?? null,
                desired_price: data.desired_price ?? null,
                notes: data.notes || null,
                status: 'pending',
            })
            .select('id')
            .single()
        if (error) {
            console.error('Error creating work request:', error)
            return { success: false, error: error.message }
        }
        return { success: true, requestId: row?.id ?? id }
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        return { success: false, error: msg }
    }
}

export async function fetchWorkRequestsByFarmer(farmerId: string): Promise<WorkRequest[]> {
    const { data, error } = await supabase
        .from('work_requests')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })
    if (error) {
        console.error('Error fetching work requests:', error)
        return []
    }
    return (data as WorkRequest[]) || []
}

// --- 畑（fields）CRUD ---

export async function fetchFieldsByFarmer(farmerId: string): Promise<Field[]> {
    const { data, error } = await supabase
        .from('fields')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })
    if (error) {
        console.error('Error fetching fields:', error)
        return []
    }
    return (data as Field[]) || []
}

export interface FieldData {
    farmer_id: string
    name?: string
    address?: string
    area_size?: number
    lat?: number
    lng?: number
}

export async function createField(data: FieldData): Promise<{ success: boolean; error?: string; fieldId?: string }> {
    try {
        const id = `F_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const { data: row, error } = await supabase
            .from('fields')
            .insert({
                id,
                farmer_id: data.farmer_id,
                name: data.name || null,
                address: data.address || null,
                area_size: data.area_size ?? null,
                lat: data.lat ?? null,
                lng: data.lng ?? null,
            })
            .select('id')
            .single()
        if (error) {
            console.error('Error creating field:', error)
            return { success: false, error: error.message }
        }
        return { success: true, fieldId: row?.id ?? id }
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        return { success: false, error: msg }
    }
}

export async function updateField(
    fieldId: string,
    data: Partial<Omit<FieldData, 'farmer_id'>>
): Promise<{ success: boolean; error?: string }> {
    const payload: Record<string, unknown> = {}
    if (data.name !== undefined) payload.name = data.name
    if (data.address !== undefined) payload.address = data.address
    if (data.area_size !== undefined) payload.area_size = data.area_size
    if (data.lat !== undefined) payload.lat = data.lat
    if (data.lng !== undefined) payload.lng = data.lng
    const { error } = await supabase.from('fields').update(payload).eq('id', fieldId)
    if (error) {
        console.error('Error updating field:', error)
        return { success: false, error: error.message }
    }
    return { success: true }
}

export async function deleteField(fieldId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from('fields').delete().eq('id', fieldId)
    if (error) {
        console.error('Error deleting field:', error)
        return { success: false, error: error.message }
    }
    return { success: true }
}
