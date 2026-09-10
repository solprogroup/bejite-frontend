import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Star,
  Calendar,
  Sparkles,
  Lock,
  Crown,
  Check,
  FileText,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import {
  ConfirmBadgeModal,
  PendingReviewModal,
} from "../../components/modal/confirmBadgeModal";
import NewsFeedLayout from "../../components/layout/NewsFeedLayout";
import VerifiedBadgeIcon from "../../components/VerifiedBadgeIcon";
import {
  getBadgeStatus,
  getBadgePlans,
  initializeBadgeSubscription,
} from "../../services/verifiedBadgeApi";
import { getUser, mergeAuthUsers } from "../../utils/tokenManager";
import { userHasVerifiedBadge } from "../../utils/verifiedBadge";

const JOBSEEKER_BENEFITS = [
  {
    icon: VerifiedBadgeIcon,
    title: "Verified Badge",
    description:
      "A verified badge appears on your profile, building credibility with recruiters and connections.",
  },
  {
    icon: FileText,
    title: "Weekly & Monthly Job Application Report",
    description:
      "Receive a weekly & monthly job application insights report.",
  },
  {
    icon: Calendar,
    title: "Exclusive Partner Events",
    description:
      "Access career fairs, networking conferences, and seminars reserved for verified subscribers.",
  },
  /*{
    icon: Star,
    title: "Featured Profile",
    description:
      "Your profile is featured in Bejite's Top Creators and Rising Stars sections.",
  },
  {
    icon: Crown,
    title: "Exclusive Content",
    description:
      "Access to premium career resources and interview prep guides.",
  },*/
];

const RECRUITER_BENEFITS = [
  {
    icon: VerifiedBadgeIcon,
    title: "Verified Recruiter Badge",
    description:
      "A verified badge appears on your profile, building credibility with jobseekers and connections.",
  },
  {
    icon: FileText,
    title: "Weekly & Monthly Job Posting Report",
    description:
      "Receive a weekly & monthly job posting insights report.",
  },
  {
    icon: Calendar,
    title: "Exclusive Partner Events",
    description:
      "Access career fairs, networking conferences, and seminars reserved for verified recruiters.",
  },
];

const RECRUITER_NOTE =
  "Recruiters get the Verified Recruiter badge by uploading an ID, paying ₦5,000 once, and passing admin review.";

