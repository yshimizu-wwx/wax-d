import { test, expect } from '@playwright/test';

/**
 * ログイン正常系 E2E (#21)
 * テスト用アカウント（test:seed で投入）でログインし、リダイレクトを確認する。
 */
test.describe('ログイン', () => {
  const TEST_EMAIL = 'shimizu.g.eggs@gmail.com';
  const TEST_PASSWORD = '11111111';

  test('農家アカウントでログインするとトップにリダイレクトされる', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /ログイン|AgriX/i })).toBeVisible({ timeout: 10000 });

    await page.getByLabel(/メールアドレス/i).fill(TEST_EMAIL);
    await page.getByLabel(/パスワード/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page).toHaveURL(/\/(\?|$)/, { timeout: 15000 });
  });

  test('誤ったパスワードではログインできない', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/メールアドレス/i).fill(TEST_EMAIL);
    await page.getByLabel(/パスワード/i).fill('wrong-password');
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page.getByText(/ログインに失敗|パスワード|invalid/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
