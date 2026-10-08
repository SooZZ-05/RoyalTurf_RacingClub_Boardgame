import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 180000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: [
    {
      command: 'node --import tsx scripts/test-server.ts',
      url: 'http://127.0.0.1:8788/api/health',
      timeout: 30000,
    },
    {
      command: 'API_PROXY_TARGET=http://127.0.0.1:8788 npm run dev -- --port 5174',
      url: 'http://127.0.0.1:5174',
      timeout: 30000,
    },
  ],
});
