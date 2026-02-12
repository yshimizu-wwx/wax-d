/**
 * Booking service unit tests.
 * Focus: validateApplicationArea (area limits) used in createBooking.
 * Supabase is fully mocked; no real DB.
 */

import { describe, test, expect } from 'vitest';
import { createBooking } from './booking.service';
import { createMockSupabase } from './test-utils/mockSupabase';

const CAMPAIGN_ID = 'C_test_001';

const baseBookingInput = {
  campaign_id: CAMPAIGN_ID,
  farmer_id: null as string | null,
  farmer_name: 'テスト農家',
  phone: '090-0000-0000',
  email: 'farmer@example.com',
  desired_start_date: '2025-03-01',
  desired_end_date: '2025-03-31',
  field_polygon: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [139.5, 35.5],
        [139.6, 35.5],
        [139.6, 35.6],
        [139.5, 35.6],
        [139.5, 35.5],
      ],
    ],
  },
  area_10r: 10,
  locked_price: 17000,
};

describe('Booking Service', () => {
  describe('createBooking - validateApplicationArea (area limits)', () => {
    test('残り面積内の申込面積なら成功する', async () => {
      const currentTotal = 40;
      const maxArea = 50;
      const requestedArea = 10;

      const supabase = createMockSupabase({
        projectSelect: {
          data: {
            id: CAMPAIGN_ID,
            is_closed: false,
            status: 'open',
            end_date: null as string | null,
            max_target_area_10r: maxArea,
            target_area_10r: 50,
          },
          error: null,
        },
        bookingsSelect: {
          data: [{ area_10r: currentTotal }],
          error: null,
        },
        bookingInsert: { data: { id: 'BK_new_001' }, error: null },
      });

      const result = await createBooking(supabase, {
        ...baseBookingInput,
        area_10r: requestedArea,
      });

      expect(result.success).toBe(true);
      expect(result.bookingId).toBeDefined();
    });

    test('残り面積ちょうどの申込も成功する', async () => {
      const currentTotal = 40;
      const maxArea = 50;
      const requestedArea = 10;

      const supabase = createMockSupabase({
        projectSelect: {
          data: {
            id: CAMPAIGN_ID,
            is_closed: false,
            status: 'open',
            end_date: null as string | null,
            max_target_area_10r: maxArea,
            target_area_10r: 50,
          },
          error: null,
        },
        bookingsSelect: {
          data: [{ area_10r: currentTotal }],
          error: null,
        },
        bookingInsert: { data: { id: 'BK_new_002' }, error: null },
      });

      const result = await createBooking(supabase, {
        ...baseBookingInput,
        area_10r: requestedArea,
      });

      expect(result.success).toBe(true);
    });

    test('申込面積が残り面積を超えるとエラー（上限超過）', async () => {
      const currentTotal = 40;
      const maxArea = 50;
      const requestedArea = 20;

      const supabase = createMockSupabase({
        projectSelect: {
          data: {
            id: CAMPAIGN_ID,
            is_closed: false,
            status: 'open',
            end_date: null as string | null,
            max_target_area_10r: maxArea,
            target_area_10r: 50,
          },
          error: null,
        },
        bookingsSelect: {
          data: [{ area_10r: currentTotal }],
          error: null,
        },
      });

      const result = await createBooking(supabase, {
        ...baseBookingInput,
        area_10r: requestedArea,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/上限|残り|予約可能/);
    });

    test('申込面積が0の場合はエラー（1反以上必要）', async () => {
      const supabase = createMockSupabase({
        projectSelect: {
          data: {
            id: CAMPAIGN_ID,
            is_closed: false,
            status: 'open',
            end_date: null as string | null,
            max_target_area_10r: 50,
            target_area_10r: 50,
          },
          error: null,
        },
        bookingsSelect: { data: [], error: null },
      });

      const result = await createBooking(supabase, {
        ...baseBookingInput,
        area_10r: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/1反以上|面積/);
    });

    test('max_target_area_10r が未設定の場合は target_area_10r を上限として検証する', async () => {
      const currentTotal = 25;
      const targetArea = 50;
      const requestedArea = 25;

      const supabase = createMockSupabase({
        projectSelect: {
          data: {
            id: CAMPAIGN_ID,
            is_closed: false,
            status: 'open',
            end_date: null as string | null,
            max_target_area_10r: null,
            target_area_10r: targetArea,
          },
          error: null,
        },
        bookingsSelect: {
          data: [{ area_10r: currentTotal }],
          error: null,
        },
        bookingInsert: { data: { id: 'BK_new_003' }, error: null },
      });

      const result = await createBooking(supabase, {
        ...baseBookingInput,
        area_10r: requestedArea,
      });

      expect(result.success).toBe(true);
    });

    test('募集終了案件には申込不可', async () => {
      const supabase = createMockSupabase({
        projectSelect: {
          data: {
            id: CAMPAIGN_ID,
            is_closed: true,
            status: 'closed',
            end_date: '2025-12-31',
            max_target_area_10r: 50,
            target_area_10r: 50,
          },
          error: null,
        },
      });

      const result = await createBooking(supabase, baseBookingInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('募集終了');
    });
  });
});
