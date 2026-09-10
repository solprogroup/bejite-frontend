import React, { useMemo, useState, useEffect, useCallback } from "react";
import { FaHome, FaUserPlus } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { getUser } from "../../utils/tokenManager";
import InviteFriendsModal from "../InviteFriendsModal";
import ConnectModal from "../ConnectModal";
import { Network } from "lucide-react";
import { isCorporateRecruiter } from "../../utils/recruiterProfilePaths";
import * as connectionsApi from "../../services/connectionsApi";
import { profileAvatarSrc } from "../../utils/profilePhotoUrl";
import { pickAuthorProfilePhoto } from "../../utils/profileImageUtils";
import { formatDisplayPersonName } from "../../utils/personDisplayName";

const ADPRO_NAV_ITEM = {
  icon: "/assets/images/adpro-sidebar.svg",
  label: "AdPro",
  iconClassName: "h-7 w-7",
};

const navItems = [
  { icon: FaHome, label: "News Feed" },
  { icon: "/assets/images/repeate-one.svg", label: "Connections" },
  { icon: "/assets/images/messages-2.svg", label: "Chats" },
  { icon: "/assets/images/user-search.svg", label: "Recruitment" },
  { icon: "/assets/images/notification.svg", label: "Notifications" },
  { icon: Network, label: "Milestones" },
];

const fallbackAvatars = [
  { id: null, firstName: "Discover", lastName: "People" },
  { id: null, firstName: "Grow", lastName: "Network" },
  { id: null, firstName: "Connect", lastName: "Today" },
];

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const getInitials = (person) => {
  if (!person) return "U";
  const first = (
    person?.firstName ||
    person?.first_name ||
    person?.name ||
    ""
  )
    .trim()
    .charAt(0);
  const last = (person?.lastName || person?.last_name || "").trim().charAt(0);
  if (first && last) return `${first}${last}`.toUpperCase();
  if (first) return first.toUpperCase();
  if (person?.username) return person.username.slice(0, 2).toUpperCase();
  return "U";
};

const getGradientClass = (index, person) => {
  const gradients = [
    "from-emerald-500 to-teal-700",
    "from-blue-500 to-indigo-700",
    "from-amber-500 to-orange-600",
    "from-purple-500 to-pink-600",
    "from-rose-500 to-red-600",
    "from-teal-500 to-emerald-700",
    "from-cyan-500 to-blue-600",
    "from-violet-500 to-purple-700",
  ];
  const charCode =
    (person?.firstName || person?.name || "").charCodeAt(0) || index;
  return gradients[charCode % gradients.length];
};

