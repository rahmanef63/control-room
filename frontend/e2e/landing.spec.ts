import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const canonical = 'https://vps.rahmanef.com/landing';

const viewports = [
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'full-hd-1920x1080', width: 1920, height: 1080 }
];

test('landing is public, indexable, structured, and zero-CSR', async ({ page, request }) => {
  const response = await page.goto('/landing');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Control Room — Browser Terminal Multiplexer for Your VPS');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your terminal sessions');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index,follow/);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');

  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
  expect(jsonLd).toBeTruthy();
  const schema = JSON.parse(jsonLd ?? '{}') as { '@type'?: string; name?: string; url?: string };
  expect(schema['@type']).toBe('SoftwareApplication');
  expect(schema.name).toBe('Control Room');
  expect(schema.url).toBe(canonical);

  // `/landing` opts out of CSR. The only script in its HTML is non-executable JSON-LD.
  await expect(page.locator('script[type="module"]')).toHaveCount(0);
  await expect(page.locator('script[src]')).toHaveCount(0);

  const externalResources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => new URL(entry.name))
      .filter((url) => url.origin !== window.location.origin)
      .map((url) => url.href)
  );
  expect(externalResources).toEqual([]);

  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('Allow: /landing');
  expect(await robots.text()).toContain('Sitemap: https://vps.rahmanef.com/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain(`<loc>${canonical}</loc>`);
});

test('landing stays responsive, accessible, and motion-safe', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/landing');

    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth
    }));
    expect(dimensions.scrollWidth, viewport.name).toBeLessThanOrEqual(dimensions.innerWidth + 1);
    expect(dimensions.bodyWidth, viewport.name).toBeLessThanOrEqual(dimensions.innerWidth + 1);

    if (viewport.name === 'phone-390x844' || viewport.name === 'desktop-1440x900') {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')),
        viewport.name
      ).toEqual([]);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/landing');
  await page.screenshot({
    path: '../.agent/evidence/artifacts/landing-desktop-1440x900.png',
    fullPage: true,
    animations: 'disabled'
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/landing');
  const cursorDuration = await page.locator('.terminal-prompt i').evaluate((node) => getComputedStyle(node).animationDuration);
  expect(Number.parseFloat(cursorDuration)).toBeLessThanOrEqual(0.00001);
  await page.screenshot({
    path: '../.agent/evidence/artifacts/landing-mobile-390x844.png',
    fullPage: true,
    animations: 'disabled'
  });
});
