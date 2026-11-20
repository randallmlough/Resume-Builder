import type {
  AttachmentTargetType,
  CoverLetterRecord,
  RecommendationLetterRecord,
  ResumeConfig,
  ResumeData,
  ResumeRecord,
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
