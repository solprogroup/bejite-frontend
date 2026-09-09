import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  FaImage,
  FaVideo,
  FaPoll,
  FaEllipsisH,
  FaSpinner,
} from "react-icons/fa";
import {
  getFeed,
  createPost,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  getSavedPosts,
  getPostLikes,
  getPostShares,
  getComments,
  voteOnPoll,
} from "../../services/postsApi";
import { getPostDetailPath } from "../../utils/postNavigation";
import {
  buildPostShareText,
  copyPostLink,
  getPostShareUrl,
  getSocialShareUrl,
  isPublicShareablePost,
  openShareWindow,
  recordPostShare,
  togglePostRepost,
} from "../../utils/postShare";
import {
  getUser,
  mergeAuthUsers,
  pickProfilePhotoPath,
} from "../../utils/tokenManager";
import { profileAvatarSrc } from "../../utils/profilePhotoUrl";
import { getAuthorProfileImageUrl, getUserProfileImage } from "../../utils/profileImageUtils";
import PostCreationModal from "../PostCreationModal";
import useSyncProfilePhoto from "../../hooks/useSyncProfilePhoto";
import {
  getPortaledMenuStyle,
  usePortaledMenu,
} from "../../hooks/usePortaledMenu";
import SharePostModal from "../SharePostModal";
import RepostModal from "../RepostModal";
import UsersListModal from "../UsersListModal";
import { formatDisplayPersonName } from "../../utils/personDisplayName";
import DisplayNameWithBadge from "../DisplayNameWithBadge";
import { getAuthorSubtitle } from "../../utils/authorDisplay";
import PostMediaGallery from "../PostMediaGallery";
import PostPoll from "../feed/PostPoll";
import PostActions from "../feed/PostActions";
import PostDetailModal from "../feed/PostDetailModal";
import { OriginalPostNest, RepostIntro } from "../feed/RepostChrome";
import PostCommentsSection from "../PostCommentsSection";
import FormattedPostBody from "../feed/FormattedPostBody";
import { normalizeHashtag } from "../../utils/postBodyFormat";
import AdCard from "../Ads/AdCard";
import PeopleYouMayKnowSlider from "../feed/PeopleYouMayKnowSlider";
import { getAdProFeedAds, trackAdCampaignEvent, likeAdCampaign, unlikeAdCampaign, saveAdCampaign, unsaveAdCampaign } from "../../services/adProApi";

const FEED_PAGE_SIZE = 20;

const mergeFeedPosts = (existing, incoming) => {
  const keyOf = (p) => p.feedItemKey || p.id;
  const seen = new Set(existing.map(keyOf));
  const merged = [...existing];
  for (const post of incoming) {
    const key = keyOf(post);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(post);
    }
  }
  return merged;
};

const getDisplayName = (user) => formatDisplayPersonName(user);

// Helper function to format date (LinkedIn-style)
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

