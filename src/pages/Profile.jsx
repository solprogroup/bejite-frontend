import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  FaEdit,
  FaArrowLeft,
  FaGlobe,
  FaLinkedin,
  FaTwitter,
  FaInstagram,
  FaMapMarkerAlt,
  FaBuilding,
  FaUserFriends,
  FaBriefcase,
  FaCamera,
  FaChevronDown,
  FaExternalLinkAlt,
  FaLayerGroup,
  FaFileAlt,
  FaNewspaper,
  FaShareAlt,
  FaCheck,
  FaLink,
} from "react-icons/fa";
import NewsFeedLayout from "../components/layout/NewsFeedLayout";
import ProfileCvSections, {
  ProfileSkillsSection,
  ProfileLinksSection,
  ProfileLinkItem,
} from "../components/ProfileCvSections";
import axiosInstance from "../utils/axiosInstance";
import { fetchCurrentUserProfilePhoto } from "../services/profilePhotoService";
import { fetchFullUserProfile, ProfileAccessError } from "../services/fetchFullUserProfile";
import {
  mergeCvWithCandidateSkills,
  normalizeProfileSkills,
  resolveProfileSkillSource,
} from "../utils/profileSkills";
import { getUser, pickProfilePhotoPath } from "../utils/tokenManager";
import { profileAvatarSrc } from "../utils/profilePhotoUrl";
import { pickAuthorProfilePhoto } from "../utils/profileImageUtils";
import { getRecruiterEditProfilePath } from "../utils/recruiterProfilePaths";
import useAuth from "../hooks/useAuth";
import {
  normalizeProfileData,
  unwrapAuthProfileBody,
  profilePayloadLooksUsable,
  profileFromSearchPreview,
} from "../utils/profileUtils";
import {
  formatDisplayPersonName,
  formatRoleAndMode,
  formatDisplayHandle,
} from "../utils/personDisplayName";
import { formatDisplayText } from "../utils/displayFormatUtils";
import ProfileConnectActions from "../components/ProfileConnectActions";
import ProfilePostsSection from "../components/ProfilePostsSection";
import DisplayNameWithBadge from "../components/DisplayNameWithBadge";
import MutualConnectionsModal from "../components/MutualConnectionsModal";
import ProfileVerifiedBadgeCard from "../components/profile/ProfileVerifiedBadgeCard";
import { userHasVerifiedBadge } from "../utils/verifiedBadge";

import { formatCompactCount as formatConnectionCount } from "../utils/formatCompactCount";

const ABOUT_CHAR_LIMIT = 240;
const ABOUT_WORD_LIMIT = 35;

const MUTUAL_SIDEBAR_PREVIEW = 4;

