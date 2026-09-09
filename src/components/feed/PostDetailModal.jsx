import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaTimes, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { toast } from "react-toastify";
import PostActions from "./PostActions";
import PostCommentsSection from "../PostCommentsSection";
import FormattedPostBody from "./FormattedPostBody";
import SharePostModal from "../SharePostModal";
import RepostModal from "../RepostModal";
import { OriginalPostNest, RepostIntro } from "./RepostChrome";
import UsersListModal from "../UsersListModal";
import usePostUsersList from "../../hooks/usePostUsersList";
import { getComments, recordImpression } from "../../services/postsApi";
import {
  buildPostShareText,
  copyPostLink,
  getPostShareUrl,
  getSocialShareUrl,
  isPublicShareablePost,
  openShareWindow,
} from "../../utils/postShare";
import {
  getUserProfileImage,
  getProfileImageUrl,
} from "../../utils/profileImageUtils";
import { formatDisplayPersonName } from "../../utils/personDisplayName";
import {
  resolvePostMediaUrl,
  getVideoPosterUrl,
  isVideoMedia,
} from "../../utils/postMediaUrl";

/**
 * Instagram-style post viewer:
 * desktop — large media left, caption/comments/actions right
 * mobile — media on top, details stacked below
 */
export default function PostDetailModal({
  isOpen,
  onClose,
  post,
  onLike,
  onSave,
  onShare,
  onRepost,
  currentUserId,
}) {
  const navigate = useNavigate();
  const media = Array.isArray(post?.media) ? post.media : [];
  const hasMedia = media.length > 0;
  const commentInputRef = useRef(null);
  const commentsSectionRef = useRef(null);
  const sidebarScrollRef = useRef(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sharedByMe, setSharedByMe] = useState(false);
  const [sharesCount, setSharesCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [reposting, setReposting] = useState(false);
  const { showLikers, usersListModalProps } = usePostUsersList();

  useEffect(() => {
    if (!isOpen || !post?.id) return;
    if (
      post.authorId != null &&
      currentUserId != null &&
      String(post.authorId) === String(currentUserId)
    ) {
      return;
    }
    recordImpression(post.id);
  }, [isOpen, post?.id, post?.authorId, currentUserId]);

  useEffect(() => {
    if (!isOpen || !post) return;
    setActiveIndex(0);
    setLiked(post.likedByMe === true);
    setSaved(post.savedByMe === true);
    setSharedByMe(post.sharedByMe === true);
    setSharesCount(Number(post.sharesCount) || 0);
    setLikesCount(Number(post.likesCount) || 0);
    setCommentsCount(Number(post.commentsCount) || 0);
    setComments([]);
    // Sync from selected post fields only; full `post` would reset on unrelated updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional field-level deps
  }, [
    isOpen,
    post?.id,
    post?.likedByMe,
    post?.savedByMe,
    post?.sharedByMe,
    post?.likesCount,
    post?.commentsCount,
    post?.sharesCount,
  ]);

  const loadComments = useCallback(async () => {
    if (!post?.id) return;
    try {
      setLoadingComments(true);
      const data = await getComments(post.id);
      setComments(data.comments || []);
    } catch (err) {
      console.error("PostDetailModal comments:", err);
    } finally {
      setLoadingComments(false);
    }
  }, [post?.id]);

  useEffect(() => {
    if (!isOpen || !post?.id) return undefined;
    loadComments();
  }, [isOpen, post?.id, loadComments]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (!hasMedia) return;
      if (e.key === "ArrowLeft") {
        setActiveIndex((i) => (i > 0 ? i - 1 : media.length - 1));
      }
      if (e.key === "ArrowRight") {
        setActiveIndex((i) => (i < media.length - 1 ? i + 1 : 0));
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose, hasMedia, media.length]);

  if (!isOpen || !post) return null;

  const author = post.author || {};
  const authorName = formatDisplayPersonName(author, "User");
  const authorImage = getProfileImageUrl(
    author.image || author.profile_photo,
  );
  const activeItem = hasMedia ? media[activeIndex] : null;
  const activeUrl = resolvePostMediaUrl(activeItem?.url);
  const activeIsVideo = isVideoMedia(activeItem);

  const goToAuthor = () => {
    if (post.authorId) {
      onClose();
      navigate(`/user-profile/${post.authorId}`);
    }
  };

  const focusComments = () => {
    commentsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    // Allow scroll to settle before focusing the input
    window.setTimeout(() => {
      commentInputRef.current?.focus({ preventScroll: true });
    }, 200);
  };

  const handleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikesCount((c) => Math.max(0, c + (next ? 1 : -1)));
    onLike?.(post.id, liked);
  };

  const handleSave = () => {
    setSaved(!saved);
    onSave?.(post.id, saved);
  };

  const isMyScheduledRepost =
    post.myRepostIsScheduled === true ||
    (post.repostIsScheduled === true &&
      String(post.repostedBy?.id) === String(currentUserId));

  const handleRepost = async () => {
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

  const handleShareOption = async (platform) => {
    try {
      if (!isPublicShareablePost(post)) {
        toast.info(
          "Only public posts show a rich preview on social media. Connections-only posts can still be shared as a link.",
        );
      }
      await onShare?.(post.id);
      const postUrl = getPostShareUrl(post.id);
      const shareText = buildPostShareText(post);
      if (platform === "copy") {
        await copyPostLink(post.id);
      } else {
        openShareWindow(
          getSocialShareUrl(platform, postUrl, { text: shareText }),
        );
      }
    } finally {
      setShowShareModal(false);
    }
  };

  const sidebar = (
    <div className="flex flex-col h-full min-h-0 bg-white relative">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="md:hidden absolute top-2 right-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-600 hover:bg-gray-100 bg-white/90"
      >
        <FaTimes className="w-3.5 h-3.5" />
      </button>

      {/* Caption + comments */}
      <div
        ref={sidebarScrollRef}
        className="flex-1 min-h-0 overflow-y-auto nfl-scroll overscroll-contain px-4 py-3 pr-12 md:pr-4 space-y-4"
      >
        {post.repostedBy ? (
          <RepostIntro
            repostedBy={post.repostedBy}
            quote={post.repostQuote}
            repostedAt={post.repostScheduledAt || post.repostedAt}
            repostIsScheduled={post.repostIsScheduled}
            currentUserId={currentUserId}
          />
        ) : null}
        <OriginalPostNest active={Boolean(post.repostedBy)}>
        {post.body ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goToAuthor}
                disabled={!post.authorId}
                className="rounded-full shrink-0 disabled:cursor-default"
                aria-label={
                  post.authorId ? `View ${authorName}'s profile` : undefined
                }
              >
                <img
                  src={authorImage}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                />
              </button>
              <button
                type="button"
                onClick={goToAuthor}
                disabled={!post.authorId}
                className="font-semibold text-sm text-[#16730F] hover:underline truncate text-left disabled:cursor-default disabled:no-underline"
              >
                {authorName}
              </button>
            </div>
            <div className="pl-11">
              <FormattedPostBody
                body={post.body}
                className="text-sm text-gray-800 whitespace-pre-wrap break-words"
              />
            </div>
          </div>
        ) : null}
        </OriginalPostNest>

        <PostCommentsSection
          postId={post.id}
          comments={comments}
          setComments={setComments}
          loading={loadingComments}
          onReload={loadComments}
          onCommentCountChange={(delta) =>
            setCommentsCount((count) => Math.max(0, count + delta))
          }
          currentUserPhotoUrl={getUserProfileImage()}
          currentUserId={currentUserId}
          inputRef={commentInputRef}
          sectionRef={commentsSectionRef}
        />
      </div>

      {/* Actions footer */}
      <div className="shrink-0 border-t border-gray-200 px-4 py-3 space-y-2 bg-white">
        <PostActions
          liked={liked}
          saved={saved}
          sharedByMe={sharedByMe}
          repostScheduled={isMyScheduledRepost}
          likesCount={likesCount}
          commentsCount={commentsCount}
          sharesCount={sharesCount}
          onLike={handleLike}
          onShowLikers={() => showLikers(post.id)}
          onComment={focusComments}
          onRepost={handleRepost}
          onShare={() => setShowShareModal(true)}
          onSave={handleSave}
        />
        {likesCount > 0 && (
          <button
            type="button"
            onClick={() => showLikers(post.id)}
            className="text-xs font-semibold text-gray-800 hover:underline"
          >
            {likesCount} like{likesCount === 1 ? "" : "s"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center bg-black/80 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Post viewer"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="hidden md:flex absolute top-4 right-4 z-[110] w-10 h-10 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
      >
        <FaTimes className="w-5 h-5" />
      </button>

      <div
        className={`relative w-full max-w-[100vw] sm:max-w-5xl lg:max-w-6xl h-[100dvh] sm:h-auto sm:max-h-[92vh] bg-black sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row ${
          hasMedia ? "" : "md:max-w-lg bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media pane */}
        {hasMedia && (
          <div className="relative bg-black flex items-center justify-center shrink-0 w-full md:w-[58%] lg:w-[62%] h-[42vh] sm:h-[48vh] md:h-[min(92vh,820px)] min-h-[220px]">
            {activeUrl ? (
              activeIsVideo ? (
                <video
                  key={activeUrl}
                  src={activeUrl}
                  poster={getVideoPosterUrl(activeItem)}
                  controls
                  playsInline
                  autoPlay
                  className="max-w-full max-h-full w-full h-full object-contain"
                />
              ) : (
                <img
                  key={activeUrl}
                  src={activeUrl}
                  alt="Post media"
                  className="max-w-full max-h-full w-full h-full object-contain"
                />
              )
            ) : (
              <p className="text-white/60 text-sm">Media unavailable</p>
            )}

            {media.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() =>
                    setActiveIndex((i) =>
                      i > 0 ? i - 1 : media.length - 1,
                    )
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
                >
                  <FaChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() =>
                    setActiveIndex((i) =>
                      i < media.length - 1 ? i + 1 : 0,
                    )
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
                >
                  <FaChevronRight className="w-3.5 h-3.5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {media.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Go to media ${idx + 1}`}
                      onClick={() => setActiveIndex(idx)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        idx === activeIndex ? "bg-white" : "bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Sidebar */}
        <div
          className={`flex-1 min-h-0 min-w-0 ${
            hasMedia
              ? "md:w-[42%] lg:w-[38%] h-[58vh] sm:h-auto md:h-[min(92vh,820px)]"
              : "w-full h-full"
          }`}
        >
          {sidebar}
        </div>
      </div>

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
      <UsersListModal {...usersListModalProps} />
    </div>
  );
}
