import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaEllipsisH,
} from "react-icons/fa";
import PostActions from "./PostActions";
import { getComments } from "../../services/postsApi";
import {
  buildPostShareText,
  copyPostLink,
  getPostShareUrl,
  getSocialShareUrl,
  isPublicShareablePost,
  openShareWindow,
} from "../../utils/postShare";
import { getUserProfileImage, getProfileImageUrl } from "../../utils/profileImageUtils";
import FormattedPostBody from "./FormattedPostBody";
import SharePostModal from "../SharePostModal";
import RepostModal from "../RepostModal";
import PostMediaGallery from "../PostMediaGallery";
import PostPoll from "./PostPoll";
import PostCommentsSection from "../PostCommentsSection";
import PostCreationModal from "../PostCreationModal";
import { formatDisplayPersonName } from "../../utils/personDisplayName";
import { getAuthorSubtitle } from "../../utils/authorDisplay";
import DisplayNameWithBadge from "../DisplayNameWithBadge";
import { OriginalPostNest, RepostIntro } from "./RepostChrome";
import UsersListModal from "../UsersListModal";
import usePostImpression from "../../hooks/usePostImpression";
import usePostUsersList from "../../hooks/usePostUsersList";

import {
  getPortaledMenuStyle,
  usePortaledMenu,
} from "../../hooks/usePortaledMenu";

const PostDetailModal = React.lazy(() => import("./PostDetailModal"));

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

const PostHeader = ({
  author,
  authorId,
  createdAt,
  showMenu,
  setShowMenu,
  onEdit,
  onDelete,
  isOwner,
}) => {
  const navigate = useNavigate();
  const { triggerRef, menuRef, menuPos } = usePortaledMenu({
    isOpen: showMenu,
    onClose: () => setShowMenu(false),
    minWidth: 128,
    maxHeight: 120,
  });
  const displayName = getDisplayName(author);
  const displayJobTitle = getAuthorSubtitle(author, authorId);
  const authorImage = getProfileImageUrl(author?.image || author?.profile_photo);

  const goToAuthorProfile = () => {
    if (authorId) navigate(`/user-profile/${authorId}`);
  };

  return (
    <div className="flex flex-row items-start justify-between gap-3 w-full">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <button
          type="button"
          onClick={goToAuthorProfile}
          disabled={!authorId}
          className="rounded-full shrink-0 disabled:cursor-default"
          aria-label={`View ${displayName}'s profile`}
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
            disabled={!authorId}
            className="font-semibold text-base sm:text-lg text-[#16730F] hover:underline text-left disabled:cursor-default disabled:no-underline max-w-full min-w-0"
          >
            <DisplayNameWithBadge
              user={author}
              fallback={displayName}
              badgeSize="xs"
              responsiveBadge
            />
          </button>
          <p className="text-[#1A3E32] text-xs sm:text-sm">{displayJobTitle}</p>
          <p className="text-[#1A3E32] text-xs sm:text-sm">{formatDate(createdAt)}</p>
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
                    onEdit();
                  }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
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
  );
};

const PostContent = ({ body, onOpenDetail, isDetailView }) => (
  <div
    role={!isDetailView && onOpenDetail ? "button" : undefined}
    tabIndex={!isDetailView && onOpenDetail ? 0 : undefined}
    onClick={(e) => {
      if (isDetailView || !onOpenDetail) return;
      if (e.target.closest("a, button")) return;
      onOpenDetail();
    }}
    onKeyDown={(e) => {
      if (isDetailView || !onOpenDetail) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpenDetail();
      }
    }}
    className={!isDetailView && onOpenDetail ? "cursor-pointer rounded-lg" : undefined}
  >
    <FormattedPostBody body={body} truncateAt={200} />
  </div>
);

