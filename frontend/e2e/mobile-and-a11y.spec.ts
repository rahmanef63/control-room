import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const secret = 'e2e-control-room-secret-0123456789abcdef0123456789abcdef';
const viewports = [
  { name: 'narrow-320x568', width: 320, height: 568 },
  { name: 'phone-360x800', width: 360, height: 800 },
  { name: 'iphone-390x844', width: 390, height: 844 },
  { name: 'large-phone-430x932', width: 430, height: 932 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'desktop-1366x768', width: 1366, height: 768 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'desktop-wide-1920x1080', width: 1920, height: 1080 },
  { name: 'landscape-844x390', width: 844, height: 390 }
];

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Access secret').fill(secret);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/');
}

test('responsive matrix has no document overflow', async ({ page }) => {
  await page.setViewportSize({ width: viewports[0].width, height: viewports[0].height });
  await login(page);
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(100);
    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth
    }));
    expect(dimensions.scrollWidth, viewport.name).toBeLessThanOrEqual(dimensions.innerWidth + 1);
    expect(dimensions.bodyWidth, viewport.name).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  }
});


test('security headers and unauthenticated API boundary are enforced', async ({ page, request }) => {
  const response = await page.goto('/login');
  expect(response).not.toBeNull();
  const headers = response!.headers();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['strict-transport-security']).toContain('max-age=31536000');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['x-request-id']).toBeTruthy();

  const api = await request.get('/api/terminals');
  expect(api.status()).toBe(401);
  expect(api.headers()['x-request-id']).toBeTruthy();
});

test('login and app have no serious accessibility violations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([]);

  await login(page);
  results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([]);
});

test('login visual baseline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page).toHaveScreenshot('login-390x844.png', { fullPage: true, animations: 'disabled' });
});


test('terminal workspace creates and duplicates shells without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page);

  const menubar = page.locator('.app-menubar');
  const workspaceBar = page.locator('.workspace-tabs');
  const commandbar = page.locator('.terminal-commandbar');
  await expect(menubar).toBeVisible();
  await expect(workspaceBar).toBeVisible();
  await expect(commandbar).toBeVisible();

  const desktopChrome = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
    const menu = rect('.app-menubar');
    const workspaces = rect('.workspace-tabs');
    const commands = rect('.terminal-commandbar');
    const stage = rect('.terminal-stage');
    return {
      menuHeight: menu?.height ?? 999,
      workspaceHeight: workspaces?.height ?? 999,
      commandHeight: commands?.height ?? 999,
      stageHeight: stage?.height ?? 0
    };
  });
  expect(desktopChrome.menuHeight).toBeLessThanOrEqual(32);
  expect(desktopChrome.workspaceHeight).toBeLessThanOrEqual(34);
  expect(desktopChrome.commandHeight).toBeLessThanOrEqual(40);
  expect(desktopChrome.stageHeight).toBeGreaterThan(620);

  await page.getByRole('button', { name: '+ New shell' }).click();
  await expect(page.getByRole('button', { name: 'Close terminal' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Duplicate terminal' })).toBeVisible();
  await page.screenshot({ path: '../.agent/evidence/artifacts/layout-after-desktop.png', fullPage: true, animations: 'disabled' });

  await page.getByRole('button', { name: 'Duplicate terminal' }).click();
  await expect(page.locator('.session-tab')).toHaveCount(2);

  let dimensions = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.app-menubar__menus')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open terminal controls' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open terminal launcher' }).first()).toBeVisible();
  const mobileChrome = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
    const menu = rect('.app-menubar');
    const workspaces = rect('.workspace-tabs');
    const commands = rect('.terminal-commandbar');
    return {
      menuHeight: menu?.height ?? 999,
      workspaceHeight: workspaces?.height ?? 999,
      commandHeight: commands?.height ?? 999
    };
  });
  expect(mobileChrome.menuHeight).toBeLessThanOrEqual(36);
  expect(mobileChrome.workspaceHeight).toBeLessThanOrEqual(34);
  expect(mobileChrome.commandHeight).toBeLessThanOrEqual(40);
  await page.screenshot({ path: '../.agent/evidence/artifacts/layout-after-mobile-compact.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Open terminal controls' }).click();
  await expect(page.getByRole('group', { name: 'Terminal toolbar' }).getByLabel('Open terminal launcher')).toBeVisible();
  await page.screenshot({ path: '../.agent/evidence/artifacts/layout-after-mobile.png', fullPage: true, animations: 'disabled' });
  dimensions = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([]);
});
