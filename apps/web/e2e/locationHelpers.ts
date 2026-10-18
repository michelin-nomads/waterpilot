import { expect, type Page } from '@playwright/test';

/** Select a labelled fixture through the real location flow; leave confirmation to the caller. */
export async function chooseFixtureLocation(page: Page) {
  await page.getByRole('combobox', { name: 'Search for a place' }).fill('Bengaluru');
  await page.getByRole('option', { name: /^Bengaluru/ }).click();
  await expect(page.getByRole('form', { name: 'Your selected area' })).toBeVisible();
}
