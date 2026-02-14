/**
 * 業者ダッシュボード用: 期限切迫・報告漏れなどのアクション優先度判定
 * Must（緊急）と Want（推奨）の識別に使用
 */

const DAYS_NEAR_DEADLINE = 3;

export type DeadlineAlert = 'overdue' | 'soon' | null;

/**
 * 作業予定日に対するアラート: 超過 = 報告必須、3日以内 = 期日が近い
 */
export function getReportDeadlineAlert(confirmedDate: string | null): DeadlineAlert {
  if (!confirmedDate) return null;
  const d = new Date(confirmedDate);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= DAYS_NEAR_DEADLINE) return 'soon';
  return null;
}

/**
 * 募集締切・作業期日が N 日以内か、または過ぎているか
 * deadlineDate: final_date または end_date など
 */
export function getRecruitmentDeadlineAlert(deadlineDate: string | null): DeadlineAlert {
  if (!deadlineDate) return null;
  const d = new Date(deadlineDate);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= DAYS_NEAR_DEADLINE) return 'soon';
  return null;
}

/**
 * Must アクションか（最優先で上に表示するか）
 * - 報告: 作業予定日超過の未報告
 * - 集客: 締切が過ぎている or 3日以内
 */
export function isMustActionReport(confirmedDate: string | null): boolean {
  return getReportDeadlineAlert(confirmedDate) !== null;
}

export function isMustActionRecruitment(deadlineDate: string | null): boolean {
  return getRecruitmentDeadlineAlert(deadlineDate) !== null;
}
