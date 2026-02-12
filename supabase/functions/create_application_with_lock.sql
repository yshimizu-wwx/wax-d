-- ============================================
-- 申込作成（排他制御付き）
-- ============================================
--
-- GAS版の Application.js:56 - submitApplication の完全移植
-- 参照: current_system_spec.md:360-435
--
-- 機能:
-- 1. 案件を行ロック（FOR UPDATE）で排他制御
-- 2. 募集終了・残り面積チェック
-- 3. 申込を作成
-- 4. 目標面積達成時に自動で募集締切
--
-- 使用例:
-- SELECT create_application_with_lock(
--   p_campaign_id := '...',
--   p_farmer_id := '...',
--   p_area_10r := 10.5,
--   p_field_id := '...',
--   p_preferred_dates := ARRAY['2026-03-01', '2026-03-02']
-- );

CREATE OR REPLACE FUNCTION create_application_with_lock(
  p_campaign_id UUID,
  p_farmer_id UUID,
  p_area_10r NUMERIC,
  p_field_id UUID DEFAULT NULL,
  p_preferred_dates TEXT[] DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_campaign RECORD;
  v_farmer RECORD;
  v_current_total NUMERIC;
  v_remaining NUMERIC;
  v_max_area NUMERIC;
  v_application_id UUID;
  v_is_provider_linked BOOLEAN;
  v_result JSON;
  v_should_close BOOLEAN := FALSE;
  v_new_total NUMERIC;
BEGIN
  -- ============================================
  -- 1. 案件を行ロック（FOR UPDATE）
  -- ============================================
  -- 他のトランザクションがこの案件の申込を同時に作成できないようにロック
  -- GAS版の LockService.getScriptLock() に相当
  SELECT * INTO v_campaign
  FROM campaigns
  WHERE id = p_campaign_id
  FOR UPDATE; -- 排他ロック

  -- 案件が存在しない場合
  IF NOT FOUND THEN
    RAISE EXCEPTION '案件が見つかりません（ID: %）', p_campaign_id;
  END IF;

  -- ============================================
  -- 2. ユーザー認証
  -- ============================================
  SELECT * INTO v_farmer
  FROM users
  WHERE id = p_farmer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ユーザーが見つかりません';
  END IF;

  -- 農家ロールのみ申込可能
  IF v_farmer.role != 'farmer' THEN
    RAISE EXCEPTION '農家ユーザーのみ申込可能です';
  END IF;

  -- ユーザーステータスがactiveか確認
  IF v_farmer.status != 'active' THEN
    RAISE EXCEPTION 'アカウントが有効ではありません（ステータス: %）', v_farmer.status;
  END IF;

  -- ============================================
  -- 3. 業者-農家の紐付けチェック
  -- ============================================
  SELECT EXISTS (
    SELECT 1
    FROM farmer_providers
    WHERE farmer_id = p_farmer_id
      AND provider_id = v_campaign.provider_id
      AND status = 'active'
  ) INTO v_is_provider_linked;

  IF NOT v_is_provider_linked THEN
    RAISE EXCEPTION 'この案件の業者とまだ紐付けされていません。業者の招待コードで登録してください。';
  END IF;

  -- ============================================
  -- 4. 案件バリデーション
  -- ============================================
  -- 募集終了チェック（GAS版: isCampaignClosed）
  IF v_campaign.is_closed THEN
    RAISE EXCEPTION 'この案件の募集は終了しています';
  END IF;

  IF v_campaign.status IN ('closed', 'completed', 'unformed', 'archived') THEN
    RAISE EXCEPTION 'この案件は申し込みできません（ステータス: %）', v_campaign.status;
  END IF;

  -- 終了日チェック
  IF v_campaign.end_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'この案件の募集期間は終了しています';
  END IF;

  -- ============================================
  -- 5. 残り面積チェック
  -- ============================================
  -- 現在の申込合計を計算
  SELECT COALESCE(SUM(area_10r), 0) INTO v_current_total
  FROM applications
  WHERE campaign_id = p_campaign_id
    AND status = 'confirmed';

  -- 満額ライン（max_target_area_10r）または目標面積を上限とする
  v_max_area := COALESCE(
    NULLIF(v_campaign.max_target_area_10r, 0),
    NULLIF(v_campaign.target_area_10r, 0),
    999999 -- フォールバック（制限なし）
  );

  v_remaining := v_max_area - v_current_total;

  -- 残り面積を超える申込は拒否
  IF p_area_10r > v_remaining THEN
    RAISE EXCEPTION '申し込み面積が上限を超えています。残り % 反まで予約可能です。',
      ROUND(v_remaining, 1);
  END IF;

  -- 最低申込面積チェック（1反以上）
  IF p_area_10r < 1 THEN
    RAISE EXCEPTION '申込面積は1反以上である必要があります';
  END IF;

  -- ============================================
  -- 6. 畑（Field）のバリデーション
  -- ============================================
  IF p_field_id IS NOT NULL THEN
    -- 畑が存在し、申込者の所有であることを確認
    IF NOT EXISTS (
      SELECT 1 FROM fields
      WHERE id = p_field_id
        AND farmer_id = p_farmer_id
    ) THEN
      RAISE EXCEPTION '指定された畑が見つからないか、あなたの所有ではありません';
    END IF;
  END IF;

  -- ============================================
  -- 7. 申込を作成
  -- ============================================
  INSERT INTO applications (
    campaign_id,
    farmer_id,
    area_10r,
    field_id,
    preferred_dates,
    status,
    work_status,
    invoice_status,
    applied_at
  ) VALUES (
    p_campaign_id,
    p_farmer_id,
    p_area_10r,
    p_field_id,
    array_to_string(p_preferred_dates, ','),
    'confirmed',
    'pending',
    'unbilled',
    NOW()
  )
  RETURNING id INTO v_application_id;

  -- 新しい合計面積を計算
  v_new_total := v_current_total + p_area_10r;

  -- ============================================
  -- 8. 目標面積達成チェック（自動締切トリガー）
  -- ============================================
  -- パターンA: 最低成立面積がある場合
  IF v_campaign.min_target_area_10r > 0 THEN
    -- 最低成立面積達成 → 自動締切
    IF v_new_total >= v_campaign.min_target_area_10r
       AND v_current_total < v_campaign.min_target_area_10r THEN
      v_should_close := TRUE;
    END IF;

    -- 満額ライン達成 → 自動締切
    IF v_campaign.max_target_area_10r > 0
       AND v_new_total >= v_campaign.max_target_area_10r THEN
      v_should_close := TRUE;
    END IF;
  ELSE
    -- パターンB: 従来の線形方式
    -- 目標面積達成 → 自動締切
    IF v_new_total >= v_campaign.target_area_10r
       AND v_current_total < v_campaign.target_area_10r THEN
      v_should_close := TRUE;
    END IF;
  END IF;

  -- 自動締切を実行
  IF v_should_close THEN
    PERFORM close_campaign(p_campaign_id);
  END IF;

  -- ============================================
  -- 9. 結果を返す
  -- ============================================
  v_result := json_build_object(
    'success', true,
    'application_id', v_application_id,
    'campaign_id', p_campaign_id,
    'farmer_id', p_farmer_id,
    'area_10r', p_area_10r,
    'total_area', v_new_total,
    'remaining_area', v_max_area - v_new_total,
    'should_close', v_should_close,
    'created_at', NOW()
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- エラー時はトランザクションが自動でロールバックされる
    -- エラーメッセージをクライアントに返す
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- コメント
-- ============================================
COMMENT ON FUNCTION create_application_with_lock IS
'申込作成（排他制御付き）- GAS版のsubmitApplicationの完全移植。
案件を行ロックして、残り面積チェック・自動締切トリガーを実行する。';

-- ============================================
-- 使用例
-- ============================================
-- SELECT create_application_with_lock(
--   p_campaign_id := '123e4567-e89b-12d3-a456-426614174000',
--   p_farmer_id := '123e4567-e89b-12d3-a456-426614174001',
--   p_area_10r := 10.5,
--   p_field_id := '123e4567-e89b-12d3-a456-426614174002',
--   p_preferred_dates := ARRAY['2026-03-01', '2026-03-02', '2026-03-03']
-- );
