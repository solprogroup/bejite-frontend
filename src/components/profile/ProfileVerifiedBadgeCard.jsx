import { useNavigate } from "react-router-dom";
import { FaCheck, FaArrowRight } from "react-icons/fa";
import VerifiedBadgeIcon from "../VerifiedBadgeIcon";

const JOBSEEKER_BENEFITS = [
  "Verified badge on your profile name",
  "Weekly & monthly job application reports",
  "Access to exclusive partner events",
  "Featured profile placement",
  "Premium career resources",
];

const RECRUITER_BENEFITS = [
  "Verified Recruiter badge on your profile",
  "More trust from jobseekers you reach out to",
  "Access to exclusive partner events",
  "Weekly & monthly job posting reports",
  "Premium recruitment resources",
];

/**
 * Own-profile promo for users who do not yet have a verified badge.
 */
export default function ProfileVerifiedBadgeCard({ isRecruiter = false }) {
  const navigate = useNavigate();
  const benefits = isRecruiter ? RECRUITER_BENEFITS : JOBSEEKER_BENEFITS;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-[#1A3E32] via-[#1f4d3f] to-[#2d6a54] p-5 sm:p-6 text-white shadow-sm">
      <div className="pointer-events-none absolute -right-6 -top-6 opacity-10">
        <VerifiedBadgeIcon className="h-28 w-28" aria-hidden />
      </div>

      <div className="relative space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/10">
            <VerifiedBadgeIcon className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/90">
              Bejite Verified
            </p>
            <h3 className="text-base sm:text-lg font-bold leading-snug mt-0.5">
              {isRecruiter
                ? "Get your Verified Recruiter badge"
                : "Get a Verified Badge"}
            </h3>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-emerald-50/90 leading-relaxed">
          {isRecruiter
            ? "Upload an original ID, complete a one-time payment, and unlock trust signals that help candidates take you seriously."
            : "Stand out to recruiters with a verified profile plus job application reports, events, and featured placement."}
        </p>

        <ul className="space-y-2">
          <p> Get:</p>
          {benefits.map((benefit) => (
            <li
              key={benefit}
              className="flex items-start gap-2 text-xs sm:text-[13px] text-white/95 leading-snug"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/15">
                <FaCheck className="h-2 w-2 text-emerald-200" aria-hidden />
              </span>
              <span className="min-w-0">{benefit}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => navigate("/badge")}
          className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#1A3E32] shadow-sm transition-colors hover:bg-emerald-50 cursor-pointer"
        >
          <span>{isRecruiter ? "Start verification" : "Get verified"}</span>
          <FaArrowRight className="h-3 w-3" aria-hidden />
        </button>
      </div>
    </div>
  );
}
