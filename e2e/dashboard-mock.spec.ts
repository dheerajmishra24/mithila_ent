import { test, expect } from '@playwright/test';

test.describe('Dashboard Features & E2E Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept and mock backend API routes to decouple from database latency
    await page.route('**/api/inventory', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          json: [
            { id: 'INV-100', name: 'Industrial Loom Thread', stock: 500, status: 'in_stock' },
            { id: 'INV-101', name: 'Synthetic Packaging Material', stock: 10, status: 'low_stock' }
          ]
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, json: { success: true } });
      }
    });

    await page.route('**/api/orders', async (route) => {
      await route.fulfill({
        status: 200,
        json: [
          { id: 'ORD-9999', customer: 'Global Imports Corp', total: 45000, status: 'Processing' }
        ]
      });
    });

    await page.route('**/api/promotions', async (route) => {
      await route.fulfill({
        status: 200,
        json: [
          { code: 'SUMMER50', discount: 50, type: 'percentage' }
        ]
      });
    });
  });

  test('should flawlessly validate all core dashboard flows without arbitrary waits', async ({ page }) => {
    // 1. Dashboard Landing & KPI Verification
    await page.goto('/admin/dashboard');
    
    // Explicit visibility assertions (NO waitForTimeout)
    await expect(page.getByRole('heading', { name: /executive ledger|dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /inventory/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /orders/i })).toBeVisible();

    // 2. Inventory Management Flow
    await page.getByRole('link', { name: /inventory/i }).click();
    await expect(page.getByRole('heading', { name: /inventory management/i })).toBeVisible();
    
    // Validate mocked data rendered properly
    await expect(page.getByRole('row', { name: /Industrial Loom Thread/i })).toContainText('500');
    await expect(page.getByRole('row', { name: /Synthetic Packaging Material/i })).toContainText('10');
    
    // Assert Low Stock styling exists via user-facing warning text or icon (if applicable)
    await expect(page.getByText('Low Stock', { exact: true })).toBeVisible();

    // 3. Orders Management Flow
    await page.getByRole('link', { name: /orders/i }).click();
    await expect(page.getByRole('heading', { name: /recent orders/i })).toBeVisible();
    
    const orderRow = page.getByRole('row', { name: /ORD-9999/i });
    await expect(orderRow).toBeVisible();
    await expect(orderRow).toContainText('Global Imports Corp');
    await expect(orderRow).toContainText('Processing');

    // 4. Promotions / Discount Code Engine
    await page.getByRole('link', { name: /promotions/i }).click();
    await expect(page.getByRole('heading', { name: /discount codes/i })).toBeVisible();
    
    const promoRow = page.getByRole('row', { name: /SUMMER50/i });
    await expect(promoRow).toBeVisible();
    
    // Interaction: Generate a new coupon code
    await page.getByRole('button', { name: /create promotion/i }).click();
    
    // Fill form using explicit aria-labels or placeholders
    await page.getByLabel(/promotion code/i).fill('WINTER20');
    await page.getByLabel(/discount percentage/i).fill('20');
    
    // Mock the POST request for creation
    await page.route('**/api/promotions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, json: { success: true } });
      }
    });

    await page.getByRole('button', { name: /save code/i }).click();
    await expect(page.getByText('Promotion created successfully')).toBeVisible();
  });
});
