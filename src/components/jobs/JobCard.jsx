import {
  FaBuilding,
  FaBriefcase,
  FaUsers,
  FaBookmark,
  FaRegBookmark,
  FaMapMarkerAlt,
  FaClock,
  FaMoneyBillWave,
  FaGraduationCap,
  FaUser,
} from "react-icons/fa";
import { MdWorkOutline, MdAccessTime } from "react-icons/md";
import { formatSalary, formatTimeRemaining } from "../../utils/checksFormat";
import { profilePhotoUrl } from "../../utils/profilePhotoUrl";
import { getJobCardExcerpt } from "../../utils/jobDescription";
import VerifiedBadge from "../VerifiedBadge";
import { userHasVerifiedBadge, userShowsUnverifiedRecruiterPill } from "../../utils/verifiedBadge";
import useJobImpression from "../../hooks/useJobImpression";

export const JobCard = ({
  job,
  isSaved,
  onSave,
  onUnsave,
  onClick,
  currentUserId = null,
}) => {
  const timeRemaining = formatTimeRemaining(job.expiresAt);
  const salary = formatSalary(job);
  const companyLogoSrc = profilePhotoUrl(
    job.recruiterProfilePhoto || job.companyLogo,
  );
  const excerpt = getJobCardExcerpt(job);
  const isIndividualPoster =
    String(job.posterMode || "").toLowerCase() === "individual";
  const PosterIcon = isIndividualPoster ? FaUser : FaBuilding;
  const impressionRef = useJobImpression({
    jobId: job.id,
    postedBy: job.postedBy,
    currentUserId,
    enabled: Boolean(currentUserId),
  });

  return (
    <div
      ref={impressionRef}
      onClick={onClick}
      className="group relative bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-[#16730F]/30 hover:-translate-y-1"
    >
      {/* Featured Ribbon */}
      {job.featured && (
        <div className="absolute top-0 right-0 z-10">
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold px-4 py-1 rounded-bl-2xl shadow-md">
            ⭐ FEATURED
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6">
        {/* Mobile Header - Company Logo visible on mobile */}
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Company Logo - Hidden on very small, visible on sm and up */}
          <div className="hidden sm:block flex-shrink-0">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#16730F] to-[#1A3E32] overflow-hidden shadow-md">
              {companyLogoSrc ? (
                <img
                  src={companyLogoSrc}
                  alt={job.company}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl">
                  {job.company.charAt(0)}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {/* Title Row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-[#16730F] transition-colors line-clamp-2">
                  {job.title}
                </h3>
              </div>
              {/* Save Button - Mobile Optimized */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isSaved ? onUnsave(job.id) : onSave(job.id);
                }}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors active:bg-gray-200 flex-shrink-0"
                aria-label={isSaved ? "Unsave job" : "Save job"}
              >
                {isSaved ? (
                  <FaBookmark className="text-[#16730F] text-lg sm:text-xl" />
                ) : (
                  <FaRegBookmark className="text-gray-400 text-lg sm:text-xl hover:text-[#16730F] transition-colors" />
                )}
              </button>
            </div>

            {/* Company & Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="flex items-center gap-1 text-sm text-gray-700 font-medium">
                <PosterIcon className="text-[#16730F] text-xs" />
                <span className="truncate max-w-[150px] sm:max-w-none">
                  {job.company}
                </span>
              </span>

              {userHasVerifiedBadge(job) ? (
                <VerifiedBadge size="xs" role="recruiter" />
              ) : userShowsUnverifiedRecruiterPill(
                  { ...job, role: job.posterRole || job.role },
                  { forceRecruiter: job.posterRole !== "jobseeker" },
                ) ? (
                <VerifiedBadge size="xs" role="recruiter" unverified />
              ) : null}

              {timeRemaining.isUrgent && (
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full animate-pulse">
                  ⚡ Urgent
                </span>
              )}
            </div>

            {/* Job Details Grid - Responsive */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 mb-3">
              <span className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-lg sm:bg-transparent sm:px-0">
                <MdWorkOutline className="text-[#16730F] text-sm" />
                <span className="truncate">{job.workMode}</span>
              </span>

              <span className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-lg sm:bg-transparent sm:px-0">
                <FaMapMarkerAlt className="text-[#16730F] text-sm" />
                <span className="truncate">{job.location.split(",")[0]}</span>
              </span>

              <span className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-lg sm:bg-transparent sm:px-0">
                <FaBriefcase className="text-[#16730F] text-sm" />
                <span>{job.jobType}</span>
              </span>

              <span className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded-lg sm:bg-transparent sm:px-0">
                <FaGraduationCap className="text-[#16730F] text-sm" />
                <span>{job.experienceLevel}</span>
              </span>
            </div>

            {excerpt && (
              <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 overflow-hidden mb-3">
                {excerpt}
              </p>
            )}

            {/* Skills Tags */}
            {job.skillRequirements?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
                {job.skillRequirements.slice(0, 3).map((req, idx) => (
                  <span
                    key={idx}
                    className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full border border-gray-200"
                  >
                    {req.skill}
                    {req.experience > 0 && ` • ${req.experience}y`}
                  </span>
                ))}
                {job.skillRequirements.length > 3 && (
                  <span className="text-gray-500 text-xs px-2 py-1 bg-gray-50 rounded-full">
                    +{job.skillRequirements.length - 3} more
                  </span>
                )}
              </div>
            )}

            {/* Footer Stats */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                  <FaMoneyBillWave className="text-[#16730F] text-sm" />
                  <span>{salary}</span>
                </span>

                <span className="flex items-center gap-1.5 text-gray-600">
                  <FaUsers className="text-[#16730F] text-sm" />
                  <span>{job.applicantsCount} applicants</span>
                </span>

                <span
                  className={`flex items-center gap-1.5 text-sm ${timeRemaining.isUrgent ? "text-red-600 font-medium" : "text-gray-500"}`}
                >
                  <MdAccessTime
                    className={
                      timeRemaining.isUrgent ? "text-red-500" : "text-gray-400"
                    }
                  />
                  <span>{timeRemaining.text}</span>
                </span>
              </div>

              {/* View Details Button - Mobile */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                className="sm:hidden px-4 py-1.5 bg-[#16730F]/10 text-[#16730F] text-sm font-medium rounded-xl hover:bg-[#16730F] hover:text-white transition-all"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hover Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#16730F]/0 to-[#16730F]/0 group-hover:from-[#16730F]/5 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
    </div>
  );
};
