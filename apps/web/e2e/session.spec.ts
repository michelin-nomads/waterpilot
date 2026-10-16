import { expect, test, type Page, type Request } from '@playwright/test';

// The shared planning session in a real browser, against the local API and the Firebase
// emulators (`npm run test:e2e:emulator`): refresh, offline edits, reconnect, two tabs,
// mode switch and account switch. Conflicting edits to the same input need the location
// and goal editors (later prompts); their choice UI is covered in Vitest.
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
  const button = mode === 'Traditional' ? 'Start exploring' : 'Plan with Copilot';
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
        const open = indexedDB.open('waterlens-recovery', 1);
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

test('refresh and Continue restore the saved mode and step', async ({ page }) => {
  await startPlanning(page, 'With the assistant');
  await expect(page.getByRole('complementary', { name: 'Conversation' })).toBeVisible();
  await stageLink(page, /goal/i).click();
  await expect(saveStatus(page)).toContainText('Changes saved');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Goal' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Copilot' })).toBeChecked();

  await page.goto('/');
  await page.getByRole('button', { name: 'Continue planning' }).click();
  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByRole('complementary', { name: 'Conversation' })).toBeVisible();
});

test('"Changes saved" waits for the server to acknowledge', async ({ page }) => {
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
  await expect(saveStatus(page)).toContainText('Changes saved');
});

test('edits made while the API is unreachable survive a reload and save once on reconnect', async ({
  page,
}) => {
  await startPlanning(page, 'Traditional');
  const counts = countAppliedUpdates(page);
  await page.route(`${API}/graphql`, (route) => route.abort('internetdisconnected'));
  await stageLink(page, /make it happen/i).click();
  await expect(saveStatus(page)).toContainText('Not saved');
  await expect.poll(async () => (await recoveryRecords(page)).length).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByText(/copy of your plan saved on this device/i)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Make It Happen' })).toBeVisible();

  await page.unroute(`${API}/graphql`);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(saveStatus(page)).toContainText('Changes saved');
  await expectSettled(() => counts.applied, 1);

  await page.goto('/');
  await page.getByRole('button', { name: 'Continue planning' }).click();
  await expect(page).toHaveURL(/\/make-it-happen$/);
});

test('two tabs share one session without duplicate or lost writes', async ({ context }) => {
  const first = await context.newPage();
  await startPlanning(first, 'Traditional');
  const second = await context.newPage();
  await second.goto('/area');
  await expect(second.getByText('Location', { exact: true })).toBeVisible();
  const firstCounts = countAppliedUpdates(first);
  const secondCounts = countAppliedUpdates(second);

  await stageLink(first, /goal/i).click();
  await expect(saveStatus(first)).toContainText('Changes saved');
  await stageLink(second, /compare/i).click();
  await expect(saveStatus(second)).toContainText('Changes saved');

  await expectSettled(() => firstCounts.applied + secondCounts.applied, 2);
  await first.goto('/');
  await first.getByRole('button', { name: 'Continue planning' }).click();
  await expect(first).toHaveURL(/\/plans$/);
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
  await page.getByRole('radio', { name: 'Copilot' }).check();
  await expect(saveStatus(page)).toContainText('Changes saved');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Copilot' })).toBeChecked();
  expect(created).toEqual([]);
  await expectSettled(() => counts.applied, 1);
});

test('an account switch shows nothing of the previous account and clears its device copy', async ({
  page,
}) => {
  const email = `switch-${Date.now()}@example.org`;
  await startPlanning(page, 'Traditional');
  await stageLink(page, /goal/i).click();
  await expect(saveStatus(page)).toContainText('Changes saved');

  // The guest becomes a permanent account and keeps the plan.
  await page.getByRole('banner').getByRole('button', { name: 'Sign in' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign in to WaterLens' });
  await dialog.getByRole('button', { name: 'Create an account' }).click();
  await dialog.getByLabel(/^Email/).fill(email);
  await dialog.getByLabel(/^Password/).fill('secret-pass');
  await dialog.getByRole('button', { name: 'Create account' }).click();
  await expect(dialog).toBeHidden();
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: /resume set your goal/i })).toBeVisible();

  await page.getByRole('banner').getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Start exploring' })).toBeVisible();
  await expect.poll(async () => (await recoveryRecords(page)).length).toBe(0);

  // A different person on the same browser starts clean.
  await startPlanning(page, 'Traditional');
  await expect(page.getByRole('heading', { level: 1, name: 'Location' })).toBeVisible();
  await expect(page.getByRole('banner').getByText(email)).toHaveCount(0);
});
