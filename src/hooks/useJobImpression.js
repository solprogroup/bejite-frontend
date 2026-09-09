import { useEffect, useRef } from "react";
import { recordJobImpression } from "../services/jobVacancyApi";

/** Avoid repeat API calls for the same job in one browser session. */
const recordedThisSession = new Set();

/**
 * Fires once when a job card is ~50% visible. Backend also dedupes
 * per viewer/job/UTC day and skips the poster.
 *
 * @returns {React.RefObject<HTMLElement|null>} attach to the job card root
 */
export default function useJobImpression({
  jobId,
  postedBy,
  currentUserId,
  enabled = true,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !jobId || !node) return undefined;

    if (
      postedBy != null &&
      currentUserId != null &&
      String(postedBy) === String(currentUserId)
    ) {
      return undefined;
    }

    const key = String(jobId);
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
        recordJobImpression(jobId).then((result) => {
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
  }, [jobId, postedBy, currentUserId, enabled]);

  return ref;
}
