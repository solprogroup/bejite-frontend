import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
  createContext,
  useMemo,
} from "react";
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

const POOL_BATCH_SIZE = 60;
const SEGMENT_CARD_COUNT = 10;
const RECENT_SHOWN_STORAGE_KEY = "bejite_recent_pymk_ids";
const SESSION_ROTATION_KEY = "bejite_pymk_session_rotation";

/**
 * Fisher-Yates array shuffling for unbiased distribution
 */
export const shuffleArray = (arr) => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/**
 * Determines whether a user object has a valid non-placeholder profile image
 */
const hasProfilePhoto = (u) => {
  const photo =
    u?.profilePhoto ||
    u?.profilePicture ||
    u?.profile_photo ||
    u?.avatar ||
    u?.photo ||
    u?.image;
  return Boolean(
    photo &&
      photo !== "/assets/images/photo_placeholder.png" &&
      !String(photo).includes("placeholder"),
  );
};

// Context for coordinating multiple feed sliders without card duplication
const PeopleSuggestionsContext = createContext(null);

/**
 * PeopleSuggestionsProvider coordinates suggestions across multiple sliders in the feed:
 * - Fetches a large pool once on load with session-based offset rotation and cache-busting.
 * - Tracks recently shown user IDs in sessionStorage to guarantee fresh recommendations on page refresh.
 * - Slices non-overlapping segments for each slider occurrence (every 4 posts).
 * - Shares connect and dismiss states across all sliders.
 */
