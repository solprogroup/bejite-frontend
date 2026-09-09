import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import { getUser } from "../../utils/tokenManager";
import {
  cleanupLegacyTourSeenKeys,
  getRmDetailTourSeenPrefix,
  getRmListTourSeenPrefix,
  readRmTourSeen,
  writeRmTourSeen,
} from "../../utils/featureTourStorage";

const GLOBAL_TOUR_ACTIVE_KEY = "bejite_feature_tour_active";
const PAD = 10;

const LIST_STEPS = [
  {
    id: "intro",
    title: "Recruitment Management",
    body: "This is your hiring workspace — create exercises, track pipelines, and move candidates from invite to hire.",
    target: null,
  },
  {
    id: "rm-create",
    title: "New recruitment exercise",
    body: "Start a new hiring exercise here. Free monthly quota and ASE plans both count toward how many you can create.",
    target: "rm-create",
  },
  {
    id: "rm-filters",
    title: "Search & filters",
    body: "Find exercises by title or position, then narrow by status, stage, and date range.",
    target: "rm-filters",
  },
  {
    id: "rm-list",
    title: "Your exercises",
    body: "Every recruitment exercise appears here. Open one to manage its pipeline, candidates, stages, and audit log.",
    target: "rm-list",
  },
];

const DETAIL_STEPS = [
  {
    id: "rm-detail-intro",
    title: "Exercise overview",
    body: "You’re inside a recruitment exercise. Edit details, close the exercise, or dig into stats and candidates below.",
    target: "rm-detail-header",
  },
  {
    id: "rm-stats",
    title: "Candidate stats",
    body: "Quick counts for invited, accepted, declined, passed, failed, and hired candidates in this exercise.",
    target: "rm-stats",
  },
  {
    id: "rm-pipeline",
    title: "Interview pipeline",
    body: "Your hiring stages live here. Add, reorder, or remove stages to match how you interview.",
    target: "rm-pipeline",
  },
  {
    id: "rm-tabs",
    title: "Candidates, stages & timeline",
    body: "Switch tabs to manage candidates, edit the stage list, or review the audit log of what happened in this exercise.",
    target: "rm-tabs",
  },
  {
    id: "rm-candidates",
    title: "Candidate actions",
    body: "Search and filter applicants, then move them between stages, send feedback, or open their profile.",
    target: "rm-candidates",
  },
];

function isGlobalTourActive() {
  try {
    return sessionStorage.getItem(GLOBAL_TOUR_ACTIVE_KEY) === "true";
  } catch {
    return false;
  }
}

function findTourTarget(tourId) {
  const nodes = document.querySelectorAll(`[data-tour-id="${tourId}"]`);
  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return nodes[0] || null;
}

/**
 * Page-specific spotlight tour for Recruitment Management.
 * List and detail views use separate localStorage flags.
 */
export default function RecruitmentManagementTour({
  ready = false,
  view = "list",
  onEnsureCandidatesTab,
}) {
  const reduxUser = useSelector((state) => state.auth?.user);
  const sessionUser = getUser();
  const user = reduxUser || sessionUser;
  const userId = user?._id || user?.id || user?.email;
  const isDetail = view === "detail";
  const seenPrefix = isDetail
    ? getRmDetailTourSeenPrefix()
    : getRmListTourSeenPrefix();
  const steps = useMemo(
    () => (isDetail ? DETAIL_STEPS : LIST_STEPS),
    [isDetail],
  );

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [globalTourActive, setGlobalTourActive] = useState(() =>
    isGlobalTourActive(),
  );

  const currentStep = steps[stepIndex] || null;
  const isLast = stepIndex >= steps.length - 1;

  useEffect(() => {
    cleanupLegacyTourSeenKeys();
  }, []);

  const finishTour = useCallback(() => {
    writeRmTourSeen(seenPrefix, userId);
    setIsOpen(false);
    setStepIndex(0);
    setRect(null);
  }, [seenPrefix, userId]);

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
      el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
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

  // Stay in sync with the global feature tour
  useEffect(() => {
    const onTour = (e) => {
      const active = Boolean(e?.detail?.active) || isGlobalTourActive();
      setGlobalTourActive(active);
      if (active) {
        setIsOpen(false);
        setRect(null);
      }
    };
    window.addEventListener("bejite:feature-tour", onTour);
    return () => window.removeEventListener("bejite:feature-tour", onTour);
  }, []);

  // Start tour when the view is ready and global tour is not active
  useEffect(() => {
    if (!ready || !userId || globalTourActive || isGlobalTourActive()) {
      setIsOpen(false);
      setRect(null);
      return undefined;
    }

    const params = new URLSearchParams(window.location.search);
    const forceShow =
      params.get("showtour") === "true" || params.get("showrmtour") === "true";
    if (!forceShow && readRmTourSeen(seenPrefix, userId)) {
      setIsOpen(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      // Re-check immediately before opening — global tour may have started.
      if (isGlobalTourActive()) {
        setGlobalTourActive(true);
        setIsOpen(false);
        return;
      }
      setStepIndex(0);
      setIsOpen(true);
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, userId, seenPrefix, view, globalTourActive]);

  // Align spotlight + ensure candidates tab for that step
  useEffect(() => {
    if (!isOpen || !currentStep) return undefined;

    let cancelled = false;

    const prepare = async () => {
      if (currentStep.id === "rm-candidates" && onEnsureCandidatesTab) {
        onEnsureCandidatesTab();
        await new Promise((r) => setTimeout(r, 80));
      }
      if (cancelled) return;
      measureTarget(currentStep.target);
      requestAnimationFrame(() => {
        if (!cancelled) measureTarget(currentStep.target);
      });
    };

    prepare();

    const onResizeOrScroll = () => measureTarget(currentStep.target);
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [isOpen, currentStep, measureTarget, stepIndex, onEnsureCandidatesTab]);

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
    const estimatedCardHeight = 210;
    let top = placeBelow ? rect.top + rect.height + 14 : rect.top - 14;

    if (!placeBelow) {
      top = Math.max(MARGIN, top - estimatedCardHeight);
    } else {
      top = Math.min(top, window.innerHeight - estimatedCardHeight - MARGIN);
      top = Math.max(MARGIN, top);
    }

    const targetCenterX = rect.left + rect.width / 2;
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

  const stepLabel =
    currentStep.id === "intro" || currentStep.id === "rm-detail-intro"
      ? isDetail
        ? "Inside an exercise"
        : "Getting started"
      : `Step ${stepIndex} of ${steps.length - 1}`;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[200]"
        role="dialog"
        aria-modal="true"
        aria-label="Recruitment Management tour"
        data-testid="recruitment-management-tour"
      >
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
                {stepLabel}
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
