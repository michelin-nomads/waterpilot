import { expect, test, type Page } from '@playwright/test';

// The location step against the local API (fixture gazetteer, no map, no Google calls)
// and the Firebase emulators (`npm run test:e2e:emulator`).
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

test.beforeEach(async ({ page }) => {
  const up = await servicesUp();
  if (!up && process.env.WP_REQUIRE_AUTH_EMULATOR === '1') {
    throw new Error('Auth emulator or local API not running (WP_REQUIRE_AUTH_EMULATOR=1)');
  }
  test.skip(!up, 'Auth emulator or local API not running');
  // Fail loudly if anything tries a real Google Maps host (emulator URLs only contain one
  // in their path).
  await page.route(
    (url) => /(^|\.)(googleapis|gstatic)\.com$/.test(url.hostname),
    (route) => route.abort(),
  );
});

async function choosePointOnly(page: Page) {
  const option = page.getByRole('radio', { name: /Just this point/ });
  await page.locator('label', { has: option }).click();
  await expect(option).toBeChecked();
}

async function startPlanning(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await expect(page).toHaveURL(/\/area$/);
  await expect(page.getByText(/local mode shows no map/i)).toBeVisible();
}

test('an ambiguous name asks which place, and a place outside India completes the step', async ({
  page,
}) => {
  await startPlanning(page);
  const search = page.getByRole('combobox', { name: 'Search for a place' });
  await search.fill('Koramangala');
  await expect(page.getByText(/2 places match “Koramangala”/)).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(2);

  await search.fill('Nairobi');
  await page.getByRole('option', { name: /Nairobi/ }).click();
  await expect(page.getByRole('heading', { name: 'Is this the right location?' })).toBeVisible();
  await expect(page.getByText(/not a water catchment/i)).toBeVisible();
  await expect(page.getByText('Test place, not real data')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Currency' })).toHaveValue('KES');
  await page.getByRole('button', { name: 'Confirm location' }).click();
  await expect(page.getByText('Choose how calculations should treat this place.')).toBeVisible();
  await choosePointOnly(page);
  await page.getByRole('button', { name: 'Confirm location' }).click();

  await expect(page.getByRole('heading', { name: 'Nairobi' })).toBeVisible();
  await expect(page.getByText('KES', { exact: true })).toBeVisible();
  await expect(page.getByText('Africa/Nairobi')).toBeVisible();
  await expect(page.getByText('User-input assessment')).toBeVisible();
});

test.describe('device location denied', () => {
  test.use({ permissions: [] });

  test('explains the denial and a typed-in location still completes the step', async ({ page }) => {
    await page.addInitScript(() => {
      const denied = { code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
      navigator.geolocation.getCurrentPosition = (_ok, fail) => fail?.(denied as never);
    });
    await startPlanning(page);
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'permission was not given' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Enter it yourself' }).first().click();
    const form = page.getByRole('form', { name: 'Enter a location yourself' });
    await form.getByLabel(/^Name/).fill('Our well');
    await form.getByLabel(/^Latitude/).fill('39.78');
    await form.getByLabel(/^Longitude/).fill('-89.65');
    await form.getByRole('combobox', { name: /Country/ }).selectOption('US');
    await form.getByRole('button', { name: 'Review this location' }).click();
    await expect(page.getByText('Please check', { exact: true })).toBeVisible();
    await choosePointOnly(page);
    await page.getByRole('button', { name: 'Confirm location' }).click();

    await expect(page.getByRole('heading', { name: 'Our well' })).toBeVisible();
    await expect(page.getByText('Private to you')).toBeVisible();
    await expect(page.getByText('US customary', { exact: true })).toBeVisible();
  });
});

test.describe('device location granted', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: -12.0464, longitude: -77.0428, accuracy: 30 },
  });

  test('asks the person to confirm the device location before saving it', async ({ page }) => {
    await startPlanning(page);
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.getByRole('heading', { name: 'Is this the right location?' })).toBeVisible();
    await expect(page.getByText('Your device location', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/within about 30 m/)).toBeVisible();
    await choosePointOnly(page);
    await page.getByRole('button', { name: 'Confirm location' }).click();
    await expect(page.getByRole('heading', { name: 'My device location' })).toBeVisible();
    await expect(page.getByText('PEN', { exact: true })).toBeVisible();
  });
});
