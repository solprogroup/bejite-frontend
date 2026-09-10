import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { EventModal } from "../../components/modal/confirmBadgeModal";
import { EventCard } from "../../components/card/EventCard";
import NewsFeedLayout from "../../components/layout/NewsFeedLayout";
import VerifiedBadge from "../../components/VerifiedBadge";
import VerifiedBadgeIcon from "../../components/VerifiedBadgeIcon";
import {
  getBadgeStatus,
  getPartnerEvents,
  getEmploymentMetrics,
  registerForPartnerEvent,
  trackPartnerEventClick,
} from "../../services/verifiedBadgeApi";
import { getUser, mergeAuthUsers } from "../../utils/tokenManager";
import { getVerifiedBadgeLabel, userIsRecruiter } from "../../utils/verifiedBadge";

const CATEGORY_STYLES = {
  Technology: { color: "from-blue-600 to-indigo-700" },
  Finance: { color: "from-emerald-600 to-teal-700" },
  Product: { color: "from-purple-600 to-violet-700" },
  Creative: { color: "from-rose-500 to-pink-700" },
};

const JOBSEEKER_LINES = [
  { key: "applicationsSubmitted", label: "Applications", color: "#1A3E32" },
  { key: "applicationsViewedByRecruiter", label: "Recruiter views", color: "#16730F" },
  { key: "fieldRelatedJobPosts", label: "Related jobs", color: "#B45309" },
];

const RECRUITER_LINES = [
  { key: "jobPostings", label: "Job postings", color: "#1A3E32" },
  { key: "applicationsReceived", label: "Applications", color: "#16730F" },
  { key: "totalJobViews", label: "Total views", color: "#0F766E" },
  { key: "uniqueJobseekerViews", label: "Unique viewers / day", color: "#B45309" },
];

function formatEventDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatChartDay(value, period) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  if (period === "week") {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function mapApiEvent(event) {
  const style = CATEGORY_STYLES[event.category] || { color: "from-[#1A3E32] to-[#2d6a54]" };
  const hostInitials = (event.host || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    ...event,
    color: style.color,
    hostAvatar: hostInitials,
    date: formatEventDate(event.date),
    coverImg: event.coverImg || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80",
    tags: Array.isArray(event.tags) ? event.tags : [],
  };
}

function MetricTile({ label, value }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 sm:p-4 min-w-0">
      <p className="text-2xl font-bold text-[#1A3E32] tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 mt-1 leading-snug break-words">{label}</p>
    </div>
  );
}

function EmploymentMetricsGrid({ metrics, isRecruiter }) {
  if (!metrics) return null;

  if (isRecruiter) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <MetricTile label="Job postings (period)" value={metrics.jobPostings ?? 0} />
        <MetricTile
          label="Active postings (now)"
          value={metrics.activeJobPostings ?? 0}
        />
        <MetricTile
          label="Unique jobseekers (period)"
          value={metrics.uniqueJobseekerViews ?? 0}
        />
        <MetricTile
          label="Total posting views (period)"
          value={metrics.totalJobViews ?? 0}
        />
        <MetricTile
          label="Applications received (period)"
          value={metrics.applicationsReceived ?? 0}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
      <MetricTile
        label="Applications submitted (period)"
        value={metrics.applicationsSubmitted ?? 0}
      />
      <MetricTile
        label="Viewed by recruiters (period)"
        value={metrics.applicationsViewedByRecruiter ?? 0}
      />
      <MetricTile
        label="Still under review / interview"
        value={metrics.applicationsInPipeline ?? 0}
      />
      <MetricTile
        label="Related jobs posted (period)"
        value={metrics.fieldRelatedJobPosts ?? 0}
      />
      <MetricTile
        label="Related jobs active (now)"
        value={metrics.fieldRelatedJobsActive ?? 0}
      />
    </div>
  );
}

