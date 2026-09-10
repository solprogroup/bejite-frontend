import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  FaPlus,
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaCheckCircle,
  FaTimesCircle,
  FaPencilAlt,
  FaTimes,
  FaArrowLeft,
} from "react-icons/fa";
import NewsFeedLayout from "../../components/layout/NewsFeedLayout";
import RecruitmentStatCard from "../../components/recruitment-management/RecruitmentStatCard";
import RecruitmentFilterBar from "../../components/recruitment-management/RecruitmentFilterBar";
import RecruitmentListTable from "../../components/recruitment-management/RecruitmentListTable";
import PipelineFlow from "../../components/recruitment-management/PipelineFlow";
import CandidateListTable from "../../components/recruitment-management/CandidateListTable";
import EditRecruitmentModal from "../../components/recruitment-management/EditRecruitmentModal";
import CloseRecruitmentModal from "../../components/recruitment-management/CloseRecruitmentModal";
import CreateRecruitmentModal from "../../components/recruitment-management/CreateRecruitmentModal";
import StageBuilderModal from "../../components/recruitment-management/StageBuilderModal";
import EditPipelineStageModal from "../../components/recruitment-management/EditPipelineStageModal";
import CandidateProfileModal from "../../components/recruitment-management/CandidateProfileModal";
import RecruitmentAuditLog from "../../components/recruitment-management/RecruitmentAuditLog";
import CandidateFeedbackModal from "../../components/recruitment-management/CandidateFeedbackModal";
import MoveCandidateModal from "../../components/recruitment-management/MoveCandidateModal";
import InterviewStagesList from "../../components/recruitment-management/InterviewStagesList";
import RecruitmentManagementTour from "../../components/recruitment-management/RecruitmentManagementTour";
import { toast } from "react-toastify";
import {
  getEmployerDashboard,
  getJobApplications,
  createEmployerJob,
  updateEmployerJob,
  closeEmployerJob,
  getJobPipeline,
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
  moveApplicationStage,
  createApplicationFeedback,
  getJobAuditLogs,
} from "../../services/employerApi";
import messagingService from "../../services/messagingService";
import { checkASEEligibility } from "../../services/paymentApi";
import { profilePhotoUrl } from "../../utils/profilePhotoUrl";

const STATUS_META = {
  pending: {
    label: "Screening",
    description: "Initial application screening",
  },
  reviewed: {
    label: "Under Review",
    description: "Applications currently being reviewed",
  },
  shortlisted: {
    label: "Tech Interview",
    description: "Technical interview stage",
  },
  hired: {
    label: "Hired",
    description: "Candidates successfully hired",
  },
  rejected: {
    label: "Rejected",
    description: "Candidates not moving forward",
  },
};

const formatRelativeTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const statusLabel = (status) => STATUS_META[status]?.label || "Applied";

const outcomeFromStatus = (status) => {
  if (status === "hired") return "Hired";
  if (status === "rejected") return "Rejected";
  if (status === "shortlisted") return "Pending";
  return "Pending";
};

const formatActiveStageLabel = (stageName, sortOrder, { closed = false } = {}) => {
  if (closed) return "Closed";
  if (!stageName) return "Stage 1: Screening";
  const step = Number.isFinite(Number(sortOrder))
    ? Number(sortOrder) + 1
    : 1;
  return `Stage ${step}: ${stageName}`;
};

const mapJobToExercise = (job) => {
  const isOpen =
    String(job.dbStatus || "").toLowerCase() !== "closed" &&
    job.status === "active";
  const position = job.roles || job.industry || "—";
  const createdAt = job.postedAt || job.createdAt || null;
  return {
    id: String(job.id),
    title: job.title || "Untitled job",
    position,
    department: job.industry || "Engineering",
    activeStage: formatActiveStageLabel(
      job.activeStageName,
      job.activeStageSortOrder,
      { closed: !isOpen },
    ),
    activePipelineStageId: job.activePipelineStageId || null,
    activeStageName: job.activeStageName || null,
    activeStageSortOrder:
      job.activeStageSortOrder != null ? Number(job.activeStageSortOrder) : null,
    invited: Number(job.applications) || 0,
    accepted: 0,
    declined: 0,
    passed: 0,
    failed: 0,
    hired: 0,
    status: isOpen ? "Open" : "Closed",
    lastUpdated: formatRelativeTime(createdAt),
    createdDate: formatDate(createdAt),
    createdAt,
    description: job.description || "",
    rawJob: job,
    candidates: [],
    pipeline: [],
    stagesList: [],
    auditLogs: [],
    appStats: null,
  };
};

const mapApplicationToCandidate = (app) => ({
  id: app.id,
  candidateId: app.candidateId,
  userId: app.userId,
  name: app.name || "Unknown Candidate",
  email: app.email || "",
  phone: app.phone || "",
  title: app.title || app.education || "",
  avatar: profilePhotoUrl(app.profilePhoto),
  currentStage: app.pipelineStageName || statusLabel(app.status),
  pipelineStageId: app.pipelineStageId || null,
  statusKey: app.status || "pending",
  outcome: app.latestFeedback?.outcome || outcomeFromStatus(app.status),
  matchScore: app.matchScore,
  score: app.matchScore,
  experience: app.experience,
  skills: app.skills || [],
  location: app.location,
  coverLetter: app.coverLetter,
  appliedAt: app.appliedAt,
  applicationDate: app.appliedAt,
  latestFeedback: app.latestFeedback || null,
  raw: app,
});

const mapApiStagesToPipeline = (stages = []) =>
  stages.map((stg, index) => ({
    id: stg.id,
    step: String(index + 1).padStart(2, "0"),
    name: stg.name,
    title: stg.name || "Stage",
    count: Number(stg.count) || 0,
  }));

const mapApiStagesToList = (stages = []) =>
  stages.map((stg) => ({
    id: stg.id,
    name: stg.name,
    description: stg.description || "",
    interviewer: stg.interviewer || "Recruiter",
    duration: stg.duration || `${stg.durationMins || 60} mins`,
    durationMins: stg.durationMins || 60,
    count: Number(stg.count) || 0,
    status: stg.status || "Not Started",
  }));