export default function RecruitmentLeft() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [networkPool, setNetworkPool] = useState([]);
  const [rotationIndex, setRotationIndex] = useState(() =>
    Math.floor(Math.random() * 10),
  );
  const [isRotating, setIsRotating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get user from Redux store or localStorage
  const reduxUser = useSelector((state) => state.auth?.user);
  const user = useMemo(() => {
    if (reduxUser) return reduxUser;
    return getUser() || {};
  }, [reduxUser]);

  // Fetch a larger pool of discoverable and connected users to rotate through
  const fetchNetworkPool = useCallback(async () => {
    try {
      setLoading(true);
      let combined = [];
      try {
        const discoverRes = await connectionsApi.discoverUsers(40, 0);
        const discoverList =
          discoverRes?.users ||
          (Array.isArray(discoverRes) ? discoverRes : []);
        combined = [...discoverList];
      } catch {
        /* optional */
      }

      try {
        const connRes = await connectionsApi.getConnections(1, 30);
        const connList = connRes?.connections || [];
        combined = [...combined, ...connList];
      } catch {
        /* optional */
      }

      const seen = new Set();
      const unique = [];
      for (const u of combined) {
        const uId = String(u?.id || u?.userId || u?.user_id || "");
        if (uId && uId !== String(user?.id) && !seen.has(uId)) {
          seen.add(uId);
          unique.push(u);
        }
      }

      if (unique.length > 0) {
        // Prioritize users with photos so avatars look vibrant & real
        const withPhotos = unique.filter((u) =>
          Boolean(pickAuthorProfilePhoto(u)),
        );
        const withoutPhotos = unique.filter(
          (u) => !pickAuthorProfilePhoto(u),
        );

        // Shuffle both groups so every reload offers fresh variety
        const shuffledWithPhotos = shuffleArray(withPhotos);
        const shuffledWithoutPhotos = shuffleArray(withoutPhotos);

        // Interleave users with photos first
        const finalPool = [...shuffledWithPhotos, ...shuffledWithoutPhotos];
        setNetworkPool(finalPool);
        // Start from a fresh randomized index
        setRotationIndex(Math.floor(Math.random() * finalPool.length));
      }
    } catch {
      /* optional fallback */
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNetworkPool();
  }, [fetchNetworkPool]);

  // Rotate avatars when navigating between pages / sidebar routes
  useEffect(() => {
    if (networkPool.length > 3) {
      setIsRotating(true);
      setRotationIndex((prev) => (prev + 3) % networkPool.length);
      const timer = setTimeout(() => setIsRotating(false), 350);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, location.key, networkPool.length]);

  // Periodic automatic rotation to keep the avatars lively and fresh
  useEffect(() => {
    if (networkPool.length <= 3) return undefined;
    const interval = setInterval(() => {
      setIsRotating(true);
      setRotationIndex((prev) => (prev + 3) % networkPool.length);
      setTimeout(() => setIsRotating(false), 350);
    }, 8500);

    return () => clearInterval(interval);
  }, [networkPool.length]);

  // Refresh/rotate when the user clicks back to the tab/window
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && networkPool.length > 3) {
        setIsRotating(true);
        setRotationIndex((prev) => (prev + 3) % networkPool.length);
        setTimeout(() => setIsRotating(false), 350);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [networkPool.length]);

  const displayAvatars = useMemo(() => {
    if (!networkPool || networkPool.length === 0) return fallbackAvatars;
    if (networkPool.length <= 3) return networkPool.slice(0, 3);

    const start = rotationIndex % networkPool.length;
    const picked = [];
    for (let i = 0; i < 3; i++) {
      picked.push(networkPool[(start + i) % networkPool.length]);
    }
    return picked;
  }, [networkPool, rotationIndex]);

  const isCorporate = isCorporateRecruiter(user);
  const roleLower = String(user?.role || "").toLowerCase();
  const canAccessAdPro = roleLower === "recruiter" || roleLower === "employer";

  const displayNavItems = useMemo(() => {
    let items = navItems.map((item) =>
      item.label === "Connections" && isCorporate
        ? { ...item, label: "Followers" }
        : item,
    );
    if (canAccessAdPro) {
      items = [...items, ADPRO_NAV_ITEM];
    }
    return items;
  }, [isCorporate, canAccessAdPro]);

  // Filter nav items based on user role
  const filteredNavItems =
    user?.role === "jobseeker"
      ? displayNavItems.filter((item) => item.label !== "Recruitment")
      : displayNavItems;

  const handleNavClick = (label) => {
    switch (label) {
      case "News Feed":
        navigate("/news-feed");
        break;
      case "Connections":
      case "Followers":
        navigate("/connection");
        break;
      case "Chats":
        navigate("/chats");
        break;
      case "Recruitment":
        navigate("/candidate-search-page");
        break;
      case "Notifications":
        navigate("/notification");
        break;
      case "Milestones":
        navigate("/milestones");
        break;
      case "AdPro":
        navigate("/adpro");
        break;
      default:
        console.log("Navigation not defined for:", label);
    }
  };

  return (
    <div className="bg-[#F5F5F5] px-2 py-2 h-full">
      <aside className="bg-[#16730F] rounded-2xl pb-2 pt-2 flex flex-col h-full">
        {/* <div className="space-y-2 p-7">
        <FaArrowLeft className="text-[#1A3E32]" />
        <h2 className="text-[20px] text-[#ffffff]">Dashboardss</h2>
      </div> */}
        <nav className=" space-y-4  p-2">
          {filteredNavItems.map(({ icon: Icon, label, iconClassName }, idx) => (
            <div
              key={idx}
              data-tour-id={
                label === "Milestones"
                  ? "milestones"
                  : label === "AdPro"
                    ? "adpro"
                    : undefined
              }
              className="flex items-center space-x-3 cursor-pointer w-full p-2 hover:bg-[#15600b] rounded-lg transition-colors duration-200"
              onClick={() => handleNavClick(label)}
            >
              {typeof Icon === "string" ? (
                <img
                  src={Icon}
                  alt={label}
                  className={`${iconClassName || "w-5 h-5"} shrink-0 object-contain`}
                />
              ) : (
                <Icon className="text-[#F5F5F5] w-5 h-5 shrink-0" size={16} />
              )}
              <span className="text-[#F5F5F5] font-bold">{label}</span>
            </div>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="p-2 space-y-2">
          {/* Invite Friends Button */}
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="flex items-center cursor-pointer space-x-3 w-full px-4 py-2 bg-[#15600b] hover:bg-[#0f4a08] rounded-lg transition-colors"
          >
            <FaUserPlus className="text-[#F5F5F5]" />
            <span className="text-[#F5F5F5] text-sm font-bold whitespace-nowrap">
              Invite Friends
            </span>
          </button>
        </div>

        <ConnectModal
          isOpen={showConnectModal}
          onClose={() => setShowConnectModal(false)}
        />

        <InviteFriendsModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          user={user}
        />

        {!isCorporate && (
        <div className="bg-[#1A3E32] flex-1 rounded-b-2xl mt-4 p-4 flex flex-col items-center justify-between text-center space-y-3">
            <div className="flex flex-col items-center space-y-2.5 pt-1 w-full">
              {loading ? (
                /* 3 Professional Shimmer Skeleton Avatars */
                <div className="flex items-center -space-x-3 justify-center py-0.5 animate-pulse">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-[#1A3E32] ring-2 ring-emerald-400/20 bg-white/15 overflow-hidden shadow-md animate-shimmer"
                    >
                      <div className="w-full h-full bg-white/10 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                /* 3 Interactive Rotating Overlapping Connection Avatars */
                <div
                  className={`flex items-center -space-x-3 justify-center py-0.5 transition-all duration-300 ${
                    isRotating
                      ? "opacity-60 scale-95"
                      : "opacity-100 scale-100"
                  }`}
                >
                  {displayAvatars.map((person, index) => {
                    const name = formatDisplayPersonName(person, "Connection");
                    const personId =
                      person?.id || person?.userId || person?.user_id;
                    const photo = pickAuthorProfilePhoto(person);
                    const photoUrl = photo ? profileAvatarSrc(photo) : null;
                    const initials = getInitials(person);
                    const gradientClass = getGradientClass(index, person);

                    return (
                      <button
                        key={`${personId || index}-${rotationIndex}-${index}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (personId) {
                            navigate(`/user-profile/${personId}`);
                          } else {
                            setShowConnectModal(true);
                          }
                        }}
                        className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-[#1A3E32] ring-2 ring-emerald-400/40 hover:ring-white shadow-md overflow-hidden bg-[#16730F] hover:z-20 focus:z-20 focus:outline-none transition-all duration-200 hover:scale-110 cursor-pointer group"
                        title={
                          personId
                            ? `View ${name}'s profile`
                            : "Click to explore connections"
                        }
                      >
                        {photoUrl ? (
                          <>
                            <img
                              src={photoUrl}
                              alt={name}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                if (e.currentTarget.nextSibling) {
                                  e.currentTarget.nextSibling.style.display =
                                    "flex";
                                }
                              }}
                            />
                            <div
                              className={`hidden h-full w-full bg-gradient-to-br ${gradientClass} items-center justify-center font-bold text-xs sm:text-sm text-white shadow-inner select-none`}
                            >
                              <span>{initials}</span>
                            </div>
                          </>
                        ) : (
                          <div
                            className={`h-full w-full bg-gradient-to-br ${gradientClass} flex items-center justify-center font-bold text-xs sm:text-sm text-white shadow-inner select-none`}
                          >
                            <span>{initials}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <h4 className="text-white font-semibold text-sm tracking-tight">
                Suggestions
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              className="w-full py-2 px-3 bg-[#16730F] hover:bg-[#135d0c] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <FaUserPlus className="text-xs" />
              <span>Connect Now</span>
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
