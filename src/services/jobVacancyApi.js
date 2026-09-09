import axiosInstance from "../utils/axiosInstance";

export const getJobVacancies = async (params = {}) => {
  const response = await axiosInstance.get("/api/job-board/vacancies", {
    params,
  });
  return response.data;
};

export const getNewJobVacancyCount = async (since) => {
  const response = await axiosInstance.get(
    "/api/job-board/vacancies/new-count",
    { params: { since } },
  );
  return response.data;
};

const JOB_VACANCY_LAST_SEEN_KEY = "jobVacancyLastSeenAt";

export const getJobVacancyLastSeenAt = () =>
  localStorage.getItem(JOB_VACANCY_LAST_SEEN_KEY);

export const markJobVacanciesSeen = () => {
  localStorage.setItem(JOB_VACANCY_LAST_SEEN_KEY, new Date().toISOString());
};

export const getJobVacancyById = async (jobId) => {
  const response = await axiosInstance.get(`/api/job-board/vacancies/${jobId}`);
  return response.data;
};

export const submitJobApplication = async (jobId, applicationData) => {
  const formData = new FormData();
  formData.append("applicationMethod", applicationData.applicationMethod);
  formData.append("fullName", applicationData.fullName);
  formData.append("email", applicationData.email);

  if (applicationData.phone) {
    formData.append("phone", applicationData.phone);
  }
  if (applicationData.location) {
    formData.append("location", applicationData.location);
  }
  if (applicationData.coverLetter) {
    formData.append("coverLetter", applicationData.coverLetter);
  }
  if (applicationData.resume) {
    formData.append("resume", applicationData.resume);
  }

  const response = await axiosInstance.post(
    `/api/job-board/vacancies/${jobId}/apply`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return response.data;
};

export const recordJobImpression = async (jobId) => {
  try {
    const response = await axiosInstance.post(
      `/api/job-board/vacancies/${jobId}/impression`,
    );
    return response.data;
  } catch {
    return { counted: false, error: true };
  }
};

export default {
  getJobVacancies,
  getJobVacancyById,
  getNewJobVacancyCount,
  getJobVacancyLastSeenAt,
  markJobVacanciesSeen,
  submitJobApplication,
  recordJobImpression,
};