export default function RecruitmentMiddle() {
  useSyncProfilePhoto();

  // this is the ads so u can use it and call the feeds endpoint
  // on it
  const [ads, setAds] = useState([]);
  const [dismissedAds, setDismissedAds] = useState(new Set());

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    try {
      const response = await getAdProFeedAds();
      setAds(response?.data?.ads || []);
    } catch (err) {
      console.error("Error fetching feed ads:", err);
      setAds([]);
    }
  };

  const handleAdInteraction = async (type, adId) => {
    try {
      await trackAdCampaignEvent(adId, type);
    } catch (err) {
      console.error(`Failed to track ad ${adId} ${type}:`, err);
    }
  };

  const patchAd = (adId, patch) => {
    setAds((prev) =>
      prev.map((ad) => (String(ad.id) === String(adId) ? { ...ad, ...patch } : ad)),
    );
  };

  const handleAdLike = async (adId, isLiked) => {
    if (isLiked) {
      await unlikeAdCampaign(adId);
    } else {
      await likeAdCampaign(adId);
    }
    const ad = ads.find((item) => String(item.id) === String(adId));
    patchAd(adId, {
      likedByMe: !isLiked,
      likesCount: Math.max(0, (Number(ad?.likesCount) || 0) + (isLiked ? -1 : 1)),
    });
  };

  const handleAdSave = async (adId, isSaved) => {
    if (isSaved) {
      await unsaveAdCampaign(adId);
    } else {
      await saveAdCampaign(adId);
    }
    const ad = ads.find((item) => String(item.id) === String(adId));
    patchAd(adId, {
      savedByMe: !isSaved,
      savesCount: Math.max(0, (Number(ad?.savesCount) || 0) + (isSaved ? -1 : 1)),
    });
  };

  const handleAdShareCount = (adId, sharesCount) => {
    patchAd(adId, { sharesCount });
  };

  const handleVotePoll = async (postId, optionId) => {
    const data = await voteOnPoll(postId, optionId);
    if (data?.poll) {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, poll: data.poll } : post,
        ),
      );
    }
    return data;
  };

  const openCreateModal = (mode = "post") => {
    setModalMode(mode);
    setShowModal(true);
  };

  const handleDismissAd = (adId) => {
    setDismissedAds((prev) => new Set([...prev, adId]));
  };

  const visibleAds = ads.filter((ad) => !dismissedAds.has(ad.id));

  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("post");
  const loadMoreRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const feedMode = searchParams.get("feed") === "saved" ? "saved" : "home";
  const feedHashtag = normalizeHashtag(
    searchParams.get("hashtag") || searchParams.get("tag") || "",
  );
  const sharedPostId =
    searchParams.get("post") || searchParams.get("postId") || null;
  const reduxUser = useSelector((state) => state.auth?.user);

  const mergedUser = useMemo(() => {
    void location.pathname;
    return mergeAuthUsers(getUser() || {}, reduxUser);
  }, [reduxUser, location.pathname]);

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

  useEffect(() => {
    if (feedMode === "saved") {
      fetchSavedPosts();
    } else {
      fetchFeed();
    }
  }, [feedMode, feedHashtag]);

  useEffect(() => {
    if (!sharedPostId) return;
    navigate(getPostDetailPath(sharedPostId), { replace: true });
  }, [sharedPostId, navigate]);

  const fetchSavedPosts = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getSavedPosts(FEED_PAGE_SIZE, null, {
        hashtag: feedHashtag || undefined,
      });
      setPosts(data.posts || []);
      setNextCursor(data.nextCursor ?? null);
      if (!silent) setError(null);
    } catch (err) {
      console.error("Error fetching saved posts:", err);
      if (!silent) setError("Failed to load saved posts");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const refreshPosts = (silent = false) => {
    if (feedMode === "saved") {
      return fetchSavedPosts(silent);
    }
    return fetchFeed(silent);
  };

  const fetchFeed = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getFeed(FEED_PAGE_SIZE, null, {
        hashtag: feedHashtag || undefined,
      });
      setPosts(data.posts || []);
      setNextCursor(data.nextCursor ?? null);
      if (!silent) setError(null);
    } catch (err) {
      console.error("Error fetching feed:", err);
      if (!silent) setError("Failed to load posts");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMorePosts = useCallback(async () => {
    if (!nextCursor || loadingMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      setLoadingMore(true);
      const data =
        feedMode === "saved"
          ? await getSavedPosts(FEED_PAGE_SIZE, nextCursor, {
              hashtag: feedHashtag || undefined,
            })
          : await getFeed(FEED_PAGE_SIZE, nextCursor, {
              hashtag: feedHashtag || undefined,
            });
      setPosts((prev) => mergeFeedPosts(prev, data.posts || []));
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      console.error("Error loading more posts:", err);
      toast.error("Failed to load more posts. Try again.");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, feedMode, feedHashtag]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !nextCursor) return undefined;

    let scrollRoot = node.parentElement;
    while (scrollRoot) {
      const { overflowY } = window.getComputedStyle(scrollRoot);
      if (overflowY === "auto" || overflowY === "scroll") break;
      scrollRoot = scrollRoot.parentElement;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMorePosts();
        }
      },
      {
        root: scrollRoot || null,
        rootMargin: "240px 0px",
        threshold: 0,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMorePosts, nextCursor, posts.length]);

  const patchPost = (postId, patch) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
    );
  };

  const handleLike = async (postId, isLiked) => {
    const current = posts.find((p) => p.id === postId);
    patchPost(postId, {
      likedByMe: !isLiked,
      likesCount: Math.max(
        0,
        (current?.likesCount || 0) + (isLiked ? -1 : 1),
      ),
    });
    try {
      if (isLiked) {
        await unlikePost(postId);
      } else {
        await likePost(postId);
      }
    } catch (err) {
      console.error("Error toggling like:", err);
      patchPost(postId, {
        likedByMe: isLiked,
        likesCount: current?.likesCount || 0,
      });
    }
  };

  const handleShare = async (postId) => {
    try {
      await recordPostShare(postId);
      const current = posts.find((p) => p.id === postId);
      if (!current?.sharedByMe) {
        patchPost(postId, {
          sharesCount: (current?.sharesCount || 0) + 1,
          sharedByMe: true,
        });
      }
    } catch (err) {
      console.error("Error sharing post:", err);
    }
  };

  const handleRepost = async (postId, currentlyShared, quote = null, scheduledAt = null) => {
    await togglePostRepost(postId, currentlyShared, quote, scheduledAt);
    refreshPosts();
  };

  const handleSave = async (postId, isSaved) => {
    try {
      if (isSaved) {
        await unsavePost(postId);
        if (feedMode === "saved") {
          setPosts((prev) => prev.filter((p) => p.id !== postId));
        } else {
          patchPost(postId, { savedByMe: false });
        }
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
      refreshPosts();
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
      throw err;
    }
  };

  return (
    <main className="w-full px-2 py-6 space-y-8 bg-[#F5F5F5]" data-testid="news-feed">
      {/* Create Post Button */}
      <div className="max-w-3xl p-6 mx-auto bg-white shadow rounded-2xl">
        <div
          className="flex items-center gap-3 cursor-pointer"
          data-testid="news-feed-start-post"
          onClick={() => openCreateModal("post")}
        >
          <img
            src={currentUserImage}
            alt="profile"
            className="rounded-full w-12 h-12 object-cover object-center"
          />
          <div className="flex-1 bg-gray-100 rounded-full px-4 py-3 text-gray-500 hover:bg-gray-200 transition-colors">
            Start a post
          </div>
        </div>
        <div className="flex items-center justify-around mt-3 pt-3 border-t border-[#A9A9A9]">
          <button
            onClick={() => openCreateModal("post")}
            className="flex items-center gap-2 text-[#1A3E32] hover:bg-gray-100 px-4 py-2 rounded-lg"
          >
            <img
              src="/assets/images/gallery.svg"
              alt="Image"
              className="w-5 h-5"
            />
            <span className="text-sm">Image</span>
          </button>
          <button
            onClick={() => openCreateModal("post")}
            className="flex items-center gap-2 text-[#1A3E32] hover:bg-gray-100 px-4 py-2 rounded-lg"
          >
            <img
              src="/assets/images/video-square.png"
              alt="Video"
              className="w-5 h-5"
            />
            <span className="text-sm">Video</span>
          </button>
          <button
            onClick={() => openCreateModal("poll")}
            className="flex items-center gap-2 text-[#1A3E32] hover:bg-gray-100 px-4 py-2 rounded-lg"
          >
            <img
              src="/assets/images/Amount_Icon_UIA.svg"
              alt="Poll"
              className="w-5 h-5"
            />
            <span className="text-sm">Poll</span>
          </button>
        </div>
      </div>

      <hr className="border-t-2 border-[#16730F]" />

      {feedHashtag && (
        <div className="max-w-3xl mx-auto flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1A3E32]">
            {feedMode === "saved" ? "Saved posts tagged" : "Posts tagged"} #
            {feedHashtag}
          </h2>
          <button
            type="button"
            onClick={() =>
              navigate(feedMode === "saved" ? "/news-feed?feed=saved" : "/news-feed")
            }
            className="text-sm text-[#16730F] hover:underline font-medium"
          >
            Clear tag
          </button>
        </div>
      )}

      {feedMode === "saved" && (
        <div className="max-w-3xl mx-auto flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1A3E32]">Saved posts</h2>
          <button
            type="button"
            onClick={() => navigate("/news-feed")}
            className="text-sm text-[#16730F] hover:underline font-medium"
          >
            Back to feed
          </button>
        </div>
      )}

      {/* Posts Feed */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">
          {feedMode === "saved" ? "Loading saved posts..." : "Loading posts..."}
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {feedMode === "saved"
            ? "No saved posts yet. Save posts from your feed to see them here."
            : "No posts yet. Be the first to post!"}
        </div>
      ) : (
        <>
          {posts.map((post, index) => (
            <React.Fragment key={post.feedItemKey || post.id}>
              <div id={`post-${post.feedItemKey || post.id}`}>
                <RecruitmentPostCard
                  key={post.feedItemKey || post.id}
                  post={post}
                currentUserId={mergedUser?.id}
                currentUserPhotoUrl={currentUserImage}
                onLike={handleLike}
                onSave={handleSave}
                onShare={handleShare}
                onRepost={handleRepost}
                onUpdate={handleUpdatePost}
                onDelete={handleDeletePost}
                onVotePoll={handleVotePoll}
              />
              </div>
              {/* this is ads so is just dummy for now  */}
              {/* it will display after three posts u can use it */}
              {(index + 1) % 3 === 0 && visibleAds.length > 0 && (
                <AdCard
                  ad={visibleAds[Math.floor(index / 3) % visibleAds.length]}
                  onInteraction={handleAdInteraction}
                  onLike={handleAdLike}
                  onSave={handleAdSave}
                  onShare={handleAdShareCount}
                  onClose={handleDismissAd}
                />
              )}

              {/* People You May Know slider (Facebook-style, shown after 4 posts) */}
              {feedMode === "home" &&
                ((index + 1) === 4 ||
                  (posts.length < 4 && index === posts.length - 1)) && (
                  <PeopleYouMayKnowSlider
                    currentUserId={mergedUser?.id}
                    currentUser={mergedUser}
                  />
                )}
            </React.Fragment>
          ))}
          {nextCursor && (
            <div ref={loadMoreRef} className="h-10 w-full" aria-hidden />
          )}
          {loadingMore && (
            <div className="flex justify-center items-center gap-2 py-6 text-[#16730F]">
              <FaSpinner className="animate-spin" />
              <span className="text-sm font-medium">Loading more posts...</span>
            </div>
          )}
          {!nextCursor && posts.length > 0 && !loadingMore && (
            <p className="text-center text-sm text-gray-500 py-6">
              You’ve reached the end of the feed
            </p>
          )}
        </>
      )}
      <PostCreationModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setModalMode("post");
        }}
        initialMode={modalMode}
        onPost={async (postData) => {
          const data = await createPost(postData);
          const newPost = data?.post;
          if (feedMode === "home" && newPost?.status === "published") {
            setPosts((prev) =>
              prev.some((p) => p.id === newPost.id) ? prev : [newPost, ...prev],
            );
          }
        }}
      />
    </main>
  );
}

