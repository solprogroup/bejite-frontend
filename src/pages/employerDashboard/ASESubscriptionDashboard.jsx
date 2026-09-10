import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Loader2, Trash2 } from "lucide-react";
import NewsFeedHeader from "../../components/NewsFeedHeader";
import {
  getSubscriptionStatus,
  getPaymentTransactions,
  deleteSavedCard,
} from "../../services/paymentApi";
import CardBrandIcon from "../../components/pricing/CardBrandIcon";

const formatPlanLabel = (planType) => {
  const labels = {
    standard: "Standard Plan",
    premium: "Premium Plan",
    jumbo: "Jumbo Plan",
  };
  return labels[String(planType || "").toLowerCase()] || "Subscription Plan";
};

const formatDashboardDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).format(date);
};

const getLoadErrorMessage = (error) => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;

  if (status === 401) {
    return "Your session has expired. Please log in again to view your subscription.";
  }
  if (status === 403) {
    return "You do not have permission to view this dashboard.";
  }
  if (serverMessage) {
    return serverMessage;
  }
  if (!error?.response) {
    return "Unable to reach the server. Check your connection and try again.";
  }
  return "Failed to load subscription data. Please try again.";
};

const TRANSACTIONS_PER_PAGE = 10;

const formatTransactionLabel = (txn) => {
  const planLabels = {
    standard: "Standard Plan",
    premium: "Premium Plan",
    jumbo: "Jumbo Plan",
    job_extension: "Job Extension",
    verified_badge: "Verified Badge",
  };
  const planKey = String(txn?.plan_type || "").toLowerCase();
  if (planLabels[planKey]) return planLabels[planKey];

  const typeLabels = {
    one_time: "One-time Payment",
    subscription: "Subscription",
    subscription_renewal: "Subscription Renewal",
    job_extension: "Job Extension",
    top_up: "Top-up",
  };
  return (
    typeLabels[txn?.transaction_type] ||
    txn?.plan_type ||
    txn?.transaction_type ||
    "Payment"
  );
};

