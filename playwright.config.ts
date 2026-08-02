import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import os from 'os';

// The Firestore emulator (required by firebase-tools) needs a portable JDK
// that isn't installed system-wide on this machine. See tests/README.md.
const JAVA_HOME = path.join(os.homedir(), '.cache', 'justdosa-e2e', 'jdk-21.0.12+8', 'Contents', 'Home');
const PATH_WITH_JAVA = `${path.join(JAVA_HOME, 'bin')}:${process.env.PATH}`;

const TEST_PORT = 3100;
const EMULATOR_UI_PORT = 4000;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  // Tests share one Firestore emulator instance and reseed it per-test, so
  // they must run serially (concurrency tests simulate simultaneous users
  // via multiple browser contexts *within* a single test, not by racing
  // separate test files against each other).
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${TEST_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx firebase emulators:start --only firestore --project just-dosa',
      url: `http://127.0.0.1:${EMULATOR_UI_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, JAVA_HOME, PATH: PATH_WITH_JAVA },
    },
    {
      command: `npx vite --port=${TEST_PORT} --host=127.0.0.1`,
      url: `http://127.0.0.1:${TEST_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { ...process.env, VITE_USE_FIRESTORE_EMULATOR: 'true' },
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