const RecruitmentPostCard = ({
  post,
  onLike,
  onSave,
  onShare,
  onRepost,
  onUpdate,
  onDelete,
  onVotePoll,
  currentUserId,
  currentUserPhotoUrl,
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

  const navigate = useNavigate();
  const [showDetailModal, setShowDetailModal] = useState(false);

  const openPostDetail = () => {
    setShowDetailModal(true);
  };

  const isOwner = String(post.authorId) === String(currentUserId);
  const isRepost = Boolean(post.repostedBy);
  const [liked, setLiked] = useState(post.likedByMe === true);
  const [saved, setSaved] = useState(post.savedByMe === true);
  const [sharedByMe, setSharedByMe] = useState(post.sharedByMe === true);
  const [sharesCount, setSharesCount] = useState(post.sharesCount || 0);
  const [reposting, setReposting] = useState(false);

  useEffect(() => {
    setLiked(post.likedByMe === true);
    setSaved(post.savedByMe === true);
    setSharedByMe(post.sharedByMe === true);
    setSharesCount(post.sharesCount || 0);
  }, [post.id, post.likedByMe, post.savedByMe, post.sharedByMe, post.sharesCount, post.feedItemKey]);
  const [showMenu, setShowMenu] = useState(false);
  const { triggerRef, menuRef, menuPos } = usePortaledMenu({
    isOpen: showMenu,
    onClose: () => setShowMenu(false),
    minWidth: 128,
    maxHeight: 120,
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);

  useEffect(() => {
    setCommentsCount(post.commentsCount || 0);
  }, [post.id, post.commentsCount]);

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

  const toggleComments = () => {
    if (!showComments) {
      fetchComments();
    }
    setShowComments(!showComments);
  };

  const handleCommentAction = () => {
    if (isRepost) {
      openPostDetail();
      return;
    }
    toggleComments();
  };

  const handleLikeClick = () => {
    setLiked(!liked);
    onLike(post.id, liked);
  };

  const handleSaveClick = () => {
    setSaved(!saved);
    onSave(post.id, saved);
  };

  const isMyScheduledRepost =
    post.myRepostIsScheduled === true ||
    (post.repostIsScheduled === true &&
      String(post.repostedBy?.id) === String(currentUserId));

  const handleRepostClick = async () => {
    if (!onRepost || reposting) return;
    if (sharedByMe && isMyScheduledRepost) {
      setShowRepostModal(true);
      return;
    }
    if (sharedByMe) {
      const previousCount = sharesCount;
      setSharedByMe(false);
      setSharesCount(Math.max(0, previousCount - 1));
      setReposting(true);
      try {
        await onRepost(post.id, true);
      } catch {
        setSharedByMe(true);
        setSharesCount(previousCount);
      } finally {
        setReposting(false);
      }
      return;
    }
    setShowRepostModal(true);
  };

  const handleRepostConfirm = async (quote, scheduledAt = null) => {
    if (!onRepost || reposting) return;
    const alreadyShared = sharedByMe;
    const wasScheduled = isMyScheduledRepost;
    const willBeScheduled = Boolean(scheduledAt);
    const previousCount = sharesCount;
    const wasLive = alreadyShared && !wasScheduled;
    const willBeLive = !willBeScheduled;

    setSharedByMe(true);
    if (!wasLive && willBeLive) setSharesCount(previousCount + 1);
    if (wasLive && !willBeLive) setSharesCount(Math.max(0, previousCount - 1));
    setReposting(true);
    try {
      await onRepost(post.id, false, quote, scheduledAt);
      setShowRepostModal(false);
    } catch {
      setSharedByMe(alreadyShared);
      setSharesCount(previousCount);
    } finally {
      setReposting(false);
    }
  };

  const handleRepostRemove = async () => {
    if (!onRepost || reposting) return;
    const previousCount = sharesCount;
    const wasLive = sharedByMe && !isMyScheduledRepost;
    setSharedByMe(false);
    if (wasLive) setSharesCount(Math.max(0, previousCount - 1));
    setReposting(true);
    try {
      await onRepost(post.id, true);
      setShowRepostModal(false);
    } catch {
      setSharedByMe(true);
      setSharesCount(previousCount);
    } finally {
      setReposting(false);
    }
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

  // Function to show users who liked
  const handleShowLikers = async () => {
    try {
      setUsersListTitle("People who liked");
      setUsersListType("likes");
      setUsersListLoading(true);
      setUsersListModalOpen(true);
      const data = await getPostLikes(post.id);
      console.log("Likes response:", data);
      // Handle response formats: { likers: [...] }, { users: [...] }, { likes: [...] }, { data: [...] }, or direct array
      let usersList = [];
      if (data?.likers) {
        usersList = data.likers;
      } else if (data?.users) {
        usersList = data.users;
      } else if (data?.likes) {
        usersList = data.likes;
      } else if (data?.data) {
        usersList = data.data;
      } else if (Array.isArray(data)) {
        usersList = data;
      }
      // Normalize user objects to have id property (some APIs use userId)
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

  // Function to show users who shared
  const handleShowSharers = async () => {
    try {
      setUsersListTitle("People who shared");
      setUsersListType("shares");
      setUsersListLoading(true);
      setUsersListModalOpen(true);
      const data = await getPostShares(post.id);
      console.log("Shares response:", data);
      // Handle response formats: { sharers: [...] }, { users: [...] }, { shares: [...] }, { data: [...] }, or direct array
      let usersList = [];
      if (data?.sharers) {
        usersList = data.sharers;
      } else if (data?.users) {
        usersList = data.users;
      } else if (data?.shares) {
        usersList = data.shares;
      } else if (data?.data) {
        usersList = data.data;
      } else if (Array.isArray(data)) {
        usersList = data;
      }
      // Normalize user objects to have id property (some APIs use userId)
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
  // For current user's posts, prioritize local image over API data
  const isCurrentUserPost = String(post.authorId) === String(currentUserId);
  const authorImage = isCurrentUserPost
    ? syncedCurrentUserPhoto
    : getAuthorProfileImageUrl(post.author);

  return (
    <div className="max-w-3xl p-4 sm:p-6 mx-auto space-y-4 sm:space-y-6 bg-white shadow rounded-2xl">
      <RepostIntro
        repostedBy={post.repostedBy}
        quote={post.repostQuote}
        repostedAt={post.repostScheduledAt || post.repostedAt}
        repostIsScheduled={post.repostIsScheduled}
        currentUserId={currentUserId}
      />
      <OriginalPostNest active={Boolean(post.repostedBy)}>
      {/* Post Header */}
      <div className="flex flex-row items-start justify-between gap-3 w-full">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={goToAuthorProfile}
            disabled={!post.authorId}
            className="rounded-full shrink-0 disabled:cursor-default"
            aria-label={`View ${authorName}'s profile`}
          >
            <img
              src={authorImage}
              alt="profile"
              className="rounded-full w-10 h-10 sm:w-12 sm:h-12 object-cover object-center cursor-pointer hover:opacity-90"
            />
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={goToAuthorProfile}
              disabled={!post.authorId}
              className="font-semibold text-base sm:text-lg text-[#16730F] hover:underline text-left disabled:cursor-default disabled:no-underline max-w-full min-w-0"
            >
              <DisplayNameWithBadge
                user={post.author}
                fallback={authorName}
                badgeSize="xs"
                responsiveBadge
              />
            </button>
            <p className="text-[#1A3E32] text-xs sm:text-sm">
              {authorJobTitle}
            </p>
            <p className="text-[#1A3E32] text-xs sm:text-sm">
              {formatDate(post.publishedAt)}
            </p>
          </div>
        </div>
        {isOwner && (
          <div className="relative shrink-0 self-start">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 -mr-1 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Post options"
              aria-expanded={showMenu}
            >
              <FaEllipsisH className="text-base" />
            </button>
            {showMenu &&
              menuPos &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  ref={menuRef}
                  className="bg-white shadow-lg rounded-lg py-2 border border-[#D3D3D3]"
                  style={getPortaledMenuStyle(menuPos)}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleEditClick();
                    }}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
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

      {/* Post Content */}
      <div className="rounded-lg">
        <FormattedPostBody body={post.body} truncateAt={200} />
      </div>

      {post.media && post.media.length > 0 && (
        <div
          role="button"
          tabIndex={0}
          onClick={openPostDetail}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPostDetail();
            }
          }}
          className="cursor-pointer"
        >
          <PostMediaGallery media={post.media} />
        </div>
      )}

      {post.poll && (
        <PostPoll
          poll={post.poll}
          onVote={async (optionId) => {
            if (!onVotePoll) return;
            await onVotePoll(post.id, optionId);
          }}
        />
      )}
      </OriginalPostNest>

      {!isRepost && (
      <div className="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500">
        {post.likesCount > 0 && (
          <button
            onClick={handleShowLikers}
            className="hover:underline font-medium"
          >
            {post.likesCount} like{post.likesCount > 1 ? "s" : ""}
          </button>
        )}
        {commentsCount > 0 && (
          <button
            type="button"
            onClick={handleCommentAction}
            className="hover:underline font-medium"
          >
            {commentsCount} comment{commentsCount > 1 ? "s" : ""}
          </button>
        )}
        {post.sharesCount > 0 && (
          <button
            onClick={handleShowSharers}
            className="hover:underline font-medium"
          >
            {sharesCount} repost{sharesCount > 1 ? "s" : ""}
          </button>
        )}
      </div>
      )}

      <PostActions
        liked={liked}
        saved={saved}
        sharedByMe={sharedByMe}
        repostScheduled={isMyScheduledRepost}
        likesCount={post.likesCount || 0}
        commentsCount={commentsCount}
        sharesCount={sharesCount}
        hideCounts={isRepost}
        onLike={handleLikeClick}
        onShowLikers={handleShowLikers}
        onComment={handleCommentAction}
        onRepost={handleRepostClick}
        onShare={handleShareClick}
        onSave={handleSaveClick}
      />

      {showComments && !isRepost && (
        <PostCommentsSection
          postId={post.id}
          comments={comments}
          setComments={setComments}
          loading={loadingComments}
          onReload={() => fetchComments(true)}
          onCommentCountChange={(delta) =>
            setCommentsCount((count) => Math.max(0, count + delta))
          }
          currentUserPhotoUrl={getUserProfileImage()}
          currentUserId={currentUserId}
        />
      )}

      <SharePostModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShare={handleShareOption}
      />
      <RepostModal
        isOpen={showRepostModal}
        onClose={() => setShowRepostModal(false)}
        post={post}
        onConfirm={handleRepostConfirm}
        onRemove={handleRepostRemove}
        submitting={reposting}
        isEditing={sharedByMe && isMyScheduledRepost}
        initialQuote={
          post.myRepostQuote ||
          (isMyScheduledRepost ? post.repostQuote : "") ||
          ""
        }
        initialScheduledAt={
          post.myRepostScheduledAt ||
          (isMyScheduledRepost ? post.repostScheduledAt : null)
        }
      />

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

      {/* Users List Modal */}
      <UsersListModal
        isOpen={usersListModalOpen}
        onClose={() => setUsersListModalOpen(false)}
        title={usersListTitle}
        users={usersListUsers}
        loading={usersListLoading}
        type={usersListType}
      />

      <PostDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        post={post}
        onLike={onLike}
        onSave={onSave}
        onShare={onShare}
        onRepost={onRepost}
        currentUserId={currentUserId}
      />
    </div>
  );
};