function EmploymentMetricsChart({ series, period, isRecruiter }) {
  const lines = isRecruiter ? RECRUITER_LINES : JOBSEEKER_LINES;
  const chartData = useMemo(
    () =>
      (series || []).map((point) => ({
        ...point,
        label: formatChartDay(point.day, period),
      })),
    [series, period],
  );

  if (!chartData.length) {
    return (
      <div className="h-[260px] sm:h-[300px] flex items-center justify-center text-sm text-gray-500">
        No trend data for this period yet.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 h-[280px] sm:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            interval={period === "week" ? 0 : "preserveStartEnd"}
            minTickGap={period === "week" ? 0 : 28}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #F3F4F6",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            }}
            labelStyle={{ fontWeight: 600, color: "#111827", marginBottom: 4 }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={line.color}
              strokeWidth={2.25}
              dot={period === "week"}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function BadgeHolder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reduxUser = useSelector((state) => state.auth?.user);
  const sessionUser = useMemo(
    () => mergeAuthUsers(getUser() || {}, reduxUser || {}),
    [reduxUser],
  );
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [events, setEvents] = useState([]);
  const [badgeStatus, setBadgeStatus] = useState(null);
  const [metricsPeriod, setMetricsPeriod] = useState("month");
  const [employmentMetrics, setEmploymentMetrics] = useState(null);
  const [metricsSeries, setMetricsSeries] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const badgeRole =
    badgeStatus?.role ||
    sessionUser?.role ||
    (badgeStatus?.source === "recruiter" ||
    badgeStatus?.source === "employer_standalone"
      ? "recruiter"
      : null);

  const badgeLabel = getVerifiedBadgeLabel(badgeRole || sessionUser);
  const isRecruiter = userIsRecruiter(badgeRole || sessionUser);

  useEffect(() => {
    const load = async () => {
      try {
        const status = await getBadgeStatus();
        setBadgeStatus(status);

        if (!status?.hasVerifiedBadge) {
          navigate("/badge", { replace: true });
          return;
        }

        const deepLinkEventId = searchParams.get("eventId");
        if (deepLinkEventId) {
          void trackPartnerEventClick(deepLinkEventId).catch(() => {
            /* ignore analytics failures */
          });
        }

        const eventsRes = await getPartnerEvents();
        const mapped = (eventsRes?.events || []).map(mapApiEvent);
        setEvents(mapped);

        if (deepLinkEventId) {
          const match = mapped.find(
            (e) => String(e.id) === String(deepLinkEventId),
          );
          if (match) setSelectedEvent(match);
        }
      } catch (err) {
        console.error(err);
        if (err.response?.status === 403) {
          navigate("/badge", { replace: true });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate, searchParams]);

  useEffect(() => {
    if (!badgeStatus?.hasVerifiedBadge) return undefined;

    const controller = new AbortController();
    const loadMetrics = async () => {
      setMetricsLoading(true);
      try {
        const metricsRes = await getEmploymentMetrics(metricsPeriod, {
          signal: controller.signal,
        });
        setEmploymentMetrics(metricsRes?.metrics || null);
        setMetricsSeries(Array.isArray(metricsRes?.series) ? metricsRes.series : []);
      } catch (err) {
        if (controller.signal.aborted || err?.code === "ERR_CANCELED") return;
        console.error(err);
        setEmploymentMetrics(null);
        setMetricsSeries([]);
      } finally {
        if (!controller.signal.aborted) setMetricsLoading(false);
      }
    };

    loadMetrics();
    return () => {
      controller.abort();
    };
  }, [badgeStatus?.hasVerifiedBadge, metricsPeriod]);

  if (loading) {
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-white font-bold text-lg sm:text-xl">
                  Verified Dashboard
                </h1>
                <VerifiedBadge
                  size="sm"
                  role={badgeRole}
                  user={sessionUser}
                  label={badgeLabel}
                  responsiveLabel
                />
              </div>
              <p className="text-green-200 text-xs mt-0.5 leading-relaxed break-words">
                Events, metrics, and subscriber benefits
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto nfl-scroll scroll-smooth">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
            <div className="bg-gradient-to-r from-[#1A3E32] to-[#2d6a54] rounded-2xl p-4 sm:p-5 text-white flex items-start gap-3 sm:gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <VerifiedBadgeIcon className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm sm:text-base break-words">
                  Welcome to the Inner Circle
                </p>
                <p className="text-green-100 text-xs mt-0.5 leading-relaxed break-words">
                  Your verified badge is active
                  {badgeStatus?.expiresAt
                    ? ` until ${new Date(badgeStatus.expiresAt).toLocaleDateString()}`
                    : ""}
                  . Access exclusive events and your employment metrics below.
                </p>
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 text-base break-words">
                    {isRecruiter
                      ? "Your hiring metrics"
                      : "Your job search metrics"}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5 break-words">
                    {metricsPeriod === "week"
                      ? "Last 7 days (UTC)"
                      : "Last 30 days (UTC)"}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-full sm:w-fit shrink-0">
                  {[
                    { id: "week", label: "Weekly" },
                    { id: "month", label: "Monthly" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMetricsPeriod(tab.id)}
                      className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        metricsPeriod === tab.id
                          ? "bg-white shadow-sm text-gray-900"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {metricsLoading && !employmentMetrics ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A3E32]" />
                </div>
              ) : (
                <>
                  <EmploymentMetricsGrid
                    metrics={employmentMetrics}
                    isRecruiter={isRecruiter}
                  />
                  <div className="bg-white border border-gray-100 rounded-2xl p-3 sm:p-4 min-w-0 overflow-hidden relative">
                    <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Trends
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Daily totals in UTC. Unique viewers/day can sum higher
                          than the period unique tile.
                        </p>
                      </div>
                      {metricsLoading && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1A3E32] shrink-0" />
                      )}
                    </div>
                    <EmploymentMetricsChart
                      series={metricsSeries}
                      period={metricsPeriod}
                      isRecruiter={isRecruiter}
                    />
                  </div>
                </>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between gap-3 mb-4 min-w-0">
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 text-base">Partner Events</h2>
                  <p className="text-gray-500 text-xs mt-0.5 break-words">
                    {events.length} upcoming · Verified subscribers only
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                {events.map((event, i) => (
                  <motion.div key={event.id} transition={{ delay: i * 0.07 }}>
                    <EventCard event={event} onSelect={setSelectedEvent} />
                  </motion.div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedEvent && (
          <EventModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            canRegister={badgeStatus?.hasVerifiedBadge}
            onRegister={registerForPartnerEvent}
          />
        )}
      </AnimatePresence>
    </NewsFeedLayout>
  );
}