export const PeopleSuggestionsProvider = ({
  currentUserId,
  currentUser,
  children,
}) => {
  const [masterPool, setMasterPool] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingSegments, setRefreshingSegments] = useState({});
  const [connectionStatuses, setConnectionStatuses] = useState({});
  const [dismissedUserIds, setDismissedUserIds] = useState(new Set());
  const [dismissedWidgets, setDismissedWidgets] = useState(new Set());
  const [segmentAllocations, setSegmentAllocations] = useState({});

  const dismissedUserIdsRef = useRef(dismissedUserIds);
  useEffect(() => {
    dismissedUserIdsRef.current = dismissedUserIds;
  }, [dismissedUserIds]);

  const connectionStatusesRef = useRef(connectionStatuses);
  useEffect(() => {
    connectionStatusesRef.current = connectionStatuses;
  }, [connectionStatuses]);

  const segmentAllocationsRef = useRef(segmentAllocations);
  useEffect(() => {
    segmentAllocationsRef.current = segmentAllocations;
  }, [segmentAllocations]);

  const masterPoolRef = useRef(masterPool);
  useEffect(() => {
    masterPoolRef.current = masterPool;
  }, [masterPool]);

  // Fetch initial discoverable pool with rotation and session recency tracking
  const fetchPool = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);

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

        // Advance session rotation offset on each page load/reload
        let sessionOffset = 0;
        try {
          const prevRotation = parseInt(
            sessionStorage.getItem(SESSION_ROTATION_KEY) || "0",
            10,
          );
          const nextRotation = (prevRotation + 1) % 4; // cycles 0, 1, 2, 3
          sessionStorage.setItem(SESSION_ROTATION_KEY, String(nextRotation));
          sessionOffset = nextRotation * 15;
        } catch {
          sessionOffset = 0;
        }

        let discoverList = [];
        try {
          const res = await connectionsApi.discoverUsers(
            POOL_BATCH_SIZE,
            sessionOffset,
          );
          discoverList = res?.users || (Array.isArray(res) ? res : []);
        } catch (err) {
          console.warn("Discover users with offset failed:", err);
        }

        // Fallback to offset 0 if offset returned empty or small
        if (!discoverList || discoverList.length < 10) {
          try {
            const fallbackRes = await connectionsApi.discoverUsers(
              POOL_BATCH_SIZE,
              0,
            );
            discoverList =
              fallbackRes?.users ||
              (Array.isArray(fallbackRes) ? fallbackRes : []);
          } catch (err) {
            console.warn("Discover users fallback to 0 failed:", err);
            try {
              const netRes = await connectionsApi.getConnections(1, 50);
              discoverList = (netRes?.connections || []).map(
                (c) => c.user || c,
              );
            } catch {
              discoverList = [];
            }
          }
        }

        // Clean and deduplicate list
        const seenRawIds = new Set();
        const cleanList = filterAdminUsersFromSearch(discoverList).filter(
          (u) => {
            const id = String(u?.id || u?.userId || "");
            if (!id || id === String(currentUserId) || seenRawIds.has(id)) {
              return false;
            }
            seenRawIds.add(id);
            return true;
          },
        );

        // Session Recency Tracking:
        // Read user IDs that were shown during the previous view/page refresh
        let recentSeenIds = new Set();
        try {
          const storedRecent = sessionStorage.getItem(RECENT_SHOWN_STORAGE_KEY);
          if (storedRecent) {
            recentSeenIds = new Set(JSON.parse(storedRecent));
          }
        } catch {
          recentSeenIds = new Set();
        }

        // Partition users into fresh (not seen in last session) and seen
        const freshUsers = cleanList.filter(
          (u) => !recentSeenIds.has(String(u.id || u.userId)),
        );
        const seenUsers = cleanList.filter((u) =>
          recentSeenIds.has(String(u.id || u.userId)),
        );

        // Shuffle each group and prioritize users with profile photos
        const freshWithPhoto = shuffleArray(freshUsers.filter(hasProfilePhoto));
        const freshNoPhoto = shuffleArray(
          freshUsers.filter((u) => !hasProfilePhoto(u)),
        );
        const seenWithPhoto = shuffleArray(seenUsers.filter(hasProfilePhoto));
        const seenNoPhoto = shuffleArray(
          seenUsers.filter((u) => !hasProfilePhoto(u)),
        );

        const finalOrderedPool = [
          ...freshWithPhoto,
          ...freshNoPhoto,
          ...seenWithPhoto,
          ...seenNoPhoto,
        ];

        // Record front batch into sessionStorage so the NEXT page refresh rotates
        try {
          const newlyRecorded = finalOrderedPool
            .slice(0, 25)
            .map((u) => String(u.id || u.userId));
          sessionStorage.setItem(
            RECENT_SHOWN_STORAGE_KEY,
            JSON.stringify(newlyRecorded),
          );
        } catch {
          // ignore storage error
        }

        const initialStatuses = {};
        pendingIds.forEach((id) => {
          initialStatuses[id] = "pending";
        });

        setConnectionStatuses((prev) => ({ ...initialStatuses, ...prev }));
        setMasterPool(finalOrderedPool);
        setSegmentAllocations({});
      } catch (err) {
        console.error("Error loading people you may know pool:", err);
        setMasterPool([]);
      } finally {
        setLoading(false);
      }
    },
    [currentUserId],
  );

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  // Allocate non-overlapping cards for a specific slider segment
  const getSegmentUsers = useCallback(
    (segmentIndex, requestedCount = SEGMENT_CARD_COUNT) => {
      const pool = masterPoolRef.current;
      if (pool.length === 0) return [];

      const existingIds = segmentAllocationsRef.current[segmentIndex];
      const dismissed = dismissedUserIdsRef.current;

      if (existingIds && existingIds.length > 0) {
        const idToUser = new Map(
          pool.map((u) => [String(u.id || u.userId), u]),
        );
        const userList = existingIds
          .map((id) => idToUser.get(id))
          .filter((u) => u && !dismissed.has(String(u.id || u.userId)));
        if (userList.length > 0) return userList;
      }

      // Find users not allocated to any other segment
      const allocatedInOtherSegments = new Set();
      Object.entries(segmentAllocationsRef.current).forEach(([idx, ids]) => {
        if (Number(idx) !== Number(segmentIndex)) {
          (ids || []).forEach((id) => allocatedInOtherSegments.add(id));
        }
      });

      const statuses = connectionStatusesRef.current;
      const availableUsers = pool.filter((u) => {
        const id = String(u.id || u.userId);
        return (
          !dismissed.has(id) &&
          !allocatedInOtherSegments.has(id) &&
          statuses[id] !== "connected" &&
          statuses[id] !== "following"
        );
      });

      // If segmentIndex > 0 and no more available users, return empty to prevent duplicates
      if (availableUsers.length === 0 && segmentIndex > 0) {
        return [];
      }

      const assigned = availableUsers.slice(0, requestedCount);
      const assignedIds = assigned.map((u) => String(u.id || u.userId));

      if (assignedIds.length > 0) {
        setTimeout(() => {
          setSegmentAllocations((prev) => {
            if (prev[segmentIndex]) return prev;
            return {
              ...prev,
              [segmentIndex]: assignedIds,
            };
          });
        }, 0);
      }

      return assigned;
    },
    [],
  );

  // Rotate / re-shuffle suggestions for a specific slider segment on demand
  const refreshSegment = useCallback(
    async (segmentIndex) => {
      setRefreshingSegments((prev) => ({ ...prev, [segmentIndex]: true }));

      const pool = masterPoolRef.current;
      const currentSegmentIds = new Set(
        segmentAllocationsRef.current[segmentIndex] || [],
      );
      const otherSegmentIds = new Set();
      Object.entries(segmentAllocationsRef.current).forEach(([idx, ids]) => {
        if (Number(idx) !== Number(segmentIndex)) {
          (ids || []).forEach((id) => otherSegmentIds.add(id));
        }
      });

      const dismissed = dismissedUserIdsRef.current;
      const statuses = connectionStatusesRef.current;

      // Unseen candidates not in any active segment
      let candidates = pool.filter((u) => {
        const id = String(u.id || u.userId);
        return (
          !currentSegmentIds.has(id) &&
          !otherSegmentIds.has(id) &&
          !dismissed.has(id) &&
          statuses[id] !== "connected" &&
          statuses[id] !== "following"
        );
      });

      // If low on candidates, re-shuffle available pool excluding other segments
      if (candidates.length < 5) {
        const reusable = pool.filter((u) => {
          const id = String(u.id || u.userId);
          return (
            !otherSegmentIds.has(id) &&
            !dismissed.has(id) &&
            statuses[id] !== "connected" &&
            statuses[id] !== "following"
          );
        });
        candidates = shuffleArray(reusable);
      }

      const newAssigned = candidates.slice(0, SEGMENT_CARD_COUNT);
      const newAssignedIds = newAssigned.map((u) => String(u.id || u.userId));

      setTimeout(() => {
        setSegmentAllocations((prev) => ({
          ...prev,
          [segmentIndex]: newAssignedIds,
        }));
        setRefreshingSegments((prev) => ({ ...prev, [segmentIndex]: false }));
      }, 350);
    },
    [],
  );

  // Send connection request and replenish card smoothly
  const connectUser = useCallback(
    async (targetUser, segmentIndex) => {
      const targetUserId = String(targetUser?.id || targetUser?.userId || "");
      if (!targetUserId) return;

      if (isCorporateRecruiter(currentUser)) {
        toast.info("Corporate accounts are follow-only.");
        return;
      }

      setConnectionStatuses((prev) => ({
        ...prev,
        [targetUserId]: "connecting",
      }));

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

        // Replenish with a candidate from master pool after card exit animation
        setTimeout(() => {
          setSegmentAllocations((prev) => {
            const currentIds = prev[segmentIndex] || [];
            const remainingIds = currentIds.filter((id) => id !== targetUserId);

            const allAllocated = new Set();
            Object.values(prev).forEach((ids) =>
              (ids || []).forEach((id) => allAllocated.add(id)),
            );
            allAllocated.add(targetUserId);

            const candidate = masterPoolRef.current.find((u) => {
              const id = String(u.id || u.userId);
              return (
                !allAllocated.has(id) &&
                !dismissedUserIdsRef.current.has(id) &&
                connectionStatusesRef.current[id] !== "connected" &&
                connectionStatusesRef.current[id] !== "following"
              );
            });

            if (candidate) {
              return {
                ...prev,
                [segmentIndex]: [
                  ...remainingIds,
                  String(candidate.id || candidate.userId),
                ],
              };
            }
            return {
              ...prev,
              [segmentIndex]: remainingIds,
            };
          });
        }, 700);
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
    },
    [currentUser],
  );

  // Dismiss individual card with animation and replenish
  const dismissCard = useCallback((userId, segmentIndex) => {
    const uId = String(userId);
    setDismissedUserIds((prev) => new Set([...prev, uId]));

    setTimeout(() => {
      setSegmentAllocations((prev) => {
        const currentIds = prev[segmentIndex] || [];
        const remainingIds = currentIds.filter((id) => id !== uId);

        const allAllocated = new Set();
        Object.values(prev).forEach((ids) =>
          (ids || []).forEach((id) => allAllocated.add(id)),
        );
        allAllocated.add(uId);

        const candidate = masterPoolRef.current.find((u) => {
          const id = String(u.id || u.userId);
          return (
            !allAllocated.has(id) &&
            !dismissedUserIdsRef.current.has(id) &&
            connectionStatusesRef.current[id] !== "connected" &&
            connectionStatusesRef.current[id] !== "following"
          );
        });

        if (candidate) {
          return {
            ...prev,
            [segmentIndex]: [
              ...remainingIds,
              String(candidate.id || candidate.userId),
            ],
          };
        }
        return {
          ...prev,
          [segmentIndex]: remainingIds,
        };
      });
    }, 250);
  }, []);

  const dismissWidget = useCallback((segmentIndex) => {
    setDismissedWidgets((prev) => new Set([...prev, segmentIndex]));
  }, []);

  const value = useMemo(
    () => ({
      masterPool,
      loading,
      refreshingSegments,
      connectionStatuses,
      dismissedUserIds,
      dismissedWidgets,
      segmentAllocations,
      getSegmentUsers,
      refreshSegment,
      connectUser,
      dismissCard,
      dismissWidget,
      fetchPool,
    }),
    [
      masterPool,
      loading,
      refreshingSegments,
      connectionStatuses,
      dismissedUserIds,
      dismissedWidgets,
      segmentAllocations,
      getSegmentUsers,
      refreshSegment,
      connectUser,
      dismissCard,
      dismissWidget,
      fetchPool,
    ],
  );

  return (
    <PeopleSuggestionsContext.Provider value={value}>
      {children}
    </PeopleSuggestionsContext.Provider>
  );
};

