/**
 * Shared tour persistence helpers.
 * Bump FEATURE_TOUR_VERSION to re-show tours for existing users.
 */
export const FEATURE_TOUR_VERSION = 3;

const FEATURE_BASE = "bejite_feature_tour_seen";
const RM_LIST_BASE = "bejite_rm_list_tour_seen";
const RM_DETAIL_BASE = "bejite_rm_detail_tour_seen";

function versionedPrefix(base, version = FEATURE_TOUR_VERSION) {
  return `${base}_v${version}_`;
}

export function getFeatureTourSeenPrefix(version = FEATURE_TOUR_VERSION) {
  return versionedPrefix(FEATURE_BASE, version);
}

export function getRmListTourSeenPrefix(version = FEATURE_TOUR_VERSION) {
  return versionedPrefix(RM_LIST_BASE, version);
}

export function getRmDetailTourSeenPrefix(version = FEATURE_TOUR_VERSION) {
  return versionedPrefix(RM_DETAIL_BASE, version);
}

function isLegacyTourKey(key) {
  if (!key || typeof key !== "string") return false;

  const currentFeature = getFeatureTourSeenPrefix();
  const currentRmList = getRmListTourSeenPrefix();
  const currentRmDetail = getRmDetailTourSeenPrefix();

  // Keep current version keys.
  if (
    key.startsWith(currentFeature) ||
    key.startsWith(currentRmList) ||
    key.startsWith(currentRmDetail)
  ) {
    return false;
  }

  // Unversioned v1 keys: bejite_feature_tour_seen_<uuid>
  // Versioned older keys: bejite_feature_tour_seen_v1_<uuid>, etc.
  return (
    key.startsWith(`${FEATURE_BASE}_`) ||
    key.startsWith(`${RM_LIST_BASE}_`) ||
    key.startsWith(`${RM_DETAIL_BASE}_`)
  );
}

/**
 * Remove orphaned tour "seen" flags from older versions / unversioned keys.
 * Safe to call repeatedly.
 */
export function cleanupLegacyTourSeenKeys() {
  if (typeof localStorage === "undefined") return;

  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (isLegacyTourKey(key)) toRemove.push(key);
    }
    for (const key of toRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function readFeatureTourSeen(userId) {
  if (!userId) return false;
  try {
    return (
      localStorage.getItem(`${getFeatureTourSeenPrefix()}${userId}`) === "true"
    );
  } catch {
    return false;
  }
}

export function writeFeatureTourSeen(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(`${getFeatureTourSeenPrefix()}${userId}`, "true");
  } catch {
    /* ignore */
  }
}

export function readRmTourSeen(prefix, userId) {
  if (!userId || !prefix) return false;
  try {
    return localStorage.getItem(`${prefix}${userId}`) === "true";
  } catch {
    return false;
  }
}

export function writeRmTourSeen(prefix, userId) {
  if (!userId || !prefix) return;
  try {
    localStorage.setItem(`${prefix}${userId}`, "true");
  } catch {
    /* ignore */
  }
}