function TransactionRow({ txn }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
        <span className="font-semibold text-gray-900">
          {formatTransactionLabel(txn)}
        </span>
        <span className="text-gray-500 text-sm sm:text-base">
          ₦{Number(txn.amount).toLocaleString("en-NG")}
        </span>
        {txn.reference && (
          <span className="text-gray-400 text-xs truncate max-w-full sm:max-w-[200px]">
            Ref: {txn.reference}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
        <span
          className={`px-3 py-1 text-xs font-bold rounded-full ${
            txn.status === "success"
              ? "bg-green-100 text-green-700"
              : txn.status === "pending"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {txn.status?.toUpperCase()}
        </span>
        <span className="text-gray-400 text-sm">
          {formatDashboardDate(txn.paid_at || txn.created_at)}
        </span>
      </div>
    </div>
  );
}

function MobileDashboardNav({ navigate }) {
  const navItems = [
    { label: "← Dashboard", path: "/news-feed" },
    { label: "Search", path: "/candidate-search-page" },
    { label: "Pricing", path: "/subscription-pricing" },
  ];

  return (
    <div className="md:hidden space-y-3">
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className="shrink-0 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 hover:text-[#16730F] transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => navigate("/candidate-search-page")}
          className="w-full px-4 py-3 bg-[#16730F] text-white rounded-lg hover:bg-[#145c0a] transition-colors font-medium text-sm sm:text-base text-center"
        >
          Search Candidates →
        </button>
        <button
          type="button"
          onClick={() => navigate("/subscription-pricing")}
          className="w-full px-4 py-3 border-2 border-[#1A3E32] text-[#1A3E32] rounded-lg hover:bg-[#1A3E32] hover:text-white transition-colors font-medium text-sm sm:text-base text-center"
        >
          View Plans →
        </button>
      </div>
    </div>
  );
}

const ASESubscriptionDashboard = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingCardId, setDeletingCardId] = useState(null);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [allTransactions, setAllTransactions] = useState([]);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsPagination, setTransactionsPagination] = useState(null);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState(null);

  const loadAllTransactions = useCallback(async (page = 1) => {
    setTransactionsLoading(true);
    setTransactionsError(null);

    try {
      const data = await getPaymentTransactions({
        page,
        limit: TRANSACTIONS_PER_PAGE,
      });
      if (data?.success === false) {
        throw new Error(data.message || "Failed to load transactions");
      }
      setAllTransactions(data.transactions || []);
      setTransactionsPagination(data.pagination || null);
      setTransactionsPage(page);
    } catch (err) {
      console.error("Error loading payment transactions:", err);
      const message = getLoadErrorMessage(err);
      setTransactionsError(message);
      setAllTransactions([]);
      setTransactionsPagination(null);
      toast.error(message);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  const handleToggleAllTransactions = async () => {
    if (showAllTransactions) {
      setShowAllTransactions(false);
      return;
    }

    setShowAllTransactions(true);
    await loadAllTransactions(1);
  };

  const handleTransactionsPageChange = async (nextPage) => {
    await loadAllTransactions(nextPage);
  };

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSubscriptionStatus();
      if (data?.success === false) {
        throw new Error(data.message || "Failed to load subscription status");
      }
      setStatus(data);
      if (data.repaired && data.subscription?.plan_type) {
        toast.success(`${formatPlanLabel(data.subscription.plan_type)} activated successfully`);
      }
    } catch (err) {
      console.error("Error loading subscription status:", err);
      const message = getLoadErrorMessage(err);
      setError(message);
      setStatus(null);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleInitiateCardRemoval = (card) => {
    navigate("/subscription/cancel", {
      state: {
        action: "remove_card",
        card,
        subscription,
        savedCards,
      },
    });
  };

  const handleDeleteCard = async (cardId) => {
    setDeletingCardId(cardId);
    try {
      await deleteSavedCard(cardId);
      toast.success("Payment method removed");
      await loadStatus();
    } catch (err) {
      console.error("Error deleting card:", err);
      toast.error(
        err?.response?.data?.message ||
          "Failed to remove payment method. Please try again.",
      );
    } finally {
      setDeletingCardId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <NewsFeedHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#16730F]"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <NewsFeedHeader />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Could not load dashboard
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={loadStatus}
                className="px-6 py-2.5 bg-[#1A3E32] text-white rounded-lg hover:bg-[#2d5a47] transition-colors font-medium"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const {
    subscription,
    freeQuota,
    paidSearchCredits = 0,
    usage,
    savedCards,
    recentTransactions,
    transactionCount,
  } = status || {};

  const topupSearchCredits = Number(usage?.topup_searches_remaining) || 0;
  const oneTimeRemaining = Number(usage?.remaining_searches) || 0;
  const totalPaidSearches = Number(usage?.total_paid_searches) || 0;
  const validOneTimeCredits =
    totalPaidSearches > 0 &&
    oneTimeRemaining > 0 &&
    oneTimeRemaining <= 50
      ? oneTimeRemaining
      : 0;
  // Prefer API-computed total; fall back to the same eligibility rules locally.
  const effectivePaidSearchCredits =
    Number(paidSearchCredits) > 0
      ? Number(paidSearchCredits)
      : topupSearchCredits + validOneTimeCredits;

  const freeQuotaExhausted = Boolean(
    freeQuota?.exhausted ||
      (freeQuota &&
        (freeQuota.searchesRemaining || 0) <= 0 &&
        (freeQuota.jobsRemaining || 0) <= 0 &&
        (freeQuota.recruitmentRemaining || 0) <= 0 &&
        Number(freeQuota.adCreditBalance || 0) <= 0),
  );

  const totalTransactions = transactionCount ?? recentTransactions?.length ?? 0;
  const totalTransactionPages = transactionsPagination?.totalPages || 0;
  const transactionStartIdx =
    totalTransactionPages > 0 ? (transactionsPage - 1) * TRANSACTIONS_PER_PAGE : 0;
  const transactionEndIdx = Math.min(
    transactionStartIdx + (allTransactions?.length || 0),
    transactionsPagination?.total || 0,
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <NewsFeedHeader />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr_1fr] gap-3 sm:gap-4 p-3 sm:p-4 max-w-screen-xl mx-auto flex-1 w-full min-w-0">
        {/* Left Sidebar */}
        <div className="hidden md:block">
          <div className="bg-white rounded-lg shadow p-4 sticky top-20">
            <h3 className="font-semibold text-[#1A3E32] mb-4">Navigation</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => navigate("/news-feed")}
                  className="text-gray-600 hover:text-[#16730F] w-full text-left px-3 py-2 rounded hover:bg-gray-50"
                >
                  ← Back to Dashboard
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate("/candidate-search-page")}
                  className="text-gray-600 hover:text-[#16730F] w-full text-left px-3 py-2 rounded hover:bg-gray-50"
                >
                  Candidate Search
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate("/subscription-pricing")}
                  className="text-gray-600 hover:text-[#16730F] w-full text-left px-3 py-2 rounded hover:bg-gray-50"
                >
                  Pricing Plans
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Main Content */}
        <div className="min-h-0 min-w-0">
          <MobileDashboardNav navigate={navigate} />

          <div className="bg-white rounded-lg shadow-lg overflow-hidden mt-3 md:mt-0">
            {/* Header */}
            <div className="bg-[#1A3E32] px-4 py-6 sm:px-6 sm:py-8 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Subscription Dashboard
              </h1>
              <p className="text-green-100 mt-2 text-base sm:text-lg">
                Manage your plan and payment methods
              </p>
            </div>

            {/* Current Plan Section */}
            <div className="p-4 sm:p-6 border-b">
              <h2 className="text-lg font-bold text-[#1A3E32] mb-4">
                Current Plan
              </h2>
              {subscription ? (
                <div className="bg-green-50 border-2 border-[#16730F] rounded-lg p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                      <span className="text-lg sm:text-xl font-semibold text-[#1A3E32]">
                        {formatPlanLabel(subscription.plan_type)}
                      </span>
                      <span className="px-3 py-1 text-xs font-bold bg-[#16730F] text-white rounded-full">
                        {subscription.status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-sm text-gray-600">
                        Next billing:{" "}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDashboardDate(subscription.next_billing_date)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    Candidate limit:{" "}
                    <span className="font-semibold text-[#1A3E32]">
                      {subscription.candidate_limit}
                    </span>{" "}
                    per search
                  </p>
                  {subscription.monthly_search_limit != null && (
                    <p className="mt-1 text-sm text-gray-600">
                      Searches this period:{" "}
                      <span className="font-semibold text-[#1A3E32]">
                        {subscription.searches_used_this_period || 0} /{" "}
                        {subscription.monthly_search_limit}
                      </span>
                    </p>
                  )}
                  {subscription.monthly_job_post_limit != null && (
                    <p className="mt-1 text-sm text-gray-600">
                      Job posts this period:{" "}
                      <span className="font-semibold text-[#1A3E32]">
                        {subscription.jobs_posted_this_period || 0} /{" "}
                        {subscription.monthly_job_post_limit}
                      </span>
                    </p>
                  )}
                  {subscription.monthly_job_post_limit == null && (
                    <p className="mt-1 text-sm text-gray-600">
                      Job posts:{" "}
                      <span className="font-semibold text-[#1A3E32]">
                        Unlimited (fair use)
                      </span>
                    </p>
                  )}
                  {Number(subscription.ad_credit_balance) > 0 && (
                    <p className="mt-1 text-sm text-gray-600">
                      AdPro credit balance:{" "}
                      <span className="font-semibold text-[#1A3E32]">
                        ₦{Number(subscription.ad_credit_balance).toLocaleString("en-NG")}
                      </span>
                    </p>
                  )}
                </div>
              ) : effectivePaidSearchCredits > 0 ? (
                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg sm:text-xl font-semibold text-gray-800">
                        Pay-Per-Search
                      </span>
                      <span className="px-3 py-1 text-xs font-bold bg-gray-700 text-white rounded-full">
                        ACTIVE
                      </span>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-sm text-gray-600">Remaining: </span>
                      <span className="text-xl sm:text-2xl font-bold text-[#16730F]">
                        {effectivePaidSearchCredits}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    Total searches used:{" "}
                    <span className="font-semibold">
                      {usage?.total_paid_searches || 0}
                    </span>
                  </p>
                  {freeQuota && !freeQuotaExhausted && (
                    <p className="mt-2 text-xs text-gray-500">
                      Free monthly ASE also available after paid credits are used
                      ({freeQuota.searchesRemaining} searches left this month).
                    </p>
                  )}
                </div>
              ) : freeQuota ? (
                <div
                  className={`rounded-lg p-4 border-2 ${
                    freeQuotaExhausted
                      ? "bg-amber-50 border-amber-200"
                      : "bg-green-50 border-[#16730F]"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                      <span className="text-lg sm:text-xl font-semibold text-[#1A3E32]">
                        Free Monthly ASE
                      </span>
                      <span
                        className={`px-3 py-1 text-xs font-bold text-white rounded-full ${
                          freeQuotaExhausted ? "bg-amber-600" : "bg-[#16730F]"
                        }`}
                      >
                        {freeQuotaExhausted ? "EXHAUSTED" : "ACTIVE"}
                      </span>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-sm text-gray-600">Resets: </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDashboardDate(freeQuota.nextResetDate)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    Candidate limit:{" "}
                    <span className="font-semibold text-[#1A3E32]">
                      {freeQuota.candidateLimit}
                    </span>{" "}
                    per search
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Searches this month:{" "}
                    <span className="font-semibold text-[#1A3E32]">
                      {freeQuota.searchesUsed || 0} /{" "}
                      {freeQuota.monthlySearchLimit}
                    </span>
                    <span className="text-gray-500">
                      {" "}
                      ({freeQuota.searchesRemaining} left)
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Job posts this month:{" "}
                    <span className="font-semibold text-[#1A3E32]">
                      {freeQuota.jobsUsed || 0} / {freeQuota.monthlyJobPostLimit}
                    </span>
                    <span className="text-gray-500">
                      {" "}
                      ({freeQuota.jobsRemaining} left)
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Recruitment exercises:{" "}
                    <span className="font-semibold text-[#1A3E32]">
                      {freeQuota.recruitmentUsed || 0} /{" "}
                      {freeQuota.recruitmentExerciseLimit}
                    </span>
                    <span className="text-gray-500">
                      {" "}
                      ({freeQuota.recruitmentRemaining} left)
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    AdPro credit balance:{" "}
                    <span className="font-semibold text-[#1A3E32]">
                      ₦
                      {Number(freeQuota.adCreditBalance || 0).toLocaleString(
                        "en-NG",
                      )}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 font-medium">
                    No active subscription or credits
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => navigate("/subscription-pricing")}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#1A3E32] text-white rounded-lg hover:bg-[#2d5a47] transition-colors font-medium cursor-pointer"
                >
                  {subscription ? "Change Plan" : "Upgrade Now"} →
                </button>
                {subscription && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/subscription/cancel", {
                        state: {
                          action: "cancel_subscription",
                          subscription,
                          savedCards,
                        },
                      })
                    }
                    className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm cursor-pointer"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>

            {/* Saved Payment Methods */}
            <div className="p-4 sm:p-6 border-b">
              <h2 className="text-lg font-bold text-[#1A3E32] mb-4">
                Payment Methods
              </h2>
              {savedCards && savedCards.length > 0 ? (
                <div className="space-y-3">
                  {savedCards.map((card) => (
                    <div
                      key={card.id}
                      className="flex items-center gap-3 sm:gap-4 bg-gray-50 rounded-xl p-4 border border-gray-200"
                    >
                      <div className="w-14 h-10 bg-white border border-gray-200 rounded-md flex items-center justify-center px-2 shrink-0 shadow-sm">
                        <CardBrandIcon brand={card.card_brand} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm sm:text-base font-semibold text-gray-900 tracking-wide">
                            •••• •••• •••• {card.card_last4}
                          </span>
                          {card.is_default && (
                            <span className="px-2.5 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide bg-[#16730F] text-white rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                          Expires {card.expiry_month}/{card.expiry_year}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInitiateCardRemoval(card)}
                        disabled={deletingCardId === card.id}
                        aria-label={
                          deletingCardId === card.id
                            ? "Removing payment method"
                            : "Remove payment method"
                        }
                        title={
                          deletingCardId === card.id
                            ? "Removing..."
                            : "Remove card"
                        }
                        className="shrink-0 inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-red-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {deletingCardId === card.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="w-4 h-4" aria-hidden />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-gray-500">No saved payment methods</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Cards are saved automatically after a successful Paystack
                    checkout.
                  </p>
                  <button
                    onClick={() => navigate("/subscription-pricing")}
                    className="mt-3 text-sm font-medium text-[#16730F] hover:underline"
                  >
                    Go to pricing to add a card
                  </button>
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            <div className="p-4 sm:p-6 w-full border-b">
              <h2 className="text-lg font-bold text-[#1A3E32] mb-4">
                Recent Transactions
              </h2>
              {recentTransactions && recentTransactions.length > 0 ? (
                <div className="space-y-3">
                  {recentTransactions.map((txn) => (
                    <TransactionRow key={txn.id} txn={txn} />
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-gray-500">No recent transactions</p>
                </div>
              )}

              {totalTransactions > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllTransactions}
                  className="mt-4 text-sm font-medium text-[#16730F] hover:underline"
                >
                  {showAllTransactions
                    ? "Hide all transactions"
                    : `View all transactions (${totalTransactions})`}
                </button>
              )}
            </div>

            {/* All Transactions */}
            {showAllTransactions && (
              <div className="p-4 sm:p-6 w-full">
                <h2 className="text-lg font-bold text-[#1A3E32] mb-4">
                  All Transactions
                </h2>

                {transactionsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-[#16730F]" />
                  </div>
                ) : transactionsError ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p className="text-red-700 mb-3">{transactionsError}</p>
                    <button
                      type="button"
                      onClick={() => loadAllTransactions(transactionsPage)}
                      className="text-sm font-medium text-[#16730F] hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : allTransactions.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {allTransactions.map((txn) => (
                        <TransactionRow key={txn.id} txn={txn} />
                      ))}
                    </div>

                    {totalTransactionPages > 1 && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-gray-200 text-sm">
                        <div className="text-gray-500">
                          Showing {transactionStartIdx + 1}–{transactionEndIdx} of{" "}
                          {transactionsPagination?.total || 0}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleTransactionsPageChange(transactionsPage - 1)
                            }
                            disabled={transactionsPage <= 1 || transactionsLoading}
                            className="px-3 py-1.5 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Previous
                          </button>
                          <span className="px-2 text-gray-700 font-medium">
                            Page {transactionsPage} of {totalTransactionPages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleTransactionsPageChange(transactionsPage + 1)
                            }
                            disabled={
                              transactionsPage >= totalTransactionPages ||
                              transactionsLoading
                            }
                            className="px-3 py-1.5 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-gray-500">No transactions found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Quick Actions */}
        <div className="hidden md:block">
          <div className="bg-white rounded-lg shadow p-4 sticky top-20">
            <h3 className="font-semibold text-[#1A3E32] mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate("/candidate-search-page")}
                className="w-full text-left px-4 py-3 bg-[#16730F] text-white rounded-lg hover:bg-[#145c0a] transition-colors font-medium"
              >
                Search Candidates →
              </button>
              <button
                onClick={() => navigate("/subscription-pricing")}
                className="w-full text-left px-4 py-3 border-2 border-[#1A3E32] text-[#1A3E32] rounded-lg hover:bg-[#1A3E32] hover:text-white transition-colors font-medium"
              >
                View Plans →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ASESubscriptionDashboard;
