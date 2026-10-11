import { expect, test } from '@playwright/test';

test('app boots and redirects to the area screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /understand your area/i })).toBeVisible();
});
