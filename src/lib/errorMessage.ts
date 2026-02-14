/**
 * API・DB から返る技術的なエラーメッセージを、
 * ユーザー向けの日本語メッセージに変換する。
 * トースト等の UI にはこの変換後のみ表示し、生のエラーは console に留める。
 */

const FALLBACK = '入力内容に誤りがあります。もう一度お試しください。';

/**
 * 技術エラー文字列をユーザー向けメッセージにマッピングする。
 * マッチしなければ汎用メッセージを返す（生の SQL 等は返さない）。
 */
export function toUserFriendlyError(raw: string): string {
  if (!raw || typeof raw !== 'string') return FALLBACK;
  const lower = raw.toLowerCase();

  // UUID 型エラー（畑登録など）
  if (lower.includes('invalid input syntax for type uuid') || lower.includes('uuid')) {
    return FALLBACK;
  }

  // 権限・RLS
  if (
    lower.includes('permission') ||
    lower.includes('denied') ||
    lower.includes('pgrst301') ||
    lower.includes('row-level security')
  ) {
    return 'データの保存に必要な権限がありません。管理者にご連絡ください。';
  }

  // 制約違反（一意制約・外部キー等）
  if (
    lower.includes('duplicate key') ||
    lower.includes('unique constraint') ||
    lower.includes('violates') ||
    lower.includes('foreign key')
  ) {
    return FALLBACK;
  }

  // ネットワーク・接続
  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('connection') ||
    lower.includes('timeout')
  ) {
    return '通信環境の良い場所で再度お試しください。';
  }

  // 認証
  if (lower.includes('jwt') || lower.includes('session') || lower.includes('unauthorized')) {
    return 'ログインの有効期限が切れている可能性があります。再度ログインしてください。';
  }

  // その他技術的なキーワードが含まれる場合は汎用メッセージ
  if (
    /syntax|type|cast|column|relation|does not exist|pgrst|postgres|sql/.test(lower)
  ) {
    return FALLBACK;
  }

  // 既に日本語で分かりやすい短いメッセージの場合はそのまま返す（例: バリデーション文言）
  if (raw.length <= 80 && /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(raw)) {
    return raw;
  }

  return FALLBACK;
}
