-- fields.id を INSERT 時に省略した場合に DB で UUID を生成するようにする。
-- 既に DEFAULT がある場合は上書きされるだけなので冪等。
alter table public.fields
  alter column id set default gen_random_uuid();
