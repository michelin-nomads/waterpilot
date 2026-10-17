import { chooseFixtureLocation } from './locationHelpers';
import { expect, test, type Page } from '@playwright/test';

// Compare, and what-ifs explored in Agent mode, against the local API and the
// Firebase emulators (`npm run test:e2e:emulator`). Every number comes from the
// deterministic engines.
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

async function enter(
  page: Page,
  input: string,
  value: string,
  unit: string | null,
  source: string,
) {
  const row = page.locator(`[data-input="${input}"]`);
  await row.getByLabel(/^.+ value\b/i).fill(value);
  if (unit) await row.getByLabel('Unit').selectOption(unit);
  await row.getByLabel(/^source/i).fill(source);
  await row.getByRole('button', { name: 'Save value' }).click();
  await expect(row.getByText(/not as measured data/i)).toBeVisible();
}

test('a guest compares only feasible plans, chooses one, and tests a what-if in Agent mode', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Exploring' }).click();
  await chooseFixtureLocation(page);
  await page.getByRole('button', { name: 'Confirm location', exact: true }).click();
  // 12000 people x 135 L = 1,620,000 L/day demand; 300,000 L/day from tankers (30%).
  await enter(page, 'POPULATION', '12000', null, 'Ward census table, 2011');
  await enter(page, 'PER_CAPITA_STANDARD', '135', null, 'National design standard');
  await enter(page, 'DELIVERED_SUPPLY', '1', 'MLD', 'Utility monthly report');
  await enter(page, 'TANKER_SUPPLY', '0.3', 'MLD', 'Tanker delivery receipts');

  await page.getByRole('link', { name: 'Set your goal', exact: true }).click();
  const tanker = page.getByRole('radio', { name: /tanker dependence by 30%/i });
  await page.locator('label', { has: tanker }).click();
  await page.getByRole('button', { name: /your site/i }).click();
  await page.getByLabel('Scale').selectOption('BUILDING');
  await page.getByLabel('Use a borewell or other groundwater?').selectOption('yes');
  await page.getByRole('button', { name: /your own estimates/i }).click();
  await page.getByLabel('Add an estimate for').selectOption({ label: 'Water-efficient fixtures' });
  await page.getByRole('button', { name: 'Add estimate' }).click();
  await page.getByLabel('Share of water use the fixtures save — low (%)').fill('20');
  await page.getByLabel('Share of water use the fixtures save — high (%)').fill('25');
  await page.getByLabel('Shortest build (days)').fill('30');
  await page.getByLabel('Longest build (days)').fill('60');
  await page.getByRole('button', { name: 'Save goal' }).click();
  await expect(page.getByRole('button', { name: 'Goal saved' })).toBeDisabled();
  await page.getByRole('link', { name: 'Compare plans' }).click();
  await expect(page).toHaveURL(/\/plans$/);

  // One measure passes; nothing is invented to fill three slots.
  const plans = page.getByRole('list', { name: 'Feasible plans' });
  await expect(plans.locator('[data-option-id]')).toHaveCount(1);
  await expect(page.getByText(/no other combination passes/i)).toBeVisible();
  await expect(plans.getByText('Water-efficient fixtures', { exact: false }).first()).toBeVisible();

  // Wider effects sit with the plan before it is chosen. With no reviewed connectivity
  // record, every shared system stays unknown; the borewell answer raises a flag that
  // says so instead of claiming harm or safety.
  const effects = plans.getByRole('region', { name: 'Effects beyond your site' });
  await expect(effects.getByText(/^30\.0% now; .+% with this plan\.$/)).toBeVisible();
  await expect(effects.locator('[data-finding^="ext."]').first()).toHaveAttribute(
    'data-linkage',
    'UNKNOWN',
  );
  const flag = effects.locator('[data-notice="caution"]');
  await expect(flag.getByText('Possible false resilience', { exact: true })).toBeVisible();
  await expect(flag.getByText(/not known/).first()).toBeVisible();
  const boundaries = page.getByRole('table', { name: 'Influence boundaries' });
  await expect(boundaries.locator('tr[data-linkage]')).toHaveCount(3);
  await expect(boundaries.locator('tr[data-linkage="UNKNOWN"]')).toHaveCount(3);
  await expect(
    page
      .getByRole('list', { name: 'Not assessed' })
      .locator('[data-unavailable="neighbour_effects"]'),
  ).toBeVisible();
  await expect(page.locator('[data-groundwater="DECLARED"]')).toBeVisible();

  await plans.getByRole('button', { name: 'Choose this plan' }).click();
  await expect(plans.getByRole('button', { name: 'Chosen plan' })).toBeDisabled();

  // Traditional mode has ordinary goal editing and no what-if controls.
  await expect(page.getByRole('button', { name: 'Preview' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Water demand' })).toHaveCount(0);

  // Agent mode explores the what-if against the same baseline.
  await page.getByRole('radio', { name: 'WaterPilot Agent' }).check();
  const agent = page.locator('[data-agent-scenario]');
  const demand = agent.getByRole('group', { name: 'Water demand' });
  await demand.getByLabel('Change').selectOption('INCREASE_BY');
  await demand.getByLabel('Percentage').fill('50');
  await agent.getByRole('button', { name: 'Preview' }).click();
  await expect(agent.locator('[data-scenario-source="preview"]')).toBeVisible();
  await expect(agent.getByText('+8,10,000 L/day').first()).toBeVisible();
  // Previewing saved nothing: the plan is still chosen.
  await expect(plans.getByRole('button', { name: 'Chosen plan' })).toBeDisabled();
  await expect(page.locator('[data-scenario-result]')).toHaveCount(0);

  await demand.getByLabel('Change').selectOption('INCREASE_BY');
  await demand.getByLabel('Percentage').fill('50');
  await agent.getByRole('button', { name: 'Apply to plans' }).click();
  // Demand 2,430,000 L/day: 20% savings leave 624,000 of 1,324,000 L/day from tankers.
  await expect(page.locator('[data-status="NO_FEASIBLE_PLAN"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose this plan' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Continue to review' })).toHaveCount(0);
  const result = page.locator('[data-scenario-result="applied"]');
  await expect(result.getByText('Agent-generated')).toBeVisible();

  // Back in Traditional mode the agent's what-if is shown read-only.
  await page.getByRole('radio', { name: 'Explorer' }).check();
  await expect(result.getByRole('button', { name: 'Open Agent mode' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview' })).toHaveCount(0);
});
