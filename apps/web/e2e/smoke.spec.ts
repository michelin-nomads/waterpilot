import { expect, test } from '@playwright/test';

// Scope: UI boot, Welcome and guest/sign-in flows in the browser. Flows that create
// accounts start a planning session, so they need the Auth emulator (demo-waterlens) and
// the local API, and are skipped when either is not running.
const EMULATOR = 'http://127.0.0.1:9099';
const API = 'http://127.0.0.1:8000';

async function emulatorUp(): Promise<boolean> {
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

test('app boots to the Welcome screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Plan for water security, together',
  );
  await expect(page.getByText(/coverage varies by location/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start exploring' })).toBeEnabled();
});

test('a network failure while starting shows a retry and keeps the user on Welcome', async ({
  page,
}) => {
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await expect(page.getByText(/could not reach the sign-in service/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test.describe('with the Auth emulator', () => {
  test.beforeEach(async () => {
    const up = await emulatorUp();
    if (!up && process.env.WL_REQUIRE_AUTH_EMULATOR === '1') {
      throw new Error('Auth emulator not running (WL_REQUIRE_AUTH_EMULATOR=1)');
    }
    test.skip(!up, 'Auth emulator not running');
    await fetch(`${EMULATOR}/emulator/v1/projects/demo-waterlens/accounts`, { method: 'DELETE' });
  });

  test('Start exploring creates a guest that survives a reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start exploring' }).click();
    await expect(page).toHaveURL(/\/area$/);
    await expect(page.getByRole('heading', { name: /location/i })).toBeVisible();
    await expect(page.getByRole('banner').getByText('Guest')).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Continue planning' })).toBeVisible();
  });

  test('closing the Google popup reports a cancelled sign-in and changes nothing', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('banner').getByRole('button', { name: 'Sign in' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign in to WaterLens' });
    const popupPromise = page.waitForEvent('popup');
    await dialog.getByRole('button', { name: 'Continue with Google' }).click();
    const popup = await popupPromise;
    await popup.close();
    // Firebase waits several seconds after a popup closes before reporting cancellation.
    await expect(dialog.getByText('Sign-in was cancelled')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('banner').getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('a guest links a new email account and keeps planning', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start exploring' }).click();
    await expect(page).toHaveURL(/\/area$/);
    await page.getByRole('banner').getByRole('button', { name: 'Sign in' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign in to WaterLens' });
    await dialog.getByRole('button', { name: 'Create an account' }).click();
    await dialog.getByLabel(/^Email/).fill('e2e@example.org');
    await dialog.getByLabel(/^Password/).fill('secret-pass');
    await dialog.getByRole('button', { name: 'Create account' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('banner').getByText('e2e@example.org')).toBeVisible();
    await expect(page).toHaveURL(/\/area$/);
  });
});
