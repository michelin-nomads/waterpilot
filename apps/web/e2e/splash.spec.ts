import { expect, test } from '@playwright/test';

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 390, 1440]) {
    test(`splash fits ${width}px in ${colorScheme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/splash');
      await expect(page.getByText(/A more water-secure/)).toBeVisible();
      await expect(page.getByLabel('WaterPilot startup').getByRole('banner')).toHaveCount(0);
      await expect(page.getByLabel('WaterPilot startup').getByRole('link')).toHaveCount(0);
      await expect(page.getByLabel('WaterPilot startup').getByRole('status')).toContainText(
        'Preparing your workspace',
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await expect(page.getByRole('link', { name: 'Open WaterPilot' })).toHaveCount(0);
      const wave = page.locator('[class*="waveFront"]').first();
      const before = await wave.evaluate((el) => getComputedStyle(el).transform);
      await expect
        .poll(() => wave.evaluate((el) => getComputedStyle(el).transform))
        .not.toBe(before);
      await page.screenshot({
        path: test.info().outputPath('splash.png'),
        animations: 'disabled',
        fullPage: true,
      });
    });
  }
}

test('reduced motion shows a static illustration and still opens the app', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/splash');
  await expect(page.getByText(/A more water-secure/)).toBeVisible();
  for (const className of ['world', 'waveFront', 'cloudLeft', 'earthTurn', 'dropFloat']) {
    const item = page.locator(`svg [class*="${className}"]`).first();
    await expect(item).toHaveCSS('animation-name', 'none');
  }

  await expect(
    page.getByRole('heading', { name: 'A better water plan starts here.' }),
  ).toBeVisible();
});

test('the splash remains during auth loading, then opens the requested screen', async ({
  page,
}) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/src/auth/firebaseClient.ts*', async (route) => {
    await waiting;
    await route.continue();
  });
  await page.goto('/signin');
  await expect(page.getByText(/A more water-secure/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open WaterPilot' })).toHaveCount(0);
  // A slow load must keep the splash even after the 2-second introduction.
  await page.waitForTimeout(2200);
  await expect(page.getByText(/A more water-secure/)).toBeVisible();
  release();
  await expect(page.getByRole('heading', { name: 'Welcome to WaterPilot' })).toBeVisible();
  await expect(page.getByText(/A more water-secure/)).toHaveCount(0);
  await expect(page).toHaveURL(/\/signin$/);
});

test('startup shows the splash for 2 seconds and automatically opens home', async ({ page }) => {
  await page.addInitScript(() => {
    let seen = false;
    const observer = new MutationObserver(() => {
      const visible = document.querySelector('[aria-label="WaterPilot startup"]') !== null;
      if (visible && !seen) {
        seen = true;
        performance.mark('test:splash-start');
      } else if (!visible && seen) {
        performance.measure('test:splash-duration', 'test:splash-start');
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');
  await expect(page.getByText(/A more water-secure/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open WaterPilot' })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'A better water plan starts here.' }),
  ).toBeVisible();
  const duration = await page.evaluate(
    () => performance.getEntriesByName('test:splash-duration')[0]?.duration,
  );
  expect(duration).toBeGreaterThanOrEqual(1950);
  await expect(page.getByLabel('WaterPilot startup')).toHaveCount(0);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to WaterPilot' })).toBeVisible();
  await expect(page.getByLabel('WaterPilot startup')).toHaveCount(0);
});

test('the old splash link automatically opens home without a manual button', async ({ page }) => {
  await page.goto('/splash');
  await expect(
    page.getByRole('heading', { name: 'A better water plan starts here.' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Open WaterPilot' })).toHaveCount(0);
});

test('the HTML shows no old loader before the splash mounts', async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/src/main.tsx*', async (route) => {
    await waiting;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#root')).toBeAttached();
  await expect(page.locator('#root')).toBeEmpty();
  await expect(page.locator('.wp-boot')).toHaveCount(0);
  release();
  await expect(page.getByLabel('WaterPilot startup')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'A better water plan starts here.' }),
  ).toBeVisible();
});
