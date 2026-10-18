import { expect, test } from '@playwright/test';

const EMULATOR = 'http://127.0.0.1:9099';
const API = process.env.WP_E2E_API_URL ?? 'http://127.0.0.1:8000';

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

const mainHeading = 'Understand your water. Plan a better future.';
const header = (page: import('@playwright/test').Page) => page.locator('header').first();

test('home offers both planning modes and navigates to the dedicated sign-in page', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(mainHeading);
  await expect(header(page).getByText('Guest', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore on my own' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Start with Agent' })).toBeEnabled();
  await header(page).getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to WaterPilot');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(header(page).getByText('Guest', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Continue as guest' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(mainHeading);
});

test('a failed guest start keeps the main screen and allows retry', async ({ page }) => {
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore on my own' }).click();
  await expect(page.getByText(/your plan could not be started/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
  await expect(header(page).getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

for (const width of [320, 390, 768, 1440, 1920, 2560]) {
  test(`home fits a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(mainHeading);
    await expect(header(page).getByRole('link', { name: 'Sign in' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const main = await page.getByRole('main').boundingBox();
    expect(main!.width).toBeGreaterThan(width * 0.95);
    const card = page.getByRole('complementary', { name: 'Your community water plan' });
    const originalHeight = (await card.boundingBox())!.height;
    await card.getByRole('button', { name: /Garden Heights/ }).click();
    await expect(card.getByText('Garden Heights · Area analysis')).toBeVisible();
    await card.getByRole('tab', { name: 'Compare', exact: true }).click();
    await card.getByRole('button', { name: /Harvesting \+ reuse/ }).click();
    await card.getByRole('tab', { name: 'Take action', exact: true }).click();
    await card.getByRole('checkbox').check();
    await card.getByRole('button', { name: 'Save report', exact: true }).click();
    await expect(card.getByRole('link', { name: 'Download report ↓' })).toBeVisible();
    expect((await card.boundingBox())!.height).toBeCloseTo(originalHeight, 1);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await card.screenshot({
        animations: 'disabled',
        path: test.info().outputPath(`water-plan-${colorScheme}.png`),
      });
    }
  });
}

test.describe('with the Auth emulator', () => {
  test.beforeEach(async () => {
    const up = await emulatorUp();
    if (!up && process.env.WP_REQUIRE_AUTH_EMULATOR === '1') {
      throw new Error('Auth emulator or local API not running (WP_REQUIRE_AUTH_EMULATOR=1)');
    }
    test.skip(!up, 'Auth emulator or local API not running');
  });

  test('guests plan directly, and modal sign-up preserves unfinished location input', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore on my own' }).click();
    await expect(page).toHaveURL(/\/area$/);
    await expect(header(page).getByText('Guest')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
    const name = page.getByRole('combobox', { name: 'Search for a place' });
    await name.fill('Our village well');
    await header(page).getByRole('button', { name: 'Sign in' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign in to WaterPilot' });
    await dialog.getByRole('button', { name: 'Create an account' }).click();
    await dialog.getByLabel(/^Email/).fill(`plan-${Date.now()}@example.org`);
    await dialog.getByLabel(/^Password/).fill('secret-pass');
    await dialog.getByRole('button', { name: 'Create account' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/area$/);
    await expect(name).toHaveValue('Our village well');
    await expect(header(page).getByText('Guest')).toHaveCount(0);
    await expect(header(page).getByRole('button', { name: /Account menu/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  });

  test('unfinished goal inputs survive modal cancellation and account creation', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore on my own' }).click();
    await page
      .getByRole('navigation', { name: 'Planning stages' })
      .getByRole('link', { name: /goal/i })
      .click();
    await page
      .locator('label', { has: page.getByRole('radio', { name: /tanker dependence by 30%/i }) })
      .click();
    const target = page.getByLabel('Target (%)');
    await target.fill('37');
    await header(page).getByRole('button', { name: 'Sign in' }).click();
    let dialog = page.getByRole('dialog', { name: 'Sign in to WaterPilot' });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(target).toHaveValue('37');
    await header(page).getByRole('button', { name: 'Sign in' }).click();
    dialog = page.getByRole('dialog', { name: 'Sign in to WaterPilot' });
    await dialog.getByRole('button', { name: 'Create an account' }).click();
    await dialog.getByLabel(/^Email/).fill(`goal-${Date.now()}@example.org`);
    await dialog.getByLabel(/^Password/).fill('secret-pass');
    await dialog.getByRole('button', { name: 'Create account' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/goals$/);
    await expect(target).toHaveValue('37');
  });

  test('closing the Google popup reports a cancelled sign-in and changes nothing', async ({
    page,
  }) => {
    await page.goto('/signin');
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    const popup = await popupPromise;
    await popup.close();
    await expect(page.getByText('Sign-in was cancelled')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Continue as guest' })).toBeVisible();
  });

  test('page sign-up lands at home; Reports and Communities use header navigation', async ({
    page,
  }) => {
    await page.goto('/signin');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByLabel(/^Email/).fill(`e2e-${Date.now()}@example.org`);
    await page.getByLabel(/^Password/).fill('secret-pass');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(mainHeading);
    await expect(header(page).getByRole('button', { name: /Account menu/ })).toBeVisible();
    await header(page).getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL(/\/reports$/);
    await expect(page.getByRole('button', { name: 'New report' })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('reports.png') });
    await expect(page.getByRole('navigation', { name: 'Workspace' })).toHaveCount(0);
    await header(page).getByRole('link', { name: 'Communities' }).click();
    await expect(page).toHaveURL(/\/communities$/);
    await expect(page.getByRole('link', { name: 'Create a community' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Workspace' })).toHaveCount(0);
  });
});