const applyStoredActiveStage = (exercise, jobMeta = {}, { closed = false } = {}) => {
  const stageName =
    jobMeta.activeStageName ||
    exercise?.activeStageName ||
    null;
  const sortOrder =
    jobMeta.activeStageSortOrder != null
      ? Number(jobMeta.activeStageSortOrder)
      : exercise?.activeStageSortOrder != null
        ? Number(exercise.activeStageSortOrder)
        : null;
  const stageId =
    jobMeta.activePipelineStageId ||
    exercise?.activePipelineStageId ||
    null;

  return {
    activePipelineStageId: stageId,
    activeStageName: stageName,
    activeStageSortOrder: sortOrder,
    activeStage: formatActiveStageLabel(stageName, sortOrder, { closed }),
  };
};

export default function RecruitmentManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeJobId } = useParams();

  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);

  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [closing, setClosing] = useState(false);
  const [moving, setMoving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState("candidates");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateStageFilter, setCandidateStageFilter] = useState("all");
  const [candidateOutcomeFilter, setCandidateOutcomeFilter] = useState("all");
  const [candidateSort, setCandidateSort] = useState("newest");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isStageBuilderOpen, setIsStageBuilderOpen] = useState(false);
  const [editingPipelineStage, setEditingPipelineStage] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [feedbackCandidate, setFeedbackCandidate] = useState(null);
  const [bulkFeedbackCandidates, setBulkFeedbackCandidates] = useState([]);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [moveCandidate, setMoveCandidate] = useState(null);
  const [bulkMoveCandidates, setBulkMoveCandidates] = useState([]);
  const [selectionResetKey, setSelectionResetKey] = useState(0);
  const [viewProfileCandidate, setViewProfileCandidate] = useState(null);
  const [profileInitialTab, setProfileInitialTab] = useState("overview");
  const [recruitmentAccess, setRecruitmentAccess] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);

  const loadRecruitmentAccess = useCallback(async () => {
    setAccessLoading(true);
    try {
      const eligibility = await checkASEEligibility();
      setRecruitmentAccess({
        allowed: eligibility?.recruitmentAllowed !== false,
        canCreate: eligibility?.canCreateRecruitmentExercise !== false,
        remaining:
          eligibility?.remainingRecruitmentExercises != null
            ? Number(eligibility.remainingRecruitmentExercises)
            : null,
        limit:
          eligibility?.recruitmentExerciseLimit != null
            ? Number(eligibility.recruitmentExerciseLimit)
            : 2,
        used:
          eligibility?.usedRecruitmentExercises != null
            ? Number(eligibility.usedRecruitmentExercises)
            : null,
        accessType:
          eligibility?.recruitmentAccessType ||
          eligibility?.accessType ||
          "none",
        message: eligibility?.recruitmentMessage || eligibility?.message,
        code: eligibility?.recruitmentCode,
      });
    } catch (err) {
      console.error("Recruitment access check failed:", err);
      // Fail closed for create; still allow UI to show upgrade path
      setRecruitmentAccess({
        allowed: false,
        canCreate: false,
        remaining: 0,
        limit: 2,
        used: null,
        accessType: "none",
        message:
          "Unable to verify subscription. Subscribe to access Recruitment Management.",
        code: "PAYMENT_REQUIRED",
      });
    } finally {
      setAccessLoading(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const dashboardRes = await getEmployerDashboard({
        status: "all",
        listing_kind: "recruitment",
      });

      if (!dashboardRes?.success) {
        throw new Error(dashboardRes?.message || "Failed to load jobs");
      }

      const jobs = dashboardRes.data?.jobs || [];
      setExercises(jobs.map(mapJobToExercise));
    } catch (err) {
      console.error("Recruitment list load error:", err);
      const code = err.response?.data?.code;
      if (code === "PAYMENT_REQUIRED" || err.response?.status === 403) {
        setRecruitmentAccess((prev) => ({
          ...(prev || {}),
          allowed: false,
          canCreate: false,
          remaining: 0,
          accessType: "none",
          message:
            err.response?.data?.message ||
            "Subscribe to access Recruitment Management.",
          code: code || "PAYMENT_REQUIRED",
        }));
        setExercises([]);
        setListError(null);
        return;
      }
      setListError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load recruitment exercises",
      );
      setExercises([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (jobId, baseExercise) => {
    if (!jobId) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [appsRes, pipelineRes, auditRes] = await Promise.all([
        getJobApplications(jobId),
        getJobPipeline(jobId),
        getJobAuditLogs(jobId, { limit: 50 }).catch(() => ({ data: [] })),
      ]);

      if (!appsRes?.success) {
        throw new Error(appsRes?.message || "Failed to load applications");
      }

      const apps = appsRes.data?.applications || [];
      const stats = appsRes.data?.stats || {};
      const jobTitle = appsRes.data?.job?.title;
      const apiStages = pipelineRes?.data?.stages || [];
      const pipelineJob = pipelineRes?.data?.job || {};
      const auditLogs = Array.isArray(auditRes?.data) ? auditRes.data : [];

      const candidates = apps.map(mapApplicationToCandidate);
      const stagesList = mapApiStagesToList(apiStages);
      const pipeline = mapApiStagesToPipeline(apiStages);
      const isClosed =
        String(baseExercise?.status || "").toLowerCase() === "closed";
      const storedActive = applyStoredActiveStage(
        baseExercise,
        pipelineJob,
        { closed: isClosed },
      );

      const detail = {
        ...(baseExercise || {}),
        id: String(jobId),
        title: jobTitle || baseExercise?.title || "Job",
        invited: Number(stats.total) || apps.length,
        accepted:
          (Number(stats.reviewed) || 0) +
          (Number(stats.shortlisted) || 0) +
          (Number(stats.hired) || 0),
        declined: Number(stats.rejected) || 0,
        passed: Number(stats.hired) || 0,
        failed: Number(stats.rejected) || 0,
        hired: Number(stats.hired) || 0,
        ...storedActive,
        candidates,
        pipeline,
        stagesList,
        appStats: stats,
        auditLogs,
      };

      setSelectedExercise(detail);
      setExercises((prev) =>
        prev.map((ex) =>
          String(ex.id) === String(jobId)
            ? {
                ...ex,
                invited: detail.invited,
                accepted: detail.accepted,
                declined: detail.declined,
                passed: detail.passed,
                failed: detail.failed,
                hired: detail.hired,
                activeStage: detail.activeStage,
                activePipelineStageId: detail.activePipelineStageId,
                activeStageName: detail.activeStageName,
                activeStageSortOrder: detail.activeStageSortOrder,
                title: detail.title,
              }
            : ex,
        ),
      );
    } catch (err) {
      console.error("Recruitment detail load error:", err);
      setDetailError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load job applications",
      );
      setSelectedExercise(baseExercise || null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecruitmentAccess();
  }, [loadRecruitmentAccess]);

  useEffect(() => {
    if (accessLoading) return;
    if (recruitmentAccess?.allowed === false) {
      setListLoading(false);
      setExercises([]);
      return;
    }
    loadList();
  }, [loadList, accessLoading, recruitmentAccess?.allowed]);

  useEffect(() => {
    const targetId = routeJobId || location.state?.exerciseId || null;
    if (!targetId) {
      setSelectedExercise(null);
      setDetailError(null);
      return;
    }

    const base = exercises.find((ex) => String(ex.id) === String(targetId));
    loadDetail(targetId, base);
    // Intentionally omit `exercises` to avoid refetch loops after list load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeJobId, location.state?.exerciseId, loadDetail]);

  useEffect(() => {
    if (!selectedExercise?.id || !exercises.length) return;
    const base = exercises.find(
      (ex) => String(ex.id) === String(selectedExercise.id),
    );
    if (!base) return;
    setSelectedExercise((prev) =>
      prev
        ? {
            ...prev,
            position: prev.position || base.position,
            createdDate: prev.createdDate || base.createdDate,
            status: base.status,
            lastUpdated: base.lastUpdated,
            description: prev.description || base.description,
          }
        : prev,
    );
  }, [exercises, selectedExercise?.id]);

  useEffect(() => {
    setSelectionResetKey((key) => key + 1);
    setBulkMoveCandidates([]);
    setBulkFeedbackCandidates([]);
    setMoveCandidate(null);
    setFeedbackCandidate(null);
  }, [selectedExercise?.id]);

  const handleViewExercise = (ex) => {
    navigate(`/employer/recruitment-management/${ex.id}`);
  };

  const handleBackToList = () => {
    setSelectedExercise(null);
    navigate("/employer/recruitment-management");
  };

  const handleGoBackNav = () => {
    if (routeJobId || selectedExercise) {
      handleBackToList();
    } else {
      navigate("/candidate-search-page");
    }
  };

  const handleCreateClick = () => {
    if (!recruitmentAccess?.canCreate) {
      toast.info(
        recruitmentAccess?.message ||
          "Subscribe to create more recruitment exercises.",
      );
      navigate("/subscription-pricing");
      return;
    }
    setIsCreateOpen(true);
  };

  const handleCreateExercise = async (formData) => {
    if (!recruitmentAccess?.canCreate) {
      toast.info(
        recruitmentAccess?.message ||
          "Free trial includes 2 recruitment exercises. Subscribe to create more.",
      );
      navigate("/subscription-pricing");
      return false;
    }

    setCreating(true);
    try {
      const title = String(formData.title || "").trim();
      const position = String(formData.position || "General Role").trim();
      const department = String(formData.department || "Engineering").trim();
      const description =
        String(formData.description || "").trim() ||
        `Recruitment exercise for ${title}`;

      const response = await createEmployerJob({
        title,
        industry: department,
        roles: position,
        responsibilities: description,
        description,
        workMode: "Remote",
        country: "Nigeria",
        skills: [{ skill: position || department || "General", experience: 0 }],
        listing_kind: "recruitment",
      });

      if (!response?.success) {
        throw new Error(response?.message || "Failed to create recruitment");
      }

      toast.success("Recruitment exercise created successfully!");
      await Promise.all([loadList(), loadRecruitmentAccess()]);
      return true;
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === "PAYMENT_REQUIRED" || code === "RECRUITMENT_LIMIT_REACHED") {
        await loadRecruitmentAccess();
        toast.error(
          err.response?.data?.message ||
            "Subscribe to create more recruitment exercises.",
        );
        navigate("/subscription-pricing");
        return false;
      }
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to create recruitment exercise",
      );
      return false;
    } finally {
      setCreating(false);
    }
  };

  const handleEditSave = async (updated) => {
    if (!selectedExercise?.id) return false;
    setEditing(true);
    try {
      const response = await updateEmployerJob(selectedExercise.id, {
        title: updated.title,
        position: updated.position,
        department: updated.department,
        description: updated.description,
        status: updated.status,
      });
      if (!response?.success) {
        throw new Error(response?.message || "Failed to update recruitment");
      }

      // Persist Open/Closed via API; "Final Stage" maps to Active/Open in DB
      const persistedStatus =
        response?.data?.status ||
        (updated.status === "Closed" ? "Closed" : "Open");

      const next = {
        ...selectedExercise,
        title: updated.title,
        position: updated.position,
        department: updated.department,
        description: updated.description,
        status: persistedStatus,
        ...applyStoredActiveStage(selectedExercise, {}, {
          closed: persistedStatus === "Closed",
        }),
        lastUpdated: "Just now",
      };
      setSelectedExercise(next);
      setExercises((prev) =>
        prev.map((ex) =>
          String(ex.id) === String(next.id) ? { ...ex, ...next } : ex,
        ),
      );
      toast.success("Recruitment updated successfully!");
      await loadList();
      return true;
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to update recruitment",
      );
      return false;
    } finally {
      setEditing(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!selectedExercise?.id) return;
    setClosing(true);
    try {
      const response = await closeEmployerJob(selectedExercise.id);
      if (!response?.success) {
        throw new Error(response?.message || "Failed to close recruitment");
      }
      toast.info(`Closed and archived "${selectedExercise.title}"`);
      setIsCloseModalOpen(false);
      setSelectedExercise(null);
      navigate("/employer/recruitment-management");
      await loadList();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to close recruitment",
      );
    } finally {
      setClosing(false);
    }
  };

  const applyStagesToSelected = (stages) => {
    const stagesList = mapApiStagesToList(stages);
    const pipeline = mapApiStagesToPipeline(stages);
    setSelectedExercise((prev) => {
      if (!prev) return prev;
      const matched =
        stages.find(
          (s) => String(s.id) === String(prev.activePipelineStageId),
        ) || null;
      const idx = matched
        ? stages.findIndex((s) => String(s.id) === String(matched.id))
        : -1;
      const stored = matched
        ? applyStoredActiveStage(
            prev,
            {
              activePipelineStageId: matched.id,
              activeStageName: matched.name,
              activeStageSortOrder:
                matched.sortOrder != null ? matched.sortOrder : idx,
            },
            { closed: String(prev.status).toLowerCase() === "closed" },
          )
        : {};
      const next = { ...prev, stagesList, pipeline, ...stored };
      setExercises((list) =>
        list.map((ex) =>
          String(ex.id) === String(next.id)
            ? {
                ...ex,
                activeStage: next.activeStage,
                activePipelineStageId: next.activePipelineStageId,
                activeStageName: next.activeStageName,
                activeStageSortOrder: next.activeStageSortOrder,
              }
            : ex,
        ),
      );
      return next;
    });
  };

  const handleAddStageFromBuilder = async (newStageData) => {
    if (!selectedExercise?.id) return false;
    try {
      const response = await createPipelineStage(selectedExercise.id, {
        name: newStageData.name,
        description: newStageData.description,
        interviewer: newStageData.interviewer,
        duration: newStageData.duration,
      });
      if (!response?.success) {
        throw new Error(response?.message || "Failed to create stage");
      }
      applyStagesToSelected(response.data?.stages || []);
      toast.success(`Stage "${newStageData.name}" added`);
      const auditRes = await getJobAuditLogs(selectedExercise.id).catch(
        () => null,
      );
      if (auditRes?.data) {
        setSelectedExercise((prev) =>
          prev ? { ...prev, auditLogs: auditRes.data } : prev,
        );
      }
      return true;
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Failed to add stage",
      );
      return false;
    }
  };

  const handleUpdatePipelineStage = async (updatedStage) => {
    if (!selectedExercise?.id || !updatedStage?.id) return;
    try {
      const response = await updatePipelineStage(
        selectedExercise.id,
        updatedStage.id,
        {
          name: updatedStage.name,
          description: updatedStage.description,
          interviewer: updatedStage.interviewer,
          duration: updatedStage.duration,
        },
      );
      if (!response?.success) {
        throw new Error(response?.message || "Failed to update stage");
      }
      applyStagesToSelected(response.data?.stages || []);
      toast.success(`Stage "${updatedStage.name}" updated`);
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Failed to update stage",
      );
    }
  };

  const handleDeletePipelineStage = async (stageToDelete) => {
    if (!selectedExercise?.id || !stageToDelete?.id) return;

    const fullStage =
      (selectedExercise.stagesList || []).find(
        (s) => String(s.id) === String(stageToDelete.id),
      ) || stageToDelete;

    const candidateCount = Number(fullStage.count ?? stageToDelete.count) || 0;
    const confirmMsg =
      candidateCount > 0
        ? `Delete stage "${fullStage.name}"?\n\n${candidateCount} candidate(s) on this stage will be unassigned from the pipeline. This cannot be undone.`
        : `Delete stage "${fullStage.name}"? This cannot be undone.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const response = await deletePipelineStage(
        selectedExercise.id,
        fullStage.id,
      );
      if (!response?.success) {
        throw new Error(response?.message || "Failed to delete stage");
      }
      applyStagesToSelected(response.data?.stages || []);
      toast.info(`Stage "${fullStage.name}" deleted`);
      await loadDetail(selectedExercise.id, selectedExercise);
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Failed to delete stage",
      );
    }
  };

  const handleReorderPipelineStages = async (newOrderedList) => {
    if (!selectedExercise?.id || !Array.isArray(newOrderedList)) return;

    // Pipeline flow cards may only carry id/name/count — rebuild from stagesList
    const byId = new Map(
      (selectedExercise.stagesList || []).map((s) => [String(s.id), s]),
    );
    const ordered = newOrderedList
      .map((item) => byId.get(String(item.id)) || item)
      .filter((s) => s?.id != null);

    if (!ordered.length) return;

    const stageIds = ordered.map((s) => s.id);
    // Optimistic UI
    applyStagesToSelected(
      ordered.map((s, index) => ({
        ...s,
        sortOrder: index,
        durationMins: s.durationMins || 60,
        duration: s.duration,
      })),
    );
    try {
      const response = await reorderPipelineStages(
        selectedExercise.id,
        stageIds,
      );
      if (!response?.success) {
        throw new Error(response?.message || "Failed to reorder stages");
      }
      applyStagesToSelected(response.data?.stages || []);
      toast.success("Pipeline stages reordered");
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to reorder stages",
      );
      await loadDetail(selectedExercise.id, selectedExercise);
    }
  };

  const handleMoveCandidateStage = async (candidateOrList, targetStageValue) => {
    const list = Array.isArray(candidateOrList)
      ? candidateOrList
      : candidateOrList
        ? [candidateOrList]
        : [];
    if (!selectedExercise?.id || !list.length) return false;

    const stages = selectedExercise.stagesList || [];
    const matched =
      stages.find((s) => String(s.id) === String(targetStageValue)) ||
      stages.find((s) => s.name === targetStageValue);

    if (!matched?.id) {
      toast.error("Unknown target stage");
      return false;
    }

    const isAlreadyOnStage = (candidate) => {
      if (
        candidate?.pipelineStageId != null &&
        String(candidate.pipelineStageId) === String(matched.id)
      ) {
        return true;
      }
      const current = String(candidate?.currentStage || "")
        .trim()
        .toLowerCase();
      const target = String(matched.name || "").trim().toLowerCase();
      return Boolean(current && target && current === target);
    };

    const isBulk = list.length > 1;
    setMoving(true);
    let moved = 0;
    let skipped = 0;
    let failed = 0;

    try {
      for (const candidate of list) {
        if (!candidate?.id || isAlreadyOnStage(candidate)) {
          skipped += 1;
          continue;
        }
        try {
          const response = await moveApplicationStage(
            selectedExercise.id,
            candidate.id,
            matched.id,
          );
          if (!response?.success) {
            throw new Error(response?.message || "Failed to move candidate");
          }
          moved += 1;
        } catch {
          failed += 1;
        }
      }

      if (moved > 0) {
        await loadDetail(selectedExercise.id, selectedExercise);
      }

      if (isBulk) {
        const parts = [];
        if (moved) parts.push(`Moved ${moved} to ${matched.name}`);
        if (skipped) parts.push(`${skipped} already there`);
        if (failed) parts.push(`${failed} failed`);
        if (failed && moved === 0) {
          toast.error(parts.join(". ") || "Failed to move candidates");
          return false;
        }
        toast.success(parts.join(". ") || "No candidates needed moving");
        setMoveCandidate(null);
        setBulkMoveCandidates([]);
        setSelectionResetKey((key) => key + 1);
        return failed === 0;
      }

      if (failed || moved === 0) {
        toast.error(
          skipped
            ? `${list[0]?.name} is already in ${matched.name}`
            : `Failed to move ${list[0]?.name || "candidate"}`,
        );
        return false;
      }

      toast.success(`Moved ${list[0].name} to ${matched.name}`);
      setMoveCandidate(null);
      setBulkMoveCandidates([]);
      return true;
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to move candidate",
      );
      return false;
    } finally {
      setMoving(false);
    }
  };

  const sendCandidateChatFeedback = async (candidate, payload) => {
    const recipientUserId = String(
      candidate.userId || candidate.user_id || "",
    ).trim();
    if (!recipientUserId) {
      throw new Error(
        "This candidate has no linked account, so feedback cannot be sent in chat.",
      );
    }

    const conversation =
      await messagingService.startConversation(recipientUserId);
    if (!conversation?.id) {
      throw new Error("Failed to open chat with candidate");
    }

    const jobTitle = selectedExercise.title || "your application";
    const outcome = payload.outcome || "Pending";
    const feedbackBody = String(payload.feedback || "").trim();
    const content = [
      `Recruitment feedback — ${jobTitle}`,
      `Outcome: ${outcome}`,
      "",
      feedbackBody,
    ].join("\n");

    await messagingService.sendMessage(conversation.id, content);
  };

  const handleSaveFeedback = async (candidateOrList, payload) => {
    const list = Array.isArray(candidateOrList)
      ? candidateOrList
      : candidateOrList
        ? [candidateOrList]
        : [];
    if (!selectedExercise?.id || !list.length || feedbackSaving) return false;

    const isBulk = list.length > 1;
    setFeedbackSaving(true);
    try {
      if (!isBulk) {
        await sendCandidateChatFeedback(list[0], payload);
        toast.success(
          `Feedback sent to ${list[0].name}'s chat. They can view it on their Chats page.`,
        );
        setFeedbackCandidate(null);
        setBulkFeedbackCandidates([]);
        return true;
      }

      let sent = 0;
      let skipped = 0;
      let failed = 0;

      for (const candidate of list) {
        const recipientUserId = String(
          candidate.userId || candidate.user_id || "",
        ).trim();
        if (!recipientUserId) {
          skipped += 1;
          continue;
        }
        try {
          await sendCandidateChatFeedback(candidate, payload);
          try {
            await createApplicationFeedback(
              selectedExercise.id,
              candidate.id,
              {
                outcome: payload.outcome || "Pending",
                feedback: String(payload.feedback || "").trim(),
              },
            );
          } catch {
            // Chat already sent; outcome log is best-effort.
          }
          sent += 1;
        } catch {
          failed += 1;
        }
      }

      if (sent > 0) {
        await loadDetail(selectedExercise.id, selectedExercise);
      }

      const parts = [];
      if (sent) parts.push(`Sent feedback to ${sent} candidate${sent === 1 ? "" : "s"}`);
      if (skipped) parts.push(`${skipped} skipped (no linked account)`);
      if (failed) parts.push(`${failed} failed`);

      if (sent === 0) {
        toast.error(parts.join(". ") || "Failed to send feedback");
        return false;
      }

      toast.success(parts.join(". "));
      setFeedbackCandidate(null);
      setBulkFeedbackCandidates([]);
      setSelectionResetKey((key) => key + 1);
      return failed === 0;
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to send feedback to candidate chat",
      );
      return false;
    } finally {
      setFeedbackSaving(false);
    }
  };

  const handleViewCandidateProfile = (candidate, tab = "overview") => {
    setProfileInitialTab(tab);
    setViewProfileCandidate(candidate);
  };

  const normalizeFilterValue = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const listPositionOptions = useMemo(() => {
    const seen = new Map();
    exercises.forEach((ex) => {
      const label = String(ex.position || "").trim();
      if (!label || label === "—") return;
      const value = normalizeFilterValue(label);
      if (!seen.has(value)) seen.set(value, label);
    });
    return [
      { label: "All Positions", value: "all" },
      ...Array.from(seen.entries()).map(([value, label]) => ({ label, value })),
    ];
  }, [exercises]);

  const listStageOptions = useMemo(() => {
    const seen = new Map();
    exercises.forEach((ex) => {
      const label = String(ex.activeStage || "").trim();
      if (!label) return;
      const value = normalizeFilterValue(label);
      if (!seen.has(value)) seen.set(value, label);
    });
    return [
      { label: "All Stages", value: "all" },
      ...Array.from(seen.entries()).map(([value, label]) => ({ label, value })),
    ];
  }, [exercises]);

  const filteredExercises = useMemo(
    () =>
      exercises.filter((ex) => {
        const query = String(searchQuery || "").trim().toLowerCase();
        const matchesSearch =
          !query ||
          ex.title.toLowerCase().includes(query) ||
          (ex.position || "").toLowerCase().includes(query);
        const matchesStatus =
          statusFilter === "all" ||
          normalizeFilterValue(ex.status) === statusFilter;
        const matchesPosition =
          positionFilter === "all" ||
          normalizeFilterValue(ex.position) === positionFilter;
        const stageValue = normalizeFilterValue(ex.activeStage);
        const matchesStage =
          stageFilter === "all" ||
          stageValue === stageFilter ||
          stageValue.includes(stageFilter);

        let matchesDate = true;
        if (dateFrom || dateTo) {
          const created = ex.createdAt ? new Date(ex.createdAt) : null;
          if (!created || Number.isNaN(created.getTime())) {
            matchesDate = false;
          } else {
            if (dateFrom) {
              const from = new Date(`${dateFrom}T00:00:00`);
              if (created < from) matchesDate = false;
            }
            if (matchesDate && dateTo) {
              const to = new Date(`${dateTo}T23:59:59.999`);
              if (created > to) matchesDate = false;
            }
          }
        }

        return (
          matchesSearch &&
          matchesStatus &&
          matchesPosition &&
          matchesStage &&
          matchesDate
        );
      }),
    [
      exercises,
      searchQuery,
      statusFilter,
      positionFilter,
      stageFilter,
      dateFrom,
      dateTo,
    ],
  );

  const filteredCandidates = useMemo(() => {
    if (!selectedExercise?.candidates) return [];

    const normalize = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    let list = selectedExercise.candidates.filter((c) => {
      const search = String(candidateSearch || "").trim().toLowerCase();
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search) ||
        (c.email || "").toLowerCase().includes(search);

      const stageValue = normalize(c.currentStage || c.pipelineStageName);
      const matchesStage =
        candidateStageFilter === "all" ||
        stageValue === candidateStageFilter ||
        stageValue.includes(candidateStageFilter);

      const outcomeValue = normalize(c.outcome || "pending");
      const matchesOutcome =
        candidateOutcomeFilter === "all" ||
        outcomeValue === candidateOutcomeFilter ||
        (candidateOutcomeFilter === "pending" &&
          !["passed", "failed", "hired", "rejected"].includes(outcomeValue)) ||
        (candidateOutcomeFilter === "failed" &&
          ["failed", "rejected"].includes(outcomeValue)) ||
        (candidateOutcomeFilter === "passed" &&
          ["passed", "hired"].includes(outcomeValue));

      return matchesSearch && matchesStage && matchesOutcome;
    });

    list = [...list].sort((a, b) => {
      const aTime = new Date(a.appliedAt || 0).getTime();
      const bTime = new Date(b.appliedAt || 0).getTime();
      if (candidateSort === "oldest") return aTime - bTime;
      return bTime - aTime;
    });

    return list;
  }, [
    selectedExercise,
    candidateSearch,
    candidateStageFilter,
    candidateOutcomeFilter,
    candidateSort,
  ]);

  const openCount = exercises.filter((ex) => ex.status === "Open").length;
  const showPaywall = !accessLoading && recruitmentAccess?.allowed === false;
  const isFreeTrialAccess =
    (recruitmentAccess?.accessType === "free_monthly" ||
      recruitmentAccess?.accessType === "free_trial") &&
    recruitmentAccess?.remaining != null &&
    recruitmentAccess.remaining >= 0;
  const freeTrialLabel =
    isFreeTrialAccess && recruitmentAccess.canCreate
      ? `${recruitmentAccess.remaining} of ${recruitmentAccess.limit || 2} free exercise${
          recruitmentAccess.remaining === 1 ? "" : "s"
        } left this month`
      : isFreeTrialAccess && !recruitmentAccess.canCreate
        ? "Free monthly recruitment quota used — wait until next month or subscribe"
        : null;

  return (
    <NewsFeedLayout showSidebars={false}>
      <div className="w-full min-w-0 max-w-[1440px] mx-auto p-3 sm:p-5 lg:p-6 space-y-5 pb-16">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 flex-wrap">
              <button
                type="button"
                onClick={handleGoBackNav}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAEAEA] hover:bg-gray-300 text-[#1A3E32] transition-colors"
              >
                <FaArrowLeft className="w-2.5 h-2.5" />
                Go Back
              </button>
              <span>›</span>
              <button
                type="button"
                onClick={handleBackToList}
                className={`hover:underline ${
                  selectedExercise || routeJobId
                    ? "text-[#16730F] font-bold"
                    : "text-[#16730F]"
                }`}
              >
                Recruitment Management
              </button>
              {selectedExercise && (
                <>
                  <span>›</span>
                  <span className="text-[#1A3E32] font-bold truncate max-w-[240px]">
                    {selectedExercise.title}
                  </span>
                </>
              )}
            </div>

            {!routeJobId && !selectedExercise && (
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A3E32] tracking-tight">
                  Recruitment Management
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 font-normal mt-0.5 max-w-2xl">
                  Monitor recruitment progress, manage interview pipelines, and
                  track candidate outcomes across all hiring exercises.
                </p>
                {freeTrialLabel && !showPaywall && (
                  <p className="text-xs sm:text-sm text-[#16730F] font-semibold mt-1.5">
                    {freeTrialLabel}
                  </p>
                )}
              </div>
            )}
          </div>

          {!routeJobId && !selectedExercise && !showPaywall && !accessLoading && (
            <button
              type="button"
              data-tour-id="rm-create"
              onClick={handleCreateClick}
              className="inline-flex items-center gap-2 bg-[#16730F] hover:bg-[#125B0C] active:scale-95 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-md transition-all shrink-0 self-start sm:self-auto"
            >
              <FaPlus className="w-3.5 h-3.5" />
              {recruitmentAccess?.canCreate
                ? "New Recruitment Exercise"
                : "Upgrade to Create More"}
            </button>
          )}
        </div>

        {accessLoading ? (
          <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center text-sm text-gray-500 font-medium">
            Checking recruitment access…
          </div>
        ) : showPaywall ? (
          <div className="bg-white border border-gray-200 rounded-3xl p-8 sm:p-12 text-center shadow-sm">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#1A3E32]">
              Subscription required
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-600 max-w-lg mx-auto leading-relaxed">
              {recruitmentAccess?.message ||
                "Recruitment Management is available to subscribed recruiters. Free trial includes 2 recruitment exercises."}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/subscription-pricing")}
                className="inline-flex items-center justify-center bg-[#16730F] hover:bg-[#125B0C] text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-md transition-colors"
              >
                View ASE plans
              </button>
              <button
                type="button"
                onClick={() => navigate("/candidate-search-page")}
                className="inline-flex items-center justify-center bg-[#EAEAEA] hover:bg-gray-300 text-[#1A3E32] font-bold text-sm px-6 py-3 rounded-2xl transition-colors"
              >
                Back to search
              </button>
            </div>
          </div>
        ) : (
          <>
        {!routeJobId && !selectedExercise && (
          <>
            {listError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-2xl px-4 py-3">
                {listError}
              </div>
            )}

            {!recruitmentAccess?.canCreate &&
              (recruitmentAccess?.accessType === "free_monthly" ||
                recruitmentAccess?.accessType === "free_trial") && (
                <div className="bg-[#F3F8F2] border border-[#C8E0C4] text-[#1A3E32] text-sm font-medium rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span>
                    You’ve used your free recruitment exercises for this month.
                    Wait until next month or subscribe to create more while
                    keeping access to your existing pipelines.
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate("/subscription-pricing")}
                    className="shrink-0 inline-flex items-center justify-center bg-[#16730F] hover:bg-[#125B0C] text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors"
                  >
                    View plans
                  </button>
                </div>
              )}

            <RecruitmentFilterBar
              tourId="rm-filters"
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search recruitments by title or position..."
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              positionFilter={positionFilter}
              onPositionChange={setPositionFilter}
              stageFilter={stageFilter}
              onStageChange={setStageFilter}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              onClearDate={() => {
                setDateFrom("");
                setDateTo("");
              }}
              statusOptions={[
                { label: "All Statuses", value: "all" },
                { label: "Open", value: "open" },
                { label: "Closed", value: "closed" },
              ]}
              positionOptions={listPositionOptions}
              stageOptions={listStageOptions}
              showDateFilter
              onApply={() => toast.success("Filters applied")}
              onReset={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setPositionFilter("all");
                setStageFilter("all");
                setDateFrom("");
                setDateTo("");
                toast.info("Filters reset");
              }}
            />

            {listLoading ? (
              <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center text-sm text-gray-500 font-medium">
                Loading recruitment exercises…
              </div>
            ) : (
              <RecruitmentListTable
                exercises={filteredExercises}
                onViewExercise={handleViewExercise}
                activeCount={openCount}
                currentPage={1}
                totalPages={1}
              />
            )}
          </>
        )}

        {(routeJobId || selectedExercise) && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {detailError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-2xl px-4 py-3">
                {detailError}
              </div>
            )}

            {detailLoading && !selectedExercise ? (
              <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center text-sm text-gray-500 font-medium">
                Loading recruitment details…
              </div>
            ) : selectedExercise ? (
              <>
                <div
                  data-tour-id="rm-detail-header"
                  className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-bold text-[#1A3E32] tracking-tight">
                        {selectedExercise.title}
                      </h1>
                      <span className="bg-[#E6F4EA] text-[#16730F] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        {selectedExercise.status}
                      </span>
                      {detailLoading && (
                        <span className="text-xs text-gray-400 font-medium">
                          Refreshing…
                        </span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
                      <span>{selectedExercise.position}</span>
                      <span>•</span>
                      <span>Created {selectedExercise.createdDate}</span>
                      <span>•</span>
                      <span>Status: {selectedExercise.status}</span>
                    </div>
                  </div>

              <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto min-w-0">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 bg-[#1A3E32] hover:bg-[#132E25] active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all"
                >
                  <FaPencilAlt className="w-3 h-3" />
                  Edit Recruitment
                </button>
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(true)}
                  className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 bg-[#FF3B30] hover:bg-[#E03126] active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all"
                >
                  <FaTimes className="w-3.5 h-3.5" />
                  Close Recruitment
                </button>
              </div>
                </div>

                <div
                  data-tour-id="rm-stats"
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
                >
                  <RecruitmentStatCard
                    icon={FaUsers}
                    value={selectedExercise.invited}
                    label="TOTAL INVITED"
                    sublabel="Candidates who a..."
                    variant="green"
                  />
                  <RecruitmentStatCard
                    icon={FaUserCheck}
                    value={selectedExercise.accepted}
                    label="ACCEPTED"
                    sublabel="Candidates who a..."
                    variant="green"
                  />
                  <RecruitmentStatCard
                    icon={FaUserTimes}
                    value={selectedExercise.declined}
                    label="DECLINED"
                    sublabel="Candidates who ..."
                    variant="red"
                  />
                  <RecruitmentStatCard
                    icon={FaCheckCircle}
                    value={selectedExercise.passed}
                    label="PASSED"
                    sublabel="Candidates who p..."
                    variant="green"
                  />
                  <RecruitmentStatCard
                    icon={FaTimesCircle}
                    value={selectedExercise.failed}
                    label="FAILED"
                    sublabel="Candidates who d..."
                    variant="red"
                  />
                  <RecruitmentStatCard
                    icon={FaUserCheck}
                    value={selectedExercise.hired}
                    label="HIRED"
                    sublabel="Candidates succe..."
                    variant="green"
                  />
                </div>

                <PipelineFlow
                  stages={selectedExercise.pipeline}
                  onAddStage={() => setIsStageBuilderOpen(true)}
                  onDeleteStage={handleDeletePipelineStage}
                  onReorderStages={handleReorderPipelineStages}
                />

                <div
                  data-tour-id="rm-tabs"
                  className="border-b border-gray-200 flex items-center gap-4 sm:gap-6 text-sm font-bold pt-2 overflow-x-auto scrollbar-none -mx-1 px-1"
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab("candidates")}
                    className={`pb-2 border-b-2 transition-colors shrink-0 ${
                      activeTab === "candidates"
                        ? "border-[#16730F] text-[#16730F]"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Candidates
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("stages")}
                    className={`pb-2 border-b-2 transition-colors shrink-0 ${
                      activeTab === "stages"
                        ? "border-[#16730F] text-[#16730F]"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Stages
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("timeline")}
                    className={`pb-2 border-b-2 transition-colors shrink-0 ${
                      activeTab === "timeline"
                        ? "border-[#16730F] text-[#16730F]"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Timeline / Audit Log
                  </button>
                </div>

                {activeTab === "candidates" && (
                  <div data-tour-id="rm-candidates" className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-[#1A3E32]">
                        Candidates
                      </h2>
                      <p className="text-xs text-gray-500">
                        Manage candidates progressing through this recruitment.
                      </p>
                    </div>

                    <RecruitmentFilterBar
                      searchQuery={candidateSearch}
                      onSearchChange={setCandidateSearch}
                      searchPlaceholder="Search candidate name and email..."
                      showDateFilter={false}
                      statusFilter={candidateStageFilter}
                      onStatusChange={setCandidateStageFilter}
                      positionFilter={candidateOutcomeFilter}
                      onPositionChange={setCandidateOutcomeFilter}
                      stageFilter={candidateSort}
                      onStageChange={setCandidateSort}
                      statusOptions={[
                        { label: "All Pipeline Stages", value: "all" },
                        ...(selectedExercise.stagesList || []).map((stg) => ({
                          label: stg.name,
                          value: String(stg.name || "")
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "_")
                            .replace(/^_+|_+$/g, ""),
                        })),
                      ]}
                      positionOptions={[
                        { label: "All Outcomes", value: "all" },
                        { label: "Pending", value: "pending" },
                        { label: "Passed", value: "passed" },
                        { label: "Failed", value: "failed" },
                      ]}
                      stageOptions={[
                        { label: "Sort by: Newest", value: "newest" },
                        { label: "Sort by: Oldest", value: "oldest" },
                      ]}
                      onApply={() => {
                        toast.success("Candidate filters applied");
                      }}
                      onReset={() => {
                        setCandidateSearch("");
                        setCandidateStageFilter("all");
                        setCandidateOutcomeFilter("all");
                        setCandidateSort("newest");
                      }}
                    />

                    <CandidateListTable
                      candidates={filteredCandidates}
                      selectionResetKey={selectionResetKey}
                      onViewCandidateProfile={(cand) =>
                        handleViewCandidateProfile(cand, "overview")
                      }
                      onFeedback={(cand) => {
                        setBulkFeedbackCandidates([]);
                        setFeedbackCandidate(cand);
                      }}
                      onMoveStage={(cand) => {
                        setBulkMoveCandidates([]);
                        setMoveCandidate(cand);
                      }}
                      onBulkMove={(cands) => {
                        setMoveCandidate(null);
                        setBulkMoveCandidates(cands);
                      }}
                      onBulkFeedback={(cands) => {
                        setFeedbackCandidate(null);
                        setBulkFeedbackCandidates(cands);
                      }}
                    />
                  </div>
                )}

                {activeTab === "stages" && (
                  <InterviewStagesList
                    stages={selectedExercise.stagesList || []}
                    onAddStage={() => setIsStageBuilderOpen(true)}
                    onEditStage={(stg) => setEditingPipelineStage(stg)}
                    onDeleteStage={handleDeletePipelineStage}
                    onReorderStages={handleReorderPipelineStages}
                  />
                )}

                {activeTab === "timeline" && (
                  <RecruitmentAuditLog logs={selectedExercise.auditLogs || []} />
                )}
              </>
            ) : null}
          </div>
        )}
          </>
        )}

        <CreateRecruitmentModal
          isOpen={isCreateOpen}
          onClose={() => !creating && setIsCreateOpen(false)}
          onCreate={handleCreateExercise}
          submitting={creating}
        />

        <EditRecruitmentModal
          isOpen={isEditOpen}
          onClose={() => !editing && setIsEditOpen(false)}
          exercise={selectedExercise}
          onSave={handleEditSave}
          submitting={editing}
        />

        <CloseRecruitmentModal
          isOpen={isCloseModalOpen}
          onClose={() => !closing && setIsCloseModalOpen(false)}
          exerciseTitle={selectedExercise?.title}
          onConfirmClose={handleConfirmClose}
          breakdown={{
            hired: selectedExercise?.hired || 0,
            failed: selectedExercise?.failed || 0,
            withdrawn: 0,
            pending:
              Number(selectedExercise?.appStats?.pending) ||
              Number(selectedExercise?.appStats?.reviewed) ||
              0,
          }}
        />

        <StageBuilderModal
          isOpen={isStageBuilderOpen}
          onClose={() => setIsStageBuilderOpen(false)}
          onAddStage={handleAddStageFromBuilder}
        />

        <EditPipelineStageModal
          isOpen={Boolean(editingPipelineStage)}
          onClose={() => setEditingPipelineStage(null)}
          stage={editingPipelineStage}
          onUpdateStage={handleUpdatePipelineStage}
        />

        <CandidateProfileModal
          isOpen={Boolean(viewProfileCandidate)}
          onClose={() => setViewProfileCandidate(null)}
          candidate={viewProfileCandidate}
          jobId={selectedExercise?.id}
          initialTab={profileInitialTab}
          onMoveToNextStage={(cand) => setMoveCandidate(cand)}
          onChangeOutcome={(cand) => setMoveCandidate(cand)}
          onSendFeedback={(cand) => setFeedbackCandidate(cand)}
        />

        <CandidateFeedbackModal
          isOpen={
            Boolean(feedbackCandidate) || bulkFeedbackCandidates.length > 0
          }
          onClose={() => {
            if (feedbackSaving) return;
            setFeedbackCandidate(null);
            setBulkFeedbackCandidates([]);
          }}
          candidate={feedbackCandidate}
          candidates={
            bulkFeedbackCandidates.length > 0
              ? bulkFeedbackCandidates
              : undefined
          }
          jobTitle={selectedExercise?.title || ""}
          onSubmitFeedback={handleSaveFeedback}
          submitting={feedbackSaving}
        />

        <MoveCandidateModal
          isOpen={Boolean(moveCandidate) || bulkMoveCandidates.length > 0}
          onClose={() => {
            if (moving) return;
            setMoveCandidate(null);
            setBulkMoveCandidates([]);
          }}
          candidate={moveCandidate}
          candidates={
            bulkMoveCandidates.length > 0 ? bulkMoveCandidates : undefined
          }
          stages={selectedExercise?.stagesList || []}
          onMoveCandidate={handleMoveCandidateStage}
          submitting={moving}
        />

        <RecruitmentManagementTour
          ready={
            !accessLoading &&
            !showPaywall &&
            (selectedExercise
              ? true
              : !routeJobId && !listLoading)
          }
          view={selectedExercise ? "detail" : "list"}
          onEnsureCandidatesTab={() => setActiveTab("candidates")}
        />
      </div>
    </NewsFeedLayout>
  );
}
