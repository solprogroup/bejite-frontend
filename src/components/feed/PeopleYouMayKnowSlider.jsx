import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUserFriends,
  FaUserPlus,
  FaCheck,
  FaSpinner,
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
  FaSyncAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";
import * as connectionsApi from "../../services/connectionsApi";
import * as followsApi from "../../services/followsApi";
import { getAuthorProfileImageUrl } from "../../utils/profileImageUtils";
import { formatDisplayPersonName } from "../../utils/personDisplayName";
import DisplayNameWithBadge from "../DisplayNameWithBadge";
import { filterAdminUsersFromSearch } from "../../utils/filterAdminUsers";
import { isCorporateRecruiter } from "../../utils/recruiterProfilePaths";

const PAGE_SIZE = 15;

const PeopleYouMayKnowSlider = ({
  currentUserId,
  currentUser,
  className = "",
}) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dismissedUserIds, setDismissedUserIds] = useState(new Set());
  const [exitingUserIds, setExitingUserIds] = useState(new Set());
  const [isWidgetDismissed, setIsWidgetDismissed] = useState(false);
  const [connectionStatuses, setConnectionStatuses] = useState({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const sliderRef = useRef(null);
  const pageRef = useRef(1);
  const isFetchingMoreRef = useRef(false);
  const seenUserIdsRef = useRef(new Set());
  const dismissedUserIdsRef = useRef(dismissedUserIds);
  const connectionStatusesRef = useRef(connectionStatuses);

  useEffect(() => {
    dismissedUserIdsRef.current = dismissedUserIds;
  }, [dismissedUserIds]);

  useEffect(() => {
    connectionStatusesRef.current = connectionStatuses;
  }, [connectionStatuses]);

  // Check scroll positions to toggle chevron arrows
  const checkScrollState = useCallback(() => {
    const el = sliderRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;

    checkScrollState();
    el.addEventListener("scroll", checkScrollState, { passive: true });
    window.addEventListener("resize", checkScrollState);

    return () => {
      el.removeEventListener("scroll", checkScrollState);
      window.removeEventListener("resize", checkScrollState);
    };
  }, [checkScrollState, users.length]);

  // Background replenish helper
  const replenishUsers = useCallback(
    async (isReset = false) => {
      if (isFetchingMoreRef.current) return;
      isFetchingMoreRef.current = true;

      if (isReset) {
        setLoadingMore(true);
      }

      try {
        const nextPage = isReset ? pageRef.current + 1 : pageRef.current + 1;
        const offset = Math.max(0, (nextPage - 1) * PAGE_SIZE);

        let list = [];
        try {
          const res = await connectionsApi.discoverUsers(PAGE_SIZE, offset);
          list = res?.users || (Array.isArray(res) ? res : []);
        } catch (err) {
          console.warn("Discover users page fetch failed, trying fallback:", err);
          try {
            const fallbackRes = await connectionsApi.getConnections(nextPage, PAGE_SIZE);
            list = (fallbackRes?.connections || []).map((c) => c.user || c);
          } catch {
            list = [];
          }
        }

        // If current offset returned empty, loop back to start to replenish
        if (list.length === 0) {
          pageRef.current = 1;
          try {
            const resetRes = await connectionsApi.discoverUsers(PAGE_SIZE, 0);
            list = resetRes?.users || (Array.isArray(resetRes) ? resetRes : []);
          } catch {
            list = [];
          }
          // If we cycled back, retain only current/pending users in seen set so we can recycle
          seenUserIdsRef.current = new Set([
            String(currentUserId),
            ...Object.keys(connectionStatusesRef.current || {}),
          ]);
        } else {
          pageRef.current = nextPage;
        }

        const cleanList = filterAdminUsersFromSearch(list).filter(
          (u) =>
            u &&
            String(u.id || u.userId) !== String(currentUserId) &&
            !seenUserIdsRef.current.has(String(u.id || u.userId)),
        );

        cleanList.forEach((u) => {
          seenUserIdsRef.current.add(String(u.id || u.userId));
        });

        if (cleanList.length > 0) {
          setUsers((prev) => {
            const existingIds = new Set(prev.map((u) => String(u.id || u.userId)));
            const uniqueIncoming = cleanList.filter(
              (u) => !existingIds.has(String(u.id || u.userId)),
            );
            return [...prev, ...uniqueIncoming];
          });
        }
      } catch (err) {
        console.error("Failed to replenish users:", err);
      } finally {
        isFetchingMoreRef.current = false;
        setLoadingMore(false);
      }
    },
    [currentUserId],
  );

  // Initial fetch of discoverable connections
  useEffect(() => {
    let isMounted = true;

    const fetchInitialSuggestions = async () => {
      try {
        setLoading(true);

        // Pre-fetch outgoing requests so already requested users display "Requested"
        const pendingIds = new Set();
        try {
          const outgoingRes = await connectionsApi.getOutgoingRequests(1, 50);
          const outgoingList =
            outgoingRes?.requests ||
            (Array.isArray(outgoingRes) ? outgoingRes : []);
          outgoingList.forEach((req) => {
            const toId =
              req?.toUserId ||
              req?.toUser?.id ||
              req?.toUser?.userId ||
              req?.userId;
            if (toId) pendingIds.add(String(toId));
          });
        } catch {
          // outgoing requests optional
        }

        let discoverList = [];
        try {
          const res = await connectionsApi.discoverUsers(PAGE_SIZE, 0);
          discoverList = res?.users || (Array.isArray(res) ? res : []);
        } catch (err) {
          console.warn("Discover users failed, falling back to network pool:", err);
          try {
            const fallbackRes = await connectionsApi.getConnections(1, PAGE_SIZE);
            discoverList = (fallbackRes?.connections || []).map(
              (c) => c.user || c,
            );
          } catch {
            discoverList = [];
          }
        }

        if (!isMounted) return;

        // Filter out admin users and current authenticated user
        const cleanList = filterAdminUsersFromSearch(discoverList).filter(
          (u) =>
            u &&
            String(u.id || u.userId) !== String(currentUserId),
        );

        // Populate initial pending statuses
        const initialStatuses = {};
        pendingIds.forEach((id) => {
          initialStatuses[id] = "pending";
        });

        // Initialize seen IDs set
        cleanList.forEach((u) => {
          seenUserIdsRef.current.add(String(u.id || u.userId));
        });
        if (currentUserId) {
          seenUserIdsRef.current.add(String(currentUserId));
        }

        setConnectionStatuses(initialStatuses);
        setUsers(cleanList);
        pageRef.current = 1;
      } catch (err) {
        console.error("Error loading people you may know:", err);
        if (isMounted) setUsers([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInitialSuggestions();

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  // Scroll actions
  const scroll = (direction) => {
    const el = sliderRef.current;
    if (!el) return;
    const scrollAmount = Math.max(280, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Send connection request, close card, and replenish in background
  const handleConnect = async (e, targetUser) => {
    e.stopPropagation();
    const targetUserId = String(targetUser?.id || targetUser?.userId || "");
    if (!targetUserId) return;

    if (isCorporateRecruiter(currentUser)) {
      toast.info("Corporate accounts are follow-only.");
      return;
    }

    setConnectionStatuses((prev) => ({ ...prev, [targetUserId]: "connecting" }));

    try {
      const followStatus = await followsApi
        .getFollowStatus(targetUserId)
        .catch(() => null);
      const targetName = formatDisplayPersonName(targetUser, "User");

      if (followStatus?.isCorporate) {
        await followsApi.followUser(targetUserId);
        toast.success(`You are now following ${targetName}!`);
        setConnectionStatuses((prev) => ({
          ...prev,
          [targetUserId]: "following",
        }));
      } else {
        const res = await connectionsApi.sendConnectionRequest(targetUserId);
        if (res?.connected) {
          toast.success(`Connected with ${targetName}!`);
          setConnectionStatuses((prev) => ({
            ...prev,
            [targetUserId]: "connected",
          }));
        } else {
          toast.success(`Connection request sent to ${targetName}!`);
          setConnectionStatuses((prev) => ({
            ...prev,
            [targetUserId]: "pending",
          }));
        }
      }

      seenUserIdsRef.current.add(targetUserId);

      // Brief delay (500ms) for user to see the success checkmark
      setTimeout(() => {
        // Trigger smooth card exit animation
        setExitingUserIds((prev) => new Set([...prev, targetUserId]));

        // After animation finishes (300ms), remove card and replenish background
        setTimeout(() => {
          setUsers((prev) => {
            const remaining = prev.filter(
              (u) => String(u.id || u.userId) !== targetUserId,
            );
            const remainingVisible = remaining.filter(
              (u) => !dismissedUserIdsRef.current.has(String(u.id || u.userId)),
            );

            // If running low (<= 4) or all cards connected, background refresh to fetch more
            if (remainingVisible.length <= 4) {
              replenishUsers(remainingVisible.length === 0);
            }

            return remaining;
          });

          setExitingUserIds((prev) => {
            const next = new Set(prev);
            next.delete(targetUserId);
            return next;
          });
        }, 300);
      }, 500);
    } catch (err) {
      console.error("Failed to connect:", err);
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to send request";
      toast.error(errorMsg);
      setConnectionStatuses((prev) => {
        const next = { ...prev };
        delete next[targetUserId];
        return next;
      });
    }
  };

  // Dismiss individual card with animation and replenish
  const handleDismissCard = (e, userId) => {
    e.stopPropagation();
    const uId = String(userId);
    setExitingUserIds((prev) => new Set([...prev, uId]));
    seenUserIdsRef.current.add(uId);

    setTimeout(() => {
      setDismissedUserIds((prev) => new Set([...prev, uId]));
      setUsers((prev) => {
        const remaining = prev.filter((u) => String(u.id || u.userId) !== uId);
        const remainingVisible = remaining.filter(
          (u) => !dismissedUserIdsRef.current.has(String(u.id || u.userId)),
        );

        // If running low (<= 4) or empty, background refresh for more users
        if (remainingVisible.length <= 4) {
          replenishUsers(remainingVisible.length === 0);
        }

        return remaining;
      });

      setExitingUserIds((prev) => {
        const next = new Set(prev);
        next.delete(uId);
        return next;
      });
    }, 250);
  };

  // Navigate to user profile
  const handleProfileClick = (userId) => {
    if (userId) {
      navigate(`/user-profile/${userId}`);
    }
  };

  const visibleUsers = users.filter(
    (u) => !dismissedUserIds.has(String(u.id || u.userId)),
  );

  // If user explicitly dismissed the entire section
  if (isWidgetDismissed) return null;

  return (
    <section
      aria-label="People you may know"
      className={`max-w-3xl mx-auto bg-white rounded-2xl shadow p-4 sm:p-5 my-6 border border-gray-100 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#16730F]/10 flex items-center justify-center text-[#16730F]">
            <FaUserFriends className="text-base" />
          </div>
          <div>
            <h2 className="font-bold text-[#1A3E32] text-base sm:text-lg leading-tight">
              People you may know
            </h2>
            <p className="text-xs text-gray-500">Based on your industry and connections</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/connection")}
            className="text-sm font-semibold text-[#16730F] hover:text-[#135d0d] hover:underline px-2 py-1 rounded transition-colors"
          >
            See all
          </button>
          <button
            type="button"
            onClick={() => setIsWidgetDismissed(true)}
            aria-label="Hide people you may know"
            title="Hide"
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <FaTimes className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Slider Carousel Area */}
      <div className="relative group/slider">
        {/* Left Scroll Button */}
        {canScrollLeft && !loading && visibleUsers.length > 0 && (
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="absolute -left-2.5 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white shadow-lg border border-gray-200 text-[#1A3E32] flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
          >
            <FaChevronLeft className="text-sm" />
          </button>
        )}

        {/* Right Scroll Button */}
        {canScrollRight && !loading && visibleUsers.length > 0 && (
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="absolute -right-2.5 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white shadow-lg border border-gray-200 text-[#1A3E32] flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
          >
            <FaChevronRight className="text-sm" />
          </button>
        )}

        {/* Cards Track */}
        <div
          ref={sliderRef}
          className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth py-1.5 px-0.5 snap-x snap-mandatory touch-pan-x min-h-[290px] items-center"
        >
          {loading || (loadingMore && visibleUsers.length === 0) ? (
            // Skeleton Placeholders while loading
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`pymk-skeleton-${i}`}
                className="w-[185px] sm:w-[195px] shrink-0 snap-start bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs animate-pulse"
              >
                <div className="w-full h-36 bg-gray-200" />
                <div className="p-3 space-y-2.5">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-8 bg-gray-200 rounded-lg w-full mt-3" />
                  <div className="h-7 bg-gray-100 rounded-lg w-full" />
                </div>
              </div>
            ))
          ) : visibleUsers.length === 0 ? (
            // All cards connected/removed state with refresh button
            <div className="w-full py-8 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[#16730F]/10 flex items-center justify-center text-[#16730F]">
                <FaUserFriends className="text-xl" />
              </div>
              <p className="text-sm font-semibold text-[#1A3E32]">
                You've reviewed all suggestions!
              </p>
              <p className="text-xs text-gray-500">
                Connect with more professionals across the network
              </p>
              <button
                type="button"
                onClick={() => replenishUsers(true)}
                disabled={loadingMore}
                className="mt-2 px-4 py-2 bg-[#16730F] hover:bg-[#135d0d] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-60"
              >
                <FaSyncAlt className={`text-xs ${loadingMore ? "animate-spin" : ""}`} />
                <span>Discover More People</span>
              </button>
            </div>
          ) : (
            visibleUsers.map((user) => {
              const userId = String(user.id || user.userId);
              const status = connectionStatuses[userId] || "none";
              const isConnecting = status === "connecting";
              const isPending = status === "pending";
              const isConnected = status === "connected";
              const isFollowing = status === "following";
              const isExiting = exitingUserIds.has(userId);
              const photoUrl = getAuthorProfileImageUrl(user);
              const displayName = formatDisplayPersonName(user);
              const subtitle =
                user.mutualConnectionsCount || user.mutualCount
                  ? `${user.mutualConnectionsCount || user.mutualCount} mutual connection${
                      (user.mutualConnectionsCount || user.mutualCount) > 1
                        ? "s"
                        : ""
                    }`
                  : user.jobTitle || user.job_title || user.role || "Suggested for you";

              return (
                <div
                  key={`pymk-${userId}`}
                  className={`w-[185px] sm:w-[195px] shrink-0 snap-start bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group/card relative select-none ${
                    isExiting
                      ? "scale-90 opacity-0 -translate-y-2 pointer-events-none"
                      : "scale-100 opacity-100"
                  }`}
                >
                  {/* Dismiss card 'X' button */}
                  <button
                    type="button"
                    onClick={(e) => handleDismissCard(e, userId)}
                    aria-label={`Remove ${displayName} from suggestions`}
                    title="Remove"
                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center transition-all shadow-xs backdrop-blur-xs cursor-pointer"
                  >
                    <FaTimes className="text-xs" />
                  </button>

                  {/* Top Photo / Avatar */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleProfileClick(userId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleProfileClick(userId);
                      }
                    }}
                    className="w-full h-36 sm:h-40 bg-gray-100 relative overflow-hidden cursor-pointer"
                  >
                    <img
                      src={photoUrl}
                      alt={displayName}
                      className="w-full h-full object-cover object-center group-hover/card:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>

                  {/* Info Section */}
                  <div className="p-3 flex flex-col flex-1 justify-between gap-2.5">
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => handleProfileClick(userId)}
                        className="text-left font-semibold text-sm text-[#1A3E32] hover:text-[#16730F] truncate block w-full transition-colors"
                      >
                        <DisplayNameWithBadge
                          user={user}
                          fallback={displayName}
                          badgeSize="xs"
                        />
                      </button>
                      <p
                        className="text-xs text-gray-500 line-clamp-2 min-h-[32px] leading-tight text-left"
                        title={subtitle}
                      >
                        {subtitle}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-1.5 pt-1">
                      {isPending ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-1.5 px-3 bg-gray-100 text-[#16730F] font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 border border-[#16730F]/30"
                        >
                          <FaCheck className="text-xs" />
                          <span>Requested</span>
                        </button>
                      ) : isConnected ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-1.5 px-3 bg-green-50 text-green-700 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 border border-green-200"
                        >
                          <FaCheck className="text-xs" />
                          <span>Connected</span>
                        </button>
                      ) : isFollowing ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-1.5 px-3 bg-green-50 text-green-700 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 border border-green-200"
                        >
                          <FaCheck className="text-xs" />
                          <span>Following</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleConnect(e, user)}
                          disabled={isConnecting}
                          className="w-full py-1.5 px-3 bg-[#16730F] hover:bg-[#135d0d] text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs active:scale-[0.98] disabled:opacity-75 cursor-pointer"
                        >
                          {isConnecting ? (
                            <>
                              <FaSpinner className="animate-spin text-xs" />
                              <span>Connecting...</span>
                            </>
                          ) : (
                            <>
                              <FaUserPlus className="text-xs" />
                              <span>Connect</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Remove / Dismiss button */}
                      <button
                        type="button"
                        onClick={(e) => handleDismissCard(e, userId)}
                        className="w-full py-1 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors active:scale-[0.98] cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default PeopleYouMayKnowSlider;
