import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

// Real-browser checks for Phase 03: six theme × palette combinations (token contrast),
// keyboard paths, reduced motion, hidden-tab pausing and responsive layouts.
// Screenshots are written only when WL_CAPTURE_SCREENSHOTS=1, so normal runs never
// rewrite docs.

const THEMES = ['light', 'dark'] as const;
const PALETTES = ['estuary', 'monsoon', 'grove'] as const;
const CAPTURE = process.env.WL_CAPTURE_SCREENSHOTS === '1';
const SHOT_DIR = fileURLToPath(
  new URL('../../../docs/design/screenshots/phase-03/', import.meta.url),
);

async function usePreferences(page: Page, theme: string, palette: string, mode = 'traditional') {
  await page.addInitScript(
    ([t, p, m]) => {
      window.localStorage.setItem('waterlens.display.v1', JSON.stringify({ theme: t, palette: p }));
      window.localStorage.setItem('waterlens.planningMode.v1', m!);
    },
    [theme, palette, mode],
  );
}

async function capture(page: Page, name: string, fullPage = false) {
  if (!CAPTURE) return;
  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOT_DIR}${name}.jpg`, type: 'jpeg', quality: 72, fullPage });
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Expected a 6-digit hex token, got "${hex}"`);
  const value = parseInt(match[1]!, 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

// [foreground, background, minimum ratio] — 4.5 for text, 3 for UI boundaries and chart marks.
const PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surface-sunken', 4.5],
  ['text', 'accent-soft', 4.5],
  ['text-muted', 'bg', 4.5],
  ['text-muted', 'surface', 4.5],
  ['text-muted', 'surface-sunken', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'surface', 4.5],
  ['accent-strong', 'accent-soft', 4.5],
  ['on-accent', 'accent', 4.5],
  ['surface', 'text', 4.5],
  ['success', 'success-soft', 4.5],
  ['warning', 'warning-soft', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['info', 'info-soft', 4.5],
  ['success', 'surface', 4.5],
  ['danger', 'surface', 4.5],
  // Notices, error summary and selected choice cards put body text on tinted surfaces.
  ['text', 'info-soft', 4.5],
  ['text', 'warning-soft', 4.5],
  ['text', 'danger-soft', 4.5],
  ['text-muted', 'accent-soft', 4.5],
  ['text-muted', 'surface-sunken', 4.5],
  ['accent', 'accent-soft', 3],
  ['focus', 'bg', 3],
  ['focus', 'surface', 3],
  ['border-strong', 'surface', 3],
  ['chart-1', 'surface', 3],
  ['chart-2', 'surface', 3],
  ['chart-3', 'surface', 3],
  ['chart-4', 'surface', 3],
];

for (const theme of THEMES) {
  for (const palette of PALETTES) {
    test(`${theme} + ${palette}: tokens meet contrast targets and components render`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await usePreferences(page, theme, palette);
      await page.goto('/design-system');
      await expect(page.getByRole('heading', { level: 1, name: 'Design system' })).toBeVisible();

      const html = page.locator('html');
      await expect(html).toHaveAttribute('data-theme', theme);
      await expect(html).toHaveAttribute('data-palette', palette);

      const tokens = await page.evaluate(
        (names) => {
          const style = getComputedStyle(document.documentElement);
          return Object.fromEntries(
            names.map((n) => [n, style.getPropertyValue(`--wl-color-${n}`).trim()]),
          );
        },
        [...new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]))],
      );

      const failures = PAIRS.map(([fg, bg, min]) => ({
        fg,
        bg,
        min,
        ratio: contrast(tokens[fg]!, tokens[bg]!),
      }))
        .filter((r) => r.ratio < r.min)
        .map((r) => `${r.fg} on ${r.bg}: ${r.ratio.toFixed(2)} < ${r.min}`);
      expect(failures, `contrast failures for ${theme}/${palette}`).toEqual([]);

      await capture(page, `design-system-${theme}-${palette}`, true);
    });
  }
}

test('theme and palette chosen in the Display menu persist across reload', async ({ page }) => {
  await page.goto('/area');
  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByRole('radio', { name: /dark/i }).check();
  await page.getByRole('radio', { name: /grove/i }).check();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'grove');
});

test('keyboard: skip link, stage navigation focus and dialog focus return', async ({ page }) => {
  await page.goto('/design-system');
  await expect(page.getByRole('heading', { level: 1, name: 'Design system' })).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

  const opener = page.getByRole('button', { name: 'Open dialog' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Example dialog' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeFocused();
  // Tab cycles within the dialog only.
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  await page.goto('/area');
  const goal = page
    .getByRole('navigation', { name: 'Planning stages' })
    .getByRole('link', { name: /goal/i });
  await goal.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Goal' })).toBeFocused();
  await expect(page).toHaveTitle('Goal · WaterLens');
});

test.describe('motion', () => {
  test('ambient animations run normally and pause while the tab is hidden', async ({ page }) => {
    await page.goto('/area');
    const wave = page.locator('[data-decor="water"] svg').first();
    await expect(wave).toHaveCSS('animation-play-state', 'running');
    expect(await wave.evaluate((el) => getComputedStyle(el).animationName)).not.toBe('none');

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('html')).toHaveAttribute('data-page-hidden', 'true');
    await expect(wave).toHaveCSS('animation-play-state', 'paused');
  });

  test('reduced motion disables ambient animation', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/area');
    for (const selector of ['[data-decor="water"] svg', '[data-decor="earth"] g']) {
      const name = await page
        .locator(selector)
        .first()
        .evaluate((el) => getComputedStyle(el).animationName);
      expect(name, selector).toBe('none');
    }
    await context.close();
  });
});

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`responsive ${viewport.name}: agent mode layout`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await usePreferences(page, 'light', 'estuary', 'agent');
    await page.goto('/area');
    const heading = page.getByRole('heading', { level: 1, name: 'Location' });
    await expect(heading).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow, 'page must not scroll sideways').toBeLessThanOrEqual(0);

    if (viewport.name === 'desktop') {
      const agent = page.getByRole('complementary', { name: 'Conversation' });
      await expect(agent).toBeVisible();
      const agentBox = await agent.boundingBox();
      const headingBox = await heading.boundingBox();
      expect(agentBox!.x + agentBox!.width).toBeLessThanOrEqual(headingBox!.x);
      await expect(page.getByRole('tablist', { name: 'Planning panes' })).toHaveCount(0);
    } else {
      const tabs = page.getByRole('tablist', { name: 'Planning panes' });
      await expect(tabs).toBeVisible();
      await tabs.getByRole('tab', { name: 'Conversation' }).click();
      await expect(page.getByRole('tabpanel', { name: 'Conversation' })).toBeVisible();
      await expect(heading).toBeHidden();
      await capture(page, `area-agent-${viewport.name}-agent-pane`);
      await tabs.getByRole('tab', { name: 'Workspace' }).click();
      await expect(heading).toBeVisible();
    }
    await capture(page, `area-agent-${viewport.name}`);
  });
}

const pageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('320 px reflow', () => {
  const ROUTES = [
    { path: '/area', heading: 'Location', mode: 'traditional' },
    { path: '/area', heading: 'Location', mode: 'agent' },
    { path: '/make-it-happen', heading: 'Make It Happen', mode: 'agent' },
    { path: '/communities', heading: 'Communities', mode: 'traditional' },
    { path: '/design-system', heading: 'Design system', mode: 'traditional' },
  ] as const;

  for (const route of ROUTES) {
    test(`${route.path} (${route.mode}) has no sideways scroll at 320 px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await usePreferences(page, 'light', 'estuary', route.mode);
      await page.goto(route.path);
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
      expect(await pageOverflow(page), 'page must not scroll sideways').toBeLessThanOrEqual(0);
      if (route.path === '/design-system') await capture(page, 'design-system-320');
      if (route.mode === 'agent' && route.path === '/area') await capture(page, 'area-agent-320');
    });
  }

  test('open tooltips stay inside the viewport at 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/design-system');
    for (const name of ['About shortage days', 'About example rate']) {
      const trigger = page.getByRole('button', { name });
      await trigger.focus();
      const tip = page.locator(`[id="${await trigger.getAttribute('aria-describedby')}"]`);
      await expect(tip).toBeVisible();
      const box = (await tip.boundingBox())!;
      expect(box.x, name).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, name).toBeLessThanOrEqual(320);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    }
  });

  test('dialogs become full-screen sheets at 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    // Measure the settled sheet, not the entrance animation.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/design-system');
    await page.getByRole('button', { name: 'Open dialog' }).click();
    const box = await page.getByRole('dialog', { name: 'Example dialog' }).boundingBox();
    const viewport = await page.evaluate(() => document.documentElement.clientWidth);
    expect(box!.x).toBeLessThanOrEqual(1);
    expect(box!.width).toBeGreaterThanOrEqual(viewport - 1);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test('desktop conversation pane resizes by pointer drag and keeps its width after reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await usePreferences(page, 'light', 'estuary', 'agent');
  await page.goto('/area');
  const pane = page.getByRole('complementary', { name: 'Conversation' });
  const handle = page.getByRole('separator', { name: 'Resize conversation pane' });
  const before = (await pane.boundingBox())!.width;

  const box = (await handle.boundingBox())!;
  const y = box.y + 40;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, y, { steps: 6 });
  await page.mouse.up();

  const after = (await pane.boundingBox())!.width;
  expect(after - before).toBeGreaterThan(100);
  await expect(handle).toBeFocused();

  // The workspace still gets the larger share at the maximum width.
  await page.keyboard.press('End');
  const workspace = page.getByRole('region', { name: 'Workspace' });
  expect((await pane.boundingBox())!.width).toBeLessThan((await workspace.boundingBox())!.width);

  const stored = await handle.getAttribute('aria-valuenow');
  await page.reload();
  await expect(page.getByRole('separator', { name: 'Resize conversation pane' })).toHaveAttribute(
    'aria-valuenow',
    stored!,
  );
});

test('choice cards and validation summary behave in a real browser', async ({ page }) => {
  await page.goto('/design-system');
  const group = page.getByRole('group', { name: 'How do you want to plan?' });
  const traditional = group.getByRole('radio', { name: /traditional/i });
  await expect(traditional).toBeChecked();
  // force: bypass Playwright's own enabled-check to prove the browser ignores the click.
  await group.getByText('With the assistant').click({ force: true });
  await expect(traditional).toBeChecked();
  await expect(group.getByRole('radio', { name: /with the assistant/i })).toBeDisabled();

  await page.getByRole('button', { name: 'Validate' }).click();
  const summary = page.getByRole('heading', { name: 'Check these fields' }).locator('..');
  await expect(summary).toBeFocused();
  await summary.getByRole('link').click();
  await expect(page.getByLabel(/^Budget/)).toBeFocused();
});

test('dark theme planning screenshots (traditional mode, desktop)', async ({ page }) => {
  test.skip(!CAPTURE, 'screenshot capture only');
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const palette of PALETTES) {
    await usePreferences(page, 'dark', palette);
    await page.goto('/plans');
    await expect(page.getByRole('heading', { level: 1, name: 'Compare' })).toBeVisible();
    await capture(page, `plans-dark-${palette}`);
  }
});
