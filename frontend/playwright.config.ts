import { defineConfig } from '@playwright/test';

const secret = 'e2e-control-room-secret-0123456789abcdef0123456789abcdef';
const sessionSecret = 'e2e-session-secret-0123456789abcdef0123456789abcdef0123';
const browserChannel = process.env.PLAYWRIGHT_USE_BUNDLED === '1' ? undefined : 'chrome';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_500 },
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:44173',
    browserName: 'chromium',
    ...(browserChannel ? { channel: browserChannel } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: [
    {
      command: 'node e2e/stub-agent.mjs',
      url: 'http://127.0.0.1:45999/health',
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      command: 'bun run build && node build/index.js',
      url: 'http://127.0.0.1:44173/login',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: '44173',
        HOST: '127.0.0.1',
        NODE_ENV: 'production',
        ORIGIN: 'http://127.0.0.1:44173',
        CONTROL_ROOM_SECRET: secret,
        CONTROL_ROOM_SESSION_SECRET: sessionSecret,
        AGENT_GATEWAY_SECRET: 'e2e-gateway-secret-0123456789abcdef0123456789abcdef012',
        TERMINAL_GATEWAY_URL: 'http://127.0.0.1:45999',
        CONTROL_ROOM_LOCAL_TRUST: '1',
        AUTH_DEVICE_STORE: '/tmp/control-room-e2e-auth-devices.json'
      }
    }
  ]
});