const PostStats = ({
  likesCount,
  commentsCount,
  sharesCount,
  onLikesClick,
  onCommentsClick,
  onSharesClick,
  isDetailView = false,
}) => {
  if (likesCount <= 0 && commentsCount <= 0 && sharesCount <= 0) return null;

  return (
    <div
      className={`${isDetailView ? "flex" : "hidden sm:flex"} flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500`}
    >
      {likesCount > 0 && (
        <button
          type="button"
          onClick={onLikesClick}
          className="hover:underline font-medium"
        >
          {likesCount} like{likesCount > 1 ? "s" : ""}
        </button>
      )}
      {commentsCount > 0 && (
        <button
          type="button"
          onClick={onCommentsClick}
          className="hover:underline font-medium"
        >
          {commentsCount} comment{commentsCount > 1 ? "s" : ""}
        </button>
      )}
      {sharesCount > 0 && (
        <button
          type="button"
          onClick={onSharesClick}
          className="hover:underline font-medium"
        >
          {sharesCount} share{sharesCount > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
};

const PostCard = ({
  post,
  onLike,
  onSave,
  onShare,
  onRepost,
  onUpdate,
  onDelete,
  onVotePoll,
  currentUserId,
  isDetailView = false,
  defaultShowComments = false,
}) => {
  const isOwner = String(post.authorId) === String(currentUserId);
  const isRepost = Boolean(post.repostedBy);
  const showOriginalEngagement = isDetailView || !isRepost;
  const impressionRef = usePostImpression({
    postId: post.id,
    authorId: post.authorId,
    currentUserId,
  });
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [liked, setLiked] = useState(post.likedByMe === true);
  const [saved, setSaved] = useState(post.savedByMe === true);
  const [sharedByMe, setSharedByMe] = useState(post.sharedByMe === true);
  const [sharesCount, setSharesCount] = useState(post.sharesCount || 0);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [reposting, setReposting] = useState(false);

  useEffect(() => {
    setLiked(post.likedByMe === true);
    setSaved(post.savedByMe === true);
    setSharedByMe(post.sharedByMe === true);
    setSharesCount(post.sharesCount || 0);
  }, [post.id, post.likedByMe, post.savedByMe, post.sharedByMe, post.sharesCount, post.feedItemKey]);

  const openPostDetail = () => {
    if (!isDetailView) {
      setShowDetailModal(true);
    }
  };

  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const { showLikers, showSharers, usersListModalProps } = usePostUsersList();

  useEffect(() => {
    setCommentsCount(post.commentsCount || 0);
  }, [post.id, post.commentsCount]);

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

  useEffect(() => {
    if (!defaultShowComments) return;

    let cancelled = false;

    const loadComments = async () => {
      try {
        setLoadingComments(true);
        const data = await getComments(post.id);
        if (!cancelled) {
          setComments(data.comments || []);
          setShowComments(true);
        }
      } catch (err) {
        console.error("Error fetching comments:", err);
      } finally {
        if (!cancelled) setLoadingComments(false);
      }
    };

    loadComments();
    return () => {
      cancelled = true;
    };
  }, [post.id, defaultShowComments]);

  const handleCommentAction = () => {
    if (!showOriginalEngagement) {
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

  return (
    <div
      ref={impressionRef}
      id={isDetailView ? undefined : `post-${post.feedItemKey || post.id}`}
      className={
        isDetailView
          ? "space-y-4 sm:space-y-6"
          : "bg-white p-4 sm:p-6 max-w-3xl mx-auto rounded-2xl space-y-4 sm:space-y-6 mb-6"
      }
    >
      <RepostIntro
        repostedBy={post.repostedBy}
        quote={post.repostQuote}
        repostedAt={post.repostScheduledAt || post.repostedAt}
        repostIsScheduled={post.repostIsScheduled}
        currentUserId={currentUserId}
      />
      <OriginalPostNest active={isRepost}>
        <PostHeader
          author={post.author}
          authorId={post.authorId}
          createdAt={post.publishedAt}
          showMenu={showMenu}
          setShowMenu={setShowMenu}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          isOwner={isOwner}
        />
        <PostContent
          body={post.body}
          onOpenDetail={undefined}
          isDetailView={isDetailView}
        />
        {post.media && post.media.length > 0 && (
          <div
            role={!isDetailView ? "button" : undefined}
            tabIndex={!isDetailView ? 0 : undefined}
            onClick={() => {
              if (!isDetailView) openPostDetail();
            }}
            onKeyDown={(e) => {
              if (isDetailView) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPostDetail();
              }
            }}
            className={!isDetailView ? "cursor-pointer" : undefined}
          >
            <PostMediaGallery media={post.media} showFullMedia={isDetailView} />
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
      {showOriginalEngagement && (
        <PostStats
          likesCount={post.likesCount || 0}
          commentsCount={commentsCount}
          sharesCount={sharesCount}
          onLikesClick={() => showLikers(post.id)}
          onCommentsClick={handleCommentAction}
          onSharesClick={() => showSharers(post.id)}
          isDetailView={isDetailView}
        />
      )}
      <PostActions
        liked={liked}
        saved={saved}
        sharedByMe={sharedByMe}
        repostScheduled={isMyScheduledRepost}
        likesCount={post.likesCount || 0}
        commentsCount={commentsCount}
        sharesCount={sharesCount}
        hideCounts={!showOriginalEngagement}
        onLike={handleLikeClick}
        onShowLikers={() => showLikers(post.id)}
        onComment={handleCommentAction}
        onRepost={handleRepostClick}
        onShare={handleShareClick}
        onSave={handleSaveClick}
      />
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

      {showComments && showOriginalEngagement && (
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

      <UsersListModal {...usersListModalProps} />

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

      {!isDetailView && (
        <React.Suspense fallback={null}>
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
        </React.Suspense>
      )}
    </div>
  );
};

export default PostCard;
