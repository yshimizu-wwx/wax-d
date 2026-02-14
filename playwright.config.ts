import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 設定 (#21)
 * - テスト前に DB シードを実行（globalSetup）
 * - 失敗時にスクリーンショット・トレースを test-results/ に保存
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'test-results/html' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  outputDir: 'test-results/artifacts',
});
