import { execSync } from 'child_process';
import path from 'path';

/**
 * E2E 実行前にテスト用DBをリセットし、シードデータを投入する (#21)
 * 未設定時はスキップ（CI では環境変数で test:seed を有効にすること）
 */
async function globalSetup(): Promise<void> {
  const runSeed = process.env.PLAYWRIGHT_RUN_SEED === '1' || process.env.CI === 'true';
  if (!runSeed) {
    console.log('PLAYWRIGHT_RUN_SEED が未設定のため、DBシードをスキップします。');
    return;
  }
  const root = path.resolve(__dirname, '..');
  try {
    execSync('npm run test:seed', {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log('DBシード完了。');
  } catch (e) {
    console.warn('DBシードに失敗しました。.env.local とマイグレーションを確認してください。', e);
    throw e;
  }
}

export default globalSetup;
