/**
 * Supabase client mock for service unit tests.
 * No real DB or network; chainable API returning configurable results.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

type MockChain = {
  select: (columns?: string) => MockChain;
  eq: (column: string, value: unknown) => MockChain;
  neq: (column: string, value: unknown) => MockChain;
  order: (column: string, opts?: { ascending: boolean }) => MockChain;
  limit: (n: number) => MockChain;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
  in: (column: string, values: unknown[]) => MockChain;
  insert: (payload: unknown) => MockChain;
  update: (payload: unknown) => MockChain;
  then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown) => Promise<unknown>;
};

function createChain(result: { data: unknown; error: unknown }): MockChain {
  const chain: MockChain = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    in: () => chain,
    insert: () => chain,
    update: () => chain,
    then: (fn) => Promise.resolve(result).then(fn as (v: unknown) => unknown),
  };
  return chain;
}

export interface MockSupabaseConfig {
  projectSelect?: { data: unknown; error: unknown };
  /** Used for from('bookings').select().eq().neq() (e.g. total area) */
  bookingsSelect?: { data: Array<{ area_10r?: number }>; error: unknown };
  /** Used for from('bookings').select().eq('id', id).single() */
  bookingSingle?: { data: unknown; error: unknown };
  projectUpdate?: { error: unknown };
  bookingsUpdate?: { error: unknown };
  workReportsSelect?: { data: unknown; error: unknown };
  workReportsInsert?: { error: unknown };
  storageUpload?: { error: unknown };
  /** Used for from('bookings').insert().select('id').single() */
  bookingInsert?: { data: { id: string }; error: unknown };
  /** Optional: capture project update payload for assertions */
  onProjectUpdate?: (payload: unknown) => void;
  onBookingsUpdate?: (payload: unknown) => void;
}

export function createMockSupabase(config: MockSupabaseConfig = {}): SupabaseClient {
  const from = (table: string) => {
    if (table === 'projects') {
      const chain = createChain(config.projectSelect ?? { data: null, error: null });
      return {
        ...chain,
        update: (payload: unknown) => {
          config.onProjectUpdate?.(payload);
          const r = config.projectUpdate;
          return {
            eq: () => createChain(r ? { data: null, error: r.error } : { data: null, error: null }),
          };
        },
      };
    }
    if (table === 'bookings') {
      const arrayChain = createChain(config.bookingsSelect ?? { data: [], error: null });
      const singleResult = config.bookingSingle ?? { data: null, error: null };
      const chainWithSingle = {
        ...arrayChain,
        single: () => Promise.resolve(singleResult),
        neq: () => arrayChain,
      };
      return {
        ...chainWithSingle,
        update: (payload: unknown) => {
          config.onBookingsUpdate?.(payload);
          const r = config.bookingsUpdate;
          return {
            eq: () => ({
              neq: () => createChain(r ? { data: null, error: r.error } : { data: null, error: null }),
            }),
          };
        },
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve(config.bookingInsert ?? { data: { id: 'BK_mock' }, error: null }),
          }),
        }),
      };
    }
    if (table === 'work_reports') {
      const chain = createChain(config.workReportsSelect ?? { data: null, error: null });
      const r = config.workReportsInsert;
      return {
        ...chain,
        insert: () => createChain(r ? { data: null, error: r.error } : { data: null, error: null }),
      };
    }
    return createChain({ data: null, error: null });
  };

  const storage = {
    from: () => ({
      upload: () => Promise.resolve({ error: config.storageUpload?.error ?? null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://mock.example/evidence/url' } }),
    }),
  };

  return {
    from,
    storage,
    auth: {} as SupabaseClient['auth'],
    rest: {} as SupabaseClient['rest'],
    realtime: {} as SupabaseClient['realtime'],
    rpc: () => ({ then: (fn: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(fn) }),
    remove: () => createChain({ data: null, error: null }),
    schema: () => ({} as SupabaseClient['schema']),
  } as unknown as SupabaseClient;
}
