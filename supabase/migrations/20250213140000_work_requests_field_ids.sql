-- Issue #16: 作業依頼に複数圃場を紐付け可能にする
-- field_ids: 選択した圃場（fields.id）の配列。合計面積は estimated_area_10r に保存
ALTER TABLE public.work_requests
  ADD COLUMN IF NOT EXISTS field_ids text[] DEFAULT '{}';

COMMENT ON COLUMN public.work_requests.field_ids IS '依頼対象の圃場ID一覧（複数選択可）';
