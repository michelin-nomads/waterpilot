import { expect, test, type Page } from '@playwright/test';

// Goals and constraints, against the local API and the Firebase emulators
// (`npm run test:e2e:emulator`). The baseline comes from values typed on the area step;
// the demo area's synthetic sources are too old to be used.
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

async function enter(page: Page, input: string, value: string, unit: string, source: string) {
  const row = page.locator(`[data-input="${input}"]`);
  await row.getByLabel(/^.+ value\b/i).fill(value);
  await row.getByLabel('Unit').selectOption(unit);
  await row.getByLabel(/^source/i).fill(source);
  await row.getByRole('button', { name: 'Save value' }).click();
  await expect(row.getByText(/not as measured data/i)).toBeVisible();
}

async function preset(page: Page, name: RegExp) {
  const radio = page.getByRole('radio', { name });
  await page.locator('label', { has: radio }).click();
}

test('a guest checks a goal against their baseline, saves it, and sees an impossible one explained', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await page.getByRole('button', { name: 'Use the synthetic demo area' }).click();
  await enter(page, 'DELIVERED_SUPPLY', '1', 'MLD', 'Utility monthly report');
  await enter(page, 'TANKER_SUPPLY', '0.3', 'MLD', 'Tanker delivery receipts');
  await page.getByRole('link', { name: 'Set your goal' }).click();
  await expect(page).toHaveURL(/\/goals$/);

  await preset(page, /tanker dependence by 30%/i);
  await page.getByRole('button', { name: 'Check goal' }).click();
  const check = page.getByRole('region', { name: 'Goal check' });
  await expect(check.locator('[data-target-outcome]')).toHaveAttribute(
    'data-target-outcome',
    'FEASIBLE',
  );
  await expect(page.getByText('Checked, not saved yet.')).toBeVisible();
  await expect(check.getByText(/confidence/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'Save goal' }).click();
  await expect(page.getByRole('button', { name: 'Goal saved' })).toBeDisabled();
  await expect(page.getByLabel('Target (%)')).toHaveValue('30');

  await preset(page, /raise the groundwater level/i);
  await page.getByRole('button', { name: /your site/i }).click();
  await page.getByLabel('No digging or excavation').check();
  await page.getByLabel('No sending water into the ground').check();
  await page.getByRole('button', { name: 'Check goal' }).click();
  await expect(page.getByRole('region', { name: 'Goal check' })).toHaveAttribute(
    'data-goal-outcome',
    'INFEASIBLE',
  );
  await expect(page.getByText(/rule out every measure/i).first()).toBeVisible();
});
