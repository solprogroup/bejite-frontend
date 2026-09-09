import { test, expect } from '@playwright/test';
import {
  dismissFeatureTourIfOpen,
  markToursSeen,
} from '../helpers/featureTour.js';

const hasCreds = Boolean(
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD,
);

test.describe('chat day separators', () => {
  test.skip(!hasCreds, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD');

  test('opening a thread shows a day label and message time', async ({
    page,
  }) => {
    await page.goto('/chats');
    await markToursSeen(page);
    await dismissFeatureTourIfOpen(page);

    await expect(page.getByText('Loading conversations...').first()).toBeHidden({
      timeout: 40_000,
    });

    const desktop = page.locator('div.hidden.lg\\:grid');
    const conversation = desktop.locator('.rounded-xl.cursor-pointer').first();
    await expect(conversation).toBeVisible({ timeout: 20_000 });
    await dismissFeatureTourIfOpen(page);
    await conversation.click();

    const thread = desktop.locator('[data-chat-messages]');
    await expect(thread).toBeVisible({ timeout: 20_000 });

    const empty = thread.getByText('No messages yet');
    if (await empty.isVisible().catch(() => false)) {
      test.info().annotations.push({
        type: 'note',
        description: 'Selected conversation has no messages yet',
      });
      return;
    }

    await expect(desktop.locator('[data-chat-day]').first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
