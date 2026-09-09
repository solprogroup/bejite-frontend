import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import { getAccessToken, getUser, isAuthenticated } from "../utils/tokenManager";
import {
  cleanupLegacyTourSeenKeys,
  readFeatureTourSeen,
  writeFeatureTourSeen,
} from "../utils/featureTourStorage";

const TOUR_ACTIVE_KEY = "bejite_feature_tour_active";

const SKIP_EXACT = new Set([
  "/",
  "/signup",
  "/forgot-password",
  "/email-check",
  "/complete-signup",
  "/confirmpassword",
]);

const SKIP_PREFIXES = [
  "/auth/",
  "/admin",
  "/resume",
  "/bio",
  "/education",
  "/skills",
  "/work-history",
  "/certificate",
  "/links",
  "/job-type",
  "/save-progress",
  "/edit-profile",
  "/individual/",
  "/corporate/",
  "/jobseeker-option",
  "/employer-option",
  "/employer/recruitment-management",
  "/jobconnection",
  "/verify-email",
  "/verify-failed",
  "/verify-expired",
];

const PAD = 10;

function shouldSkipPath(pathname) {
  if (SKIP_EXACT.has(pathname)) return true;
  return SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function setTourActive(active) {
  try {
    if (active) sessionStorage.setItem(TOUR_ACTIVE_KEY, "true");
    else sessionStorage.removeItem(TOUR_ACTIVE_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent("bejite:feature-tour", { detail: { active: Boolean(active) } }),
    );
  } catch {
    /* ignore */
  }
}

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

function findTourTarget(tourId) {
  const nodes = document.querySelectorAll(`[data-tour-id="${tourId}"]`);
  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return nodes[0] || null;
}

function buildSteps(role) {
  const isJobseeker = role === "jobseeker";
  const isRecruiterOrEmployer = role === "recruiter" || role === "employer";

  const steps = [
    {
      id: "intro",
      title: "Welcome to Bejite",
      body: "Here’s a quick tour of the main features so you can find your way around.",
      target: null,
    },
    {
      id: "home-icon",
      title: "News Feed",
      body: "See posts from your network, share updates, and stay active on the platform.",
      target: "home-icon",
      mobileNav: true,
    },
    {
      id: "CHAT",
      title: "Chats",
      body: "Message recruiters and candidates directly from your inbox.",
      target: "CHAT",
      mobileNav: true,
    },
    {
      id: "notifications",
      title: "Notifications",
      body: "Get alerts for applications, connections, interviews, and more.",
      target: "notifications",
      mobileNav: true,
    },
    isJobseeker
      ? {
          id: "job-vacancy",
          title: "Job Vacancy",
          body: "Browse open roles, filter by what you want, and apply in a few taps.",
          target: "job-vacancy",
          mobileNav: true,
        }
      : {
          id: "recruitment",
          title: "Recruitment",
          body: "Run ASE searches, manage jobs, and move candidates through your hiring pipeline.",
          target: "recruitment",
          mobileNav: true,
        },
    {
      id: "connection",
      title: "Connections",
      body: isJobseeker
        ? "Grow your network — connect with people who can help you land your next role."
        : "Build your network of candidates and peers to hire and collaborate faster.",
      target: "connection",
      mobileNav: true,
    },
    {
      id: "milestones",
      title: "Milestones",
      body: "Celebrate birthdays and work anniversaries in your network — and never miss a moment to reconnect.",
      target: "milestones",
      mobileNav: true,
    },
  ];

  if (isRecruiterOrEmployer) {
    steps.push({
      id: "adpro",
      title: "AdPro",
      body: "Promote jobs and campaigns to the right audience with AdPro credits from your ASE plan.",
      target: "adpro",
      mobileNav: true,
    });
  }

  steps.push(
    {
      id: "activity-log",
      title: "Activity Log",
      body: isJobseeker
        ? "Manage everything you’ve shared — your posts and media, plus weekly or monthly likes, comments, and views."
        : "Review your posts and engagement stats, and open Job Applications to manage candidates who applied to your roles.",
      target: "activity-log",
      mobileNav: true,
    },
    {
      id: "badge-status",
      title: "Badge Status",
      body: isJobseeker
        ? "Get a Verified Badge on your profile — plus monthly employment reports, partner events, and featured placement."
        : "Get the Verified Recruiter badge by uploading your ID and gain more trust from jobseekers.",
      target: "badge-status",
      mobileNav: true,
    },
    {
      id: "role-menu",
      title: isJobseeker ? "Your account menu" : "Recruiter menu",
      body: isJobseeker
        ? "Open your Jobseeker menu for edit profile and account shortcuts."
        : "Open your Recruiter / Employer menu for profile, candidate search, subscription, job postings, and more.",
      target: "role-menu",
      mobileNav: false,
    },
  );

  return steps;
}

/**
 * First-timer spotlight tour over real header nav items.
 * Persistence: localStorage per user (no backend).
 */
export default function FeatureTour() {
  const location = useLocation();
  const reduxToken = useSelector((state) => state.auth?.token);
  const reduxUser = useSelector((state) => state.auth?.user);

  const token = reduxToken || getAccessToken() || "";
  const authenticated = Boolean(token) || isAuthenticated();
  const user = reduxUser || getUser();
  const role = normalizeRole(user?.role);
  const userId = user?._id || user?.id || user?.email;
  const onAppRoute = !shouldSkipPath(location.pathname);
  // Tour targets live in the news-feed chrome; only start there.
  const onNewsFeed = location.pathname === "/news-feed";

  const steps = useMemo(() => buildSteps(role), [role]);

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const mobileNavOpenedRef = useRef(false);

  const currentStep = steps[stepIndex] || null;
  const isLast = stepIndex >= steps.length - 1;

  useEffect(() => {
    cleanupLegacyTourSeenKeys();
  }, []);

  const pauseTourUi = useCallback(() => {
    setIsOpen(false);
    setTourActive(false);
    setRect(null);
    window.dispatchEvent(new Event("bejite:close-mobile-nav"));
    mobileNavOpenedRef.current = false;
  }, []);

  const finishTour = useCallback(() => {
    writeFeatureTourSeen(userId);
    pauseTourUi();
    setStepIndex(0);
  }, [userId, pauseTourUi]);

  const measureTarget = useCallback((tourId) => {
    if (!tourId) {
      setRect(null);
      return;
    }
    const el = findTourTarget(tourId);
    if (!el) {
      setRect(null);
      return;
    }
    try {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch {
      /* ignore */
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    });
  }, []);

  // Decide whether to start the tour (news-feed only; pause if user leaves)
  useEffect(() => {
    if (!authenticated || !onAppRoute || !role || !onNewsFeed) {
      // Leaving news-feed pauses without marking seen, so it can resume later.
      pauseTourUi();
      return undefined;
    }

    const params = new URLSearchParams(window.location.search);
    const forceShow = params.get("showtour") === "true";
    if (!forceShow && readFeatureTourSeen(userId)) {
      setIsOpen(false);
      setTourActive(false);
      return undefined;
    }

    let cancelled = false;
    let opened = false;
    // Suppress corner reminders immediately while we wait to open.
    setTourActive(true);
    const timer = setTimeout(() => {
      if (cancelled) return;
      opened = true;
      setStepIndex(0);
      setIsOpen(true);
    }, 900);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (!opened) {
        setTourActive(false);
      }
    };
  }, [authenticated, onAppRoute, onNewsFeed, role, userId, location.search, pauseTourUi]);

  // Keep spotlight aligned with the current step target
  useEffect(() => {
    if (!isOpen || !currentStep) return undefined;

    let cancelled = false;

    const prepareAndMeasure = async () => {
      if (isMobileViewport()) {
        const needsDrawer =
          Boolean(currentStep.target) && currentStep.mobileNav !== false;
        if (needsDrawer) {
          window.dispatchEvent(new Event("bejite:open-mobile-nav"));
          mobileNavOpenedRef.current = true;
          await new Promise((r) => setTimeout(r, 160));
        } else if (mobileNavOpenedRef.current) {
          window.dispatchEvent(new Event("bejite:close-mobile-nav"));
          mobileNavOpenedRef.current = false;
          await new Promise((r) => setTimeout(r, 120));
        }
      }

      if (cancelled) return;
      measureTarget(currentStep.target);
      requestAnimationFrame(() => {
        if (!cancelled) measureTarget(currentStep.target);
      });
    };

    prepareAndMeasure();

    const onResizeOrScroll = () => measureTarget(currentStep.target);
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [isOpen, currentStep, measureTarget, stepIndex]);

  // Escape skips (marks seen)
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") finishTour();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, finishTour]);

  if (!isOpen || !currentStep) return null;

  const tooltipStyle = (() => {
    const MARGIN = 16;
    // Matches w-[min(100vw-2rem,22rem)]
    const cardWidth = Math.min(window.innerWidth - MARGIN * 2, 22 * 16);

    if (!rect) {
      return {
        top: "50%",
        left: "50%",
        width: cardWidth,
        maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
        transform: "translate(-50%, -50%)",
      };
    }

    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const placeBelow = spaceBelow > 200;
    const estimatedCardHeight = 200;
    let top = placeBelow
      ? rect.top + rect.height + 14
      : rect.top - 14;

    if (!placeBelow) {
      top = Math.max(MARGIN, top - estimatedCardHeight);
    } else {
      top = Math.min(top, window.innerHeight - estimatedCardHeight - MARGIN);
      top = Math.max(MARGIN, top);
    }

    const targetCenterX = rect.left + rect.width / 2;
    // Position by left edge (no horizontal translate) so clamping is exact.
    let left = targetCenterX - cardWidth / 2;
    left = Math.max(
      MARGIN,
      Math.min(left, window.innerWidth - cardWidth - MARGIN),
    );

    return {
      top,
      left,
      width: cardWidth,
      maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
      transform: "none",
    };
  })();

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[200]"
        role="dialog"
        aria-modal="true"
        aria-label="Feature tour"
        data-testid="feature-tour"
      >
        {/* Dim overlay with spotlight hole */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          onClick={finishTour}
        >
          {rect ? (
            <div
              className="absolute rounded-2xl ring-2 ring-[#16730F] ring-offset-2 ring-offset-transparent pointer-events-none transition-all duration-200"
              style={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-black/55" />
          )}
        </motion.div>

        {/* Tooltip card */}
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="fixed z-[201] box-border rounded-2xl border border-[#16730F]/25 bg-white p-4 shadow-xl"
          style={tooltipStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#16730F]">
                {currentStep.id === "intro"
                  ? "Getting started"
                  : `Step ${stepIndex} of ${steps.length - 1}`}
              </p>
              <h3 className="mt-1 text-base font-bold text-[#1A3E32]">
                {currentStep.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={finishTour}
              className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer transition-colors"
              aria-label="Skip tour"
            >
              <FaTimes size={14} />
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            {currentStep.body}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={finishTour}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Skip
            </button>
            <div className="flex flex-wrap gap-2 justify-end">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (isLast) finishTour();
                  else setStepIndex((i) => i + 1);
                }}
                className="rounded-lg bg-[#16730F] px-3 py-2 text-sm font-medium text-white hover:bg-[#125c0c] transition-colors cursor-pointer"
              >
                {isLast ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
