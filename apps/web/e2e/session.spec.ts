import { expect, test, type Page, type Request } from '@playwright/test';

// The shared planning session in a real browser, against the local API and the Firebase
// emulators (`npm run test:e2e:emulator`): plans ending with the visit, offline edits,
// reconnect, mode switch and account switch. Conflicting edits to the same input need the location
// and goal editors (later prompts); their choice UI is covered in Vitest.
const EMULATOR = 'http://127.0.0.1:9099';
const API = process.env.WP_E2E_API_URL ?? 'http://127.0.0.1:8000';

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

const isUpdate = (request: Request) =>
  request.url().endsWith('/graphql') &&
  (request.postData() ?? '').includes('mutation UpdatePlanningSession');

/** Counts session updates the server applied (a typed error is not an applied write). */
function countAppliedUpdates(page: Page): { applied: number; conflicts: number } {
  const counts = { applied: 0, conflicts: 0 };
  page.on('response', async (response) => {
    if (!isUpdate(response.request())) return;
    const body = (await response.json().catch(() => null)) as {
      data?: { updatePlanningSession?: { session: unknown; error: { code: string } | null } };
    } | null;
    const payload = body?.data?.updatePlanningSession;
    if (payload?.session) counts.applied += 1;
    if (payload?.error?.code === 'VERSION_CONFLICT') counts.conflicts += 1;
  });
  return counts;
}

/** Response bodies are read asynchronously: wait for the count, then check it stays. */
async function expectSettled(count: () => number, expected: number) {
  await expect.poll(count).toBe(expected);
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(count()).toBe(expected);
}

async function startPlanning(page: Page, mode: 'Traditional' | 'With the assistant') {
  await page.goto('/');
  const button = mode === 'Traditional' ? 'Explore on my own' : 'Start with Agent';
  await page.getByRole('button', { name: button }).click();
  await expect(page).toHaveURL(/\/area$/);
}

const stageLink = (page: Page, name: RegExp) =>
  page.getByRole('navigation', { name: 'Planning stages' }).getByRole('link', { name });

const saveStatus = (page: Page) => page.locator('[data-save]');

async function recoveryRecords(page: Page): Promise<Array<{ uid: string; pending: object }>> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('waterpilot-recovery', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('sessions')) return resolve([]);
          const all = db.transaction('sessions').objectStore('sessions').getAll();
          all.onsuccess = () => resolve(all.result);
          all.onerror = () => reject(all.error);
        };
      }),
  );
}

test('a plan is not kept: reloading ends it and Welcome offers a fresh start', async ({ page }) => {
  await startPlanning(page, 'With the assistant');
  await expect(page.getByRole('complementary', { name: 'Conversation' })).toBeVisible();
  const saved = page.waitForResponse((response) => isUpdate(response.request()) && response.ok());
  await stageLink(page, /goal/i).click();
  await saved;
  await expect(saveStatus(page)).toHaveCount(0);

  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Continue planning' })).toHaveCount(0);
  await expect(page.getByText(/in progress/i)).toHaveCount(0);
  // The guest account stays, so the start screen is the choice of how to plan.
  await expect(page.getByRole('button', { name: 'Explore on my own' })).toBeVisible();
});

test('saving remains until the server acknowledges, then the status disappears', async ({
  page,
}) => {
  await startPlanning(page, 'Traditional');
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`${API}/graphql`, async (route) => {
    if (!isUpdate(route.request())) return route.continue();
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  await stageLink(page, /compare/i).click();
  await expect(saveStatus(page)).toContainText('Saving…');
  await page.waitForTimeout(500);
  await expect(page.getByText('Changes saved')).toHaveCount(0);
  release();
  await expect(saveStatus(page)).toHaveCount(0);
});

test('edits made while the API is unreachable save once on reconnect', async ({ page }) => {
  await startPlanning(page, 'Traditional');
  const counts = countAppliedUpdates(page);
  await page.route(`${API}/graphql`, (route) => route.abort('internetdisconnected'));
  await stageLink(page, /goal/i).click();
  await expect(saveStatus(page)).toContainText('Not saved');

  await page.unroute(`${API}/graphql`);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(saveStatus(page)).toHaveCount(0);
  await expectSettled(() => counts.applied, 1);
});

test('switching mode keeps the same session', async ({ page }) => {
  await startPlanning(page, 'Traditional');
  const counts = countAppliedUpdates(page);
  const created: string[] = [];
  page.on('request', (request) => {
    if ((request.postData() ?? '').includes('mutation CreatePlanningSession')) {
      created.push(request.url());
    }
  });
  await page
    .locator('label', { has: page.getByRole('radio', { name: 'WaterPilot Agent' }) })
    .click();
  await expect(saveStatus(page)).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'WaterPilot Agent' })).toBeChecked();
  expect(created).toEqual([]);
  await expectSettled(() => counts.applied, 1);
});

test('a signed-in person plans with an avatar in the header; signing out asks first', async ({
  page,
}) => {
  const email = `switch-${Date.now()}@example.org`;
  await page.goto('/signin');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill('secret-pass');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('button', { name: 'Explore on my own' }).click();
  await expect(page).toHaveURL(/\/area$/);
  const header = page
    .getByRole('link', { name: 'WaterPilot home' })
    .locator('xpath=ancestor::header');
  await expect(header.getByRole('button', { name: /Account menu/ })).toBeVisible();
  await expect(header.getByText('Guest')).toHaveCount(0);
  await expect(header.getByRole('button', { name: 'Sign in' })).toHaveCount(0);

  await header.getByRole('button', { name: /Account menu/ }).click();
  await header.getByRole('button', { name: 'Sign out' }).click();
  const confirm = page.getByRole('dialog', { name: 'Sign out and lose your plan?' });
  await confirm.getByRole('button', { name: 'Sign out and lose plan' }).click();
  await expect(page.getByRole('button', { name: 'Explore on my own' })).toBeVisible();
  await expect.poll(async () => (await recoveryRecords(page)).length).toBe(0);
});

test('guests cannot open the signed-in workspace', async ({ page }) => {
  await startPlanning(page, 'Traditional');
  await page.goto('/reports');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
});
