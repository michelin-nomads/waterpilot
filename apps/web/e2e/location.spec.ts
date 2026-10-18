import { expect, test, type Page } from '@playwright/test';

const API = process.env.WP_E2E_API_URL ?? 'http://127.0.0.1:8000';
const EMULATOR = 'http://127.0.0.1:9099';

test.beforeEach(async ({ page }) => {
  let up = false;
  try {
    const services = await Promise.all([
      fetch(`${API}/healthz`),
      fetch(`${EMULATOR}/emulator/v1/projects/demo-waterpilot/config`),
    ]);
    up = services.every((response) => response.ok);
  } catch {
    /* Local integration services may not be running. */
  }
  test.skip(!up, 'Needs the local API and Auth emulator');
  await page.route(
    (url) => /(^|\.)(googleapis|gstatic)\.com$/.test(url.hostname),
    (route) => route.abort(),
  );
});

async function startPlanning(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore on my own' }).click();
  await expect(page).toHaveURL(/\/area$/);
}

async function confirm(page: Page) {
  const selectedName = await page.getByTestId('review-name').innerText();
  const response = page.waitForResponse((result) =>
    (result.request().postData() ?? '').includes('mutation ConfirmLocation'),
  );
  await page.getByRole('button', { name: 'Understand this area', exact: true }).click();
  const body = await (await response).json();
  expect(body.data.confirmLocation.error).toBeNull();
  await expect(page).toHaveURL(/\/area$/);
  await page.getByRole('button', { name: 'Continue to baseline' }).click();
  await expect(page).toHaveURL(/\/baseline$/);
  await expect(page.getByTestId('summary-name')).toHaveText(selectedName);
  expect(
    (
      body.data.confirmLocation.area.formattedAddress ?? body.data.confirmLocation.area.name
    ).startsWith(selectedName),
  ).toBe(true);
  const summary = page.locator('section[aria-labelledby="location-summary-title"]');
  await expect(summary.getByText('Units', { exact: true })).toHaveCount(0);
  await expect(summary.getByText('Private to you', { exact: true })).toHaveCount(0);
  await expect(summary.getByText('Unreviewed source', { exact: true })).toHaveCount(0);
  return body.data.confirmLocation.area;
}

test('search reviews a circle and automatically determines currency and timezone', async ({
  page,
}) => {
  await startPlanning(page);
  const search = page.getByRole('combobox', { name: 'Search for a place' });
  const locate = page.getByRole('button', { name: 'Use my location' });
  const searchBox = (await search.boundingBox())!;
  const locateBox = (await locate.boundingBox())!;
  expect(locateBox.x).toBeGreaterThanOrEqual(searchBox.x + searchBox.width);
  await expect(
    page.getByRole('button', { name: /Enter it yourself|synthetic demo area/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('definition').filter({ hasText: /Not chosen yet|Not set yet/ }),
  ).toHaveCount(0);
  await search.fill('Nairobi');
  await page.getByRole('option', { name: /Nairobi/ }).click();
  const review = page.getByRole('form', { name: 'Your selected area' });
  await expect(review).toBeVisible();
  await expect(review.getByRole('radio')).toHaveCount(0);
  for (const name of [/Country/i, /Currency/i, /Time zone/i])
    await expect(review.getByRole('combobox', { name })).toHaveCount(0);
  await expect(page.getByText('A place is not a catchment', { exact: true })).toHaveCount(0);
  const radius = review.getByRole('textbox', { name: /Radius/ });
  await expect(radius).toHaveValue('1');
  await radius.fill('0.5');
  await review.getByRole('button', { name: 'Understand this area', exact: true }).click();
  await expect(page.getByText('Enter a radius from 1 to 10 km.', { exact: true })).toBeVisible();
  await radius.fill('10.1');
  await review.getByRole('button', { name: 'Understand this area', exact: true }).click();
  await expect(page.getByText('Enter a radius from 1 to 10 km.', { exact: true })).toBeVisible();
  await radius.fill('2.5');
  await review.getByRole('button', { name: 'About the planning radius' }).focus();
  await expect(
    review.getByRole('button', { name: 'About the planning radius' }),
  ).toHaveAccessibleDescription(/from 1 to 10 km/);
  await page.keyboard.press('Escape');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
  await page.screenshot({ path: test.info().outputPath('location-review.png') });
  const area = await confirm(page);
  expect(area).toMatchObject({
    countryCode: 'KE',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
    extent: 'USER_RADIUS',
    radiusMeters: 2500,
  });
  await expect(page.getByText(/Changes saved/)).toHaveCount(0);
});

test('a denied device permission keeps search usable without a manual-entry fallback', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) =>
      fail?.({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
  });
  await startPlanning(page);
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: /permission was not given/ }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Search for a place' }).fill('Nairobi');
  await page.getByRole('option', { name: /Nairobi/ }).click();
  expect(await confirm(page)).toMatchObject({
    countryCode: 'KE',
    extent: 'USER_RADIUS',
    radiusMeters: 1000,
  });
});

