-- テスト用DBをクリーンな状態にリセットするための関数（#21）
-- service_role で RPC 呼び出しし、public スキーマの全テーブルを TRUNCATE する。
-- 本番ではこの RPC を呼ばないこと（テスト/開発専用）。

create or replace function public.reset_test_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- FK の子から親の順で truncate（CASCADE で参照先もクリア）
  truncate table public.work_reports restart identity cascade;
  truncate table public.routes restart identity cascade;
  truncate table public.bookings restart identity cascade;
  truncate table public.campaigns restart identity cascade;
  truncate table public.billings restart identity cascade;
  truncate table public.work_requests restart identity cascade;
  truncate table public.farmer_providers restart identity cascade;
  truncate table public.masters restart identity cascade;
  truncate table public.templates restart identity cascade;
  truncate table public.fields restart identity cascade;
  truncate table public.users restart identity cascade;
end;
$$;

comment on function public.reset_test_data() is 'Test only: truncates all public app tables. Use with service_role. (#21)';
