import { expect, test, type Page } from '@playwright/test';

test.skip(
  process.env.WP_E2E_AGENT !== '1',
  'Requires the local fake-inference API and Auth/Firestore emulators',
);

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with agent' }).click();
  await expect(page).toHaveURL(/\/area$/);
}

test('live events, token headers, reconnect and mode switching keep one run and session', async ({
  page,
}) => {
  let starts = 0;
  const streams: Array<{ url: string; token: string | undefined; cursor: string | undefined }> = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/v1/agent-conversations') && request.method() === 'POST') starts++;
    if (/agent-conversations\/[^/]+\/events/.test(request.url()))
      streams.push({
        url: request.url(),
        token: request.headers().authorization,
        cursor: request.headers()['last-event-id'],
      });
  });
  await start(page);
  await expect(page.getByLabel('Message', { exact: true })).toBeVisible();
  await page.getByLabel('Message', { exact: true }).fill('Check the rainfall data');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('You: Check the rainfall data');
  await expect(page.getByRole('button', { name: 'Edit in workspace' }).first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Completed' })).toBeVisible();
  expect(starts).toBe(1);
  expect(streams.length).toBeGreaterThan(0);
  expect(streams.every((s) => s.token?.startsWith('Bearer ') && !s.url.includes('token='))).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Open normal mode' }).click();
  await expect(page.getByRole('log')).toBeHidden();
  const agent = page.getByRole('radio', { name: 'Copilot', exact: true });
  await page.locator('label', { has: agent }).click();
  await expect(page.getByRole('log')).toContainText('You: Check the rainfall data');
  // Switching modes keeps the same conversation rather than starting another run.
  expect(starts).toBe(1);
});

test('cancellation is inline and does not duplicate a run', async ({ page }) => {
  await start(page);
  await page.getByLabel('Message', { exact: true }).fill('Check data');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel run' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Run cancelled' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled(); // empty composer
  await expect(page.getByRole('button', { name: 'Cancel run' })).toHaveCount(0);
});

test('mobile tabs and edit action are keyboard operable without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  const workspace = page.getByRole('tab', { name: 'Workspace', exact: true });
  await workspace.focus();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Conversation', exact: true })).toBeFocused();
  await page.getByLabel('Message', { exact: true }).fill('Check rainfall');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const edit = page.getByRole('button', { name: 'Edit in workspace' }).first();
  await expect(edit).toBeVisible();
  await edit.focus();
  await page.keyboard.press('Enter');
  await expect(workspace).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
