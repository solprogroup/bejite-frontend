import React from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getUserProfileImage } from "../../utils/profileImageUtils";
import {
  formatDisplayPersonName,
  formatDisplayHandle,
} from "../../utils/personDisplayName";
import DisplayNameWithBadge from "../DisplayNameWithBadge";
import useRecruitmentRightStats from "../../hooks/useRecruitmentRightStats";
import { RECRUITMENT_RIGHT_LINKS } from "./recruitmentRightLinks";
import { formatCompactCount as formatNetworkCount } from "../../utils/formatCompactCount";

function RecruitmentRight() {
  const navigate = useNavigate();
  const {
    userData,
    postCount,
    connectionCount,
    postCountLoading,
    networkCountLoading,
  } = useRecruitmentRightStats();

  const displayName = userData
    ? formatDisplayPersonName(userData, "User")
    : "Osakwe Prisca";
  const username = formatDisplayHandle(userData);

  return (
    <div className="bg-[#F5F5F5] px-2 py-2 lg:h-full">
      <aside className="bg-[#1A3E32] rounded-2xl flex flex-col lg:h-full lg:overflow-hidden">
        <div className="bg-[#16730F] rounded-t-2xl p-3 shrink-0">
          <div className="p-5 space-y-2" />
          <div className="flex flex-col items-center">
            <div className="border-[#16730F] border-5 rounded-full relative bottom-10">
              <img
                className="w-16 h-16 rounded-full object-cover"
                src={
                  userData ? getUserProfileImage() : "/assets/images/prisca.jpg"
                }
                alt=""
              />
            </div>
            <div className="text-[#FFFFFF] text-center mt-[-40px] w-full px-2 min-w-0">
              <div className="text-[14px] sm:text-[16px] font-bold min-w-0">
                <DisplayNameWithBadge
                  user={userData}
                  fallback={displayName}
                  badgeSize="xs"
                  badgePlacement="below"
                  responsiveBadge={false}
                  as="div"
                  className="items-center w-full justify-center"
                  nameClassName="whitespace-normal break-words text-center leading-snug"
                />
              </div>
              {username && (
                <p className="text-[11px] font-bold break-words mt-0.5">{username}</p>
              )}
            </div>
          </div>
          <div className="mt-6 px-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl py-3 px-2 text-center border border-white/10">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <svg
                    className="w-4 h-4 text-white/70"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                  <p className="text-[8px] font-semibold text-white/70 uppercase tracking-wider">
                    Total
                  </p>
                </div>
                <p className="text-[15px] font-bold text-white min-h-[1.25rem] flex items-center justify-center">
                  {postCountLoading ? (
                    <Loader2
                      className="w-4 h-4 animate-spin text-white/80"
                      aria-label="Loading post count"
                    />
                  ) : (
                    postCount
                  )}
                </p>
                <p className="text-[10px] font-medium text-white/60 mt-0.5">
                  Posts Created
                </p>
              </div>

              <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl py-3 px-2 text-center border border-white/10">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <svg
                    className="w-4 h-4 text-white/70"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <p className="text-[8px] font-semibold text-white/70 uppercase tracking-wider">
                    Network
                  </p>
                </div>
                <p className="text-[15px] font-bold text-white min-h-[1.25rem] flex items-center justify-center">
                  {networkCountLoading ? (
                    <Loader2
                      className="w-4 h-4 animate-spin text-white/80"
                      aria-label="Loading network count"
                    />
                  ) : (
                    formatNetworkCount(connectionCount)
                  )}
                </p>
                <p className="text-[10px] font-medium text-white/60 mt-0.5">
                  {String(userData?.role || "").toLowerCase() === "recruiter" &&
                  String(userData?.mode || "").toLowerCase() === "corporate"
                    ? "Followers"
                    : "Connections Made"}
                </p>
              </div>
            </div>
          </div>

          <div className="w-[150px] m-auto mt-4">
            <button
              type="button"
              className="bg-[#6B8E23] mb-4 p-2 text-[10px] text-[#FFFFFF] w-full rounded-3xl font-bold hover:bg-[#7BA428] transition-colors"
              onClick={() => navigate("/profile")}
            >
              View Profile
            </button>
          </div>
        </div>

        <div className="lg:flex-1 mt-3 p-4 pb-6 lg:overflow-y-auto nfl-sidebar-scroll scroll-smooth rounded-b-2xl">
          <div className="space-y-4 cursor-pointer">
            {RECRUITMENT_RIGHT_LINKS.map((item) => (
              <div
                key={item.path}
                data-tour-id={item.tourId || undefined}
                className="flex items-center space-x-3 hover:bg-white/5 p-2 rounded-lg transition-all duration-200"
                onClick={() => navigate(item.path)}
                onKeyDown={(e) => e.key === "Enter" && navigate(item.path)}
                role="button"
                tabIndex={0}
              >
                <img src={item.icon} alt="" />
                <p className="text-[#F5F5F5] font-bold">{item.label}</p>
                {item.secondaryIcon && (
                  <img src={item.secondaryIcon} className="w-4" alt="" />
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default RecruitmentRight;
