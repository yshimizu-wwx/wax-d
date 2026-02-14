import { test, expect } from '@playwright/test';

/**
 * ログアウト E2E（v0.3 Feature Expansion）
 * 期待動作: ログイン状態でユーザーメニューから「ログアウト」を押すと /login に遷移する。
 */
test.describe('ログアウト', () => {
  const TEST_EMAIL = 'shimizu.g.eggs@gmail.com';
  const TEST_PASSWORD = '11111111';

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/メールアドレス/i).fill(TEST_EMAIL);
    await page.getByLabel(/パスワード/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/\/(\?|$)/, { timeout: 15000 });
  });

  test('ユーザーメニューからログアウトを押すとログイン画面に遷移する', async ({ page }) => {
    await page.getByTestId('user-menu-trigger').click();
    await page.getByRole('menuitem', { name: 'ログアウト' }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: 'ログイン' }).or(page.getByLabel(/メールアドレス/i))).toBeVisible({ timeout: 5000 });
  });
});
