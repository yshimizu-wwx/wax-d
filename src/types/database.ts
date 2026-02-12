export interface Project {
    id: string;
    provider_id?: string;
    start_date?: string;
    end_date?: string;
    final_date?: string;
    location: string;
    base_price?: number;
    min_price?: number;
    target_area_10r?: number;
    status?: string;
    map_url?: string;
    target_crop_id?: string;
    task_category_id?: string;
    task_detail_id?: string;
    is_closed?: boolean;
    final_unit_price?: number;
    pesticide?: string;
    notes?: string;
    billing_id?: string;
    final_decision_date?: string;
    min_target_area_10r?: number;
    max_target_area_10r?: number;
    execution_price?: number;
    pesticide_name?: string;
    dilution_rate?: string;
    amount_per_10r?: string;
    target_area_polygon?: any; // PostGIS geometry
    confirmation_deadline_days?: number;
    campaign_title?: string;
    // Denormalized fields
    crop_name?: string;
    task_category_name?: string;
    task_detail_name?: string;
    created_at?: string;

    // Legacy/Frontend helpers (optional)
    title?: string; // mapped from campaign_title or constructed
    current_price?: number;
}

export interface Booking {
    id: string;
    campaign_id: string;
    farmer_id?: string;
    farmer_name?: string;
    locked_price?: number;
    area_10r?: number;
    status?: string;
    work_status?: string;
    applied_at?: string;
    created_at?: string;
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
