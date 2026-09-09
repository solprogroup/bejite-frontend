import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  X,
  ArrowRight,
  Lock,
  Sparkles,
} from "lucide-react";
import lottie from "lottie-web";
import animatedPhone2faData from "../../assets/lottie/animatedphone2fa.json";
import { getTwoFactorStatus } from "../../services/twoFactorApi";
import { getUser } from "../../utils/tokenManager";
import { TwoFactorModal } from "./confirmBadgeModal";
import { toast } from "react-toastify";

function isFeatureTourActive() {
  try {
    return sessionStorage.getItem("bejite_feature_tour_active") === "true";
  } catch {
    return false;
  }
}

export default function TwoFactorAnnouncementModal({
  forceShow = false,
  autoAdvanceDelay = 5500,
  onClose,
  onSetupSuccess,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState("intro"); // "intro" | "details"
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [tourActive, setTourActive] = useState(() => isFeatureTourActive());
  /** Show 2FA after the feature tour finishes, if we already decided it should open. */
  const pendingOpenRef = useRef(false);

  const lottieContainerRef = useRef(null);
  const animInstanceRef = useRef(null);

  const tryOpen = () => {
    if (isFeatureTourActive()) {
      pendingOpenRef.current = true;
      setIsOpen(false);
      return;
    }
    pendingOpenRef.current = false;
    setIsOpen(true);
    setStage("intro");
  };

  // Stay in sync with the first-timer feature tour
  useEffect(() => {
    const onTour = (e) => {
      const active = Boolean(e?.detail?.active) || isFeatureTourActive();
      setTourActive(active);
      if (active) {
        setIsOpen(false);
      } else if (pendingOpenRef.current) {
        pendingOpenRef.current = false;
        setIsOpen(true);
        setStage("intro");
      }
    };
    window.addEventListener("bejite:feature-tour", onTour);
    return () => window.removeEventListener("bejite:feature-tour", onTour);
  }, []);

  // Check 2FA status from endpoint on mount or when user changes
  useEffect(() => {
    // Allow URL override for easy testing: ?show2fa=true
    const urlParams = new URLSearchParams(window.location.search);
    const urlForce = urlParams.get("show2fa") === "true";

    if (forceShow || urlForce) {
      tryOpen();
      return;
    }

    const currentUser = getUser();
    const userId = currentUser?._id || currentUser?.id || currentUser?.email;

    // If this specific user has already closed/dismissed the modal, don't show it again
    if (userId) {
      try {
        if (localStorage.getItem(`bejite_2fa_dismissed_${userId}`) === "true") {
          setIsOpen(false);
          pendingOpenRef.current = false;
          return;
        }
      } catch {
        /* ignore localStorage access errors */
      }
    }

    let cancelled = false;
    let openTimer;

    // Call the endpoint to check if 2FA is enabled
    getTwoFactorStatus()
      .then((status) => {
        if (cancelled) return;

        // If 2FA is already enabled (true), do NOT show the modal
        if (status?.enabled) {
          setIsOpen(false);
          pendingOpenRef.current = false;
        } else {
          // If 2FA is NOT enabled (false), show the modal for this user
          openTimer = setTimeout(() => {
            if (!cancelled) tryOpen();
          }, 600);
        }
      })
      .catch((err) => {
        console.warn("Could not check 2FA status:", err?.message);
        if (!cancelled) {
          setIsOpen(false);
          pendingOpenRef.current = false;
        }
      });

    return () => {
      cancelled = true;
      if (openTimer) clearTimeout(openTimer);
    };
  }, [forceShow]);

  // Load and play Lottie animation from directly embedded JSON data
  useEffect(() => {
    if (!isOpen || stage !== "intro" || !lottieContainerRef.current) return;

    if (animInstanceRef.current) {
      animInstanceRef.current.destroy();
      animInstanceRef.current = null;
    }

    try {
      const anim = lottie.loadAnimation({
        container: lottieContainerRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        animationData: animatedPhone2faData,
        rendererSettings: {
          preserveAspectRatio: "xMidYMid meet",
          clearCanvas: false,
          progressiveLoad: true,
        },
      });

      animInstanceRef.current = anim;

      // When animation finishes, pause briefly then advance to details stage
      anim.addEventListener("complete", () => {
        setTimeout(() => {
          setStage("details");
        }, 700);
      });
    } catch (err) {
      console.warn("Lottie animation error:", err);
      setStage("details");
    }

    return () => {
      if (animInstanceRef.current) {
        animInstanceRef.current.destroy();
        animInstanceRef.current = null;
      }
    };
  }, [isOpen, stage]);

  // Fallback auto-advance timer for intro stage
  useEffect(() => {
    if (!isOpen || stage !== "intro") return;

    const timer = setTimeout(() => {
      setStage("details");
    }, autoAdvanceDelay);

    return () => clearTimeout(timer);
  }, [isOpen, stage, autoAdvanceDelay]);

  // Dismiss handler: closes modal and saves dismissal ONLY for this specific user
  const handleDismiss = () => {
    const currentUser = getUser();
    const userId = currentUser?._id || currentUser?.id || currentUser?.email;
    if (userId) {
      try {
        localStorage.setItem(`bejite_2fa_dismissed_${userId}`, "true");
      } catch {
        /* ignore localStorage access errors */
      }
    }
    setIsOpen(false);
    onClose?.();
  };

  // Launch live 2FA setup modal
  const handleStartSetup = () => {
    const currentUser = getUser();
    const userId = currentUser?._id || currentUser?.id || currentUser?.email;
    if (userId) {
      try {
        localStorage.setItem(`bejite_2fa_dismissed_${userId}`, "true");
      } catch {
        /* ignore localStorage access errors */
      }
    }
    setIsOpen(false);
    setSetupModalOpen(true);
  };

  const handleSetupComplete = () => {
    setSetupModalOpen(false);
    toast.success("Two-Factor Authentication is now enabled on your account!");
    onSetupSuccess?.();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && !tourActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6"
            onClick={handleDismiss}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative border border-emerald-100/80 overflow-hidden"
            >
              {/* Close Button (X) - Closes for this user */}
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Close notification"
                className="absolute top-4 right-4 z-20 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#1A3E32]/20 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Top Accent Gradient Bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-[#1A3E32] to-teal-400" />

              {/* STAGE 1: LOTTIE ANIMATION SPOTLIGHT */}
              <AnimatePresence mode="wait">
                {stage === "intro" && (
                  <motion.div
                    key="intro-stage"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94, y: -10 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="p-6 sm:p-8 text-center flex flex-col items-center"
                  >
                    {/* Feature Badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#1A3E32] border border-emerald-200/60 shadow-xs mb-2">
                      <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      NEW SECURITY UPGRADE
                    </div>

                    <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight mt-2">
                      Enhanced Account Protection
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-xs">
                      Two-Factor Authentication is now live on Bejite.
                    </p>

                    {/* Lottie Animation Canvas */}
                    <div className="my-4 w-[260px] h-[260px] max-w-full flex items-center justify-center relative">
                      <div
                        ref={lottieContainerRef}
                        style={{ width: "260px", height: "260px" }}
                        className="w-[260px] h-[260px] drop-shadow-md flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                      />
                    </div>

                    {/* Animated Progress Tracker */}
                    <div className="w-full max-w-xs space-y-2 mt-1">
                      <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: autoAdvanceDelay / 1000, ease: "linear" }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-[#1A3E32]"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Securing your account...</span>
                        <button
                          type="button"
                          onClick={() => setStage("details")}
                          className="text-[#1A3E32] font-semibold hover:underline cursor-pointer"
                        >
                          Skip →
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STAGE 2: 2FA VALUE PROPOSITION & CTA */}
                {stage === "details" && (
                  <motion.div
                    key="details-stage"
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="p-6 sm:p-8"
                  >
                    {/* Icon & Badge */}
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1A3E32] to-emerald-700 text-white flex items-center justify-center shadow-lg shadow-[#1A3E32]/25 mb-3.5">
                        <ShieldCheck className="w-7 h-7 text-emerald-300 stroke-[2.2]" />
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#1A3E32] border border-emerald-200/60 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        TWO-FACTOR AUTHENTICATION IS READY
                      </div>

                      <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                        Protect Your Account with 2FA
                      </h3>

                      <p className="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed">
                        We&apos;ve added Two-Factor Authentication to safeguard your data and account credentials against unauthorized access.
                      </p>
                    </div>

                    {/* CTA Actions */}
                    <div className="mt-6 space-y-2.5">
                      <button
                        type="button"
                        onClick={handleStartSetup}
                        className="w-full py-3.5 px-5 rounded-2xl bg-[#1A3E32] hover:bg-[#132f26] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-[#1A3E32]/25 hover:shadow-lg hover:shadow-[#1A3E32]/35 active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <Lock className="w-4 h-4 text-emerald-300" />
                        Set Up 2FA Now
                        <ArrowRight className="w-4 h-4 ml-0.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live 2FA Setup Modal Launcher */}
      <AnimatePresence>
        {setupModalOpen && (
          <TwoFactorModal
            onClose={() => setSetupModalOpen(false)}
            onEnabled={handleSetupComplete}
          />
        )}
      </AnimatePresence>
    </>
  );
}
