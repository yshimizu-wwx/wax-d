/**
 * Campaign service unit tests.
 * Focus: reverse auction price calculation in closeCampaign (start/end price interpolation).
 * Supabase is fully mocked; no real DB.
 */

import { describe, test, expect } from 'vitest';
import { closeCampaign } from './campaign.service';
import { createMockSupabase } from './test-utils/mockSupabase';
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';

const CAMPAIGN_ID = 'C_test_123';

describe('Campaign Service', () => {
  describe('closeCampaign - Reverse Auction price calculation', () => {
    test('線形方式: 目標面積50%で中間単価が final_unit_price に反映される', async () => {
      const project = {
        id: CAMPAIGN_ID,
        base_price: 20000,
        min_price: 15000,
        target_area_10r: 50,
        min_target_area_10r: null,
        max_target_area_10r: null,
        execution_price: null,
      };
      const totalArea = 25; // 50% of target
      let capturedProjectUpdate: Record<string, unknown> | null = null;

      const supabase = createMockSupabase({
        projectSelect: { data: project, error: null },
        bookingsSelect: { data: [{ area_10r: totalArea }], error: null },
        projectUpdate: { error: null },
        bookingsUpdate: { error: null },
        onProjectUpdate: (p) => {
          capturedProjectUpdate = p as Record<string, unknown>;
        },
      });

      const result = await closeCampaign(supabase, CAMPAIGN_ID);

      expect(result.success).toBe(true);

      const expected = calculateCurrentUnitPrice(
        {
          base_price: 20000,
          min_price: 15000,
          target_area_10r: 50,
        },
        totalArea
      );
      const expectedPrice =
        expected.currentPrice ?? project.min_price ?? project.base_price ?? 0;
      expect(capturedProjectUpdate).not.toBeNull();
      expect(capturedProjectUpdate!.final_unit_price).toBe(expectedPrice);
      // 線形: 25/50 = 0.5 → 20000 - (20000-15000)*0.5 = 17500
      expect(capturedProjectUpdate!.final_unit_price).toBe(17500);
    });

    test('線形方式: 目標面積0で開始単価が final_unit_price に反映される', async () => {
      const project = {
        id: CAMPAIGN_ID,
        base_price: 20000,
        min_price: 15000,
        target_area_10r: 50,
        min_target_area_10r: null,
        max_target_area_10r: null,
        execution_price: null,
      };
      let capturedProjectUpdate: Record<string, unknown> | null = null;

      const supabase = createMockSupabase({
        projectSelect: { data: project, error: null },
        bookingsSelect: { data: [], error: null },
        projectUpdate: { error: null },
        bookingsUpdate: { error: null },
        onProjectUpdate: (p) => {
          capturedProjectUpdate = p as Record<string, unknown>;
        },
      });

      await closeCampaign(supabase, CAMPAIGN_ID);

      expect(capturedProjectUpdate!.final_unit_price).toBe(20000);
    });

    test('線形方式: 目標面積100%で最低単価が final_unit_price に反映される', async () => {
      const project = {
        id: CAMPAIGN_ID,
        base_price: 20000,
        min_price: 15000,
        target_area_10r: 50,
        min_target_area_10r: null,
        max_target_area_10r: null,
        execution_price: null,
      };
      let capturedProjectUpdate: Record<string, unknown> | null = null;

      const supabase = createMockSupabase({
        projectSelect: { data: project, error: null },
        bookingsSelect: { data: [{ area_10r: 50 }], error: null },
        projectUpdate: { error: null },
        bookingsUpdate: { error: null },
        onProjectUpdate: (p) => {
          capturedProjectUpdate = p as Record<string, unknown>;
        },
      });

      await closeCampaign(supabase, CAMPAIGN_ID);

      expect(capturedProjectUpdate!.final_unit_price).toBe(15000);
    });

    test('パターンA（最低成立面積）: 最低成立〜満額の中間で線形補間された単価が final_unit_price に反映される', async () => {
      const project = {
        id: CAMPAIGN_ID,
        base_price: 20000,
        min_price: 15000,
        target_area_10r: 50,
        min_target_area_10r: 30,
        max_target_area_10r: 50,
        execution_price: 18000,
      };
      const totalArea = 40; // 30〜50 の中間
      let capturedProjectUpdate: Record<string, unknown> | null = null;

      const supabase = createMockSupabase({
        projectSelect: { data: project, error: null },
        bookingsSelect: { data: [{ area_10r: 40 }], error: null },
        projectUpdate: { error: null },
        bookingsUpdate: { error: null },
        onProjectUpdate: (p) => {
          capturedProjectUpdate = p as Record<string, unknown>;
        },
      });

      const result = await closeCampaign(supabase, CAMPAIGN_ID);

      expect(result.success).toBe(true);

      const expected = calculateCurrentUnitPrice(
        {
          base_price: 20000,
          min_price: 15000,
          target_area_10r: 50,
          min_target_area_10r: 30,
          max_target_area_10r: 50,
          execution_price: 18000,
        },
        totalArea
      );
      const expectedPrice =
        expected.currentPrice ?? project.min_price ?? project.base_price ?? 0;
      expect(capturedProjectUpdate!.final_unit_price).toBe(expectedPrice);
      // execution_price + (min_price - execution_price) * progress, progress = (40-30)/(50-30) = 0.5
      // 18000 + (15000 - 18000) * 0.5 = 16500
      expect(capturedProjectUpdate!.final_unit_price).toBe(16500);
    });

    test('パターンA: 満額ライン達成で min_price が final_unit_price に反映される', async () => {
      const project = {
        id: CAMPAIGN_ID,
        base_price: 20000,
        min_price: 15000,
        target_area_10r: 50,
        min_target_area_10r: 30,
        max_target_area_10r: 50,
        execution_price: 18000,
      };
      let capturedProjectUpdate: Record<string, unknown> | null = null;

      const supabase = createMockSupabase({
        projectSelect: { data: project, error: null },
        bookingsSelect: { data: [{ area_10r: 50 }], error: null },
        projectUpdate: { error: null },
        bookingsUpdate: { error: null },
        onProjectUpdate: (p) => {
          capturedProjectUpdate = p as Record<string, unknown>;
        },
      });

      await closeCampaign(supabase, CAMPAIGN_ID);

      expect(capturedProjectUpdate!.final_unit_price).toBe(15000);
    });

    test('closeCampaign で bookings の locked_price が同じ final_unit_price で更新される', async () => {
      const project = {
        id: CAMPAIGN_ID,
        base_price: 20000,
        min_price: 15000,
        target_area_10r: 50,
        min_target_area_10r: null,
        max_target_area_10r: null,
        execution_price: null,
      };
      let capturedBookingsUpdate: Record<string, unknown> | null = null;

      const supabase = createMockSupabase({
        projectSelect: { data: project, error: null },
        bookingsSelect: { data: [{ area_10r: 25 }], error: null },
        projectUpdate: { error: null },
        bookingsUpdate: { error: null },
        onBookingsUpdate: (p) => {
          capturedBookingsUpdate = p as Record<string, unknown>;
        },
      });

      await closeCampaign(supabase, CAMPAIGN_ID);

      expect(capturedBookingsUpdate!.locked_price).toBe(17500);
    });

    test('案件が見つからない場合は success: false', async () => {
      const supabase = createMockSupabase({
        projectSelect: { data: null, error: { message: 'Not found' } },
      });

      const result = await closeCampaign(supabase, CAMPAIGN_ID);

      expect(result.success).toBe(false);
      expect(result.error).toContain('案件が見つかりません');
    });
  });
});
