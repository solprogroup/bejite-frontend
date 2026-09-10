import { useEffect, useRef } from "react";
import { recordImpression } from "../services/postsApi";

/** Avoid repeat API calls for the same post in one browser session. */
const recordedThisSession = new Set();

/**
 * Fires once when a post card is ~50% visible. Backend also dedupes
 * per viewer/post/UTC day and skips the author.
 *
 * @returns {React.RefObject<HTMLElement|null>} attach to the post root element
 */
export default function usePostImpression({
  postId,
  authorId,
  currentUserId,
  enabled = true,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !postId || !node) return undefined;

    if (
      authorId != null &&
      currentUserId != null &&
      String(authorId) === String(currentUserId)
    ) {
      return undefined;
    }

    const key = String(postId);
    if (recordedThisSession.has(key)) return undefined;

    let cancelled = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || cancelled) return;
        if (recordedThisSession.has(key)) {
          observer.disconnect();
          return;
        }
        recordedThisSession.add(key);
        observer.disconnect();
        recordImpression(postId).then((result) => {
          // Allow a later retry if the request failed outright.
          if (result?.error) recordedThisSession.delete(key);
        });
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [postId, authorId, currentUserId, enabled]);

  return ref;
}
