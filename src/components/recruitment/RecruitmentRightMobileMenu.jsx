import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getUserProfileImage } from "../../utils/profileImageUtils";
import { formatDisplayPersonName, formatDisplayHandle } from "../../utils/personDisplayName";
import DisplayNameWithBadge from "../DisplayNameWithBadge";
import useRecruitmentRightStats from "../../hooks/useRecruitmentRightStats";
import { RECRUITMENT_RIGHT_LINKS } from "./recruitmentRightLinks";
import { formatCompactCount as formatNetworkCount } from "../../utils/formatCompactCount";

export default function RecruitmentRightMobileMenu({ onNavigate }) {
  const navigate = useNavigate();
  const {
    userData,
    postCount,
    connectionCount,
    postCountLoading,
    networkCountLoading,
  } = useRecruitmentRightStats();

  const go = (path) => {
    navigate(path);
    onNavigate?.();
  };

  const displayName = formatDisplayPersonName(userData, "User");
  const username = formatDisplayHandle(userData);

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="bg-[#16730F] rounded-xl p-4 text-white">
        <div className="flex flex-col items-center text-center">
          <img
            src={getUserProfileImage()}
            alt={displayName}
            className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
          />
          <div className="text-sm font-bold mt-2">
            <DisplayNameWithBadge
              user={userData}
              fallback={displayName}
              badgeSize="xs"
              badgePlacement="below"
              responsiveBadge={false}
              as="div"
              className="items-center"
            />
          </div>
          {username && (
            <p className="text-[11px] font-semibold text-white/80">{username}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-white/10 rounded-lg py-2 px-2 text-center border border-white/10">
            <p className="text-[10px] text-white/70 uppercase">Posts</p>
            <p className="text-base font-bold min-h-[1.5rem] flex items-center justify-center">
              {postCountLoading ? (
                <Loader2
                  className="w-4 h-4 animate-spin text-white/80"
                  aria-label="Loading post count"
                />
              ) : (
                postCount
              )}
            </p>
          </div>
          <div className="bg-white/10 rounded-lg py-2 px-2 text-center border border-white/10">
            <p className="text-[10px] text-white/70 uppercase">Network</p>
            <p className="text-base font-bold min-h-[1.5rem] flex items-center justify-center">
              {networkCountLoading ? (
                <Loader2
                  className="w-4 h-4 animate-spin text-white/80"
                  aria-label="Loading network count"
                />
              ) : (
                formatNetworkCount(connectionCount)
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => go("/profile")}
          className="mt-3 w-full bg-[#6B8E23] py-2 text-xs font-bold rounded-full hover:bg-[#7BA428] transition-colors"
        >
          View Profile
        </button>
      </div>

      <nav className="mt-4 flex flex-col gap-1">
        {RECRUITMENT_RIGHT_LINKS.map((item) => (
          <button
            key={item.path}
            type="button"
            data-tour-id={item.tourId || undefined}
            onClick={() => go(item.path)}
            className="flex items-center gap-2 w-full px-2 py-2.5 rounded-lg text-[#1A3E32] hover:bg-gray-50 transition-colors text-left"
          >
            <img
              src={item.mobileIcon ?? item.icon}
              alt=""
              className="h-7 w-7 object-contain shrink-0"
            />
            <span className="font-medium text-sm">{item.label}</span>
            {item.secondaryIcon && (
              <img
                src={item.secondaryIcon}
                alt=""
                className="w-4 h-4 ml-auto object-contain"
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
