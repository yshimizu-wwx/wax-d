/**
 * Report service unit tests.
 * Focus: calculateFinalAmount flow (unitPrice * actualArea10r, Math.round).
 * GAS spec: finalAmount = Math.round(unitPrice * actualArea10r).
 * Supabase is fully mocked; no real DB.
 */

import { describe, test, expect } from 'vitest';
import { submitWorkReport } from './report.service';
import { createMockSupabase } from './test-utils/mockSupabase';

const BOOKING_ID = 'BK_test_001';
const CAMPAIGN_ID = 'C_test_001';
const PROVIDER_ID = 'provider_001';

describe('Report Service', () => {
  describe('submitWorkReport - calculateFinalAmount (unitPrice * actualArea10r)', () => {
    test('確定金額が unitPrice * actualArea10r の四捨五入と一致する', async () => {
      const unitPrice = 15000;
      const actualArea10r = 5;

      const supabase = createMockSupabase({
        bookingSingle: {
          data: {
            id: BOOKING_ID,
            campaign_id: CAMPAIGN_ID,
            farmer_id: 'farmer_001',
            area_10r: 10,
          },
          error: null,
        },
        projectSelect: {
          data: {
            id: CAMPAIGN_ID,
            provider_id: PROVIDER_ID,
            final_unit_price: unitPrice,
            base_price: 20000,
            dilution_rate: null,
            amount_per_10r: null,
          },
          error: null,
        },
        workReportsSelect: { data: null, error: null },
        bookingsUpdate: { error: null },
        workReportsInsert: { error: null },
      });

      const result = await submitWorkReport(
        supabase,
        { bookingId: BOOKING_ID, actualArea10r },
        PROVIDER_ID
      );

      expect(result.success).toBe(true);
      expect(result.finalAmount).toBe(Math.round(unitPrice * actualArea10r));
      expect(result.finalAmount).toBe(75000);
    });

    test('final_unit_price が null の場合は base_price で計算する', async () => {
      const basePrice = 18000;
      const actualArea10r = 3;

      const supabase = createMockSupabase({
        bookingSingle: {
          data: {
            id: BOOKING_ID,
            campaign_id: CAMPAIGN_ID,
            farmer_id: 'farmer_001',
            area_10r: 5,
          },
          error: null,
        },
        projectSelect: {
          data: {
            id: CAMPAIGN_ID,
            provider_id: PROVIDER_ID,
            final_unit_price: null,
            base_price: basePrice,
            dilution_rate: null,
            amount_per_10r: null,
          },
          error: null,
        },
        workReportsSelect: { data: null, error: null },
        bookingsUpdate: { error: null },
        workReportsInsert: { error: null },
      });

      const result = await submitWorkReport(
        supabase,
        { bookingId: BOOKING_ID, actualArea10r },
        PROVIDER_ID
      );

      expect(result.success).toBe(true);
      expect(result.finalAmount).toBe(Math.round(basePrice * actualArea10r));
      expect(result.finalAmount).toBe(54000);
    });

    test('端数: unitPrice * actualArea10r が小数のとき Math.round で四捨五入される', async () => {
      const unitPrice = 15000.4;
      const actualArea10r = 5.6;
      const expectedAmount = Math.round(unitPrice * actualArea10r); // 84002.24 -> 84002

      const supabase = createMockSupabase({
        bookingSingle: {
          data: {
            id: BOOKING_ID,
            campaign_id: CAMPAIGN_ID,
            farmer_id: 'farmer_001',
            area_10r: 10,
          },
          error: null,
        },
        projectSelect: {
          data: {
            id: CAMPAIGN_ID,
            provider_id: PROVIDER_ID,
            final_unit_price: unitPrice,
            base_price: 20000,
            dilution_rate: null,
            amount_per_10r: null,
          },
          error: null,
        },
        workReportsSelect: { data: null, error: null },
        bookingsUpdate: { error: null },
        workReportsInsert: { error: null },
      });

      const result = await submitWorkReport(
        supabase,
        { bookingId: BOOKING_ID, actualArea10r },
        PROVIDER_ID
      );

      expect(result.success).toBe(true);
      expect(result.finalAmount).toBe(expectedAmount);
      expect(result.finalAmount).toBe(84002);
    });

    test('実績面積0の場合、確定金額は0', async () => {
      const supabase = createMockSupabase({
        bookingSingle: {
          data: {
            id: BOOKING_ID,
            campaign_id: CAMPAIGN_ID,
            farmer_id: 'farmer_001',
            area_10r: 5,
          },
          error: null,
        },
        projectSelect: {
          data: {
            id: CAMPAIGN_ID,
            provider_id: PROVIDER_ID,
            final_unit_price: 15000,
            base_price: 20000,
            dilution_rate: null,
            amount_per_10r: null,
          },
          error: null,
        },
        workReportsSelect: { data: null, error: null },
        bookingsUpdate: { error: null },
        workReportsInsert: { error: null },
      });

      const result = await submitWorkReport(
        supabase,
        { bookingId: BOOKING_ID, actualArea10r: 0 },
        PROVIDER_ID
      );

      expect(result.success).toBe(true);
      expect(result.finalAmount).toBe(0);
    });

    test('申込IDなし・実績面積不正の場合は success: false', async () => {
      const supabase = createMockSupabase({});

      const noBooking = await submitWorkReport(
        supabase,
        { bookingId: '', actualArea10r: 5 },
        PROVIDER_ID
      );
      expect(noBooking.success).toBe(false);
      expect(noBooking.message).toContain('申込IDと実績面積は必須');

      const negativeArea = await submitWorkReport(
        supabase,
        { bookingId: BOOKING_ID, actualArea10r: -1 },
        PROVIDER_ID
      );
      expect(negativeArea.success).toBe(false);
    });

    test('既に実績報告済みの申込は重複報告不可', async () => {
      const supabase = createMockSupabase({
        bookingSingle: {
          data: {
            id: BOOKING_ID,
            campaign_id: CAMPAIGN_ID,
            farmer_id: 'farmer_001',
            area_10r: 5,
          },
          error: null,
        },
        projectSelect: {
          data: {
            id: CAMPAIGN_ID,
            provider_id: PROVIDER_ID,
            final_unit_price: 15000,
            base_price: 20000,
            dilution_rate: null,
            amount_per_10r: null,
          },
          error: null,
        },
        workReportsSelect: { data: { id: 'WRP_existing' }, error: null },
        bookingsUpdate: { error: null },
        workReportsInsert: { error: null },
      });

      const result = await submitWorkReport(
        supabase,
        { bookingId: BOOKING_ID, actualArea10r: 5 },
        PROVIDER_ID
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('既に実績報告済み');
    });
  });
});
