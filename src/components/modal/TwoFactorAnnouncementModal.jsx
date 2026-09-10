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

const checkIsMobile = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 640;
};

export default function TwoFactorAnnouncementModal({
  forceShow = false,
  autoAdvanceDelay = 5500,
  onClose,
  onSetupSuccess,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(checkIsMobile);
  // On mobile screens, skip the animation stage completely and show "Protect Account with 2FA" directly
  const [stage, setStage] = useState(() => (checkIsMobile() ? "details" : "intro"));
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  const lottieContainerRef = useRef(null);
  const animInstanceRef = useRef(null);

  // Keep mobile state updated on viewport resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (mobile && stage === "intro") {
        setStage("details");
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [stage]);

  // Check 2FA status from endpoint on mount or when user changes
  useEffect(() => {
    // Allow URL override for easy testing: ?show2fa=true
    const urlParams = new URLSearchParams(window.location.search);
    const urlForce = urlParams.get("show2fa") === "true";

    const mobile = checkIsMobile();
    setIsMobile(mobile);

    if (forceShow || urlForce) {
      setIsOpen(true);
      setStage(mobile ? "details" : "intro");
      return;
    }

    const currentUser = getUser();
    const userId = currentUser?._id || currentUser?.id || currentUser?.email;

    // If this specific user has already closed/dismissed the modal, don't show it again
    if (userId) {
      try {
        if (localStorage.getItem(`bejite_2fa_dismissed_${userId}`) === "true") {
          setIsOpen(false);
          return;
        }
      } catch {
        /* ignore localStorage access errors */
      }
    }

    let cancelled = false;

    // Call endpoint to check if 2FA is enabled
    getTwoFactorStatus()
      .then((status) => {
        if (cancelled) return;

        // If 2FA is already enabled (true), do NOT show the modal
        if (status?.enabled) {
          setIsOpen(false);
        } else {
          // If 2FA is NOT enabled (false), show the modal for this user
          const timer = setTimeout(() => {
            if (!cancelled) {
              const currentMobile = checkIsMobile();
              setIsMobile(currentMobile);
              setIsOpen(true);
              setStage(currentMobile ? "details" : "intro");
            }
          }, 600);
          return () => clearTimeout(timer);
        }
      })
      .catch((err) => {
        console.warn("Could not check 2FA status:", err?.message);
        if (!cancelled) {
          setIsOpen(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [forceShow]);

  // Load and play Lottie animation ONLY on desktop in intro stage
  useEffect(() => {
    // Completely disable Lottie on mobile to eliminate CPU/GPU lag and frame drops
    if (!isOpen || stage !== "intro" || isMobile || !lottieContainerRef.current) {
      if (animInstanceRef.current) {
        animInstanceRef.current.destroy();
        animInstanceRef.current = null;
      }
      return;
    }

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
        }, 600);
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
  }, [isOpen, stage, isMobile]);

  // Fallback auto-advance timer for desktop intro stage
  useEffect(() => {
    if (!isOpen || stage !== "intro" || isMobile) return;

    const timer = setTimeout(() => {
      setStage("details");
    }, autoAdvanceDelay);

    return () => clearTimeout(timer);
  }, [isOpen, stage, isMobile, autoAdvanceDelay]);

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
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm sm:backdrop-blur-md z-[110] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
            onClick={handleDismiss}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl relative border border-emerald-100/80 overflow-hidden my-auto max-h-[calc(100dvh-2rem)] flex flex-col"
            >
              {/* Close Button (X) */}
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Close notification"
                className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#1A3E32]/20 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Top Accent Gradient Bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-[#1A3E32] to-teal-400 shrink-0" />

              {/* STAGE 1: DESKTOP ONLY INTRO ANIMATION (HIDDEN ON MOBILE TO PREVENT LAG & CLIPPING) */}
              <AnimatePresence mode="wait">
                {stage === "intro" && !isMobile && (
                  <motion.div
                    key="intro-stage"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94, y: -10 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="p-6 sm:p-8 text-center flex flex-col items-center overflow-y-auto"
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
                    <div className="my-4 w-[220px] h-[220px] sm:w-[260px] sm:h-[260px] max-w-full flex items-center justify-center relative">
                      <div
                        ref={lottieContainerRef}
                        style={{ width: "100%", height: "100%" }}
                        className="w-full h-full drop-shadow-md flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                      />
                    </div>

                    {/* Progress Bar and Skip */}
                    <div className="w-full max-w-xs space-y-2 mt-1">
                      <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{
                            duration: autoAdvanceDelay / 1000,
                            ease: "linear",
                          }}
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

                {/* STAGE 2: PROTECT ACCOUNT WITH 2FA (SHOWN DIRECTLY ON MOBILE & AFTER INTRO ON DESKTOP) */}
                {(stage === "details" || isMobile) && (
                  <motion.div
                    key="details-stage"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="p-5 sm:p-8 overflow-y-auto flex flex-col justify-between"
                  >
                    {/* Icon & Badge */}
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#1A3E32] to-emerald-700 text-white flex items-center justify-center shadow-lg shadow-[#1A3E32]/25 mb-3">
                        <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-300 stroke-[2.2]" />
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-50 text-[#1A3E32] border border-emerald-200/60 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        TWO-FACTOR AUTHENTICATION IS READY
                      </div>

                      <h3 className="text-lg sm:text-2xl font-extrabold text-gray-900 tracking-tight leading-snug">
                        Protect Your Account with 2FA
                      </h3>

                      <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed max-w-sm">
                        We&apos;ve added Two-Factor Authentication to safeguard your
                        data and account credentials against unauthorized access.
                      </p>
                    </div>

                    {/* CTA Actions */}
                    <div className="mt-5 sm:mt-6 space-y-2.5">
                      <button
                        type="button"
                        onClick={handleStartSetup}
                        className="w-full py-3 sm:py-3.5 px-5 rounded-xl sm:rounded-2xl bg-[#1A3E32] hover:bg-[#132f26] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-[#1A3E32]/25 hover:shadow-lg hover:shadow-[#1A3E32]/35 active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <Lock className="w-4 h-4 text-emerald-300" />
                        <span>Set Up 2FA Now</span>
                        <ArrowRight className="w-4 h-4 ml-0.5" />
                      </button>

                      <button
                        type="button"
                        onClick={handleDismiss}
                        className="w-full py-2 px-4 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer text-center"
                      >
                        Skip for now
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
