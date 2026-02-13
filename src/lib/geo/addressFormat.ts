/**
 * 表示用住所のフォーマット（クライアント・サーバー両方で利用可能）
 */

/** 表示用住所から末尾の「日本」「, Japan」などを除去する */
export function stripJapanFromDisplayAddress(addr: string | undefined | null): string {
  if (addr == null || !addr.trim()) return addr ?? '';
  return addr
    .replace(/,?\s*日本\s*$/i, '')
    .replace(/,?\s*Japan\s*$/i, '')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();
}
