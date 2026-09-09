import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { markToursSeen } from './helpers/featureTour.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '.auth/user.json');

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const hasCreds = Boolean(email && password);

function writeEmptyAuth() {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  fs.writeFileSync(
    authFile,
    JSON.stringify({ cookies: [], origins: [] }, null, 2),
  );
}

async function waitForLoginSuccess(page) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    if (token) return;

    const inline = page.getByTestId('signin-error');
    if (await inline.isVisible().catch(() => false)) {
      throw new Error(
        `Login failed: ${(await inline.textContent())?.trim() || 'unknown error'}. Is the API up at E2E_API_URL / :3001?`,
      );
    }
    const toast = page.locator('.Toastify__toast--error').first();
    if (await toast.isVisible().catch(() => false)) {
      throw new Error(
        `Login failed: ${(await toast.textContent())?.trim() || 'toast error'}. Is the API up at E2E_API_URL / :3001?`,
      );
    }
    await page.waitForTimeout(200);
  }
  throw new Error('Login timed out waiting for accessToken');
}

setup('authenticate as user', async ({ page }) => {
  if (!hasCreds) {
    writeEmptyAuth();
    setup.skip(true, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD');
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('signin-email').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByTestId('signin-email').fill(email);
  await page.getByTestId('signin-password').fill(password);
  await page.getByTestId('signin-submit').click();

  await waitForLoginSuccess(page);

  await expect
    .poll(async () => new URL(page.url()).pathname, { timeout: 30_000 })
    .not.toBe('/');

  // Prevent the feature-tour overlay from blocking authenticated e2e clicks.
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('user')), {
      timeout: 15_000,
    })
    .toBeTruthy();
  await markToursSeen(page);

  await page.context().storageState({ path: authFile });
});