const formatMutualConnectionsLabel = (count, samples = []) => {
  const n = Number(count) || 0;
  if (n <= 0) return null;

  const names = (Array.isArray(samples) ? samples : [])
    .map((person) =>
      [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim(),
    )
    .filter(Boolean);

  const countLabel = formatConnectionCount(n);
  if (names.length === 0) {
    return `${countLabel} mutual ${n === 1 ? "connection" : "connections"}`;
  }

  if (n === 1) return `${names[0]} is a mutual connection`;
  if (n === 2 && names.length >= 2) {
    return `${names[0]} and ${names[1]} are mutual connections`;
  }

  const shown = names.slice(0, 2);
  const remaining = Math.max(n - shown.length, 0);
  if (remaining <= 0) {
    return `${shown.join(" and ")} are mutual connections`;
  }

  return `${shown.join(", ")} and ${formatConnectionCount(remaining)} other${
    remaining === 1 ? "" : "s"
  }`;
};

const toExternalHref = (url) => {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const ProfileDetailRow = ({
  icon: Icon,
  label,
  value,
  href,
  preserveCase = false,
  brandColor = "bg-emerald-50 text-[#16730F] border-emerald-100",
  hoverBorderColor = "hover:border-emerald-300",
}) => {
  const displayValue = value
    ? preserveCase
      ? String(value).trim()
      : formatDisplayText(value)
    : "Not provided";
  const isLink = Boolean(href && value);

  return (
    <div
      className={`group relative flex items-center gap-3.5 min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 ${hoverBorderColor} hover:shadow-md transition-all duration-200`}
    >
      <div
        className={`p-3 rounded-xl border ${brandColor} shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200`}
      >
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </p>
        {isLink ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={href}
            className="mt-0.5 flex min-w-0 w-full items-center gap-1.5 text-xs sm:text-sm font-bold text-[#16730F] hover:text-[#145a0c] hover:underline"
          >
            <span className="min-w-0 flex-1 truncate">{displayValue}</span>
            <FaExternalLinkAlt className="w-2.5 h-2.5 shrink-0 opacity-70 group-hover:opacity-100" />
          </a>
        ) : (
          <p
            className="text-xs sm:text-sm font-semibold text-slate-700 truncate mt-0.5"
            title={displayValue}
          >
            {displayValue}
          </p>
        )}
      </div>
    </div>
  );
};

const ProfileSkeleton = () => (
  <NewsFeedLayout showSidebars={false}>
    <div className="w-full min-w-0 max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 animate-pulse space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 space-y-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 w-full">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-slate-200 shrink-0"></div>
            <div className="w-full space-y-3 pt-2 text-center sm:text-left">
              <div className="h-8 bg-slate-200 rounded-xl w-56 mx-auto sm:mx-0"></div>
              <div className="h-4 bg-slate-200 rounded-lg w-36 mx-auto sm:mx-0"></div>
              <div className="h-4 bg-slate-200 rounded-lg w-64 mx-auto sm:mx-0"></div>
            </div>
          </div>
          <div className="h-20 bg-slate-100 rounded-2xl w-full md:w-64 shrink-0"></div>
        </div>
      </div>
      <div className="h-12 bg-white rounded-2xl border border-slate-200/80 w-full"></div>
      <div className="bg-white rounded-3xl p-6 space-y-4 border border-slate-200/80">
        <div className="h-6 bg-slate-200 rounded-lg w-40"></div>
        <div className="h-4 bg-slate-200 rounded-md w-full"></div>
        <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
      </div>
    </div>
  </NewsFeedLayout>
);

const buildAvatarCandidates = (rawPhoto) => {
  const candidates = [];
  const pushUnique = (value) => {
    if (!value || typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed || candidates.includes(trimmed)) return;
    candidates.push(trimmed);
  };

  pushUnique(profileAvatarSrc(rawPhoto));

  const raw = typeof rawPhoto === "string" ? rawPhoto.trim() : "";
  if (!raw) return candidates;

  pushUnique(raw);

  const isAbsolute =
    /^https?:\/\//i.test(raw) ||
    raw.startsWith("blob:") ||
    raw.startsWith("data:") ||
    raw.startsWith("/assets/") ||
    raw.startsWith("assets/");

  if (!isAbsolute) {
    const relativePath = raw.startsWith("/") ? raw : `/${raw}`;
    const baseUrl = String(import.meta.env.VITE_API_URL || "")
      .trim()
      .replace(/\/+$/, "");
    const baseApi = String(import.meta.env.VITE_API_BASE_URL || "")
      .trim()
      .replace(/\/+$/, "");
    pushUnique(baseUrl ? `${baseUrl}${relativePath}` : "");
    pushUnique(baseApi ? `${baseApi}${relativePath}` : "");
    pushUnique(`${window.location.origin}${relativePath}`);
  }

  return candidates;
};

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams();
  const { user: authUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [cvData, setCvData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileAccessCode, setProfileAccessCode] = useState(null);
  const [avatarCandidates, setAvatarCandidates] = useState([]);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [showMutualConnections, setShowMutualConnections] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [copiedLink, setCopiedLink] = useState(false);

  // Prefer Redux so photo/name updates re-render immediately after edit.
  const user = authUser || getUser();

  const fetchProfileData = async ({ cancelled } = {}) => {
    const isCancelled = () => Boolean(cancelled?.());

    try {
      setLoading(true);
      setError(null);

      const currentUser = authUser || getUser();
      const targetUserId = userId || currentUser?.id;
      const viewingOwn =
        !userId || String(userId) === String(currentUser?.id ?? "");

      let profileFound = false;
      let merged = null;
      let cv = null;

      if (userId) {
        const preview = profileFromSearchPreview(
          location.state?.profilePreview,
          userId,
        );
        if (preview && profilePayloadLooksUsable(preview)) {
          merged = preview;
          profileFound = true;
        }
      }

      if (targetUserId) {
        try {
          const full = await fetchFullUserProfile(targetUserId);
          if (isCancelled()) return;
          if (full?.user) {
            merged = normalizeProfileData({ ...merged, ...full.user });
            cv = full.cv;
            profileFound = true;
          }
        } catch (profileError) {
          if (isCancelled()) return;
          if (profileError instanceof ProfileAccessError) {
            setError(profileError.message);
            setProfileAccessCode(profileError.code);
            return;
          }
          throw profileError;
        }

        const hasSkillLabels =
          normalizeProfileSkills(resolveProfileSkillSource({ cv })).length > 0;
        if (!hasSkillLabels) {
          try {
            const { data: cvRes } = await axiosInstance.get(
              `/api/cv-builder/complete/${targetUserId}`,
            );
            if (isCancelled()) return;
            if (cvRes?.success && cvRes.data) {
              cv = mergeCvWithCandidateSkills(
                {
                  bio: cv?.bio ?? cvRes.data.bio ?? null,
                  education: cv?.education ?? cvRes.data.education ?? [],
                  skills: cvRes.data.skills ?? [],
                  workHistory: cv?.workHistory ?? cvRes.data.workHistory ?? [],
                  certificates:
                    cv?.certificates ?? cvRes.data.certificates ?? [],
                  links: cv?.links ?? cvRes.data.links ?? null,
                },
                null,
              );
            }
          } catch {
            /* optional CV fallback */
          }
        }
      }

      // Fallback for normal /user-profile/:id visits when full profile lacks photo fields.
      if (targetUserId && !pickAuthorProfilePhoto(merged)) {
        try {
          const { data: candidateRes } = await axiosInstance.get(
            `/api/candidates/${targetUserId}`,
          );
          if (isCancelled()) return;
          const candidateRow = candidateRes?.data ?? candidateRes;
          const candidatePhoto = pickAuthorProfilePhoto(candidateRow);
          if (candidatePhoto) {
            merged = normalizeProfileData({
              ...merged,
              profile_photo: candidatePhoto,
              profilePhoto: candidatePhoto,
              image: candidatePhoto,
            });
            profileFound = true;
          }
        } catch {
          /* optional fallback only */
        }
      }

      if (viewingOwn && targetUserId) {
        if (!profileFound) {
          try {
            const { data } = await axiosInstance.get("/auth/me");
            if (isCancelled()) return;
            const row = unwrapAuthProfileBody(data);
            merged = normalizeProfileData({ ...merged, ...row });
            profileFound = profilePayloadLooksUsable(merged);
          } catch (meError) {
            console.warn("GET /auth/me failed:", meError?.message || meError);
          }
        }

        const role = merged?.role || currentUser?.role;
        if (role === "recruiter") {
          try {
            const response = await axiosInstance.get("/auth/user/profile");
            if (isCancelled()) return;
            const row = unwrapAuthProfileBody(response.data);
            merged = normalizeProfileData({ ...merged, ...row });
            profileFound = true;
          } catch (recruiterProfileError) {
            console.warn(
              "GET /auth/user/profile failed:",
              recruiterProfileError?.message || recruiterProfileError,
            );
          }
        }
      }

      if (viewingOwn) {
        try {
          const photoUrl = await fetchCurrentUserProfilePhoto();
          if (isCancelled()) return;
          if (photoUrl) {
            merged = merged
              ? { ...merged, profile_photo: photoUrl }
              : normalizeProfileData({
                  id: currentUser?.id,
                  profile_photo: photoUrl,
                  firstName: currentUser?.firstName,
                  lastName: currentUser?.lastName,
                  email: currentUser?.email,
                });
            profileFound = true;
          }
        } catch {
          /* photo endpoint unavailable */
        }
      }

      if (isCancelled()) return;

      if (merged) {
        // Never paint a profile for a different route user (race after back/forward).
        if (
          userId &&
          merged.id != null &&
          String(merged.id) !== String(userId)
        ) {
          return;
        }
        setProfileData(merged);
        setCvData(cv);
      }

      if (!profileFound) {
        setError("Profile data not found. Please complete your profile setup.");
      }
    } catch (err) {
      if (isCancelled()) return;
      console.error("Error fetching profile:", err);
      setError("Failed to load profile data");
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    // Drop the previous profile immediately so we never flash the wrong photo.
    setProfileData(null);
    setCvData(null);
    setAvatarCandidates([]);
    setAvatarIndex(0);
    setIsPhotoViewerOpen(false);
    setShowMutualConnections(false);
    setActiveTab("all");
      setError(null);
      setProfileAccessCode(null);
      setLoading(true);

    fetchProfileData({ cancelled: () => !active });

    return () => {
      active = false;
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isViewingOwnProfile =
    !userId || String(userId) === String(user?.id ?? "");
  const profileMatchesRoute =
    !userId || !profileData?.id || String(profileData.id) === String(userId);
  const showProfileLoading =
    loading || Boolean(userId && profileData && !profileMatchesRoute);

  const profileAvatarStored = isViewingOwnProfile
    ? pickProfilePhotoPath(user) || pickAuthorProfilePhoto(profileData)
    : pickAuthorProfilePhoto(profileData);
  const activeAvatarSrc =
    avatarCandidates[avatarIndex] || profileAvatarSrc(profileAvatarStored);

  // Only use the profile subject's role. Never fall back to the viewer's role
  // when opening someone else's profile (that made Unassigned users look like Recruiters).
  const viewedRole = isViewingOwnProfile
    ? profileData?.role || user?.role || null
    : profileData?.role || null;
  const viewedMode = isViewingOwnProfile
    ? profileData?.mode || user?.mode || null
    : profileData?.mode || null;
  const isJobseekerProfile = viewedRole === "jobseeker";
  const isRecruiterProfile = viewedRole === "recruiter";
  const displayHandle = formatDisplayHandle(profileData);

  useEffect(() => {
    const nextCandidates = buildAvatarCandidates(profileAvatarStored);
    setAvatarCandidates(nextCandidates);
    setAvatarIndex(0);
  }, [profileAvatarStored]);

  useEffect(() => {
    if (!isPhotoViewerOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsPhotoViewerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPhotoViewerOpen]);

  const handleEditProfile = () => {
    if (user?.role === "jobseeker") {
      navigate("/edit-profile/bio");
    } else {
      navigate(getRecruiterEditProfilePath(user));
    }
  };

  const handleCopyProfileLink = async () => {
    try {
      const url = window.location.href;
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch (e) {
      console.error("Failed to copy link:", e);
    }
  };

  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const aboutTextRaw =
    (typeof profileData?.bio === "string" && profileData.bio.trim()) ||
    (typeof profileData?.summary === "string" && profileData.summary.trim()) ||
    (typeof cvData?.bio?.bio === "string" && cvData.bio.bio.trim()) ||
    "";
  const aboutText = aboutTextRaw || null;

  const getAboutPreview = (text) => {
    if (!text) return { text: "", needsTruncation: false };
    const words = text.split(/\s+/).filter(Boolean);
    if (text.length > ABOUT_CHAR_LIMIT || words.length > ABOUT_WORD_LIMIT) {
      const truncatedByChar = text.slice(0, ABOUT_CHAR_LIMIT).trim();
      const lastSpaceIndex = truncatedByChar.lastIndexOf(" ");
      const cleanTruncated =
        lastSpaceIndex > 80
          ? truncatedByChar.slice(0, lastSpaceIndex)
          : truncatedByChar;
      return {
        text: cleanTruncated + "...",
        needsTruncation: true,
      };
    }
    return { text, needsTruncation: false };
  };

  const aboutPreview = aboutText
    ? getAboutPreview(aboutText)
    : { text: "", needsTruncation: false };
  const needsTruncation = aboutPreview.needsTruncation;
  const recruiterLinks = profileData?.links || {};
  const linkedinUrl =
    profileData?.linkedin_url || recruiterLinks.linkedin || null;
  const twitterUrl = profileData?.twitter_url || recruiterLinks.twitter || null;
  const instagramUrl =
    profileData?.instagram_url || recruiterLinks.instagram || null;
  const recruiterPublicLocation = [profileData?.city, profileData?.country]
    .filter((value) => value != null && String(value).trim() !== "")
    .map((value) => formatDisplayText(value))
    .join(", ");
  const viewedProfileId = userId || profileData?.id;

  if (showProfileLoading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return (
      <NewsFeedLayout showSidebars={false}>
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center bg-white p-8 sm:p-10 rounded-3xl shadow-sm border border-slate-200 max-w-md w-full">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 font-bold text-2xl shadow-2xs">
              !
            </div>
            <p className="text-slate-900 font-bold text-lg mb-2">{error}</p>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {profileAccessCode === "PROFILE_PRIVATE" ||
              profileAccessCode === "PROFILE_CONNECTIONS_ONLY"
                ? "The owner has restricted who can view this profile."
                : "Something went wrong while loading this profile."}
            </p>
            {profileAccessCode !== "PROFILE_PRIVATE" &&
            profileAccessCode !== "PROFILE_CONNECTIONS_ONLY" ? (
              <button
                onClick={() => fetchProfileData()}
                className="bg-[#16730F] text-white px-6 py-2.5 rounded-xl hover:bg-[#145a0c] font-semibold text-sm transition-all shadow-md hover:shadow-lg cursor-pointer"
              >
                Try Again
              </button>
            ) : null}
          </div>
        </div>
      </NewsFeedLayout>
    );
  }

  if (!profileData && !showProfileLoading) {
    return (
      <NewsFeedLayout classes={false} scrollable={false} showSidebars={false}>
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center bg-white p-8 sm:p-10 rounded-3xl shadow-sm border border-slate-200 max-w-md w-full">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#16730F] flex items-center justify-center mx-auto mb-4 shadow-2xs">
              <FaBriefcase className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              No profile data found
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Please complete your profile setup to view your information here.
            </p>
            <button
              onClick={() =>
                navigate(
                  user?.role === "jobseeker"
                    ? "/edit-profile/bio"
                    : getRecruiterEditProfilePath(user),
                )
              }
              className="bg-[#16730F] text-white px-6 py-2.5 rounded-xl hover:bg-[#145a0c] font-semibold text-sm transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              Complete Profile Setup
            </button>
          </div>
        </div>
      </NewsFeedLayout>
    );
  }

  return (
    <NewsFeedLayout showSidebars={false}>
      <div className="w-full min-w-0 max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 space-y-6">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-4 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              if (isViewingOwnProfile) {
                navigate("/news-feed");
              } else {
                navigate(-1);
              }
            }}
            className="flex items-center gap-2 text-slate-700 hover:text-[#16730F] bg-slate-100 hover:bg-emerald-50 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border border-slate-200/60"
          >
            <FaArrowLeft className="shrink-0 text-xs" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline-block">
              User Profile
            </span>
            {isViewingOwnProfile && (
              <button
                type="button"
                onClick={handleEditProfile}
                className="flex items-center gap-2 bg-[#16730F] hover:bg-[#145a0c] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
              >
                <FaEdit className="shrink-0 text-xs" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>

        {/* Bento Hero Showcase Hub Card (App Colors Light Palette) */}
        <div className="relative rounded-3xl bg-white p-6 sm:p-8 md:p-9 shadow-sm border border-slate-200/80 overflow-hidden transition-all duration-300">
          {/* Top Decorative Brand Bar Accent */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#16730F] via-emerald-500 to-[#16730F]"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 pt-2">
            {/* Identity Column */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 flex-1 min-w-0">
              {/* Squircle Avatar Frame */}
              <div
                className="relative group shrink-0 cursor-pointer"
                onClick={() => setIsPhotoViewerOpen(true)}
                title="Click to view full photo"
              >
                <div className="p-1 rounded-[28px] bg-gradient-to-br from-emerald-100 via-white to-emerald-50 shadow-md ring-2 ring-emerald-500/20 border border-slate-200/80">
                  <img
                    src={activeAvatarSrc}
                    alt="Profile"
                    className="w-32 h-32 sm:w-36 sm:h-36 rounded-[24px] object-cover bg-slate-100 transition-transform duration-300 group-hover:scale-[1.02]"
                    onError={() => {
                      setAvatarIndex((prev) =>
                        prev < avatarCandidates.length - 1 ? prev + 1 : prev,
                      );
                    }}
                  />
                  <div className="absolute inset-1 rounded-[24px] bg-slate-950/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-200 text-white text-xs font-semibold backdrop-blur-[2px]">
                    <FaCamera className="w-5 h-5 mb-1" />
                    <span>View Photo</span>
                  </div>
                </div>
              </div>

              {/* Name, Role & Headline Block */}
              <div className="w-full min-w-0 text-center sm:text-left space-y-2 pt-1">
                {/* Title and Role Row */}
                <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight break-words min-w-0 max-w-full">
                    <DisplayNameWithBadge
                      user={profileData}
                      fallback="User"
                      badgeSize="lg"
                      className="text-slate-900"
                    />
                  </h1>

                  {/* Account Role Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-2xs ${
                      isRecruiterProfile
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-emerald-50 text-[#16730F] border-emerald-200"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isRecruiterProfile ? "bg-purple-600" : "bg-[#16730F]"
                      }`}
                    ></span>
                    {formatRoleAndMode(viewedRole, viewedMode)}
                  </span>
                </div>

                {/* Company Name Badge */}
                {isRecruiterProfile && profileData.company_name && (
                  <div className="flex items-center justify-center sm:justify-start">
                    <span className="inline-flex items-center gap-2 max-w-full px-3.5 py-1 rounded-xl bg-emerald-50 text-[#16730F] text-xs sm:text-sm font-bold border border-emerald-200">
                      <FaBuilding className="text-[#16730F] shrink-0 text-xs" />
                      <span className="break-words">
                        {formatDisplayText(profileData.company_name)}
                      </span>
                    </span>
                  </div>
                )}

                {/* Job Title / Professional Headline */}
                {(profileData.job_title || profileData.title) && (
                  <div className="flex items-center justify-center sm:justify-start">
                    <span className="inline-flex items-center max-w-full px-3.5 py-1 rounded-xl bg-[#FFF8E7] text-[#3D2E0A] text-xs sm:text-sm font-semibold border border-[#E6D5A8] break-words shadow-2xs">
                      {formatDisplayText(
                        profileData.job_title || profileData.title,
                      )}
                    </span>
                  </div>
                )}

                {/* Handle & Location Row */}
                <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap text-xs sm:text-sm text-slate-500 pt-1">
                  {displayHandle && (
                    <span className="font-mono bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-lg font-semibold">
                      {displayHandle}
                    </span>
                  )}

                  {isRecruiterProfile && recruiterPublicLocation && (
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <FaMapMarkerAlt className="text-[#16730F] shrink-0" />
                      <span className="break-words">
                        {recruiterPublicLocation}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col items-center lg:items-end justify-between gap-4 shrink-0 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
              {/* Connections Stat Widget */}
              {isViewingOwnProfile ? (
                <button
                  type="button"
                  onClick={() => navigate("/connection")}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-5 py-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#16730F] text-xs sm:text-sm font-bold border border-emerald-200 transition-all cursor-pointer shadow-2xs"
                  title={
                    profileData.isCorporate ||
                    (String(profileData.role || "").toLowerCase() ===
                      "recruiter" &&
                      String(profileData.mode || "").toLowerCase() ===
                        "corporate")
                      ? "View all your followers"
                      : "View all your connections"
                  }
                >
                  <FaUserFriends className="text-base" />
                  <span className="text-lg font-extrabold text-[#16730F]">
                    {formatConnectionCount(profileData.connectionCount)}
                  </span>
                  <span className="text-slate-600 font-medium">
                    {profileData.isCorporate ||
                    (String(profileData.role || "").toLowerCase() ===
                      "recruiter" &&
                      String(profileData.mode || "").toLowerCase() ===
                        "corporate")
                      ? Number(profileData.connectionCount) === 1
                        ? "Follower"
                        : "Followers"
                      : Number(profileData.connectionCount) === 1
                        ? "Connection"
                        : "Connections"}
                  </span>
                </button>
              ) : (
                <div className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-5 py-3 rounded-2xl bg-slate-100/90 text-slate-800 text-xs sm:text-sm font-bold border border-slate-200">
                  <FaUserFriends className="text-[#16730F] text-base" />
                  <span className="text-lg font-extrabold text-[#16730F]">
                    {formatConnectionCount(profileData.connectionCount)}
                  </span>
                  <span className="text-slate-600 font-medium">
                    {profileData.isCorporate ||
                    (String(profileData.role || "").toLowerCase() ===
                      "recruiter" &&
                      String(profileData.mode || "").toLowerCase() ===
                        "corporate")
                      ? Number(profileData.connectionCount) === 1
                        ? "Follower"
                        : "Followers"
                      : Number(profileData.connectionCount) === 1
                        ? "Connection"
                        : "Connections"}
                  </span>
                </div>
              )}

              {/* Connect / Message Actions Panel */}
              {!isViewingOwnProfile && viewedProfileId && (
                <div className="w-full min-w-0 lg:max-w-xs">
                  <ProfileConnectActions
                    userId={viewedProfileId}
                    displayName={formatDisplayPersonName(profileData, "User")}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Segmented Interactive Nav Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "all"
                ? "bg-[#16730F] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FaLayerGroup className="text-xs" />
            <span>Overview</span>
          </button>

          {(isRecruiterProfile || isJobseekerProfile) && (
            <button
              type="button"
              onClick={() => setActiveTab("about")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === "about"
                  ? "bg-[#16730F] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FaBriefcase className="text-xs" />
              <span>About & Bio</span>
            </button>
          )}

          {isJobseekerProfile && (
            <button
              type="button"
              onClick={() => setActiveTab("cv")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === "cv"
                  ? "bg-[#16730F] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FaFileAlt className="text-xs" />
              <span>CV & Experience</span>
            </button>
          )}

          {isRecruiterProfile && (
            <button
              type="button"
              onClick={() => setActiveTab("presence")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === "presence"
                  ? "bg-[#16730F] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FaGlobe className="text-xs" />
              <span>Online Presence</span>
            </button>
          )}

          {viewedProfileId && (
            <button
              type="button"
              onClick={() => setActiveTab("posts")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                activeTab === "posts"
                  ? "bg-[#16730F] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FaNewspaper className="text-xs" />
              <span>Posts & Activity</span>
            </button>
          )}
        </div>

        {/* Main dashboard: CV + activity stack on the left so a tall sidebar cannot open a gap between them. */}
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start">
          <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-6">
            {/* Main Column – Content (before posts) */}
            <div className="space-y-6 order-1">
              {/* Bio / About Bento Section */}
              {(activeTab === "all" || activeTab === "about") &&
                (isRecruiterProfile || isJobseekerProfile) && (
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-7 transition-all">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#16730F] flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
                          <FaBriefcase className="w-4 h-4" />
                        </div>
                        <span>
                          {isRecruiterProfile ? "About Company" : "About"}
                        </span>
                      </h2>
                    </div>

                    <div className="relative">
                      {aboutText ? (
                        <>
                          <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap break-words font-normal">
                            {!needsTruncation || isAboutExpanded
                              ? aboutText
                              : aboutPreview.text}
                          </p>
                          {needsTruncation && (
                            <button
                              type="button"
                              onClick={() =>
                                setIsAboutExpanded(!isAboutExpanded)
                              }
                              className="mt-3 text-[#16730F] hover:text-[#145a0c] font-bold text-xs sm:text-sm transition-colors inline-flex items-center gap-1.5 group cursor-pointer"
                            >
                              <span>
                                {isAboutExpanded ? "See Less" : "See More"}
                              </span>
                              <FaChevronDown
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  isAboutExpanded
                                    ? "rotate-180 text-[#16730F]"
                                    : ""
                                }`}
                              />
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                          <p className="text-sm text-slate-400 font-medium">
                            No bio provided yet.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* Online Presence Grid (Recruiters) */}
              {(activeTab === "all" ||
                activeTab === "about" ||
                activeTab === "presence") &&
                isRecruiterProfile && (
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-7 transition-all">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#16730F] flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
                          <FaGlobe className="w-4 h-4" />
                        </div>
                        <span>Online Presence</span>
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <ProfileDetailRow
                        icon={FaGlobe}
                        label="Website"
                        value={profileData.website}
                        href={toExternalHref(profileData.website)}
                        preserveCase
                        brandColor="bg-emerald-50 text-[#16730F] border-emerald-200"
                      />
                      <ProfileDetailRow
                        icon={FaLinkedin}
                        label="LinkedIn"
                        value={linkedinUrl}
                        href={toExternalHref(linkedinUrl)}
                        preserveCase
                        brandColor="bg-blue-50 text-[#0A66C2] border-blue-200"
                      />
                      <ProfileDetailRow
                        icon={FaTwitter}
                        label="X (Twitter)"
                        value={twitterUrl}
                        href={toExternalHref(twitterUrl)}
                        preserveCase
                        brandColor="bg-slate-100 text-slate-900 border-slate-200"
                      />
                      <ProfileDetailRow
                        icon={FaInstagram}
                        label="Instagram"
                        value={instagramUrl}
                        href={toExternalHref(instagramUrl)}
                        preserveCase
                        brandColor="bg-pink-50 text-pink-600 border-pink-200"
                      />
                    </div>
                  </div>
                )}

              {(activeTab === "all" || activeTab === "cv") &&
                isJobseekerProfile && (
                  <ProfileCvSections
                    cv={cvData}
                    exclude={["skills", "links"]}
                  />
                )}
            </div>

            {/* Activity / Posts – last on mobile, below content on desktop */}
            <div className="space-y-6 order-3">
              {(activeTab === "all" || activeTab === "posts") &&
                viewedProfileId && (
                  <ProfilePostsSection
                    userId={String(viewedProfileId)}
                    currentUserId={user?.id}
                  />
                )}
            </div>
          </div>

          {/* Sidebar Column – appears before posts on mobile, sticky floating right column on desktop */}
          <div className="lg:col-span-1 space-y-5 order-2 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:overflow-x-hidden nfl-scroll lg:pr-1">
            {isViewingOwnProfile &&
              !userHasVerifiedBadge(profileData) &&
              !userHasVerifiedBadge(user) && (
                <ProfileVerifiedBadgeCard isRecruiter={isRecruiterProfile} />
              )}

            {/* Mutual Connections Bento Card */}
            {!isViewingOwnProfile &&
              Number(profileData.mutualConnectionCount) > 0 && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-6 transition-all hover:border-slate-300">
                  <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-[#16730F] flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
                        <FaUserFriends className="text-xs sm:text-sm" />
                      </div>
                      <span>Mutual Connections</span>
                    </span>
                    <span className="text-xs font-extrabold text-[#16730F] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      {formatConnectionCount(profileData.mutualConnectionCount)}
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex items-center -space-x-3 overflow-hidden py-1 justify-center sm:justify-start">
                      {(profileData.mutualConnections || [])
                        .slice(0, MUTUAL_SIDEBAR_PREVIEW)
                        .map((person) => {
                          const name = [person?.firstName, person?.lastName]
                            .filter(Boolean)
                            .join(" ")
                            .trim();
                          return (
                            <button
                              key={String(person.id)}
                              type="button"
                              onClick={() =>
                                navigate(`/user-profile/${person.id}`)
                              }
                              className="relative h-10 w-10 rounded-full border-2 border-white shadow-md overflow-hidden bg-slate-200 hover:z-10 focus:z-10 focus:outline-none transition-transform hover:scale-110 cursor-pointer"
                              title={
                                name ? `View ${name}'s profile` : "View profile"
                              }
                            >
                              <img
                                src={profileAvatarSrc(person.profile_photo)}
                                alt={name || "Mutual connection"}
                                className="h-full w-full object-cover"
                              />
                            </button>
                          );
                        })}
                      {Number(profileData.mutualConnectionCount) >
                        MUTUAL_SIDEBAR_PREVIEW && (
                        <button
                          type="button"
                          onClick={() => setShowMutualConnections(true)}
                          className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-emerald-100 text-xs font-bold text-[#16730F] shadow-md hover:bg-emerald-200 transition-colors cursor-pointer"
                          title="See all mutual connections"
                        >
                          +
                          {formatConnectionCount(
                            Number(profileData.mutualConnectionCount) -
                              MUTUAL_SIDEBAR_PREVIEW,
                          )}
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-snug text-center sm:text-left font-medium">
                      {formatMutualConnectionsLabel(
                        profileData.mutualConnectionCount,
                        profileData.mutualConnections,
                      )}
                    </p>

                    {Number(profileData.mutualConnectionCount) >
                      MUTUAL_SIDEBAR_PREVIEW && (
                      <button
                        type="button"
                        onClick={() => setShowMutualConnections(true)}
                        className="w-full py-2 bg-slate-50 hover:bg-emerald-50 text-[#16730F] font-bold text-xs rounded-xl border border-slate-200 hover:border-emerald-200 transition-all cursor-pointer text-center shadow-2xs"
                      >
                        View All Mutuals
                      </button>
                    )}
                  </div>
                </div>
              )}

            {/* Skills Sidebar Card (Jobseekers) */}
            {isJobseekerProfile && (
              <ProfileSkillsSection cv={cvData} className="mb-5" />
            )}

            {/* Links Sidebar Card (Jobseekers) */}
            {isJobseekerProfile && (
              <ProfileLinksSection cv={cvData} className="mb-5" />
            )}

            {/* Online Presence Sidebar Card (Recruiters) */}
            {isRecruiterProfile && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-5 sm:p-6 transition-all hover:border-slate-300">
                <h3 className="text-base font-bold text-[#1A3E32] mb-4 pb-3 border-b border-slate-100 flex items-center gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-[#16730F] flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
                    <FaGlobe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                  <span>Online Presence</span>
                </h3>

                <div className="space-y-2.5 min-w-0 ">
                  {profileData?.website && (
                    <ProfileLinkItem type="website" url={profileData.website} />
                  )}
                  {linkedinUrl && (
                    <ProfileLinkItem type="linkedin" url={linkedinUrl} />
                  )}
                  {twitterUrl && (
                    <ProfileLinkItem type="twitter" url={twitterUrl} />
                  )}
                  {instagramUrl && (
                    <ProfileLinkItem type="instagram" url={instagramUrl} />
                  )}
                  {!profileData?.website &&
                    !linkedinUrl &&
                    !twitterUrl &&
                    !instagramUrl && (
                      <div className="text-center py-5 text-slate-400 text-xs font-medium">
                        No online links provided
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Quick Share / Profile URL Floating Card */}
            <div className="bg-gradient-to-br mt-2 from-emerald-50/60 via-white to-slate-50/80 rounded-3xl p-4 sm:p-5 border border-emerald-100/90 shadow-2xs flex items-center justify-between gap-3 transition-all hover:border-emerald-200 hover:shadow-xs">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FaShareAlt className="text-[#16730F] text-[11px]" />
                  <span>Share Profile</span>
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  Copy link to share with others
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyProfileLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-[#16730F] font-bold text-xs border border-emerald-200/90 shadow-2xs hover:shadow-xs transition-all cursor-pointer shrink-0"
                title="Copy link to clipboard"
              >
                {copiedLink ? (
                  <>
                    <FaCheck className="text-xs text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <FaLink className="text-xs" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Photo Viewer Modal */}
      {isPhotoViewerOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsPhotoViewerOpen(false)}
        >
          <div className="relative max-w-[95vw] max-h-[90vh]">
            <img
              src={activeAvatarSrc}
              alt="Profile full view"
              className="max-w-full max-h-[85vh] object-contain rounded-3xl shadow-2xl border border-white/20"
              onClick={(event) => event.stopPropagation()}
            />
            <button
              type="button"
              aria-label="Close photo viewer"
              className="absolute -top-4 -right-4 text-white text-xl bg-slate-800/90 hover:bg-slate-700 rounded-full w-11 h-11 flex items-center justify-center border border-white/30 shadow-xl transition-all cursor-pointer"
              onClick={() => setIsPhotoViewerOpen(false)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Mutual Connections Modal */}
      <MutualConnectionsModal
        open={showMutualConnections}
        onClose={() => setShowMutualConnections(false)}
        otherUserId={viewedProfileId}
        otherUserName={formatDisplayPersonName(profileData, "User")}
      />
    </NewsFeedLayout>
  );
};

export default Profile;