/**
 * PeopleYouMayKnowSlider component:
 * - Can be rendered in a feed coordinated by PeopleSuggestionsProvider using segmentIndex.
 * - Also operates standalone with backwards-compatibility if used outside the provider.
 */
const PeopleYouMayKnowSlider = ({
  currentUserId,
  currentUser,
  segmentIndex = 0,
  className = "",
}) => {
  const navigate = useNavigate();
  const context = useContext(PeopleSuggestionsContext);

  // Local state used when running in standalone mode (no provider)
  const [localUsers, setLocalUsers] = useState([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const [localConnectionStatuses, setLocalConnectionStatuses] = useState({});
  const [localDismissedUserIds, setLocalDismissedUserIds] = useState(new Set());
  const [localIsWidgetDismissed, setLocalIsWidgetDismissed] = useState(false);

  // Card exit animation state (local to this slider)
  const [exitingUserIds, setExitingUserIds] = useState(new Set());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const sliderRef = useRef(null);

  // Check scroll positions for chevrons
  const checkScrollState = useCallback(() => {
    const el = sliderRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  // Determine active data source (context vs standalone)
  const isContextMode = Boolean(context);

  const users = useMemo(() => {
    if (isContextMode) {
      return context.getSegmentUsers(segmentIndex);
    }
    return localUsers;
  }, [isContextMode, context, segmentIndex, localUsers]);

  const loading = isContextMode ? context.loading : localLoading;
  const isRefreshing = isContextMode
    ? Boolean(context.refreshingSegments[segmentIndex])
    : localRefreshing;
  const connectionStatuses = isContextMode
    ? context.connectionStatuses
    : localConnectionStatuses;
  const isWidgetDismissed = isContextMode
    ? context.dismissedWidgets.has(segmentIndex)
    : localIsWidgetDismissed;

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

  // Standalone mode initialization (fallback if provider is absent)
  useEffect(() => {
    if (isContextMode) return;
    let isMounted = true;

    const fetchStandalone = async () => {
      try {
        setLocalLoading(true);
        const res = await connectionsApi.discoverUsers(POOL_BATCH_SIZE, 0);
        const list = res?.users || (Array.isArray(res) ? res : []);
        if (!isMounted) return;

        const clean = filterAdminUsersFromSearch(list).filter(
          (u) => u && String(u.id || u.userId) !== String(currentUserId),
        );

        let recentSeen = new Set();
        try {
          const stored = sessionStorage.getItem(RECENT_SHOWN_STORAGE_KEY);
          if (stored) recentSeen = new Set(JSON.parse(stored));
        } catch {
          recentSeen = new Set();
        }

        const fresh = shuffleArray(
          clean.filter((u) => !recentSeen.has(String(u.id || u.userId))),
        );
        const seen = shuffleArray(
          clean.filter((u) => recentSeen.has(String(u.id || u.userId))),
        );
        const pool = [...fresh, ...seen];

        try {
          const frontIds = pool
            .slice(0, 20)
            .map((u) => String(u.id || u.userId));
          sessionStorage.setItem(
            RECENT_SHOWN_STORAGE_KEY,
            JSON.stringify(frontIds),
          );
        } catch {
          // ignore
        }

        setLocalUsers(pool.slice(0, SEGMENT_CARD_COUNT));
      } catch (err) {
        console.error("Standalone pymk fetch failed:", err);
        if (isMounted) setLocalUsers([]);
      } finally {
        if (isMounted) setLocalLoading(false);
      }
    };

    fetchStandalone();
    return () => {
      isMounted = false;
    };
  }, [isContextMode, currentUserId]);

  const scroll = (direction) => {
    const el = sliderRef.current;
    if (!el) return;
    const scrollAmount = Math.max(280, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleManualRefresh = () => {
    if (isContextMode) {
      context.refreshSegment(segmentIndex);
    } else {
      setLocalRefreshing(true);
      setLocalUsers((prev) => shuffleArray(prev));
      setTimeout(() => setLocalRefreshing(false), 350);
    }
  };

  const handleConnectClick = async (e, user) => {
    e.stopPropagation();
    const targetUserId = String(user?.id || user?.userId || "");
    if (!targetUserId) return;

    if (isContextMode) {
      setExitingUserIds((prev) => new Set([...prev, targetUserId]));
      await context.connectUser(user, segmentIndex);
      setTimeout(() => {
        setExitingUserIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
      }, 500);
    } else {
      setExitingUserIds((prev) => new Set([...prev, targetUserId]));
      setLocalConnectionStatuses((prev) => ({
        ...prev,
        [targetUserId]: "connecting",
      }));
      try {
        await connectionsApi.sendConnectionRequest(targetUserId);
        setLocalConnectionStatuses((prev) => ({
          ...prev,
          [targetUserId]: "pending",
        }));
        setTimeout(() => {
          setLocalUsers((prev) =>
            prev.filter((u) => String(u.id || u.userId) !== targetUserId),
          );
          setExitingUserIds((prev) => {
            const next = new Set(prev);
            next.delete(targetUserId);
            return next;
          });
        }, 500);
      } catch (err) {
        toast.error("Failed to send request");
        setLocalConnectionStatuses((prev) => {
          const next = { ...prev };
          delete next[targetUserId];
          return next;
        });
      }
    }
  };

  const handleDismissCardClick = (e, userId) => {
    e.stopPropagation();
    const uId = String(userId);
    setExitingUserIds((prev) => new Set([...prev, uId]));

    setTimeout(() => {
      if (isContextMode) {
        context.dismissCard(uId, segmentIndex);
      } else {
        setLocalDismissedUserIds((prev) => new Set([...prev, uId]));
        setLocalUsers((prev) =>
          prev.filter((u) => String(u.id || u.userId) !== uId),
        );
      }
      setExitingUserIds((prev) => {
        const next = new Set(prev);
        next.delete(uId);
        return next;
      });
    }, 250);
  };

  const handleDismissWidgetClick = () => {
    if (isContextMode) {
      context.dismissWidget(segmentIndex);
    } else {
      setLocalIsWidgetDismissed(true);
    }
  };

  const handleProfileClick = (userId) => {
    if (userId) {
      navigate(`/user-profile/${userId}`);
    }
  };

  // If dismissed or if downstream slider has no unique users to show, return null
  if (isWidgetDismissed) return null;
  if (!loading && users.length === 0 && segmentIndex > 0) {
    return null;
  }

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
            <p className="text-xs text-gray-500">
              Based on your industry and connections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Interactive Refresh / Shuffle Button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing || loading}
            aria-label="Refresh suggestions to see different people"
            title="Show different people"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#16730F] px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <FaSyncAlt
              className={`text-xs ${isRefreshing ? "animate-spin text-[#16730F]" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/connection")}
            className="text-sm font-semibold text-[#16730F] hover:text-[#135d0d] hover:underline px-2 py-1 rounded transition-colors"
          >
            See all
          </button>

          <button
            type="button"
            onClick={handleDismissWidgetClick}
            aria-label="Hide people you may know"
            title="Hide"
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <FaTimes className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Slider Carousel Area */}
      <div className="relative group/slider">
        {/* Left Scroll Button */}
        {canScrollLeft && !loading && users.length > 0 && (
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
        {canScrollRight && !loading && users.length > 0 && (
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
          {loading ? (
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
          ) : users.length === 0 ? (
            // All cards connected/removed state with refresh button
            <div className="w-full py-8 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[#16730F]/10 flex items-center justify-center text-[#16730F]">
                <FaUserFriends className="text-xl" />
              </div>
              <p className="text-sm font-semibold text-[#1A3E32]">
                You’ve reviewed all suggestions!
              </p>
              <p className="text-xs text-gray-500">
                Connect with more professionals across the network
              </p>
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="mt-2 px-4 py-2 bg-[#16730F] hover:bg-[#135d0d] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-60"
              >
                <FaSyncAlt
                  className={`text-xs ${isRefreshing ? "animate-spin" : ""}`}
                />
                <span>Discover More People</span>
              </button>
            </div>
          ) : (
            users.map((user) => {
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
                  : user.jobTitle ||
                    user.job_title ||
                    user.role ||
                    "Suggested for you";

              return (
                <div
                  key={`pymk-${segmentIndex}-${userId}`}
                  className={`w-[185px] sm:w-[195px] shrink-0 snap-start bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group/card relative select-none ${
                    isExiting
                      ? "scale-90 opacity-0 -translate-y-2 pointer-events-none"
                      : "scale-100 opacity-100"
                  }`}
                >
                  {/* Dismiss card 'X' button */}
                  <button
                    type="button"
                    onClick={(e) => handleDismissCardClick(e, userId)}
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
                          onClick={(e) => handleConnectClick(e, user)}
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
                        onClick={(e) => handleDismissCardClick(e, userId)}
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
