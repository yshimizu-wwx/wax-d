const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * ISO日付 (yyyy-MM-dd) を yyyy/mm/dd 表示用に変換する。入力欄の value に使う。
 */
export function isoToYyyyMmDd(iso: string): string {
  if (!iso || iso.length < 10) return '';
  const part = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) return iso;
  return part.replace(/-/g, '/');
}

/**
 * yyyy/mm/dd または yyyymmdd を ISO (yyyy-MM-dd) に変換する。不正な場合は '' を返す。
 */
export function yyyyMmDdToIso(text: string): string {
  const t = text.trim().replace(/\s/g, '');
  if (!t) return '';
  const slash = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slash) {
    const [, y, m, d] = slash;
    const mm = m.padStart(2, '0');
    const dd = d.padStart(2, '0');
    const iso = `${y}-${mm}-${dd}`;
    const date = new Date(iso + 'T00:00:00');
    if (!Number.isNaN(date.getTime()) && date.getFullYear() === Number(y)) return iso;
  }
  const hyphen = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (hyphen) {
    const [, y, m, d] = hyphen;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const compact = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const [, y, m, d] = compact;
    return `${y}-${m}-${d}`;
  }
  return '';
}

/**
 * 期間フィルター用のデフォルト値（今日 ～ 1か月後）を yyyy-MM-dd で返す。ローカル日付を使用。
 */
export function getDefaultPeriod(): { from: string; to: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const from = `${y}-${m}-${d}`;
  const next = new Date(today);
  next.setMonth(next.getMonth() + 1);
  const y2 = next.getFullYear();
  const m2 = String(next.getMonth() + 1).padStart(2, '0');
  const d2 = String(next.getDate()).padStart(2, '0');
  const to = `${y2}-${m2}-${d2}`;
  return { from, to };
}

/**
 * 日付を yyyy/mm/dd（曜日）形式で表示する。
 * @param value 日付文字列 (YYYY-MM-DD) または Date、null/undefined の場合は fallback を返す
 * @param fallback 値がないときに返す文字列（省略時は '—'）
 */
export function formatDateWithWeekday(
  value: string | Date | null | undefined,
  fallback: string = '—'
): string {
  if (value == null || value === '') return fallback;
  const d = typeof value === 'string' ? new Date(value.includes('T') ? value : value + 'T00:00:00') : value;
  if (Number.isNaN(d.getTime())) return fallback;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const w = WEEKDAY_JA[d.getDay()];
  return `${y}/${m}/${day}（${w}）`;
}

/**
 * 日時を yyyy/mm/dd（曜日） HH:mm 形式で表示する。
 */
export function formatDateTimeWithWeekday(
  value: string | Date | null | undefined,
  fallback: string = '—'
): string {
  if (value == null || value === '') return fallback;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return fallback;
  const datePart = formatDateWithWeekday(d, '');
  if (!datePart) return fallback;
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} ${h}:${min}`;
}
