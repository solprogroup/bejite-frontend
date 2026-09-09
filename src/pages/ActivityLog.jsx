import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Image,
  FileText,
  Briefcase,
  Video,
  Search,
  MessageCircle,
  Bookmark,
  Heart,
  MoreHorizontal,
  Eye,
  Share2,
} from "lucide-react";
import NewsFeedLayout from "../components/layout/NewsFeedLayout";
import {
  getUserPosts,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  getComments,
  addComment,
  getPostLikes,
  getPostShares,
  getMyMetrics
} from "../services/postsApi";
import {
  buildPostShareText,
  copyPostLink,
  getPostShareUrl,
  getSocialShareUrl,
  isPublicShareablePost,
  openShareWindow,
  recordPostShare,
} from "../utils/postShare";
import {
  getUser,
  mergeAuthUsers,
  pickProfilePhotoPath,
} from "../utils/tokenManager";
import { profileAvatarSrc } from "../utils/profilePhotoUrl";
import { getAuthorProfileImageUrl } from "../utils/profileImageUtils";
import SharePostModal from "../components/SharePostModal";
import {
  getPortaledMenuStyle,
  usePortaledMenu,
} from "../hooks/usePortaledMenu";
import useSyncProfilePhoto from "../hooks/useSyncProfilePhoto";
import PostActions from "../components/feed/PostActions";
import FormattedPostBody from "../components/feed/FormattedPostBody";
import UsersListModal from "../components/UsersListModal";
import PostCreationModal from "../components/PostCreationModal";
import { formatDisplayPersonName } from "../utils/personDisplayName";
import DisplayNameWithBadge from "../components/DisplayNameWithBadge";
import { getAuthorSubtitle } from "../utils/authorDisplay";
import PostMediaGallery from "../components/PostMediaGallery";
import FeedLoadMoreButton from "../components/FeedLoadMoreButton";
import useJobsApi from "../services/useJobsApi";
import {
  getRecruiterJobApplications,
  getRecruiterJobApplicationById,
} from "../services/activityLogApi";
import ActivityJobDetailsModal from "../components/jobs/ActivityJobDetailsModal";
import { formatDisplayText } from "../utils/displayFormatUtils";
import { formatSalaryExpectation } from "../utils/formatSalary";
import { motion, AnimatePresence } from "framer-motion";

const getDisplayName = (user) => formatDisplayPersonName(user);

const formatDate = (dateString) => {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Just now";

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 2) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  const isThisYear = date.getFullYear() === now.getFullYear();
  const options = isThisYear
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" };
  return date.toLocaleDateString("en-US", options);
};

const mergeFeedPosts = (existing, incoming) => {
  const seen = new Set(existing.map((p) => p.id));
  const merged = [...existing];
  for (const post of incoming) {
    if (!seen.has(post.id)) {
      seen.add(post.id);
      merged.push(post);
    }
  }
  return merged;
};

