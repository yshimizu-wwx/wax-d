-- ============================================
-- 募集締切（案件のクローズ）
-- ============================================
--
-- GAS版の Campaign.js - closeCampaign の完全移植
--
-- 機能:
-- 1. 申込合計面積を計算
-- 2. 逆オークション計算で確定単価を決定
-- 3. 案件ステータスを 'closed' に更新
-- 4. is_closed フラグを true に設定
--
-- 使用例:
-- SELECT close_campaign('...');

CREATE OR REPLACE FUNCTION close_campaign(
  p_campaign_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_campaign RECORD;
  v_total_area NUMERIC;
  v_final_unit_price NUMERIC;
  v_progress NUMERIC;
  v_result JSON;
BEGIN
  -- ============================================
  -- 1. 案件を取得
  -- ============================================
  SELECT * INTO v_campaign
  FROM campaigns
  WHERE id = p_campaign_id
  FOR UPDATE; -- 排他ロック

  IF NOT FOUND THEN
    RAISE EXCEPTION '案件が見つかりません（ID: %）', p_campaign_id;
  END IF;

  -- 既に締切済みの場合はスキップ
  IF v_campaign.is_closed THEN
    RETURN json_build_object(
      'success', true,
      'message', '既に締切済みです',
      'campaign_id', p_campaign_id
    );
  END IF;

  -- ============================================
  -- 2. 申込合計面積を計算
  -- ============================================
  SELECT COALESCE(SUM(area_10r), 0) INTO v_total_area
  FROM applications
  WHERE campaign_id = p_campaign_id
    AND status = 'confirmed';

  -- ============================================
  -- 3. 確定単価を計算（逆オークション）
  -- ============================================
  -- パターンA: 最低成立面積がある場合
  IF v_campaign.min_target_area_10r > 0
     AND v_campaign.max_target_area_10r > 0
     AND v_campaign.execution_price > 0 THEN

    -- 最低成立面積未達 → 不成立
    IF v_total_area < v_campaign.min_target_area_10r THEN
      v_final_unit_price := NULL;
      v_progress := v_total_area / v_campaign.min_target_area_10r;

      -- ステータスを 'unformed' に設定
      UPDATE campaigns
      SET
        status = 'unformed',
        is_closed = true,
        final_unit_price = NULL,
        updated_at = NOW()
      WHERE id = p_campaign_id;

      RETURN json_build_object(
        'success', true,
        'message', '最低成立面積未達のため不成立となりました',
        'campaign_id', p_campaign_id,
        'total_area', v_total_area,
        'min_target_area', v_campaign.min_target_area_10r,
        'progress', v_progress,
        'status', 'unformed'
      );
    END IF;

    -- 満額ライン達成
    IF v_total_area >= v_campaign.max_target_area_10r THEN
      v_final_unit_price := v_campaign.min_price;
      v_progress := 1.0;
    ELSE
      -- 最低成立〜満額ラインの間（線形変動）
      v_progress := (v_total_area - v_campaign.min_target_area_10r)
                    / (v_campaign.max_target_area_10r - v_campaign.min_target_area_10r);

      v_final_unit_price := v_campaign.execution_price
                            + (v_campaign.min_price - v_campaign.execution_price) * v_progress;
    END IF;

  ELSE
    -- パターンB: 従来の線形方式
    v_progress := LEAST(v_total_area / v_campaign.target_area_10r, 1.0);

    v_final_unit_price := v_campaign.base_price
                          - (v_campaign.base_price - v_campaign.min_price) * v_progress;
  END IF;

  -- 小数点以下を四捨五入
  v_final_unit_price := ROUND(v_final_unit_price);

  -- ============================================
  -- 4. 案件を更新
  -- ============================================
  UPDATE campaigns
  SET
    status = 'closed',
    is_closed = true,
    final_unit_price = v_final_unit_price,
    updated_at = NOW()
  WHERE id = p_campaign_id;

  -- ============================================
  -- 5. 結果を返す
  -- ============================================
  v_result := json_build_object(
    'success', true,
    'message', '募集を締め切りました',
    'campaign_id', p_campaign_id,
    'total_area', v_total_area,
    'final_unit_price', v_final_unit_price,
    'progress', v_progress,
    'status', 'closed'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 成立判定ジョブ（定期実行用）
-- ============================================
--
-- 成立判定日（final_decision_date）を過ぎた案件を自動で不成立にする
-- Supabase の pg_cron 拡張で毎日実行する想定
--
-- 使用例（pg_cronで毎日1回実行）:
-- SELECT cron.schedule(
--   'check-formation',
--   '0 1 * * *', -- 毎日午前1時
--   $$ SELECT run_formation_check_job(); $$
-- );

CREATE OR REPLACE FUNCTION run_formation_check_job()
RETURNS JSON AS $$
DECLARE
  v_campaign RECORD;
  v_total_area NUMERIC;
  v_unformed_count INTEGER := 0;
  v_result JSON;
BEGIN
  -- 成立判定日を過ぎた案件を取得
  FOR v_campaign IN
    SELECT *
    FROM campaigns
    WHERE final_decision_date <= CURRENT_DATE
      AND status IN ('open', 'applied')
      AND is_closed = false
      AND min_target_area_10r > 0
  LOOP
    -- 申込合計面積を計算
    SELECT COALESCE(SUM(area_10r), 0) INTO v_total_area
    FROM applications
    WHERE campaign_id = v_campaign.id
      AND status = 'confirmed';

    -- 最低成立面積未達 → 不成立
    IF v_total_area < v_campaign.min_target_area_10r THEN
      UPDATE campaigns
      SET
        status = 'unformed',
        is_closed = true,
        final_unit_price = NULL,
        updated_at = NOW()
      WHERE id = v_campaign.id;

      v_unformed_count := v_unformed_count + 1;

      -- TODO: 申込者にメール通知（不成立のお知らせ）
      -- PERFORM send_unformed_notification(v_campaign.id);
    END IF;
  END LOOP;

  v_result := json_build_object(
    'success', true,
    'message', '成立判定ジョブが完了しました',
    'unformed_count', v_unformed_count,
    'executed_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 確定作業日の期日チェック（定期実行用）
-- ============================================
--
-- 開始日の○日前（confirmation_deadline_days）になっても
-- 最低成立面積未達の案件を不成立にする
--
-- 使用例（pg_cronで毎日実行）:
-- SELECT cron.schedule(
--   'check-confirmation-deadline',
--   '0 2 * * *', -- 毎日午前2時
--   $$ SELECT run_confirmation_deadline_check(); $$
-- );

CREATE OR REPLACE FUNCTION run_confirmation_deadline_check()
RETURNS JSON AS $$
DECLARE
  v_campaign RECORD;
  v_total_area NUMERIC;
  v_unformed_count INTEGER := 0;
  v_deadline_date DATE;
  v_result JSON;
BEGIN
  FOR v_campaign IN
    SELECT *
    FROM campaigns
    WHERE status IN ('open', 'applied')
      AND is_closed = false
      AND min_target_area_10r > 0
      AND confirmation_deadline_days > 0
      AND start_date IS NOT NULL
  LOOP
    -- 作業日確定の期日を計算
    v_deadline_date := v_campaign.start_date - v_campaign.confirmation_deadline_days;

    -- 期日を過ぎているか確認
    IF CURRENT_DATE >= v_deadline_date THEN
      -- 申込合計面積を計算
      SELECT COALESCE(SUM(area_10r), 0) INTO v_total_area
      FROM applications
      WHERE campaign_id = v_campaign.id
        AND status = 'confirmed';

      -- 最低成立面積未達 → 不成立
      IF v_total_area < v_campaign.min_target_area_10r THEN
        UPDATE campaigns
        SET
          status = 'unformed',
          is_closed = true,
          final_unit_price = NULL,
          updated_at = NOW()
        WHERE id = v_campaign.id;

        v_unformed_count := v_unformed_count + 1;

        -- TODO: 申込者にメール通知
        -- PERFORM send_unformed_notification(v_campaign.id);
      END IF;
    END IF;
  END LOOP;

  v_result := json_build_object(
    'success', true,
    'message', '確定期日チェックが完了しました',
    'unformed_count', v_unformed_count,
    'executed_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- コメント
-- ============================================
COMMENT ON FUNCTION close_campaign IS
'募集締切 - 申込合計面積から確定単価を計算し、案件をクローズする。';

COMMENT ON FUNCTION run_formation_check_job IS
'成立判定ジョブ - 成立判定日を過ぎた案件を自動で不成立にする。';

COMMENT ON FUNCTION run_confirmation_deadline_check IS
'確定期日チェック - 作業日確定の期日を過ぎた案件を不成立にする。';
