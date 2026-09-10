import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaTimes } from 'react-icons/fa';
import { getAccessToken, getUser, isAuthenticated } from '../utils/tokenManager';
import useProfileCompletionStatus from '../hooks/useProfileCompletionStatus';

const HIRING_REMINDER_DISMISS_PREFIX = 'bejite_jobseeker_hiring_reminder_dismissed_';

const SKIP_EXACT = new Set([
  '/',
  '/signup',
  '/forgot-password',
  '/email-check',
  '/complete-signup',
  '/confirmpassword',
]);

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

/**
 * Fixed corner popup for job seekers who have already completed their profile,
 * reminding them to update and match Bejite's hiring process for recruiters.
 *
 * - Checks if the user has completed their profile first (profileCompleted === true).
 * - Only applies to job seekers.
 * - Clicking the close (cancel) icon permanently dismisses it for this user via localStorage.
 */
export default function JobseekerHiringProcessReminder() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduxToken = useSelector((state) => state.auth?.token);
  const reduxUser = useSelector((state) => state.auth?.user);
  const [dismissed, setDismissed] = useState(false);

  const token = reduxToken || getAccessToken() || '';
  const authenticated = Boolean(token) || isAuthenticated();
  const onAppRoute = !shouldSkipPath(location.pathname);

  // Check if user has completed profile first, same as ProfileCompletionReminder does
  const { profileCompleted, loading } = useProfileCompletionStatus({
    enabled: authenticated && onAppRoute,
    authKey: token || null,
  });

  const user = reduxUser || getUser();
  const role = normalizeRole(user?.role);
  const isJobseeker = role === 'jobseeker';
  const userId = user?._id || user?.id || user?.email;

  // Check persistent localStorage dismissal for this specific user
  const isDismissedInStorage = useMemo(() => {
    if (!userId) return false;
    try {
      return localStorage.getItem(`${HIRING_REMINDER_DISMISS_PREFIX}${userId}`) === 'true';
    } catch {
      return false;
    }
  }, [userId, dismissed]);

  // Support ?showhiring=true for quick testing
  const urlParams = new URLSearchParams(window.location.search);
  const forceShow = urlParams.get('showhiring') === 'true';

  const visible = useMemo(() => {
    if (forceShow) return true;
    if (!authenticated || !onAppRoute || loading) return false;
    if (!isJobseeker) return false;
    // Check if the user has completed their profile first
    if (profileCompleted !== true) return false;
    if (isDismissedInStorage) return false;
    return true;
  }, [
    forceShow,
    authenticated,
    onAppRoute,
    loading,
    isJobseeker,
    profileCompleted,
    isDismissedInStorage,
  ]);

  const handleDismiss = () => {
    const idToSave = userId || 'anonymous';
    try {
      localStorage.setItem(`${HIRING_REMINDER_DISMISS_PREFIX}${idToSave}`, 'true');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Jobseeker hiring process reminder"
      data-testid="jobseeker-hiring-process-reminder"
      className="fixed bottom-3 right-3 left-3 sm:left-auto sm:right-4 sm:bottom-4 z-[90] sm:w-[22rem] max-w-full rounded-xl border border-[#16730F]/30 bg-white p-3.5 sm:p-4 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#1A3E32]">
            Update your profile for recruiters
          </p>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed">
            Update your profile and role preferences to match Bejite&apos;s hiring process so top recruiters can discover and shortlist you faster.
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
          onClick={() => {
            navigate('/edit-profile/job-type');
          }}
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
