import { expect, test, type Page } from '@playwright/test';

// The water baseline on the area step, against the local API and the Firebase emulators
// (`npm run test:e2e:emulator`). The demo area's synthetic sources are older than their
// freshness limits, so every value here comes from what the person types in.
const EMULATOR = 'http://127.0.0.1:9099';
const API = 'http://127.0.0.1:8000';

async function servicesUp(): Promise<boolean> {
  try {
    const [auth, api] = await Promise.all([
      fetch(`${EMULATOR}/emulator/v1/projects/demo-waterlens/config`),
      fetch(`${API}/healthz`),
    ]);
    return auth.ok && api.ok;
  } catch {
    return false;
  }
}

test.beforeEach(async () => {
  const up = await servicesUp();
  if (!up && process.env.WL_REQUIRE_AUTH_EMULATOR === '1') {
    throw new Error('Auth emulator or local API not running (WL_REQUIRE_AUTH_EMULATOR=1)');
  }
  test.skip(!up, 'Auth emulator or local API not running');
});

async function enter(
  page: Page,
  input: string,
  value: string,
  unit: string | null,
  source: string,
) {
  await page
    .getByRole('button', {
      name: ['POPULATION', 'PER_CAPITA_STANDARD', 'NON_DOMESTIC_DEMAND'].includes(input)
        ? 'Community inputs'
        : 'Water inputs',
      exact: true,
    })
    .click();
  const row = page.locator(`[data-input="${input}"]`);
  await row.getByLabel(/^.+ value\b/i).fill(value);
  if (unit) await row.getByLabel('Unit').selectOption(unit);
  await row.getByLabel(/^source/i).fill(source);
  await row.getByRole('button', { name: 'Save value' }).click();
  await expect(row.getByText(/not as measured data/i)).toBeVisible();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
}

const card = (page: Page, metric: string) => page.locator(`[data-baseline-metric="${metric}"]`);

test('a guest builds a baseline from values they know, reloads it and revises it', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await page.getByRole('button', { name: 'Use the synthetic demo area' }).click();

  await page.getByRole('button', { name: 'Confirm location' }).click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  const baseline = page.getByRole('region', { name: 'Your water baseline' });
  await expect(baseline).toBeVisible();
  await expect(card(page, 'demand').getByText('Unavailable', { exact: true })).toBeVisible();
  await expect(baseline.getByText(/\b0(\.0)?\s*(MLD|kL\/day|%|days)/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Community inputs', exact: true })).toBeVisible();

  await enter(page, 'POPULATION', '12000', null, 'Ward census table, 2011');
  await enter(page, 'PER_CAPITA_STANDARD', '135', null, 'National design standard');
  await enter(page, 'DELIVERED_SUPPLY', '1', 'MLD', 'Utility monthly report');
  await enter(page, 'TANKER_SUPPLY', '0.3', 'MLD', 'Tanker delivery receipts');

  // 12000 people x 135 L/person/day = 1,620,000 L/day.
  await expect(card(page, 'demand').getByText(/^1\.6\s*MLD$/)).toBeVisible();
  await expect(card(page, 'demand').locator('[data-origin="USER_ESTIMATE"]')).toHaveText(
    'Your estimate',
  );
  await expect(card(page, 'delivered_supply').getByText(/^1\.0\s*MLD$/)).toBeVisible();
  await expect(card(page, 'tanker_dependence').getByText(/^30%$/)).toBeVisible();
  await expect(
    card(page, 'reliable_supply').getByText('Unavailable', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to goal' })).toBeEnabled();

  const id = await baseline.getAttribute('data-baseline-id');
  expect(id).toMatch(/^bsl_/);

  await page.reload();
  await expect(card(page, 'demand').getByText(/^1\.6\s*MLD$/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your water baseline' })).toHaveAttribute(
    'data-baseline-id',
    id ?? '',
  );

  await enter(page, 'DELIVERED_SUPPLY', '1.5', 'MLD', 'Utility monthly report, corrected');
  await expect(card(page, 'delivered_supply').getByText(/^1\.5\s*MLD$/)).toBeVisible();
  await expect(card(page, 'tanker_dependence').getByText(/^20%$/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your water baseline' })).not.toHaveAttribute(
    'data-baseline-id',
    id ?? '',
  );
});
