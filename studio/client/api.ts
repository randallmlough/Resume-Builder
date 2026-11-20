import type {
  AttachmentTargetType,
  CompanyRecord,
  CoverLetterRecord,
  JobPostingRecord,
  JobStage,
  RecommendationLetterRecord,
  ResumeConfig,
  ResumeData,
  ResumeRecord,
  ResumeSnapshotRecord,
} from '@shared/schema';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // ── Resumes ───────────────────────────────────────────────────────────────
  listResumes: () => request<ResumeRecord[]>('/api/resumes'),

  createResume: (input: { title: string; data: ResumeData; config?: ResumeConfig }) =>
    request<ResumeRecord>('/api/resumes', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateResume: (
    id: string,
    input: { title?: string; data?: ResumeData; config?: ResumeConfig }
  ) =>
    request<ResumeRecord>(`/api/resumes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  setMasterResume: (id: string) =>
    request<ResumeRecord>(`/api/resumes/${id}/set-master`, {
      method: 'POST',
    }),

  cloneResume: (id: string, title?: string) =>
    request<ResumeRecord>(`/api/resumes/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
    }),

  deleteResume: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/resumes/${id}`, {
      method: 'DELETE',
    }),

  seedFromRepo: () =>
    request<ResumeRecord>('/api/seed-from-repo', {
      method: 'POST',
    }),

  // ── Companies & Job Postings ──────────────────────────────────────────────
  listCompanies: () => request<CompanyRecord[]>('/api/companies'),

  createCompany: (input: { name: string; website?: string; notes?: string }) =>
    request<CompanyRecord>('/api/companies', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateCompany: (id: string, input: { name?: string; website?: string; notes?: string }) =>
    request<CompanyRecord>(`/api/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteCompany: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/companies/${id}`, {
      method: 'DELETE',
    }),

  listJobs: (companyId?: string) =>
    request<JobPostingRecord[]>(
      companyId ? `/api/jobs?companyId=${encodeURIComponent(companyId)}` : '/api/jobs'
    ),

  createJob: (input: {
    companyId?: string;
    companyName?: string;
    title: string;
    stage?: JobStage;
    url?: string;
    location?: string;
    compensation?: string;
    description?: string;
    notes?: string;
    sourceResumeId?: string;
    sourceCoverLetterId?: string;
  }) =>
    request<{
      job: JobPostingRecord;
      company: CompanyRecord;
      resume: ResumeRecord;
      coverLetter: CoverLetterRecord;
    }>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateJob: (
    id: string,
    input: {
      companyId?: string;
      title?: string;
      stage?: JobStage;
      url?: string;
      location?: string;
      compensation?: string;
      description?: string;
      notes?: string;
      appliedAt?: string | null;
    }
  ) =>
    request<JobPostingRecord>(`/api/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteJob: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/jobs/${id}`, {
      method: 'DELETE',
    }),

  syncJobFromMaster: (jobId: string, preserveCustomSummary = true) =>
    request<ResumeRecord>(`/api/jobs/${jobId}/sync-master`, {
      method: 'POST',
      body: JSON.stringify({ preserveCustomSummary }),
    }),

  listSnapshots: (jobId: string) =>
    request<ResumeSnapshotRecord[]>(`/api/jobs/${jobId}/snapshots`),

  createSnapshot: (jobId: string, label: string) =>
    request<ResumeSnapshotRecord>(`/api/jobs/${jobId}/snapshots`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    }),

  restoreSnapshot: (jobId: string, snapshotId: string) =>
    request<{ resume: ResumeRecord; coverLetter: CoverLetterRecord | null }>(
      `/api/jobs/${jobId}/snapshots/${snapshotId}/restore`,
      { method: 'POST' }
    ),

  deleteSnapshot: (jobId: string, snapshotId: string) =>
    request<{ deleted: boolean; id: string }>(`/api/jobs/${jobId}/snapshots/${snapshotId}`, {
      method: 'DELETE',
    }),

  // ── Cover Letters ─────────────────────────────────────────────────────────
  listCoverLetters: (resumeId?: string) =>
    request<CoverLetterRecord[]>(
      resumeId ? `/api/cover-letters?resumeId=${encodeURIComponent(resumeId)}` : '/api/cover-letters'
    ),

  createCoverLetter: (input: {
    resumeId: string;
    title: string;
    company?: string;
    bodyMarkdown: string;
  }) =>
    request<CoverLetterRecord>('/api/cover-letters', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateCoverLetter: (
    id: string,
    input: { resumeId?: string; title?: string; company?: string; bodyMarkdown?: string }
  ) =>
    request<CoverLetterRecord>(`/api/cover-letters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteCoverLetter: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/cover-letters/${id}`, {
      method: 'DELETE',
    }),

  // ── Letters of Recommendation & Attachments ───────────────────────────────
  listRecommendations: () => request<RecommendationLetterRecord[]>('/api/recommendations'),

  uploadRecommendation: async (
    file: File,
    meta?: { title?: string; authorName?: string; authorTitle?: string }
  ): Promise<RecommendationLetterRecord> => {
    const form = new FormData();
    form.append('file', file);
    if (meta?.title) form.append('title', meta.title);
    if (meta?.authorName) form.append('authorName', meta.authorName);
    if (meta?.authorTitle) form.append('authorTitle', meta.authorTitle);

    const res = await fetch('/api/recommendations', {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
    }
    return res.json() as Promise<RecommendationLetterRecord>;
  },

  updateRecommendation: (
    id: string,
    input: { title?: string; authorName?: string; authorTitle?: string }
  ) =>
    request<RecommendationLetterRecord>(`/api/recommendations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteRecommendation: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/recommendations/${id}`, {
      method: 'DELETE',
    }),

  listAttachments: (targetType: AttachmentTargetType, targetId: string) =>
    request<RecommendationLetterRecord[]>(
      `/api/attachments/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`
    ),

  setAttachments: (
    targetType: AttachmentTargetType,
    targetId: string,
    letterIds: string[]
  ) =>
    request<RecommendationLetterRecord[]>(
      `/api/attachments/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ letterIds }),
      }
    ),
};
