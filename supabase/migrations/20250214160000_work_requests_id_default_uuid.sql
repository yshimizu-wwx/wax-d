-- 作業依頼の id をアプリで渡さず DB の UUID デフォルトに任せる（invalid input syntax for type uuid 対策）
-- work_requests.id が uuid 型のため、WR_ 形式の文字列を渡していた従来実装を廃止する

alter table public.work_requests
  alter column id set default gen_random_uuid();
