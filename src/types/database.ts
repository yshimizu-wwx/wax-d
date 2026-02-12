/** User status (schema constraint) */
export type UserStatus = 'pending' | 'active' | 'under_review' | 'suspended' | 'rejected';

/** User row from public.users (schema-aligned) */
export interface UserRow {
    id: string;
    email: string | null;
    role: 'admin' | 'provider' | 'farmer';
    name: string | null;
    phone: string | null;
    status: UserStatus | null;
    address: string | null;
    associated_provider_id: string | null;
    interested_crop_ids: string | null;
    license_mlit: string | null;
    license_droneskill: string | null;
    commission_rate: number | null;
    invitation_code: string | null;
    lat: number | null;
    lng: number | null;
    created_at: string | null;
}

/** PostGIS geometry: stored/retrieved as WKT or GeoJSON depending on driver */
export type GeometryColumn = unknown;

export interface Project {
    id: string;
    provider_id?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    final_date?: string | null;
    location: string;
    base_price?: number | null;
    min_price?: number | null;
    target_area_10r?: number | null;
    status?: string | null;
    map_url?: string | null;
    target_crop_id?: string | null;
    task_category_id?: string | null;
    task_detail_id?: string | null;
    is_closed?: boolean | null;
    final_unit_price?: number | null;
    pesticide?: string | null;
    notes?: string | null;
    billing_id?: string | null;
    final_decision_date?: string | null;
    min_target_area_10r?: number | null;
    max_target_area_10r?: number | null;
    execution_price?: number | null;
    pesticide_name?: string | null;
    dilution_rate?: number | null;
    amount_per_10r?: number | null;
    target_area_polygon?: GeometryColumn;
    confirmation_deadline_days?: number | null;
    campaign_title?: string | null;
    crop_name?: string | null;
    task_category_name?: string | null;
    task_detail_name?: string | null;
    created_at?: string | null;

    /** Frontend helper: display title */
    title?: string;
    /** Frontend helper: current unit price */
    current_price?: number;
}

/** Booking row from public.bookings (schema-aligned) */
export interface BookingRow {
    id: string;
    campaign_id: string;
    farmer_id: string | null;
    area_10r: number | null;
    applied_at: string | null;
    status: string | null;
    actual_area_10r: number | null;
    work_status: 'pending' | 'completed' | null;
    final_amount: number | null;
    evidence_image_url: string | null;
    preferred_dates: string | null;
    confirmed_date: string | null;
    field_id: string | null;
    invoice_status: 'unbilled' | 'sent' | 'processed' | 'invoiced' | null;
    farmer_name: string | null;
    phone: string | null;
    email: string | null;
    desired_start_date: string | null;
    desired_end_date: string | null;
    locked_price: number | null;
    created_at: string | null;
}

export interface Booking {
    id: string;
    campaign_id: string;
    farmer_id?: string | null;
    farmer_name?: string | null;
    locked_price?: number | null;
    area_10r?: number | null;
    status?: string | null;
    work_status?: string | null;
    applied_at?: string | null;
    created_at?: string | null;
}

/** Work report row from public.work_reports (schema-aligned) */
export interface WorkReportRow {
    id: string;
    application_id: string | null;
    campaign_id: string | null;
    dilution_rate_actual: string | null;
    amount_actual_per_10r: string | null;
    photo_urls_json: string | null;
    reported_at: string | null;
    reporter_id: string | null;
    gps_lat: number | null;
    gps_lng: number | null;
    reported_at_iso: string | null;
    campaign_snapshot_json: string | null;
    application_snapshot_json: string | null;
}

export type MasterType = 'crop' | 'task_category' | 'task_detail' | 'pesticide';

export interface Master {
    id: string;
    provider_id: string | null;
    type: MasterType;
    name: string;
    parent_id: string | null;
    status: 'active' | 'inactive';
    created_at?: string;
}

/** 作業依頼（農家→業者）。案件化前の依頼データ */
export interface WorkRequest {
    id: string;
    farmer_id: string;
    provider_id?: string | null;
    requested_at?: string;
    location?: string | null;
    crop_name?: string | null;
    task_category_name?: string | null;
    task_detail_name?: string | null;
    desired_start_date?: string | null;
    desired_end_date?: string | null;
    estimated_area_10r?: number | null;
    notes?: string | null;
    status: 'pending' | 'converted' | 'rejected';
    converted_campaign_id?: string | null;
    crop_name_free_text?: string | null;
    task_category_free_text?: string | null;
    task_detail_free_text?: string | null;
    desired_price?: number | null;
    target_area_polygon?: string | null;
    created_at?: string;
}

/** 農家・業者紐付け（1農家あたり最大10業者） */
export interface FarmerProvider {
  farmer_id: string;
  provider_id: string;
  status: 'active' | 'inactive';
  created_at?: string;
}

/** 農家が紐付け可能な業者数の上限 */
export const FARMER_PROVIDERS_MAX = 10;

/** 畑（圃場）fields テーブル（schema-aligned） */
export interface Field {
    id: string;
    farmer_id: string;
    name?: string | null;
    address?: string | null;
    map_url?: string | null;
    area_size?: number | null;
    lat?: number | null;
    lng?: number | null;
    place_id?: string | null;
    area_coordinates?: GeometryColumn;
    created_at?: string | null;
}
