import { expect, test as base } from '@playwright/test';

type BrowserIssue = {
  kind: 'console' | 'pageerror' | 'requestfailed' | 'server-error';
  message: string;
  url?: string;
};

function isIntentionalCancellation(message: string): boolean {
  return /(?:net::)?ERR_ABORTED/i.test(message);
}

export const test = base.extend<{ browserIssues: BrowserIssue[] }>({
  browserIssues: [
    async ({ page }, use, testInfo) => {
      const issues: BrowserIssue[] = [];
      const cancellations: BrowserIssue[] = [];

      page.on('console', (message) => {
        if (message.type() === 'error') issues.push({ kind: 'console', message: message.text() });
      });
      page.on('pageerror', (error) => {
        issues.push({ kind: 'pageerror', message: error.message });
      });
      page.on('requestfailed', (request) => {
        const issue: BrowserIssue = {
          kind: 'requestfailed',
          message: request.failure()?.errorText ?? 'request failed',
          url: request.url()
        };
        // Chromium aborts in-flight fetches when the test intentionally navigates/reloads.
        // Preserve them as evidence, but do not classify a browser cancellation as a network outage.
        if (isIntentionalCancellation(issue.message)) cancellations.push(issue);
        else issues.push(issue);
      });
      page.on('response', (response) => {
        if (response.status() >= 500) {
          issues.push({
            kind: 'server-error',
            message: `HTTP ${response.status()} ${response.statusText()}`,
            url: response.url()
          });
        }
      });

      await use(issues);

      if (cancellations.length > 0) {
        await testInfo.attach('browser-cancellations.json', {
          body: Buffer.from(JSON.stringify(cancellations, null, 2)),
          contentType: 'application/json'
        });
      }
      if (issues.length > 0) {
        await testInfo.attach('browser-issues.json', {
          body: Buffer.from(JSON.stringify(issues, null, 2)),
          contentType: 'application/json'
        });
        expect(issues, 'unexpected browser console/network/runtime errors').toEqual([]);
      }
    },
    { auto: true }
  ]
});

export { expect };
