import { useSearchParams } from "react-router-dom";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { HeroSection } from "../../../components/jobs/HeroSection";
import { SearchBar } from "../../../components/jobs/SearchBar";
import NewsFeedLayout from "../../../components/layout/NewsFeedLayout";
import { FilterSidebar } from "../../../components/forms/FilterSidebar";
import { JobDetailsModal } from "../../../components/jobs/JobDetailsModal";
import { SavedJobsModal } from "../../../components/jobs/SavedJobsModal";
import { JobCard } from "../../../components/jobs/JobCard";
import {
  getJobVacancies,
  getJobVacancyById,
} from "../../../services/jobVacancyApi";
import { toast } from "react-toastify";
import { FaBookmark, FaSpinner } from "react-icons/fa";
import { getUser } from "../../../utils/tokenManager";

const JOBS_PER_PAGE = 6;

const JobVacancyListing = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserId = getUser()?.id || null;
  const [jobs, setJobs] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedWorkMode, setSelectedWorkMode] = useState("");
  const [selectedJobType, setSelectedJobType] = useState("");
  const [selectedExperienceLevel, setSelectedExperienceLevel] = useState("");
  const [salaryRange, setSalaryRange] = useState([0, 2000000]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [savedJobs, setSavedJobs] = useState([]);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadMoreRef = useRef(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("savedJobs");
    if (saved) {
      setSavedJobs(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("savedJobs", JSON.stringify(savedJobs));
  }, [savedJobs]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const jobId = searchParams.get("jobId");
    if (!jobId) return;

    let cancelled = false;

    const openJobFromQuery = async () => {
      try {
        const response = await getJobVacancyById(jobId);
        if (!cancelled && response?.data) {
          setSelectedJob(response.data);
        }
      } catch (err) {
        console.error("Failed to open job from link:", err);
        if (!cancelled) {
          toast.error("This job vacancy is no longer available.");
        }
      }
    };

    openJobFromQuery();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const buildParams = useCallback(
    (page) => {
      const params = {
        page,
        limit: JOBS_PER_PAGE,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedIndustry) params.industry = selectedIndustry;
      if (selectedWorkMode) params.workMode = selectedWorkMode;
      if (selectedJobType) params.jobType = selectedJobType;
      if (selectedExperienceLevel) {
        params.experienceLevel = selectedExperienceLevel;
      }
      if (salaryRange[1] < 2000000) {
        params.salaryMax = salaryRange[1];
      }

      return params;
    },
    [
      debouncedSearch,
      selectedIndustry,
      selectedWorkMode,
      selectedJobType,
      selectedExperienceLevel,
      salaryRange,
    ],
  );

  const loadJobs = useCallback(
    async ({ page = 1, append = false } = {}) => {
      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setError(null);
      }

      try {
        const response = await getJobVacancies(buildParams(page));

        if (!response?.success) {
          throw new Error(response?.message || "Failed to load job vacancies");
        }

        const nextJobs = response.data?.jobs || [];
        const total = Number(response.pagination?.total) || 0;

        setIndustries(response.data?.industries || []);
        setTotalJobs(total);
        setCurrentPage(page);
        setJobs((prev) => {
          if (!append) return nextJobs;

          const seen = new Set(prev.map((job) => String(job.id)));
          const merged = [...prev];
          for (const job of nextJobs) {
            const id = String(job.id);
            if (!seen.has(id)) {
              seen.add(id);
              merged.push(job);
            }
          }
          return merged;
        });
        setHasMore(
          append
            ? page * JOBS_PER_PAGE < total && nextJobs.length > 0
            : nextJobs.length < total,
        );
      } catch (err) {
        console.error("Job vacancies load error:", err);
        if (!append) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to load job vacancies",
          );
          setJobs([]);
          setTotalJobs(0);
          setHasMore(false);
        } else {
          toast.error("Failed to load more jobs. Try again.");
        }
      } finally {
        if (append) {
          loadingMoreRef.current = false;
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [buildParams],
  );

  // Reset and reload when search/filters change.
  useEffect(() => {
    setCurrentPage(1);
    setHasMore(true);
    loadJobs({ page: 1, append: false });
  }, [loadJobs]);

  const loadMoreJobs = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore || loadingMoreRef.current) {
      return;
    }
    loadJobs({ page: currentPage + 1, append: true });
  }, [hasMore, isLoading, isLoadingMore, currentPage, loadJobs]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMore) return undefined;

    let scrollRoot = node.parentElement;
    while (scrollRoot) {
      const { overflowY } = window.getComputedStyle(scrollRoot);
      if (overflowY === "auto" || overflowY === "scroll") break;
      scrollRoot = scrollRoot.parentElement;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreJobs();
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
  }, [loadMoreJobs, jobs.length, hasMore]);

  const workModes = ["Remote", "Onsite", "Hybrid"];
  const jobTypes = [
    "Full-time",
    "Part-time",
    "Contract",
    "Internship",
    "Temporary",
  ];
  const experienceLevels = [
    "Entry",
    "Intermediate",
    "Senior",
    "Lead",
    "Executive",
  ];

  const handleSaveJob = useCallback((jobId) => {
    setSavedJobs((prev) => {
      if (!prev.some((saved) => saved.jobId === jobId)) {
        return [...prev, { jobId, savedAt: new Date().toISOString() }];
      }
      return prev;
    });
  }, []);

  const handleUnsaveJob = useCallback((jobId) => {
    setSavedJobs((prev) => prev.filter((saved) => saved.jobId !== jobId));
  }, []);

  const isJobSaved = useCallback(
    (jobId) => savedJobs.some((saved) => saved.jobId === jobId),
    [savedJobs],
  );

  const handleApply = useCallback(() => {
    if (selectedJob) {
      setJobs((prev) =>
        prev.map((job) =>
          job.id === selectedJob.id
            ? { ...job, applicantsCount: (job.applicantsCount || 0) + 1 }
            : job,
        ),
      );
    }
    toast.success("Application submitted successfully!");
  }, [selectedJob]);

  const clearFilters = useCallback(() => {
    setSelectedIndustry("");
    setSelectedWorkMode("");
    setSelectedJobType("");
    setSelectedExperienceLevel("");
    setSalaryRange([0, 2000000]);
    setSearchTerm("");
  }, []);

  return (
    <NewsFeedLayout showSidebars={false}>
      <div className="max-w-7xl mx-auto px-4 py-8 w-full box-border">
        <HeroSection />
        <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6 min-w-0">
          <div className="lg:col-span-1 min-w-0">
            <FilterSidebar
              industries={industries}
              workModes={workModes}
              jobTypes={jobTypes}
              experienceLevels={experienceLevels}
              selectedIndustry={selectedIndustry}
              selectedWorkMode={selectedWorkMode}
              selectedJobType={selectedJobType}
              selectedExperienceLevel={selectedExperienceLevel}
              salaryRange={salaryRange}
              onIndustryChange={setSelectedIndustry}
              onWorkModeChange={setSelectedWorkMode}
              onJobTypeChange={setSelectedJobType}
              onExperienceLevelChange={setSelectedExperienceLevel}
              onSalaryRangeChange={setSalaryRange}
              onClearFilters={clearFilters}
            />
          </div>

          <div className="lg:col-span-3 min-w-0">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
              <p className="text-gray-600 text-sm">
                {totalJobs > jobs.length ? (
                  <>
                    Showing{" "}
                    <span className="font-semibold text-gray-900">
                      {jobs.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-gray-900">
                      {totalJobs}
                    </span>{" "}
                    jobs
                  </>
                ) : (
                  <>
                    Showing{" "}
                    <span className="font-semibold text-gray-900">
                      {totalJobs}
                    </span>{" "}
                    jobs
                  </>
                )}
              </p>
              <div className="flex gap-3">
                {savedJobs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSavedModal(true)}
                    className="flex items-center gap-2 text-[#16730F] text-sm font-medium border border-[#16730F]/30 rounded-xl px-4 py-2 hover:bg-[#16730F]/5 transition"
                  >
                    <FaBookmark className="text-sm" /> Saved ({savedJobs.length}
                    )
                  </button>
                )}
              </div>
            </div>

            <div className="relative min-h-[28rem]">
              {isLoading && jobs.length === 0 && (
                <div className="absolute inset-0 z-10 flex items-start justify-center pt-20 bg-[#F5F5F5]/70 backdrop-blur-[1px]">
                  <FaSpinner className="animate-spin text-[#16730F] text-4xl" />
                </div>
              )}

              {jobs.length > 0 ? (
                <div aria-busy={isLoading || isLoadingMore}>
                  <div className="space-y-4">
                    {jobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        isSaved={isJobSaved(job.id)}
                        onSave={handleSaveJob}
                        onUnsave={handleUnsaveJob}
                        onClick={() => setSelectedJob(job)}
                        currentUserId={currentUserId}
                      />
                    ))}
                  </div>

                  <div
                    ref={loadMoreRef}
                    className="h-10 w-full"
                    aria-hidden
                  />

                  {isLoadingMore && (
                    <div className="flex justify-center items-center gap-2 py-6 text-[#16730F]">
                      <FaSpinner className="animate-spin" />
                      <span className="text-sm font-medium">
                        Loading more jobs...
                      </span>
                    </div>
                  )}

                  {!hasMore && !isLoadingMore && (
                    <p className="text-center text-sm text-gray-500 py-6">
                      You’ve reached the end of the list
                    </p>
                  )}
                </div>
              ) : isLoading ? (
                <div className="h-72" aria-hidden />
              ) : (
                <div className="text-center py-20 bg-gray-50 rounded-2xl">
                  <div className="text-5xl mb-4">🔍</div>
                  <h3 className="text-xl font-semibold text-gray-700">
                    No jobs found
                  </h3>
                  <p className="text-gray-500 mt-2">
                    Try adjusting your search or filters
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 text-[#16730F] hover:underline font-medium"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedJob && (
          <JobDetailsModal
            job={selectedJob}
            onClose={() => {
              setSelectedJob(null);
              if (searchParams.get("jobId")) {
                setSearchParams({}, { replace: true });
              }
            }}
            onApply={handleApply}
          />
        )}

        {showSavedModal && (
          <SavedJobsModal
            savedJobs={savedJobs}
            jobs={jobs}
            onClose={() => setShowSavedModal(false)}
            onJobClick={(job) => {
              setShowSavedModal(false);
              setSelectedJob(job);
            }}
            onUnsave={handleUnsaveJob}
          />
        )}
      </div>
    </NewsFeedLayout>
  );
};

export default JobVacancyListing;
