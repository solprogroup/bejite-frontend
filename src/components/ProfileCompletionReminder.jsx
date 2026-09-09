import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaTimes } from 'react-icons/fa';
import { getAccessToken, getUser, isAuthenticated } from '../utils/tokenManager';
import useProfileCompletionStatus from '../hooks/useProfileCompletionStatus';

const REMINDER_DISMISS_PREFIX = 'bejite_profile_update_dismissed_';

const SKIP_EXACT = new Set([
  '/',
  '/signup',
  '/forgot-password',
  '/email-check',
  '/complete-signup',
  '/confirmpassword',
]);

/** Onboarding / auth flows — hide popup here, but still show on main app (e.g. news-feed). */
const SKIP_PREFIXES = [
  '/auth/',
  '/admin',
  '/resume',
  '/bio',
  '/education',
  '/skills',
  '/work-history',
  '/certificate',
  '/links',
  '/job-type',
  '/save-progress',
  '/edit-profile',
  '/individual/',
  '/corporate/',
  '/jobseeker-option',
  '/employer-option',
  '/jobconnection',
  '/verify-email',
  '/verify-failed',
  '/verify-expired',
];

function shouldSkipPath(pathname) {
  if (SKIP_EXACT.has(pathname)) return true;
  return SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function resolveRecruiterMode(user) {
  const mode = String(user?.mode || '').toLowerCase();
  if (mode === 'individual' || mode === 'corporate') return mode;
  return null;
}

function getProfileSetupPath(role, mode) {
  if (role === 'recruiter' || role === 'employer') {
    if (mode === 'individual') {
      return '/edit-profile/individual/basic-details';
    }
    return '/edit-profile/recruiter/basic-details';
  }
  if (role === 'jobseeker') {
    return '/edit-profile/bio';
  }
  return '/complete-signup';
}

function readDismissedForUser(userId) {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${REMINDER_DISMISS_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
}

function isFeatureTourActive() {
  try {
    return sessionStorage.getItem('bejite_feature_tour_active') === 'true';
  } catch {
    return false;
  }
}

function useFeatureTourSuppressed() {
  const [suppressed, setSuppressed] = useState(() => isFeatureTourActive());

  useEffect(() => {
    const onTour = (e) => {
      setSuppressed(Boolean(e?.detail?.active) || isFeatureTourActive());
    };
    window.addEventListener('bejite:feature-tour', onTour);
    return () => window.removeEventListener('bejite:feature-tour', onTour);
  }, []);

  return suppressed;
}

/**
 * Fixed corner popup reminding authenticated users to update/complete their profile.
 *
 * - Incomplete profile: shows on app routes if profileCompleted !== true.
 * - When user clicks cancel / "Later": permanently dismisses for this user via localStorage.
 * - If user logs in as another user: checks that user's status and shows if incomplete.
 * - Complete profile: hides automatically when profileCompleted === true.
 */
export default function ProfileCompletionReminder() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduxToken = useSelector((state) => state.auth?.token);
  const reduxUser = useSelector((state) => state.auth?.user);
  const [dismissed, setDismissed] = useState(false);
  const tourActive = useFeatureTourSuppressed();

  const token = reduxToken || getAccessToken() || '';
  const authenticated = Boolean(token) || isAuthenticated();
  const onAppRoute = !shouldSkipPath(location.pathname);

  const { profileCompleted, loading } = useProfileCompletionStatus({
    enabled: authenticated && onAppRoute,
    authKey: token || null,
  });

  const user = reduxUser || getUser();
  const role = normalizeRole(user?.role);
  const userId = user?._id || user?.id || user?.email;
  const recruiterMode =
    role === 'recruiter' || role === 'employer'
      ? resolveRecruiterMode(user)
      : null;

  // Check persistent localStorage dismissal for this user
  const dismissedForUser = useMemo(() => {
    return readDismissedForUser(userId) || dismissed;
  }, [userId, dismissed]);

  const visible = useMemo(() => {
    if (!authenticated || !onAppRoute || loading) return false;
    if (!role) return false;
    if (profileCompleted === true) return false;
    if (dismissedForUser) return false;
    if (tourActive) return false;
    return true;
  }, [
    authenticated,
    onAppRoute,
    loading,
    role,
    profileCompleted,
    dismissedForUser,
    tourActive,
  ]);

  const handleDismiss = () => {
    if (userId) {
      try {
        localStorage.setItem(`${REMINDER_DISMISS_PREFIX}${userId}`, 'true');
      } catch {
        /* ignore */
      }
    }
    setDismissed(true);
  };

  if (!visible) return null;

  const setupPath = getProfileSetupPath(role, recruiterMode);
  const isIndividualRecruiter = recruiterMode === 'individual';
  const isRecruiter = role === 'recruiter' || role === 'employer';
  const title = isRecruiter
    ? 'Update your recruiter profile'
    : 'Update your jobseeker profile';
  const description = isIndividualRecruiter
    ? 'Finish every profile step and upload your ID to match Bejite\'s hiring process. Skip does not count as complete.'
    : isRecruiter
      ? 'Finish every company step and upload your registration document to match Bejite\'s hiring process. Skip does not count as complete.'
      : 'Update your profile to match Bejite\'s hiring process for recruiters. Finish every CV step, including photo and certificate uploads. Skip does not count as complete.';

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Profile update reminder"
      data-testid="profile-completion-reminder"
      className="fixed bottom-4 right-4 z-[100] w-[min(100vw-2rem,22rem)] rounded-xl border border-[#16730F]/30 bg-white p-4 shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#1A3E32]">{title}</p>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed">
            {description}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer transition-colors"
          aria-label="Dismiss reminder"
        >
          <FaTimes size={14} />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => navigate(setupPath)}
          className="flex-1 rounded-lg bg-[#16730F] px-3 py-2 text-sm font-medium text-white hover:bg-[#125c0c] transition-colors cursor-pointer text-center"
        >
          Update profile
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Later
        </button>
      </div>
    </div>
  );
}
