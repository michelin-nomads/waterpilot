import { expect, test } from '@playwright/test';

// Scope: UI boot, Welcome and guest/sign-in flows in the browser. Flows that create
// accounts start a planning session, so they need the Auth emulator (demo-waterpilot) and
// the local API, and are skipped when either is not running.
const EMULATOR = 'http://127.0.0.1:9099';
const API = 'http://127.0.0.1:8000';

async function emulatorUp(): Promise<boolean> {
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

test('app boots to the sign-in screen, with a way to continue as a guest', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to WaterPilot');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue as guest' })).toBeEnabled();
});

test('a network failure while continuing as a guest shows a message and keeps the user here', async ({
  page,
}) => {
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await expect(page.getByText(/could not reach the sign-in service/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue as guest' })).toBeEnabled();
  await expect(page).toHaveURL(/\/$/);
});

test.describe('with the Auth emulator', () => {
  test.beforeEach(async () => {
    const up = await emulatorUp();
    if (!up && process.env.WP_REQUIRE_AUTH_EMULATOR === '1') {
      throw new Error('Auth emulator not running (WP_REQUIRE_AUTH_EMULATOR=1)');
    }
    test.skip(!up, 'Auth emulator not running');
    await fetch(`${EMULATOR}/emulator/v1/projects/demo-waterpilot/accounts`, { method: 'DELETE' });
  });

  test('Continue as guest creates a guest who then chooses how to plan', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue as guest' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'A better water plan starts here.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Start exploring' }).click();
    await expect(page).toHaveURL(/\/area$/);
    await expect(page.getByRole('heading', { name: /location/i })).toBeVisible();
    // A guest in the planner sees the Guest label and no sign-in; that comes at Review.
    const header = page
      .getByRole('link', { name: 'WaterPilot home' })
      .locator('xpath=ancestor::header');
    await expect(header.getByText('Guest')).toBeVisible();
    await expect(header.getByRole('button', { name: 'Sign in' })).toHaveCount(0);

    // The plan ends with the visit, but the guest account itself stays.
    await page.goto('/');
    await expect(header.getByText('Guest')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue planning' })).toHaveCount(0);
  });

  test('closing the Google popup reports a cancelled sign-in and changes nothing', async ({
    page,
  }) => {
    await page.goto('/');
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    const popup = await popupPromise;
    await popup.close();
    // Firebase waits several seconds after a popup closes before reporting cancellation.
    await expect(page.getByText('Sign-in was cancelled')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Continue as guest' })).toBeVisible();
  });

  test('a guest who signs up from the start screen lands on the workspace', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue as guest' }).click();
    await expect(page.getByRole('button', { name: 'Start exploring' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign in' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign in to WaterPilot' });
    await dialog.getByRole('button', { name: 'Create an account' }).click();
    await dialog.getByLabel(/^Email/).fill('e2e@example.org');
    await dialog.getByLabel(/^Password/).fill('secret-pass');
    await dialog.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/reports$/);
    await expect(
      page.getByRole('button', { name: /Account menu for e2e@example.org/ }),
    ).toBeVisible();
  });
});