const ActivityLogPostCard = ({
  post,
  onLike,
  onSave,
  onShare,
  onUpdate,
  onDelete,
  currentUserId,
  currentUserPhotoUrl,
  periodMetrics = null,
  metricsPeriod = "all",
}) => {
  const reduxUser = useSelector((state) => state.auth?.user);
  const syncedCurrentUserPhoto = useMemo(() => {
    const stored = getUser() || {};
    const merged = mergeAuthUsers(stored, reduxUser);
    const raw =
      pickProfilePhotoPath(merged) ||
      pickProfilePhotoPath(stored) ||
      pickProfilePhotoPath(reduxUser);
    return raw ? profileAvatarSrc(raw) : currentUserPhotoUrl;
  }, [reduxUser, currentUserPhotoUrl]);

  const isOwner = String(post.authorId) === String(currentUserId);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [liked, setLiked] = useState(post.likedByMe === true);
  const [saved, setSaved] = useState(post.savedByMe === true);
  const navigate = useNavigate();

  useEffect(() => {
    setLiked(post.likedByMe === true);
    setSaved(post.savedByMe === true);
  }, [post.id, post.likedByMe, post.savedByMe]);
  
  const [showMenu, setShowMenu] = useState(false);
  const { triggerRef, menuRef, menuPos } = usePortaledMenu({
    isOpen: showMenu,
    onClose: () => setShowMenu(false),
    minWidth: 128,
    maxHeight: 120,
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Users list modal state
  const [usersListModalOpen, setUsersListModalOpen] = useState(false);
  const [usersListTitle, setUsersListTitle] = useState("");
  const [usersListType, setUsersListType] = useState("likes");
  const [usersListUsers, setUsersListUsers] = useState([]);
  const [usersListLoading, setUsersListLoading] = useState(false);

  const fetchComments = async (force = false) => {
    if (!force && comments.length > 0) return;
    try {
      setLoadingComments(true);
      const data = await getComments(post.id);
      setComments(data.comments || []);
    } catch (err) {
      console.error("Error fetching comments:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await addComment(post.id, newComment);
      setNewComment("");
      await fetchComments(true);
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  const toggleComments = () => {
    if (!showComments) {
      fetchComments();
    }
    setShowComments(!showComments);
  };

  const handleLikeClick = () => {
    setLiked(!liked);
    onLike(post.id, liked);
  };

  const handleSaveClick = () => {
    setSaved(!saved);
    onSave(post.id, saved);
  };

  const handleShareClick = () => {
    setShowShareModal(true);
  };

  const handleShareOption = async (platform) => {
    try {
      if (!isPublicShareablePost(post)) {
        toast.info(
          "Only public posts show a rich preview on social media. Connections-only posts can still be shared as a link.",
        );
      }

      await onShare(post.id);
      const postUrl = getPostShareUrl(post.id);
      const shareText = buildPostShareText(post);

      if (platform === "copy") {
        await copyPostLink(post.id);
      } else {
        openShareWindow(getSocialShareUrl(platform, postUrl, { text: shareText }));
      }
    } finally {
      setShowShareModal(false);
    }
  };

  const handleEditClick = () => {
    setShowEditModal(true);
  };

  const handleDeleteClick = async () => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      try {
        await onDelete(post.id);
      } catch (err) {
        console.error("Error deleting post:", err);
      }
    }
  };

  const handleShowLikers = async () => {
    try {
      setUsersListTitle("People who liked");
      setUsersListType("likes");
      setUsersListLoading(true);
      setUsersListModalOpen(true);
      const data = await getPostLikes(post.id);
      let usersList = [];
      if (data?.likers) usersList = data.likers;
      else if (data?.users) usersList = data.users;
      else if (data?.likes) usersList = data.likes;
      else if (data?.data) usersList = data.data;
      else if (Array.isArray(data)) usersList = data;
      
      usersList = usersList.map((user) => ({
        ...user,
        id: user.id || user.userId,
      }));
      setUsersListUsers(usersList);
    } catch (err) {
      console.error("Error fetching likes:", err);
      setUsersListUsers([]);
    } finally {
      setUsersListLoading(false);
    }
  };

  const handleShowSharers = async () => {
    try {
      setUsersListTitle("People who shared");
      setUsersListType("shares");
      setUsersListLoading(true);
      setUsersListModalOpen(true);
      const data = await getPostShares(post.id);
      let usersList = [];
      if (data?.sharers) usersList = data.sharers;
      else if (data?.users) usersList = data.users;
      else if (data?.shares) usersList = data.shares;
      else if (data?.data) usersList = data.data;
      else if (Array.isArray(data)) usersList = data;

      usersList = usersList.map((user) => ({
        ...user,
        id: user.id || user.userId,
      }));
      setUsersListUsers(usersList);
    } catch (err) {
      console.error("Error fetching shares:", err);
      setUsersListUsers([]);
    } finally {
      setUsersListLoading(false);
    }
  };

  const authorName = getDisplayName(post.author);
  const authorJobTitle = getAuthorSubtitle(post.author, post.authorId);
  const goToAuthorProfile = () => {
    if (post.authorId) navigate(`/user-profile/${post.authorId}`);
  };

  const isCurrentUserPost = String(post.authorId) === String(currentUserId);
  const authorImage = isCurrentUserPost
    ? syncedCurrentUserPhoto
    : getAuthorProfileImageUrl(post.author);

  const getCommentAuthorImage = (comment) => {
    const isCurrentUserComment = String(comment.authorId) === String(currentUserId);
    if (isCurrentUserComment) return syncedCurrentUserPhoto;
    return getAuthorProfileImageUrl(comment.author);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-3xl p-4 sm:p-6 mx-auto space-y-4 sm:space-y-6 bg-white shadow-sm border border-gray-100 rounded-2xl mb-4"
    >
      <div className="flex flex-row items-start justify-between gap-3 w-full">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={goToAuthorProfile}
            disabled={!post.authorId}
            className="rounded-full shrink-0 disabled:cursor-default"
          >
            <img
              src={authorImage}
              alt="profile"
              className="rounded-full w-10 h-10 sm:w-12 sm:h-12 object-cover border-2 border-green-50 cursor-pointer hover:opacity-90"
            />
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={goToAuthorProfile}
              disabled={!post.authorId}
              className="font-semibold text-base sm:text-lg text-[#16730F] hover:underline text-left disabled:cursor-default disabled:no-underline leading-tight max-w-full min-w-0"
            >
              <DisplayNameWithBadge
                user={post.author}
                fallback={authorName}
                badgeSize="xs"
                responsiveBadge
              />
            </button>
            <p className="text-gray-500 text-xs sm:text-sm">
              {authorJobTitle}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">
              {formatDate(post.publishedAt || post.createdAt)}
            </p>
          </div>
        </div>
        {isOwner && (
          <div className="relative shrink-0 self-start">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 -mr-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Post options"
              aria-expanded={showMenu}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {showMenu &&
              menuPos &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  ref={menuRef}
                  className="bg-white shadow-lg rounded-xl py-2 border border-[#D3D3D3]"
                  style={getPortaledMenuStyle(menuPos)}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleEditClick();
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleDeleteClick();
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>,
                document.body,
              )}
          </div>
        )}
      </div>

      <div>
        <FormattedPostBody
          body={post.body}
            truncateAt={200}
            className="text-gray-800 text-sm sm:text-base whitespace-pre-wrap break-words leading-relaxed"
          />
        </div>

      {post.media && post.media.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-gray-100">
           {post.media.map((m, idx) => {
             if (m.kind === 'video') {
               return (
                 <video key={idx} src={m.url} controls className="w-full h-auto max-h-[500px] object-cover bg-black" poster={m.thumbnailUrl} />
               )
             }
             return (
                <img key={idx} src={m.url} alt="media" className="w-full h-auto max-h-[500px] object-cover bg-gray-50" />
             )
           })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500">
        {(Number(
          periodMetrics?.impressions ?? post.impressionsCount,
        ) || 0) > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-gray-600">
            <Eye className="w-3.5 h-3.5" aria-hidden />
            {(
              Number(periodMetrics?.impressions ?? post.impressionsCount) || 0
            ).toLocaleString()}{" "}
            {(Number(periodMetrics?.impressions ?? post.impressionsCount) || 0) ===
            1
              ? "view"
              : "views"}
            {periodMetrics && metricsPeriod !== "all"
              ? metricsPeriod === "week"
                ? " (7d)"
                : " (30d)"
              : ""}
          </span>
        )}
        {(Number(periodMetrics?.likes ?? post.likesCount) || 0) > 0 && (
          <button
            onClick={handleShowLikers}
            className="hover:text-[#16730F] transition-colors font-medium"
          >
            {(Number(periodMetrics?.likes ?? post.likesCount) || 0).toLocaleString()}{" "}
            {(Number(periodMetrics?.likes ?? post.likesCount) || 0) === 1
              ? "Like"
              : "Likes"}
            {periodMetrics && metricsPeriod !== "all"
              ? metricsPeriod === "week"
                ? " (7d)"
                : " (30d)"
              : ""}
          </button>
        )}
        {(Number(periodMetrics?.comments ?? post.commentsCount) || 0) > 0 && (
          <button
            onClick={toggleComments}
            className="hover:text-[#16730F] transition-colors font-medium"
          >
            {(
              Number(periodMetrics?.comments ?? post.commentsCount) || 0
            ).toLocaleString()}{" "}
            comment
            {(Number(periodMetrics?.comments ?? post.commentsCount) || 0) > 1
              ? "s"
              : ""}
            {periodMetrics && metricsPeriod !== "all"
              ? metricsPeriod === "week"
                ? " (7d)"
                : " (30d)"
              : ""}
          </button>
        )}
        {(Number(periodMetrics?.shares ?? post.sharesCount) || 0) > 0 && (
          <button
            onClick={handleShowSharers}
            className="hover:text-[#16730F] transition-colors font-medium"
          >
            {(
              Number(periodMetrics?.shares ?? post.sharesCount) || 0
            ).toLocaleString()}{" "}
            share
            {(Number(periodMetrics?.shares ?? post.sharesCount) || 0) > 1
              ? "s"
              : ""}
            {periodMetrics && metricsPeriod !== "all"
              ? metricsPeriod === "week"
                ? " (7d)"
                : " (30d)"
              : ""}
          </button>
        )}
      </div>

      {periodMetrics && (
        <div className="rounded-xl border border-[#D5E5DD] bg-[#F3F8F2] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#16730F] mb-1.5">
            {metricsPeriod === "week"
              ? "Last 7 days"
              : metricsPeriod === "month"
                ? "Last 30 days"
                : "All time"}{" "}
            · post metrics
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Views", value: periodMetrics.impressions },
              { label: "Likes", value: periodMetrics.likes },
              { label: "Comments", value: periodMetrics.comments },
              { label: "Shares", value: periodMetrics.shares },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-sm font-bold text-[#1A3E32]">
                  {(Number(item.value) || 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-500 font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <PostActions
        liked={liked}
        saved={saved}
        likesCount={post.likesCount || 0}
        commentsCount={post.commentsCount || 0}
        sharesCount={post.sharesCount || 0}
        onLike={handleLikeClick}
        onShowLikers={handleShowLikers}
        onComment={toggleComments}
        onShare={handleShareClick}
        onSave={handleSaveClick}
      />

      <SharePostModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShare={handleShareOption}
      />

      {showComments && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <form
            onSubmit={handleAddComment}
            className="flex flex-wrap sm:flex-nowrap gap-3 mb-5 items-center"
          >
            <img
              src={syncedCurrentUserPhoto}
              alt="Your profile"
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200"
            />
            <input
              type="text"
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 min-w-[180px] bg-gray-50 border border-transparent rounded-full px-4 py-2.5 text-sm focus:bg-white focus:outline-none focus:border-[#16730F] focus:ring-1 focus:ring-[#16730F] transition-all"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="bg-[#16730F] text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-[#145a0c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Post
            </button>
          </form>

          {loadingComments ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#16730F] border-t-transparent"></div>
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-4">Be the first to comment!</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <img
                    src={getCommentAuthorImage(comment)}
                    alt="profile"
                    className="w-8 h-8 rounded-full object-cover border border-gray-100"
                  />
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-2xl rounded-tl-none px-4 py-3 inline-block">
                      <p className="font-semibold text-sm text-gray-900 mb-0.5">
                        <DisplayNameWithBadge user={comment.author} badgeSize="xs" />
                      </p>
                      <p className="text-sm text-gray-700">{comment.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showEditModal && (
        <PostCreationModal
          isOpen
          editingPost={post}
          onClose={() => setShowEditModal(false)}
          onPost={async (payload) => {
            await onUpdate(post.id, payload);
          }}
        />
      )}

      <UsersListModal
        isOpen={usersListModalOpen}
        onClose={() => setUsersListModalOpen(false)}
        title={usersListTitle}
        users={usersListUsers}
        loading={usersListLoading}
        type={usersListType}
      />
    </motion.div>
  );
};

const JobCard = ({ job, onView, isRecruiterViewer }) => {
  const locationLabel = formatDisplayText(
    [job.preferred_state, job.preferred_country].filter(Boolean).join(", ") ||
      job.preferred_country,
  );
  const salaryLabel = formatSalaryExpectation(
    job.expected_salary,
    job.currency,
  );

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => onView(job)}
      className="w-full text-left bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4 hover:shadow-md hover:border-[#16730F]/20 transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100 group-hover:bg-green-50 group-hover:border-green-100 transition-colors">
            <Briefcase className="w-6 h-6 text-amber-600 group-hover:text-[#16730F]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-lg leading-tight break-words">
              {formatDisplayText(job.title) || job.title}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {[job.industry_sector, job.work_type].filter(Boolean).join(" • ")}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {locationLabel && (
                <span className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs rounded-lg border border-gray-100 font-medium">
                  {locationLabel}
                </span>
              )}
              {salaryLabel && (
                <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs rounded-lg border border-green-100 font-medium">
                  {salaryLabel}
                </span>
              )}
              {job.remote_preference && (
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-100 font-medium">
                  {job.remote_preference}
                </span>
              )}
            </div>
            <p className="text-xs text-[#16730F] font-semibold mt-3 group-hover:underline">
              {isRecruiterViewer
                ? "View full details"
                : "View on job board"}
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap shrink-0">
          {formatDate(job.updated_at || job.created_at)}
        </div>
      </div>
    </motion.button>
  );
};

export default function ActivityLog() {
  useSyncProfilePhoto();
  const location = useLocation();
  const navigate = useNavigate();
  const reduxUser = useSelector((state) => state.auth?.user);
  
  const mergedUser = useMemo(() => {
    void location.pathname;
    return mergeAuthUsers(getUser() || {}, reduxUser);
  }, [reduxUser, location.pathname]);

  const isRecruiter = useMemo(() => {
    const role = (mergedUser?.role || "").toLowerCase();
    return role === "recruiter" || role === "employer";
  }, [mergedUser?.role]);

  const jobsPosterRole = isRecruiter ? "jobseeker" : "recruiter";

  const currentUserImage = useMemo(() => {
    void location.pathname;
    const stored = getUser() || {};
    const merged = mergeAuthUsers(stored, reduxUser);
    const raw =
      pickProfilePhotoPath(merged) ||
      pickProfilePhotoPath(stored) ||
      pickProfilePhotoPath(reduxUser) ||
      "/assets/images/photo_placeholder.png";
    return profileAvatarSrc(raw);
  }, [reduxUser, location.pathname]);

  const { getJobs, getJobById } = useJobsApi();

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [metricsPeriod, setMetricsPeriod] = useState("all");
  const [filtersHidden, setFiltersHidden] = useState(false);
  const filtersBarRef = useRef(null);
  const filtersLastScrollTopRef = useRef(0);
  const filtersHiddenRef = useRef(false);

  const [posts, setPosts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [metrics, setMetrics] = useState({
    postsPublished: 0,
    likesGiven: 0,
    commentsWritten: 0,
    impressionsReceived: 0,
    likesReceived: 0,
    commentsReceived: 0,
    sharesReceived: 0,
    posts: [],
  });
  const [metricsLoading, setMetricsLoading] = useState(false);

  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [jobPage, setJobPage] = useState(1);
  const [hasMoreJobs, setHasMoreJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loadingJobDetails, setLoadingJobDetails] = useState(false);
  const [jobsError, setJobsError] = useState(null);

  const filters = [
    { value: "all", label: "All" },
    { value: "post", label: "Posts" },
    { value: "image", label: "Photos" },
    { value: "video", label: "Videos" },
    {
      value: "job",
      label: isRecruiter ? "Job Applications" : "Job postings",
    },
  ];

  useEffect(() => {
    fetchPosts(true);
    fetchJobs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedUser?.id, isRecruiter]);

  const loadedPostIdsKey = useMemo(
    () => posts.map((p) => String(p.id)).join(","),
    [posts],
  );

  useEffect(() => {
    if (!mergedUser?.id) return undefined;

    let cancelled = false;
    const postIds = loadedPostIdsKey
      ? loadedPostIdsKey.split(",").filter(Boolean)
      : [];

    const run = async () => {
      try {
        setMetricsLoading(true);
        const data = await getMyMetrics(metricsPeriod, {
          postIds: postIds.length ? postIds.slice(0, 100) : undefined,
          limit: Math.min(Math.max(postIds.length || 50, 50), 100),
        });
        if (cancelled || !data) return;
        setMetrics({
          postsPublished: data.postsPublished || 0,
          likesGiven: data.likesGiven || 0,
          commentsWritten: data.commentsWritten || 0,
          impressionsReceived: data.impressionsReceived || 0,
          likesReceived: data.likesReceived || 0,
          commentsReceived: data.commentsReceived || 0,
          sharesReceived: data.sharesReceived || 0,
          posts: Array.isArray(data.posts) ? data.posts : [],
        });
      } catch (err) {
        if (!cancelled) console.error("Error fetching metrics:", err);
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [metricsPeriod, mergedUser?.id, loadedPostIdsKey]);

  const periodPostMetricsById = useMemo(() => {
    const map = new Map();
    for (const row of metrics.posts || []) {
      if (row?.postId) map.set(String(row.postId), row);
    }
    return map;
  }, [metrics.posts]);

  useEffect(() => {
    const bar = filtersBarRef.current;
    const scroller = bar?.closest(".nfl-scroll");
    if (!scroller) return;

    filtersHiddenRef.current = false;
    filtersLastScrollTopRef.current = scroller.scrollTop;
    setFiltersHidden(false);

    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const top = scroller.scrollTop;
        const delta = top - filtersLastScrollTopRef.current;
        filtersLastScrollTopRef.current = top;

        if (Math.abs(delta) < 8) return;

        if (filtersHiddenRef.current) {
          if (delta < 0) {
            filtersHiddenRef.current = false;
            setFiltersHidden(false);
          }
          return;
        }

        if (delta > 0 && top > 48) {
          filtersHiddenRef.current = true;
          setFiltersHidden(true);
        }
      });
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const fetchPosts = async (reset = false) => {
    if (!mergedUser?.id) return;
    try {
      setLoadingPosts(true);
      const currentCursor = reset ? null : nextCursor;
      const data = await getUserPosts(mergedUser.id, 10, currentCursor);
      const newPosts = data.posts || [];
      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => mergeFeedPosts(prev, newPosts));
      }
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      console.error("Error fetching user posts:", err);
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchJobs = async (reset = false) => {
    if (!mergedUser?.id) return;
    try {
      setLoadingJobs(true);
      setJobsError(null);
      const currentPage = reset ? 1 : jobPage;

      const data = isRecruiter
        ? await getRecruiterJobApplications(
            {
              page: currentPage,
              limit: 10,
            },
            getJobs,
          )
        : await getJobs({
            page: currentPage,
            limit: 10,
            poster_role: jobsPosterRole,
          });

      const newJobs = data?.data || [];
      if (reset) {
        setJobs(newJobs);
      } else {
        setJobs((prev) => [...prev, ...newJobs]);
      }
      setHasMoreJobs(data?.pagination?.page < data?.pagination?.pages);
      if (data?.pagination) {
        setJobPage(data.pagination.page + 1);
      }
    } catch (err) {
      console.error("Error fetching jobs:", err);
      const message =
        err?.response?.data?.message ||
        (typeof err === "string" ? err : null) ||
        "Could not load job applications. Please try again.";
      setJobsError(message);
      if (reset) {
        setJobs([]);
      }
    } finally {
      setLoadingJobs(false);
    }
  };

  const patchPost = (postId, patch) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
    );
  };

  const handleLike = async (postId, isLiked) => {
    try {
      if (isLiked) {
        await unlikePost(postId);
      } else {
        await likePost(postId);
      }
      const current = posts.find((p) => p.id === postId);
      patchPost(postId, {
        likedByMe: !isLiked,
        likesCount: Math.max(
          0,
          (current?.likesCount || 0) + (isLiked ? -1 : 1),
        ),
      });
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  const handleShare = async (postId) => {
    try {
      await recordPostShare(postId);
      const current = posts.find((p) => p.id === postId);
      patchPost(postId, {
        sharesCount: (current?.sharesCount || 0) + 1,
      });
    } catch (err) {
      console.error("Error sharing post:", err);
    }
  };

  const handleSave = async (postId, isSaved) => {
    try {
      if (isSaved) {
        await unsavePost(postId);
        patchPost(postId, { savedByMe: false });
      } else {
        await savePost(postId);
        patchPost(postId, { savedByMe: true });
      }
    } catch (err) {
      console.error("Error toggling save:", err);
    }
  };

  const handleUpdatePost = async (postId, postData) => {
    try {
      await updatePost(postId, postData);
      fetchPosts(true);
    } catch (err) {
      console.error("Error updating post:", err);
      throw err;
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await deletePost(postId);
      setPosts(posts.filter((p) => p.id !== postId));
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  const handleViewJob = async (job) => {
    if (!isRecruiter) {
      navigate(`/job-vacancy?jobId=${job.id}`);
      return;
    }

    setSelectedJob(job);
    setLoadingJobDetails(true);

    try {
      const response = await getRecruiterJobApplicationById(job.id, getJobById);
      if (response?.data) {
        setSelectedJob(response.data);
      }
    } catch (err) {
      console.error("Error loading job seeker preference:", err);
    } finally {
      setLoadingJobDetails(false);
    }
  };

  const handleCloseJobModal = () => {
    setSelectedJob(null);
    setLoadingJobDetails(false);
  };

  const filteredPosts = useMemo(() => {
    if (filter === "job") return [];
    return posts.filter(post => {
      if (search && !post.body?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "all") return true;
      if (filter === "post") return !post.media || post.media.length === 0;
      if (filter === "image") return post.media?.some(m => m.kind === "image");
      if (filter === "video") return post.media?.some(m => m.kind === "video");
      return true;
    });
  }, [posts, filter, search]);

  const filteredJobs = useMemo(() => {
    if (filter !== "job" && filter !== "all") return [];
    return jobs.filter((job) => {
      if (search && !job.title?.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [jobs, filter, search]);

  const showJobs = filter === "job" || filter === "all";
  const showPosts = filter !== "job";

  return (
    <NewsFeedLayout classes={false} showSidebars={false}>
      <div className="h-full min-h-0 w-full max-w-screen-xl mx-auto flex flex-col bg-[#F8FAFC]">
        <div className="flex-1 min-h-0 overflow-y-auto nfl-scroll scroll-smooth">
          {/* Header Section */}
          <div className="bg-[#1A3E32] px-6 py-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
            <div className="max-w-4xl mx-auto relative z-10 flex items-center gap-6">
              <img 
                src={currentUserImage} 
                alt="Profile" 
                className="w-20 h-20 rounded-full border-4 border-white/20 shadow-xl object-cover bg-white" 
              />
              <div>
                <h1 className="text-white font-bold text-2xl sm:text-3xl tracking-tight">Your Activity Log</h1>
                <p className="text-green-100 text-sm sm:text-base mt-1 font-medium opacity-90">
                  Manage and view everything you've shared on Bejite
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            
            {/* Metrics Dashboard */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#1A3E32]">Post performance</h2>
                  <p className="text-xs text-gray-500">
                    Engagement on your posts
                    {metricsPeriod === "week"
                      ? " over the last 7 days"
                      : metricsPeriod === "month"
                        ? " over the last 30 days"
                        : " (all time)"}
                  </p>
                </div>
                <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm self-start">
                  {[
                    { value: "all", label: "All time" },
                    { value: "week", label: "Last 7 days" },
                    { value: "month", label: "Last 30 days" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMetricsPeriod(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        metricsPeriod === opt.value
                          ? "bg-[#1A3E32] text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 transition-opacity ${
                  metricsLoading ? "opacity-60" : "opacity-100"
                }`}
              >
                {[
                  {
                    label: "Posts Published",
                    value: metrics.postsPublished,
                    icon: FileText,
                    color: "bg-blue-50 text-blue-600 border-blue-100",
                  },
                  {
                    label: "Likes Received",
                    value: metrics.likesReceived,
                    icon: Heart,
                    color: "bg-red-50 text-red-600 border-red-100",
                  },
                  {
                    label: "Comments Received",
                    value: metrics.commentsReceived,
                    icon: MessageCircle,
                    color: "bg-green-50 text-green-600 border-green-100",
                  },
                  {
                    label: "Shares Received",
                    value: metrics.sharesReceived,
                    icon: Share2,
                    color: "bg-amber-50 text-amber-600 border-amber-100",
                  },
                  {
                    label: "Views",
                    value: metrics.impressionsReceived,
                    icon: Eye,
                    color: "bg-purple-50 text-purple-600 border-purple-100",
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mb-3`}
                    >
                      <stat.icon className="w-4 h-4" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {(Number(stat.value) || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              ref={filtersBarRef}
              className={`bg-white rounded-2xl p-2 shadow-sm border border-gray-100 sticky top-2 z-20 transition-all duration-300 ease-out ${
                filtersHidden
                  ? "-translate-y-[140%] opacity-0 pointer-events-none"
                  : "translate-y-0 opacity-100"
              }`}
            >
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Filter pills */}
                <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide flex-1">
                  {filters.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFilter(f.value)}
                      className={`px-5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                        filter === f.value
                          ? "bg-[#1A3E32] text-white shadow-md shadow-[#1A3E32]/20"
                          : "bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search activity..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A3E32]/20 focus:border-[#1A3E32] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Content Feed */}
            <div className="space-y-4 pb-12">
              {jobsError && (filter === "job" || filter === "all") && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {jobsError}
                </div>
              )}
              <AnimatePresence>
                {filteredPosts.length === 0 && filteredJobs.length === 0 && !loadingPosts && !loadingJobs ? (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="text-center py-20 bg-white rounded-3xl border border-gray-100 border-dashed"
                  >
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No activity found</h3>
                    <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
                      We couldn't find any activities matching your current filters. Try adjusting your search or selecting a different tab.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {showPosts && filteredPosts.map((post) => (
                      <ActivityLogPostCard 
                        key={post.id} 
                        post={post}
                        currentUserId={mergedUser?.id}
                        currentUserPhotoUrl={currentUserImage}
                        periodMetrics={periodPostMetricsById.get(String(post.id)) || null}
                        metricsPeriod={metricsPeriod}
                        onLike={handleLike}
                        onSave={handleSave}
                        onShare={handleShare}
                        onUpdate={handleUpdatePost}
                        onDelete={handleDeletePost}
                      />
                    ))}
                    
                    {showJobs && filteredJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onView={handleViewJob}
                        isRecruiterViewer={isRecruiter}
                      />
                    ))}
                  </>
                )}
              </AnimatePresence>
              
              {(filter === "all" || filter !== "job") && (
                <div className="pt-4">
                  <FeedLoadMoreButton
                    hasMore={Boolean(nextCursor)}
                    loading={loadingPosts}
                    onLoadMore={() => fetchPosts(false)}
                    label="Load more posts"
                  />
                </div>
              )}

              {filter === "job" && (
                <div className="pt-4 flex justify-center">
                  {hasMoreJobs && (
                    <button 
                      onClick={() => fetchJobs(false)}
                      disabled={loadingJobs}
                      className="bg-white border border-gray-200 text-gray-700 font-semibold py-2.5 px-6 rounded-full hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {loadingJobs ? "Loading..." : "Load more jobs"}
                    </button>
                  )}
                </div>
              )}
            </div>
            
          </div>
        </div>
      </div>

      {isRecruiter && selectedJob && (
        <ActivityJobDetailsModal
          job={selectedJob}
          isRecruiterViewer={isRecruiter}
          loading={loadingJobDetails}
          onClose={handleCloseJobModal}
        />
      )}
    </NewsFeedLayout>
  );
}
