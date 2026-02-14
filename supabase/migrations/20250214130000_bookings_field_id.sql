-- bookings に field_id / field_polygon を追加（畑選択で申し込む場合に使用）
-- スキーマキャッシュエラー "Could not find the 'field_id' column of 'bookings'" を解消

alter table public.bookings
  add column if not exists field_id uuid references public.fields(id) on delete set null,
  add column if not exists field_polygon text;

comment on column public.bookings.field_id is '申し込み対象の畑（複数畑の場合は1申し込み1畑で複数行）';
comment on column public.bookings.field_polygon is '申し込み時の圃場範囲（WKT）。field_id がある場合は省略可';
