-- bookings に希望作業日（開始・終了）カラムを追加（農家申し込みで使用）
-- スキーマキャッシュエラー "Could not find the 'desired_end_date' column of 'bookings'" を解消

alter table public.bookings
  add column if not exists desired_start_date date,
  add column if not exists desired_end_date date;

comment on column public.bookings.desired_start_date is '農家が申し込み時に指定した希望作業開始日';
comment on column public.bookings.desired_end_date is '農家が申し込み時に指定した希望作業終了日';
