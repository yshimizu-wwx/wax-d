-- Enable PostGIS extension for geometry types
create extension if not exists postgis;

-- 1. Users Table (needed for Foreign Keys)
-- Based on 'users' sheet
create table users (
  id text primary key, -- GAS IDs are strings (e.g., 'F_12345'), keeping text for compatibility
  email text unique,
  role text check (role in ('admin', 'provider', 'farmer')),
  name text,
  phone text,
  status text, -- 'active', 'pending', etc.
  address text,
  associated_provider_id text, -- Self-reference or logical ID, can be FK to users(id) if strict
  commission_rate numeric,
  invitation_code text,
  lat double precision,
  lng double precision,
  created_at timestamp with time zone default now()
);

-- 2. Fields Table (needed for Bookings FK)
-- Based on 'fields' sheet
create table fields (
  id text primary key,
  farmer_id text references users(id),
  name text,
  address text,
  map_url text,
  area_size numeric, -- in 10a (反) or sqm? Config says 'area_size', usually GAS uses 10a or sqm implies specific unit. Keeping numeric.
  lat double precision,
  lng double precision,
  place_id text,
  area_coordinates geometry(MultiPolygon, 4326), -- PostGIS geometry for polygon data
  created_at timestamp with time zone default now()
);

-- 3. Projects Table (Campaigns)
-- Based on 'campaigns' sheet
create table projects (
  id text primary key,
  provider_id text references users(id),
  start_date date,
  end_date date,
  final_date date, -- Confirmed work date
  location text,   -- Textual location name
  base_price numeric,
  min_price numeric,
  target_area_10r numeric, -- Target area in 10a
  status text check (status in ('open', 'closed', 'completed', 'archived', 'unformed', 'applied')),
  map_url text,
  target_crop_id text, -- ID from masters, keeping text
  task_category_id text,
  task_detail_id text,
  is_closed boolean default false,
  final_unit_price numeric,
  pesticide text,
  notes text,
  billing_id text,
  final_decision_date date,
  min_target_area_10r numeric,
  max_target_area_10r numeric,
  execution_price numeric,
  pesticide_name text,
  dilution_rate text,
  amount_per_10r text,
  target_area_polygon geometry(MultiPolygon, 4326), -- PostGIS geometry
  confirmation_deadline_days integer,
  campaign_title text,
  -- Denormalized fields often used in GAS
  crop_name text,
  task_category_name text,
  task_detail_name text,
  created_at timestamp with time zone default now()
);

-- 4. Bookings Table (Applications)
-- Based on 'applications' sheet
create table bookings (
  id text primary key,
  campaign_id text references projects(id) on delete cascade,
  farmer_id text references users(id),
  area_10r numeric, -- Applied area in 10a
  applied_at timestamp with time zone,
  status text, -- 'pending', 'canceled', etc.
  actual_area_10r numeric,
  work_status text check (work_status in ('pending', 'completed')),
  final_amount numeric,
  evidence_image_url text,
  preferred_dates text, -- Stored as string in GAS?
  confirmed_date date,
  field_id text references fields(id),
  invoice_status text check (invoice_status in ('unbilled', 'sent', 'processed', 'invoiced')),
  created_at timestamp with time zone default now()
);

-- Masters (GAS masters sheet: crop, task_category, task_detail, pesticide)
create table masters (
  id text primary key,
  provider_id text references users(id),
  type text check (type in ('crop', 'task_category', 'task_detail', 'pesticide')),
  name text not null,
  parent_id text,
  status text check (status in ('active', 'inactive')) default 'active',
  created_at timestamp with time zone default now()
);
create index idx_masters_provider on masters(provider_id);
create index idx_masters_type on masters(type);
create index idx_masters_status on masters(status);

-- Farmer-Provider link table (for invitation / association)
create table farmer_providers (
  farmer_id text references users(id),
  provider_id text references users(id),
  status text check (status in ('active', 'inactive')) default 'active',
  created_at timestamp with time zone default now(),
  primary key (farmer_id, provider_id)
);
create index idx_farmer_providers_farmer on farmer_providers(farmer_id);
create index idx_farmer_providers_provider on farmer_providers(provider_id);

-- 5. work_reports (作業実績報告) - WorkReport.js
create table work_reports (
  id text primary key,
  application_id text references bookings(id),
  campaign_id text references projects(id),
  dilution_rate_actual text,
  amount_actual_per_10r text,
  photo_urls_json text,
  reported_at timestamp with time zone default now(),
  reporter_id text references users(id),
  gps_lat double precision,
  gps_lng double precision,
  reported_at_iso text,
  campaign_snapshot_json text,
  application_snapshot_json text
);
create index idx_work_reports_campaign on work_reports(campaign_id);
create index idx_work_reports_application on work_reports(application_id);

-- 6. routes (作業ルート最適化) - Application.js optimizeRouteForCampaign
create table routes (
  id text primary key,
  campaign_id text references projects(id),
  provider_id text references users(id),
  work_date date,
  route_order integer,
  application_id text references bookings(id),
  field_id text references fields(id),
  estimated_arrival_time text,
  estimated_work_duration integer,
  estimated_departure_time text,
  created_at timestamp with time zone default now()
);
create index idx_routes_campaign_date on routes(campaign_id, work_date);

-- Indexes for performance
create index idx_projects_provider_id on projects(provider_id);
create index idx_projects_status on projects(status);
create index idx_bookings_campaign_id on bookings(campaign_id);
create index idx_bookings_farmer_id on bookings(farmer_id);
create index idx_bookings_work_status on bookings(work_status);
create index idx_fields_farmer_id on fields(farmer_id);

-- Spatial indexes
create index idx_projects_polygon on projects using gist(target_area_polygon);
create index idx_fields_polygon on fields using gist(area_coordinates);
