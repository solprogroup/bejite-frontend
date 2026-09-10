import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  ShieldCheck,
  Zap,
  Briefcase,
  Gift,
  Search,
  Sparkles,
  PauseCircle,
  Percent,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import NewsFeedHeader from "../../components/NewsFeedHeader";
import CardBrandIcon from "../../components/pricing/CardBrandIcon";

const SubscriptionRetentionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    action = "remove_card",
    card = null,
    subscription = null,
    savedCards = [],
  } = location.state || {};

  const [selectedOffer, setSelectedOffer] = useState(null);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [offerType, setOfferType] = useState("");

  const planName = subscription?.plan_type
    ? subscription.plan_type.charAt(0).toUpperCase() +
      subscription.plan_type.slice(1) +
      " Plan"
    : "Active Subscription";

  const cardLast4 = card?.card_last4 || "Card on file";
  const cardBrand = card?.card_brand || "card";

  const handleClaimDiscount = () => {
    setOfferType("discount");
    setOfferAccepted(true);
    toast.success(
      "40% discount applied! Your next month's billing will be discounted.",
      { autoClose: 4000 }
    );
  };

  const handlePauseBilling = () => {
    setOfferType("pause");
    setOfferAccepted(true);
    toast.success(
      "Your subscription billing is now scheduled to pause for 30 days. No charges will occur.",
      { autoClose: 4000 }
    );
  };

  const handleSwitchToStandard = () => {
    setOfferType("standard");
    setOfferAccepted(true);
    toast.success(
      "Your plan has been scheduled to switch to Standard (₦10,000/mo) at your next billing cycle.",
      { autoClose: 4000 }
    );
  };

  const handleSwitchToPayPerSearch = () => {
    setOfferType("pay_per_search");
    setOfferAccepted(true);
    toast.success(
      "Switched to Pay-As-You-Go! Recurring charges paused; pay only when you search.",
      { autoClose: 4000 }
    );
  };

  const handleContinueToConfirm = () => {
    navigate("/subscription/cancel-confirm", {
      state: {
        action,
        card,
        subscription,
        savedCards,
      },
    });
  };

  if (offerAccepted) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <NewsFeedHeader />

        <div className="flex-1 max-w-2xl mx-auto w-full p-4 sm:p-6 my-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-100 text-[#16730F] rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-[#1A3E32] mb-3">
              {offerType === "discount" && "40% Discount Applied!"}
              {offerType === "pause" && "Billing Paused for 30 Days"}
              {offerType === "standard" && "Switched to Standard Plan"}
              {offerType === "pay_per_search" && "Switched to Pay-As-You-Go"}
            </h2>

            <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-8 max-w-md mx-auto">
              {offerType === "discount" &&
                "Your next billing cycle will be discounted by 40%. All your searches, job postings, and ad credits remain uninterrupted."}
              {offerType === "pause" &&
                "Your subscription will be on hold for 30 days starting from your next renewal date. You can resume anytime from your dashboard."}
              {offerType === "standard" &&
                "You are now on the Standard Plan at ₦10,000/month. You have preserved your candidate access while saving on your monthly budget."}
              {offerType === "pay_per_search" &&
                "Recurring renewals have been paused. Your payment method remains securely saved so you can top up searches on demand."}
            </p>

            <button
              type="button"
              onClick={() => navigate("/subscription-dashboard")}
              className="w-full sm:w-auto px-8 py-3 bg-[#16730F] text-white rounded-xl hover:bg-[#145c0a] font-semibold text-base transition-colors shadow-md"
            >
              Return to Subscription Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <NewsFeedHeader />

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 pb-16">
        {/* Navigation & Progress Stepper */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate("/subscription-dashboard")}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#1A3E32] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          {/* Stepper */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#16730F] text-white">
              1
            </span>
            <span className="text-[#1A3E32]">Explore Affordable Options</span>
            <span className="text-gray-300">———</span>
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-500">
              2
            </span>
            <span className="text-gray-400">Final Confirmation</span>
          </div>
        </div>

        {/* Hero Warning Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-[#1A3E32] to-[#255444] p-6 sm:p-8 text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 text-xs font-semibold mb-3 border border-amber-400/30">
              <AlertTriangle className="w-3.5 h-3.5" />
              {action === "remove_card"
                ? "Payment Method Removal Request"
                : "Subscription Cancellation Request"}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Wait! Before you {action === "remove_card" ? "remove your card" : "cancel"}...
            </h1>
            <p className="text-green-100/90 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
              Removing your card ending in <strong className="text-white">•••• {cardLast4}</strong> will
              cancel automatic renewal and downgrade your hiring tools. Here are flexible, budget-friendly
              alternatives to keep recruiting without high monthly commitments.
            </p>

            {card && (
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10 text-xs text-green-100">
                <div className="w-8 h-5 bg-white rounded flex items-center justify-center px-1">
                  <CardBrandIcon brand={cardBrand} className="h-4 w-auto" />
                </div>
                <span>•••• {cardLast4}</span>
                <span className="text-white/40">•</span>
                <span>Active for {planName}</span>
              </div>
            )}
          </div>

          {/* Value you'll lose section */}
          <div className="p-6 sm:p-8 bg-amber-50/50 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              Benefits you'll lose when your card is removed:
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-amber-200/60 shadow-xs">
                <Zap className="w-4 h-4 text-amber-600 mb-1.5" />
                <p className="text-xs font-bold text-gray-900">ASE Candidate Searches</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Search limit drops to 5 basic searches per month.
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-amber-200/60 shadow-xs">
                <Briefcase className="w-4 h-4 text-amber-600 mb-1.5" />
                <p className="text-xs font-bold text-gray-900">Active Job Postings</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Priority candidate matching and boosts will be paused.
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-amber-200/60 shadow-xs">
                <Gift className="w-4 h-4 text-amber-600 mb-1.5" />
                <p className="text-xs font-bold text-gray-900">₦5,000–₦30,000 Ad Credits</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Promotional ad credits expire at the end of cycle.
                </p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-amber-200/60 shadow-xs">
                <Search className="w-4 h-4 text-amber-600 mb-1.5" />
                <p className="text-xs font-bold text-gray-900">Applicant Pool Access</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Access to full candidate contact details will be limited.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Retention / Downsell Options */}
        <div className="space-y-6">
          <div className="text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1A3E32]">
              Choose a More Affordable Alternative
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Select an option below to stay connected with talent without overspending.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OPTION 1: Switch to Standard Plan (Downsell) */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border-2 border-[#16730F] hover:shadow-lg transition-all flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 bg-[#16730F] text-white text-[11px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                Most Popular Budget Plan
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <h3 className="text-lg font-bold text-[#1A3E32]">Standard Plan</h3>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Save 47%
                  </span>
                </div>
                <div className="text-2xl font-extrabold text-gray-900 mb-2">
                  ₦10,000{" "}
                  <span className="text-xs font-normal text-gray-500">/ month</span>
                </div>
                <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                  Cut your monthly spend in half while keeping essential hiring tools active.
                </p>

                <ul className="space-y-2 text-xs text-gray-700 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#16730F] shrink-0" />
                    5 ASE Searches / Month (10 results/search)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#16730F] shrink-0" />
                    5 Job Posts & Recruitment Management
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#16730F] shrink-0" />
                    ₦10,000 AdPro credit included
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#16730F] shrink-0" />
                    Keeps your payment method active
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleSwitchToStandard}
                className="w-full py-2.5 px-4 bg-[#16730F] text-white rounded-xl hover:bg-[#145c0a] font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                Switch to Standard Plan (₦10,000/mo)
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* OPTION 2: Retention Discount (40% OFF next month) */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-purple-200 hover:border-purple-300 hover:shadow-lg transition-all flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-purple-700 text-white text-[11px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                <Percent className="w-3 h-3" /> Exclusive Offer
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">40% Retention Discount</h3>
                </div>
                <div className="text-2xl font-extrabold text-purple-700 mb-2">
                  40% OFF{" "}
                  <span className="text-xs font-normal text-gray-500">
                    on your next renewal
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                  Enjoy your full current plan privileges at a massive discount for your next billing cycle.
                </p>

                <ul className="space-y-2 text-xs text-gray-700 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0" />
                    Keep all existing searches & candidate limits
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0" />
                    Standard: ₦6,000 (was ₦10,000)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0" />
                    Premium: ₦11,400 (was ₦19,000)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0" />
                    Discount applied immediately to your card
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleClaimDiscount}
                className="w-full py-2.5 px-4 bg-purple-700 text-white rounded-xl hover:bg-purple-800 font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                Claim 40% Discount & Stay
                <Sparkles className="w-4 h-4" />
              </button>
            </div>

            {/* OPTION 3: Pay-As-You-Go / Top-Up Pack */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">Pay-As-You-Go</h3>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                    No Recurring Fees
                  </span>
                </div>
                <div className="text-2xl font-extrabold text-gray-900 mb-2">
                  From ₦2,500{" "}
                  <span className="text-xs font-normal text-gray-500">per top-up</span>
                </div>
                <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                  Keep your card saved securely for on-demand hiring credits whenever you need to recruit.
                </p>

                <ul className="space-y-2 text-xs text-gray-700 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    Zero automated monthly subscriptions
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    Purchase 1, 5, or 10 search packs as needed
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    Credits never expire once purchased
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleSwitchToPayPerSearch}
                className="w-full py-2.5 px-4 bg-white border-2 border-gray-800 text-gray-800 hover:bg-gray-50 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                Switch to Pay-As-You-Go
              </button>
            </div>

            {/* OPTION 4: Pause Subscription */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">Pause for 30 Days</h3>
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    Hiring On Hold
                  </span>
                </div>
                <div className="text-2xl font-extrabold text-gray-900 mb-2">
                  ₦0{" "}
                  <span className="text-xs font-normal text-gray-500">
                    for the next month
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                  Between recruitment cycles? Freeze your billing while keeping your saved card and account history intact.
                </p>

                <ul className="space-y-2 text-xs text-gray-700 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    No charges during the pause window
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    Resume anytime with a single click
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    Retain your verified recruiter status
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handlePauseBilling}
                className="w-full py-2.5 px-4 bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <PauseCircle className="w-4 h-4" />
                Pause Subscription (30 Days)
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-10 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              toast.info("Your subscription and payment method remain fully active.");
              navigate("/subscription-dashboard");
            }}
            className="w-full sm:w-auto px-6 py-3 bg-[#1A3E32] text-white rounded-xl hover:bg-[#265545] font-semibold text-sm transition-colors shadow-sm cursor-pointer text-center"
          >
            Never mind, Keep My Subscription & Card
          </button>

          <button
            type="button"
            onClick={handleContinueToConfirm}
            className="text-xs sm:text-sm font-medium text-gray-400 hover:text-red-600 transition-colors py-2 px-3 rounded hover:bg-red-50 cursor-pointer"
          >
            I still want to continue to {action === "remove_card" ? "remove card" : "cancellation"} →
          </button>
        </div>
      </main>
    </div>
  );
};

export default SubscriptionRetentionPage;
