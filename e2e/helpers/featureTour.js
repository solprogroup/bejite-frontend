import { FEATURE_TOUR_VERSION } from '../../src/utils/featureTourStorage.js';

/**
 * Mark feature / RM tours as seen for the logged-in user so e2e
 * interactions are not blocked by the spotlight overlay.
 */
export async function markToursSeen(page) {
  await page.evaluate((version) => {
    const raw = localStorage.getItem('user');
    let userId = '';
    try {
      const user = JSON.parse(raw || '{}');
      userId = String(user._id || user.id || user.email || '').trim();
    } catch {
      userId = '';
    }
    if (!userId) return;

    const keys = [
      `bejite_feature_tour_seen_v${version}_${userId}`,
      `bejite_rm_list_tour_seen_v${version}_${userId}`,
      `bejite_rm_detail_tour_seen_v${version}_${userId}`,
    ];
    for (const key of keys) {
      localStorage.setItem(key, 'true');
    }
    try {
      sessionStorage.removeItem('bejite_feature_tour_active');
    } catch {
      /* ignore */
    }
  }, FEATURE_TOUR_VERSION);
}

/** Dismiss an open feature tour overlay if present. */
export async function dismissFeatureTourIfOpen(page) {
  const tour = page.getByTestId('feature-tour');
  if (!(await tour.isVisible().catch(() => false))) return;

  const skip = tour.getByRole('button', { name: 'Skip tour' });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ force: true });
  } else {
    await tour.locator('.absolute.inset-0').first().click({ force: true });
  }

  await tour.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
}