test.describe('device location granted', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: -12.0464, longitude: -77.0428, accuracy: 30 },
  });
  test('names the location, explains accuracy, and resolves region settings automatically', async ({
    page,
  }) => {
    await startPlanning(page);
    await page.getByRole('button', { name: 'Use my location' }).click();
    const review = page.getByRole('form', { name: 'Your selected area' });
    await expect(review.getByTestId('review-name')).toContainText('Lima');
    await expect(review.getByText('Device location', { exact: true })).toBeVisible();
    await expect(review.getByText('Approximately ±30 m')).toBeVisible();
    await expect(
      review.getByRole('button', { name: 'About location accuracy' }),
    ).toHaveAccessibleDescription(/separate from the planning radius/);
    expect(await confirm(page)).toMatchObject({
      countryCode: 'PE',
      currency: 'PEN',
      timezone: 'America/Lima',
      private: true,
    });
  });
});

test.describe('device position without reverse-geocoding results', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 12.8676256, longitude: 77.6838009, accuracy: 35 },
  });
  test('confirms the actual device coordinates with automatic Indian regional settings', async ({
    page,
  }) => {
    let lookupCount = 0;
    await page.route(`${API}/graphql`, async (route) => {
      if ((route.request().postData() ?? '').includes('query ReverseLocation')) {
        lookupCount += 1;
        const candidates =
          lookupCount === 1
            ? []
            : [
                {
                  placeId: 'fixture:hsr',
                  name: 'HSR Layout',
                  formattedAddress: 'HSR Layout, Bengaluru, Karnataka 560102, India',
                  latitude: '12.8676256',
                  longitude: '77.6838009',
                  countryCode: 'IN',
                  scope: 'SUBLOCALITY',
                  types: ['sublocality'],
                  admin: {
                    countryName: 'India',
                    locality: 'Bengaluru',
                    sublocality: 'HSR Layout',
                    admin1: 'Karnataka',
                    admin2: null,
                  },
                },
              ];
        await route.fulfill({ json: { data: { reverseLocation: { candidates } } } });
      } else {
        await route.continue();
      }
    });
    await startPlanning(page);
    await page.getByRole('button', { name: 'Use my location' }).click();
    const review = page.getByRole('form', { name: 'Your selected area' });
    await expect(
      review.getByRole('button', { name: 'Understand this area', exact: true }),
    ).toBeDisabled();
    await review.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(review.getByTestId('review-name')).toHaveText('HSR Layout, Bengaluru');
    const locationName = review.getByRole('button', { name: 'HSR Layout, Bengaluru', exact: true });
    await locationName.hover();
    await expect(
      review.getByRole('tooltip', {
        name: 'HSR Layout, Bengaluru, Karnataka 560102, India',
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath('location-name-tooltip.png'),
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(review.getByText('12.86763, 77.68380')).toBeVisible();
    expect(await confirm(page)).toMatchObject({
      countryCode: 'IN',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      private: true,
      accuracyMeters: 35,
      extent: 'USER_RADIUS',
      radiusMeters: 1000,
    });
    const summary = page.locator('section[aria-labelledby="location-summary-title"]');
    await expect(summary.getByText('India', { exact: true })).toHaveCount(1);
  });
});

test('future steps stay locked until their preceding stage is completed', async ({ page }) => {
  await startPlanning(page);
  const nav = page.getByRole('navigation', { name: 'Planning stages' });
  await expect(nav.getByRole('link')).toHaveCount(1);
  await expect(nav.locator('[aria-disabled="true"]')).toHaveCount(4);
  await page.getByRole('combobox', { name: 'Search for a place' }).fill('Nairobi');
  await page.getByRole('option', { name: /Nairobi/ }).click();
  await confirm(page);
  await expect(nav.getByRole('link', { name: /Baseline/ })).toBeVisible();
  await expect(nav.locator('[aria-disabled="true"]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to goal', exact: true }).click();
  await expect(page).toHaveURL(/\/goals$/);
  await expect(nav.getByRole('link', { name: /Goal/ })).toBeVisible();
  await expect(nav.locator('[aria-disabled="true"]')).toHaveCount(2);
  await nav.getByRole('link', { name: /Baseline/ }).click();
  await expect(nav.getByRole('link', { name: /Goal/ })).toBeVisible();
});
