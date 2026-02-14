-- bookings.id を INSERT 時に省略した場合に DB で UUID を生成するようにする。
-- アプリから id を渡さずに申し込みできるようにする（invalid input syntax for type uuid 対策）。

alter table public.bookings
  alter column id set default gen_random_uuid();
