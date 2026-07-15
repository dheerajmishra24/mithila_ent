import { test, expect } from '@playwright/test';

// Smoke journeys — runnable against `npm run dev` without a seeded DB.
test('home loads with brand title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Mithila Enterprises/);
});

test('shop renders the Fabric Registry heading', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.locator('h1')).toContainText('Fabric Registry');
});

test('category filter is reflected in URL + heading', async ({ page }) => {
  await page.goto('/shop?category=linen');
  await expect(page).toHaveURL(/category=linen/);
  await expect(page.locator('h1')).toContainText(/Linen/i);
});

test('login page renders email + password fields', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});

test('signup shows the 8-char password rule as you type', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('input[name="password"]', 'abc');
  await expect(page.getByText('At least 8 characters')).toBeVisible();
});

test('admin dashboard redirects anonymous visitors to login', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
