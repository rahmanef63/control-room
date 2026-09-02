import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const secret = 'e2e-control-room-secret-0123456789abcdef0123456789abcdef';
const viewports = [
  { name: 'narrow-320x568', width: 320, height: 568 },
  { name: 'phone-360x800', width: 360, height: 800 },
  { name: 'iphone-390x844', width: 390, height: 844 },
  { name: 'large-phone-430x932', width: 430, height: 932 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'desktop-1366x768', width: 1366, height: 768 },
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
