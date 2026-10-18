import { chooseFixtureLocation } from './locationHelpers';
import { expect, test } from '@playwright/test';

// Data readiness on the area step, against the local API and the Firebase emulators
// (`npm run test:e2e:emulator`). The local-only demo area stands in for a chosen location.
const EMULATOR = 'http://127.0.0.1:9099';
const API = 'http://127.0.0.1:8000';

async function servicesUp(): Promise<boolean> {
  try {
    const [auth, api] = await Promise.all([
      fetch(`${EMULATOR}/emulator/v1/projects/demo-waterpilot/config`),
      fetch(`${API}/healthz`),
    ]);
    return auth.ok && api.ok;
  } catch {
    return false;
  }
}

test.beforeEach(async () => {
  const up = await servicesUp();
  if (!up && process.env.WP_REQUIRE_AUTH_EMULATOR === '1') {
    throw new Error('Auth emulator or local API not running (WP_REQUIRE_AUTH_EMULATOR=1)');
  }
  test.skip(!up, 'Auth emulator or local API not running');
});

test('a guest sees readiness for the demo area and records a value they know', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring' }).click();
  await expect(page).toHaveURL(/\/area$/);

  await expect(page.getByRole('combobox', { name: 'Search for a place' })).toBeVisible();
  await chooseFixtureLocation(page);

  await page.getByRole('button', { name: 'Understand this area', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to baseline' }).click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Data coverage' })).toBeVisible();
  const demand = page.locator('[data-metric="demand"]');
  await expect(demand.getByText('Unavailable', { exact: true })).toBeVisible();
  await expect(page.getByText(/\b0\s*(MLD|%|days|L\/day)/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Community inputs', exact: true }).click();
  const population = page.locator('[data-input="POPULATION"]');
  await population.getByLabel(/population served value/i).fill('12000');
  await population.getByLabel(/^source/i).fill('Ward census table, 2011');
  await population.getByRole('button', { name: 'Save value' }).click();
  await expect(population.getByText(/not as measured data/i)).toBeVisible();
  await expect(population.getByText('Entered by you', { exact: true })).toBeVisible();
  await expect(population.getByText('Your value: 12000 people')).toBeVisible();
});
