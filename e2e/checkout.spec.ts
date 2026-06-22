import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Mithila Enterprises/);
});

test('shop navigation and cart', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.locator('h1')).toContainText('Fabric Registry');
});