export default function BadgeStatus() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const reduxUser = useSelector((state) => state.auth?.user);
  const sessionUser = useMemo(
    () => mergeAuthUsers(getUser() || {}, reduxUser || {}),
    [reduxUser],
  );
  const sessionHasBadge = userHasVerifiedBadge(sessionUser);

  const [showModal, setShowModal] = useState(false);
  const [showPendingReviewModal, setShowPendingReviewModal] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const payingRef = useRef(false);

  const isRecruiter =
    sessionUser?.role === "recruiter" || sessionUser?.role === "employer";

  // Only verified accounts go to badge-holder — pending review stays on /badge.
  useEffect(() => {
    if (sessionHasBadge) {
      navigate("/badge-holder", { replace: true });
    }
  }, [sessionHasBadge, navigate]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [statusRes, plansRes] = await Promise.all([
          getBadgeStatus().catch(() => null),
          getBadgePlans(),
        ]);
        if (cancelled) return;

        if (statusRes?.hasVerifiedBadge) {
          navigate("/badge-holder", { replace: true });
          return;
        }

        const isPending = Boolean(statusRes?.pendingReview);
        setPendingReview(isPending);
        if (isPending || searchParams.get("pendingReview") === "1") {
          setShowPendingReviewModal(true);
        }

        setPlans(plansRes?.plans || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!sessionHasBadge) {
      load();
    }

    return () => {
      cancelled = true;
    };
    // Only on mount / badge session change — do not re-open when query is cleared.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, sessionHasBadge]);

  const closePendingReviewModal = () => {
    setShowPendingReviewModal(false);
    if (searchParams.get("pendingReview")) {
      const next = new URLSearchParams(searchParams);
      next.delete("pendingReview");
      setSearchParams(next, { replace: true });
    }
  };

  const badgePlan = plans[0];
  const uiPlan = badgePlan
    ? {
        id: badgePlan.id,
        label: badgePlan.name,
        price: Number(badgePlan.priceNGN || 10000).toLocaleString("en-NG"),
        currency: "₦",
        period: " one-time",
        amount: (badgePlan.priceNGN || 10000) * 100,
      }
    : null;

  const handleCTA = () => {
    if (isRecruiter) {
      if (pendingReview) {
        setShowPendingReviewModal(true);
        return;
      }
      const mode = String(sessionUser?.mode || "").toLowerCase();
      navigate(mode === "corporate" ? "/corporate/upload" : "/individual/upload");
      return;
    }
    if (!uiPlan) return;
    setSelectedPlan(uiPlan);
    setShowModal(true);
  };

  const handleConfirm = async () => {
    if (payingRef.current) return;
    payingRef.current = true;
    setPaying(true);
    setError(null);
    try {
      const init = await initializeBadgeSubscription("NGN");
      if (init?.alreadyPaid || init?.pendingReview) {
        setShowModal(false);
        setPaying(false);
        payingRef.current = false;
        if (init?.pendingReview) {
          setPendingReview(true);
          setShowPendingReviewModal(true);
        }
        return;
      }
      const checkoutUrl = init?.data?.authorization_url;
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      throw new Error("Unable to start checkout");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || "Payment failed");
      payingRef.current = false;
      setPaying(false);
    }
  };

  if (sessionHasBadge || loading) {
    return (
      <NewsFeedLayout classes={false} showSidebars={false}>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1A3E32]" />
        </div>
      </NewsFeedLayout>
    );
  }

  return (
    <NewsFeedLayout classes={false} showSidebars={false}>
      <div className="h-full min-h-0 w-full max-w-screen-xl mx-auto flex flex-col">
        <div className="bg-[#1A3E32] px-4 sm:px-6 py-5 flex-shrink-0 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="flex items-start sm:items-center gap-3 relative min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <VerifiedBadgeIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-white font-bold text-lg sm:text-xl">Verified Badge</h1>
              <p className="text-green-200 text-xs mt-0.5 leading-relaxed break-words">
                {isRecruiter
                  ? "Document uploaded and awaiting admin review"
                  : "Premium identity for jobseekers"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto nfl-scroll scroll-smooth">
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
            <div className="bg-gradient-to-br from-[#1A3E32] to-[#2d6a54] rounded-2xl p-5 sm:p-8 text-white relative overflow-hidden">
              <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
                <VerifiedBadgeIcon className="w-24 h-24 sm:w-32 sm:h-32" />
              </div>
              <div className="relative min-w-0">
              <p className="text-green-300 text-xs font-semibold uppercase tracking-widest mb-2">
                Bejite Verified Badge
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2 break-words">
                {pendingReview
                  ? "Your document is under review"
                  : "Stand out with a verified profile"}
              </h2>
              <p className="text-green-100 text-sm leading-relaxed max-w-xl">
                {pendingReview
                  ? "Payment received. An admin is reviewing your document. You will unlock badge-holder access once it is approved."
                  : isRecruiter
                    ? RECRUITER_NOTE
                    : "Pay once to unlock your verified badge, job application reports, and exclusive events."}
              </p>
              <button
                type="button"
                onClick={handleCTA}
                disabled={paying}
                className="mt-5 w-full sm:w-auto px-6 py-2.5 bg-white text-[#1A3E32] font-semibold rounded-xl hover:bg-green-50 transition-colors text-sm sm:text-base"
              >
                {pendingReview
                  ? "View review status"
                  : isRecruiter
                    ? "Upload document & pay ₦5,000"
                    : `Get verified — ₦${uiPlan?.price || "10,000"} one-time`}
              </button>
              {error && <p className="text-red-200 text-sm mt-3 break-words">{error}</p>}
              </div>
            </div>

            {!isRecruiter && uiPlan && (
              <div className="bg-white border-2 border-[#1A3E32] rounded-2xl p-5 sm:p-6 shadow-lg">
                <p className="text-[#16730F] font-semibold text-base sm:text-lg">{uiPlan.label}</p>
                <div className="mt-3 mb-4 flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                  <span className="text-[#1A3E32] font-bold text-3xl sm:text-5xl tabular-nums">
                    {uiPlan.price}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {uiPlan.currency}
                    {uiPlan.period}
                  </span>
                </div>
                <ul className="space-y-2">
                  {(badgePlan?.features || []).map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-[#16730F] shrink-0 mt-0.5" />
                      <span className="min-w-0 break-words">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-800">
                {isRecruiter
                  ? "What Verified Recruiters Get"
                  : "What Verified Subscribers Get"}
              </p>
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {(isRecruiter ? RECRUITER_BENEFITS : JOBSEEKER_BENEFITS).map(
                  (benefit) => {
                    const Icon = benefit.icon;
                    return (
                      <div
                        key={benefit.title}
                        className="flex items-start gap-3 sm:gap-4 p-4"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#1A3E32]/10 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-[#1A3E32]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800">
                            {benefit.title}
                          </p>
                          <p className="text-xs text-gray-500 leading-relaxed mt-0.5 break-words">
                            {benefit.description}
                          </p>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-[#1A3E32]/5 to-[#2d6a54]/10 border border-[#1A3E32]/20 rounded-2xl p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-12 h-12 rounded-full bg-[#1A3E32] flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-[#1A3E32]">Exclusive Partner Events</p>
                    <Lock className="w-5 h-5 text-gray-300 shrink-0" />
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed break-words">
                    Verified subscribers can register for partner career fairs and networking events.
                    Non-verified users cannot register.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPendingReviewModal ? (
          <PendingReviewModal onClose={closePendingReviewModal} />
        ) : null}
        {showModal && selectedPlan && (
          <ConfirmBadgeModal
            plan={selectedPlan}
            oneTime
            onClose={() => !paying && setShowModal(false)}
            onConfirm={handleConfirm}
            isLoading={paying}
          />
        )}
      </AnimatePresence>
    </NewsFeedLayout>
  );
}
