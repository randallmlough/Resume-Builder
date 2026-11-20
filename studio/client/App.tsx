import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  Camera,
  Check,
  Code2,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  FolderSync,
  Loader2,
  Mail,
  Palette,
  Paperclip,
  RefreshCw,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_CONFIG,
  JOB_STAGES,
  ResumeDataSchema,
  type AttachmentTargetType,
  type CompanyRecord,
  type CoverLetterRecord,
  type JobPostingRecord,
  type JobStage,
  type RecommendationLetterRecord,
  type ResumeConfig,
  type ResumeData,
  type ResumeRecord,
  type ResumeSnapshotRecord,
} from '@shared/schema';
import { api } from './api';
import { useTypst } from './typst/useTypst';
import { mergePdfWithAttachments } from './pdf/mergePdf';
import { WorkspaceSidebar, type WorkspaceView } from './components/WorkspaceSidebar';
import { ProfileSettingsPage } from './components/ProfileSettingsPage';
import { KanbanBoard } from './components/KanbanBoard';
import { JobDetailsPanel } from './components/JobDetailsPanel';
import { NewJobModal } from './components/NewJobModal';
import { VisualEditor } from './components/VisualEditor';
import { JsonEditor } from './components/JsonEditor';
import { StylePanel } from './components/StylePanel';
import { CoverLetterEditor } from './components/CoverLetterEditor';
import { RecommendationsPanel } from './components/RecommendationsPanel';
import { PreviewPane } from './components/PreviewPane';

type ResumeTab = 'details' | 'visual' | 'json' | 'style' | 'letters';
type CoverLetterTab = 'write' | 'letters';

export function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [view, setView] = useState<WorkspaceView>('profile');

  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [jobs, setJobs] = useState<JobPostingRecord[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [letters, setLetters] = useState<CoverLetterRecord[]>([]);
  const [activeMasterLetterId, setActiveMasterLetterId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<ResumeSnapshotRecord[]>([]);

  const [recommendations, setRecommendations] = useState<RecommendationLetterRecord[]>([]);
  const [resumeAttachments, setResumeAttachments] = useState<RecommendationLetterRecord[]>([]);
  const [coverLetterAttachments, setCoverLetterAttachments] = useState<RecommendationLetterRecord[]>(
    []
  );
  const [uploadingRecommendation, setUploadingRecommendation] = useState(false);
  const [syncingMaster, setSyncingMaster] = useState(false);

  const [mode, setMode] = useState<'resume' | 'cover-letter'>('resume');
  const [resumeTab, setResumeTab] = useState<ResumeTab>('visual');
  const [coverLetterTab, setCoverLetterTab] = useState<CoverLetterTab>('write');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newJobModalOpen, setNewJobModalOpen] = useState(false);
  const [newJobInitialCompanyId, setNewJobInitialCompanyId] = useState<string | undefined>(
    undefined
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const letterSaveTimerRef = useRef<number | null>(null);
  const jobSaveTimerRef = useRef<number | null>(null);

  const masterResume = useMemo(
    () => resumes.find((r) => r.isMaster) ?? resumes[0] ?? null,
    [resumes]
  );

  const activeJob = useMemo(
    () => (view === 'role' ? jobs.find((j) => j.id === activeJobId) ?? null : null),
    [view, jobs, activeJobId]
  );

  const activeResume = useMemo(() => {
    if (view === 'role' && activeJob) {
      return resumes.find((r) => r.id === activeJob.resumeId) ?? masterResume;
    }
    return masterResume;
  }, [view, activeJob, resumes, masterResume]);

  const globalCoverLetters = useMemo(() => {
    if (!masterResume) return [];
    return letters.filter((l) => l.resumeId === masterResume.id);
  }, [letters, masterResume]);

  const activeGlobalLetter = useMemo(
    () => globalCoverLetters.find((l) => l.id === activeMasterLetterId) ?? globalCoverLetters[0] ?? null,
    [globalCoverLetters, activeMasterLetterId]
  );

  const scopedLetters = useMemo(() => {
    if (!activeResume) return [];
    const matching = letters.filter((l) => l.resumeId === activeResume.id);
    if (view === 'role') return matching;
    return matching.length > 0 ? matching : letters;
  }, [letters, activeResume, view]);

  const activeLetter = useMemo(() => {
    if (view === 'role' && activeJob?.coverLetterId) {
      return (
        letters.find((l) => l.id === activeJob.coverLetterId) ?? scopedLetters[0] ?? null
      );
    }
    return scopedLetters.find((l) => l.id === activeMasterLetterId) ?? scopedLetters[0] ?? null;
  }, [view, activeJob, letters, scopedLetters, activeMasterLetterId]);

  const activeAttachments = mode === 'resume' ? resumeAttachments : coverLetterAttachments;

  const masterHasUpdates = Boolean(
    view === 'role' &&
      activeResume &&
      masterResume &&
      activeResume.id !== masterResume.id &&
      activeResume.baseSyncedAt &&
      masterResume.updatedAt > activeResume.baseSyncedAt
  );

  // Initial data load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loadedResumes, loadedLetters, loadedRecs, loadedCompanies, loadedJobs] =
          await Promise.all([
            api.listResumes(),
            api.listCoverLetters(),
            api.listRecommendations(),
            api.listCompanies(),
            api.listJobs(),
          ]);
        if (cancelled) return;
        setResumes(loadedResumes);
        setLetters(loadedLetters);
        setActiveMasterLetterId(loadedLetters[0]?.id ?? null);
        setRecommendations(loadedRecs);
        setCompanies(loadedCompanies);
        setJobs(loadedJobs);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to connect to studio API');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load resume attachments when active resume changes
  useEffect(() => {
    if (!activeResume?.id) {
      setResumeAttachments([]);
      return;
    }
    let cancelled = false;
    api
      .listAttachments('resume', activeResume.id)
      .then((rows) => {
        if (!cancelled) setResumeAttachments(rows);
      })
      .catch(() => {
        if (!cancelled) setResumeAttachments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeResume?.id]);

  // Load cover letter attachments when active cover letter changes
  useEffect(() => {
    if (!activeLetter?.id) {
      setCoverLetterAttachments([]);
      return;
    }
    let cancelled = false;
    api
      .listAttachments('cover_letter', activeLetter.id)
      .then((rows) => {
        if (!cancelled) setCoverLetterAttachments(rows);
      })
      .catch(() => {
        if (!cancelled) setCoverLetterAttachments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLetter?.id]);

  // Load snapshots when viewing a role posting
  useEffect(() => {
    if (!activeJob?.id) {
      setSnapshots([]);
      return;
    }
    let cancelled = false;
    api
      .listSnapshots(activeJob.id)
      .then((rows) => {
        if (!cancelled) setSnapshots(rows);
      })
      .catch(() => {
        if (!cancelled) setSnapshots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeJob?.id]);

  // Typst WASM live preview
  const preview = useTypst(
    mode,
    activeResume?.data ?? null,
    activeResume?.config ?? null,
    activeLetter?.bodyMarkdown ?? ''
  );

  // Debounced autosave helpers
  const scheduleResumeSave = useCallback(
    (id: string, payload: { title?: string; data?: ResumeData; config?: ResumeConfig }) => {
      setSaveStatus('dirty');
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(async () => {
        setSaveStatus('saving');
        try {
          const updated = await api.updateResume(id, payload);
          setResumes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          setSaveStatus('saved');
        } catch {
          setSaveStatus('error');
        }
      }, 450);
    },
    []
  );

  const scheduleLetterSave = useCallback(
    (id: string, payload: { title?: string; company?: string; bodyMarkdown?: string }) => {
      setSaveStatus('dirty');
      if (letterSaveTimerRef.current) window.clearTimeout(letterSaveTimerRef.current);
      letterSaveTimerRef.current = window.setTimeout(async () => {
        setSaveStatus('saving');
        try {
          const updated = await api.updateCoverLetter(id, payload);
          setLetters((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
          setSaveStatus('saved');
        } catch {
          setSaveStatus('error');
        }
      }, 450);
    },
    []
  );

  const scheduleJobSave = useCallback(
    (
      id: string,
      payload: Partial<
        Pick<
          JobPostingRecord,
          'title' | 'stage' | 'url' | 'location' | 'compensation' | 'description' | 'notes'
        >
      >
    ) => {
      setSaveStatus('dirty');
      if (jobSaveTimerRef.current) window.clearTimeout(jobSaveTimerRef.current);
      jobSaveTimerRef.current = window.setTimeout(async () => {
        setSaveStatus('saving');
        try {
          const updated = await api.updateJob(id, payload);
          setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
          setSaveStatus('saved');
        } catch {
          setSaveStatus('error');
        }
      }, 400);
    },
    []
  );

  // Resume edit handlers
  const handleResumeDataChange = useCallback(
    (nextData: ResumeData) => {
      if (!activeResume) return;
      setResumes((prev) =>
        prev.map((r) => (r.id === activeResume.id ? { ...r, data: nextData } : r))
      );
      scheduleResumeSave(activeResume.id, { data: nextData });
    },
    [activeResume, scheduleResumeSave]
  );

  const handleResumeConfigChange = useCallback(
    (nextConfig: ResumeConfig) => {
      if (!activeResume) return;
      setResumes((prev) =>
        prev.map((r) => (r.id === activeResume.id ? { ...r, config: nextConfig } : r))
      );
      scheduleResumeSave(activeResume.id, { config: nextConfig });
    },
    [activeResume, scheduleResumeSave]
  );

  // Company & Job Posting handlers
  const handleOpenNewJobModal = (companyId?: string) => {
    setNewJobInitialCompanyId(companyId);
    setNewJobModalOpen(true);
  };

  const handleCreateJob = async (input: {
    companyId?: string;
    companyName?: string;
    title: string;
    stage: JobStage;
    url: string;
    location: string;
    compensation: string;
    description: string;
    sourceCoverLetterId?: string;
  }) => {
    const result = await api.createJob(input);
    setCompanies((prev) => {
      if (prev.some((c) => c.id === result.company.id)) return prev;
      return [...prev, result.company].sort((a, b) => a.name.localeCompare(b.name));
    });
    setJobs((prev) => [result.job, ...prev]);
    setResumes((prev) => [result.resume, ...prev]);
    setLetters((prev) => [result.coverLetter, ...prev]);
    setActiveJobId(result.job.id);
    setView('role');
    setMode('resume');
    setResumeTab('details');
  };

  const handleSelectJob = (jobId: string) => {
    setActiveJobId(jobId);
    setView('role');
    if (resumeTab === 'details') {
      // keep current tab
    }
  };

  const handleUpdateJob = (
    jobId: string,
    patch: Partial<
      Pick<
        JobPostingRecord,
        'title' | 'stage' | 'url' | 'location' | 'compensation' | 'description' | 'notes'
      >
    >
  ) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...patch } : j)));
    scheduleJobSave(jobId, patch);
  };

  const handleQuickStageChange = async (jobId: string, stage: JobStage) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, stage } : j)));
    try {
      const updated = await api.updateJob(jobId, { stage });
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    } catch {
      setSaveStatus('error');
    }
  };

  const handleDeleteJob = async (job: JobPostingRecord) => {
    if (
      !window.confirm(
        `Delete "${job.title}" at ${job.companyName} along with its tailored resume and snapshots?`
      )
    ) {
      return;
    }
    await api.deleteJob(job.id);
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    setResumes((prev) => prev.filter((r) => r.id !== job.resumeId || r.isMaster));
    if (job.coverLetterId) {
      setLetters((prev) => prev.filter((l) => l.id !== job.coverLetterId));
    }
    setActiveJobId(null);
    setView('kanban');
  };

  const handleDeleteCompany = async (company: CompanyRecord) => {
    const count = jobs.filter((j) => j.companyId === company.id).length;
    if (
      !window.confirm(
        `Delete "${company.name}"${count > 0 ? ` and all ${count} of its role postings` : ''}?`
      )
    ) {
      return;
    }
    await api.deleteCompany(company.id);
    const removedJobs = jobs.filter((j) => j.companyId === company.id);
    const removedResumeIds = new Set(removedJobs.map((j) => j.resumeId));
    const removedCoverIds = new Set(
      removedJobs.map((j) => j.coverLetterId).filter(Boolean) as string[]
    );
    setCompanies((prev) => prev.filter((c) => c.id !== company.id));
    setJobs((prev) => prev.filter((j) => j.companyId !== company.id));
    setResumes((prev) => prev.filter((r) => !removedResumeIds.has(r.id) || r.isMaster));
    setLetters((prev) => prev.filter((l) => !removedCoverIds.has(l.id)));
    if (activeJob && activeJob.companyId === company.id) {
      setActiveJobId(null);
      setView('kanban');
    }
  };

  const handleSyncFromMaster = async (preserveCustomSummary: boolean) => {
    if (!activeJob) return;
    setSyncingMaster(true);
    try {
      const synced = await api.syncJobFromMaster(activeJob.id, preserveCustomSummary);
      setResumes((prev) => prev.map((r) => (r.id === synced.id ? synced : r)));
    } finally {
      setSyncingMaster(false);
    }
  };

  const handleCreateSnapshot = async (label: string) => {
    if (!activeJob) return;
    const created = await api.createSnapshot(activeJob.id, label);
    setSnapshots((prev) => [created, ...prev]);
    setJobs((prev) =>
      prev.map((j) => (j.id === activeJob.id ? { ...j, snapshotCount: j.snapshotCount + 1 } : j))
    );
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!activeJob) return;
    const restored = await api.restoreSnapshot(activeJob.id, snapshotId);
    setResumes((prev) => prev.map((r) => (r.id === restored.resume.id ? restored.resume : r)));
    if (restored.coverLetter) {
      setLetters((prev) =>
        prev.map((l) => (l.id === restored.coverLetter!.id ? restored.coverLetter! : l))
      );
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    if (!activeJob) return;
    await api.deleteSnapshot(activeJob.id, snapshotId);
    setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
    setJobs((prev) =>
      prev.map((j) =>
        j.id === activeJob.id ? { ...j, snapshotCount: Math.max(0, j.snapshotCount - 1) } : j
      )
    );
  };

  // Repo import / JSON import / export / PDF download
  const handleSeedFromRepo = async () => {
    const imported = await api.seedFromRepo();
    if (masterResume) {
      const updated = await api.updateResume(masterResume.id, {
        data: imported.data,
        config: imported.config,
      });
      await api.deleteResume(imported.id);
      setResumes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setView('master');
    } else {
      setResumes((prev) => [imported, ...prev]);
    }
  };

  const handleImportJson = async (text: string) => {
    if (!activeResume) return;
    try {
      const parsed = ResumeDataSchema.parse(JSON.parse(text));
      handleResumeDataChange(parsed);
    } catch (err) {
      window.alert(`Invalid resume JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExportJson = () => {
    if (!activeResume) return;
    const blob = new Blob([JSON.stringify(activeResume.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = activeJob
      ? `${activeJob.companyName}-${activeJob.title}`
      : activeResume.title;
    a.download = `${slug.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'resume'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!activeResume) return;
    setExportingPdf(true);
    try {
      const basePdfBytes = await preview.compilePdf();
      const finalPdfBytes = await mergePdfWithAttachments(basePdfBytes, activeAttachments);
      const blob = new Blob([new Uint8Array(finalPdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const base =
        mode === 'cover-letter'
          ? `${activeJob ? `${activeJob.companyName}-${activeJob.title}` : activeLetter?.title || 'cover-letter'}-cover-letter`
          : `${activeResume.data.name || 'resume'}${activeJob ? `-${activeJob.companyName}-${activeJob.title}` : ''}-resume`;
      a.download = `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(`PDF export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportingPdf(false);
    }
  };

  // Cover letter CRUD
  const handleCreateLetter = async () => {
    if (!activeResume) return;
    const companyName = activeJob?.companyName ?? 'Global Template';
    const created = await api.createCoverLetter({
      resumeId: activeResume.id,
      title: activeJob ? `${companyName} — ${activeJob.title}` : `Global Cover Letter ${globalCoverLetters.length + 1}`,
      company: activeJob ? companyName : '',
      bodyMarkdown: activeJob
        ? `Dear ${companyName} Hiring Team,\n\nI am excited to apply for this role.\n\nBest regards,\n\n${activeResume.data.name}`
        : `Dear {{company}} Hiring Team,\n\nI am excited to apply for the **{{role}}** role at **{{company}}**.\n\nBest regards,\n\n${activeResume.data.name}`,
    });
    setLetters((prev) => [created, ...prev]);
    setActiveMasterLetterId(created.id);
    setCoverLetterTab('write');
  };

  const handleUploadGlobalLetter = async (title: string, bodyMarkdown: string) => {
    if (!masterResume) return;
    const created = await api.createCoverLetter({
      resumeId: masterResume.id,
      title,
      company: '',
      bodyMarkdown,
    });
    setLetters((prev) => [created, ...prev]);
    setActiveMasterLetterId(created.id);
  };

  const handleDeleteLetter = async (id: string) => {
    await api.deleteCoverLetter(id);
    const remaining = letters.filter((l) => l.id !== id);
    setLetters(remaining);
    setActiveMasterLetterId(remaining[0]?.id ?? null);
  };

  const handleLetterChange = (
    patch: Partial<Pick<CoverLetterRecord, 'title' | 'company' | 'bodyMarkdown'>>
  ) => {
    if (!activeLetter) return;
    setLetters((prev) => prev.map((l) => (l.id === activeLetter.id ? { ...l, ...patch } : l)));
    scheduleLetterSave(activeLetter.id, patch);
  };

  // Recommendations & Attachments handlers
  const handleSetAttachedIds = useCallback(
    async (targetType: AttachmentTargetType, targetId: string, letterIds: string[]) => {
      setSaveStatus('saving');
      try {
        const updated = await api.setAttachments(targetType, targetId, letterIds);
        if (targetType === 'resume') {
          setResumeAttachments(updated);
        } else {
          setCoverLetterAttachments(updated);
        }
        // Keep job badge counts in sync
        setJobs((prev) =>
          prev.map((j) => {
            if (j.resumeId === targetId || j.coverLetterId === targetId) {
              const otherCount =
                targetType === 'resume' ? coverLetterAttachments.length : resumeAttachments.length;
              return { ...j, attachmentCount: updated.length + otherCount };
            }
            return j;
          })
        );
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    [coverLetterAttachments.length, resumeAttachments.length]
  );

  const handleUploadRecommendations = useCallback(
    async (
      files: FileList | File[],
      autoAttach: boolean,
      targetType: AttachmentTargetType,
      targetId: string | null,
      currentAttached: RecommendationLetterRecord[]
    ) => {
      setUploadingRecommendation(true);
      try {
        const uploaded: RecommendationLetterRecord[] = [];
        for (const file of Array.from(files)) {
          const rec = await api.uploadRecommendation(file);
          uploaded.push(rec);
        }
        setRecommendations((prev) => [...uploaded.reverse(), ...prev]);

        if (autoAttach && targetId && uploaded.length > 0) {
          const nextIds = [...currentAttached.map((l) => l.id), ...uploaded.map((l) => l.id)];
          await handleSetAttachedIds(targetType, targetId, nextIds);
        }
      } finally {
        setUploadingRecommendation(false);
      }
    },
    [handleSetAttachedIds]
  );

  const handleUpdateRecommendation = useCallback(
    async (id: string, patch: { title?: string; authorName?: string; authorTitle?: string }) => {
      const updated = await api.updateRecommendation(id, patch);
      setRecommendations((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setResumeAttachments((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setCoverLetterAttachments((prev) => prev.map((r) => (r.id === id ? updated : r)));
    },
    []
  );

  const handleDeleteRecommendation = useCallback(async (id: string) => {
    await api.deleteRecommendation(id);
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
    setResumeAttachments((prev) => prev.filter((r) => r.id !== id));
    setCoverLetterAttachments((prev) => prev.filter((r) => r.id !== id));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-stone-100 text-stone-600 text-sm">
        Loading Resume Studio…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-stone-100 p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-5 shadow-xs space-y-2">
          <div className="font-semibold text-red-700 text-sm">Could not reach Studio API</div>
          <p className="text-xs text-stone-600">{loadError}</p>
          <p className="text-xs text-stone-500">
            Make sure the server is running via{' '}
            <code className="font-mono bg-stone-100 px-1 rounded">npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  // Ensure Master view never stays stuck on role-only 'details' tab
  const effectiveResumeTab: ResumeTab =
    view === 'master' && resumeTab === 'details' ? 'visual' : resumeTab;

  return (
    <div className="h-full flex bg-stone-100 overflow-hidden">
      {/* Persistent Left Workspace Sidebar */}
      <WorkspaceSidebar
        collapsed={sidebarCollapsed}
        view={view}
        companies={companies}
        jobs={jobs}
        resumes={resumes}
        masterResume={masterResume}
        activeJobId={activeJobId}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onSelectProfile={() => setView('profile')}
        onSelectKanban={() => setView('kanban')}
        onSelectMaster={() => {
          setView('master');
          if (resumeTab === 'details') setResumeTab('visual');
        }}
        onSelectJob={handleSelectJob}
        onOpenNewJobModal={handleOpenNewJobModal}
        onDeleteCompany={handleDeleteCompany}
      />

      {/* Right Main Area: Profile Settings, Global Kanban, OR Studio Editor + Live Preview */}
      {view === 'profile' && masterResume ? (
        <ProfileSettingsPage
          data={masterResume.data}
          config={masterResume.config}
          saveStatus={saveStatus}
          globalCoverLetters={globalCoverLetters}
          activeGlobalLetter={activeGlobalLetter}
          recommendations={recommendations}
          defaultAttachedRecommendations={resumeAttachments}
          uploadingRecommendation={uploadingRecommendation}
          onDataChange={handleResumeDataChange}
          onConfigChange={handleResumeConfigChange}
          onSelectGlobalLetter={setActiveMasterLetterId}
          onCreateGlobalLetter={() => void handleCreateLetter()}
          onUploadGlobalLetter={(title, md) => void handleUploadGlobalLetter(title, md)}
          onUpdateGlobalLetter={(patch) => {
            if (!activeGlobalLetter) return;
            setLetters((prev) =>
              prev.map((l) => (l.id === activeGlobalLetter.id ? { ...l, ...patch } : l))
            );
            scheduleLetterSave(activeGlobalLetter.id, patch);
          }}
          onDeleteGlobalLetter={(id) => void handleDeleteLetter(id)}
          onUploadRecommendations={(files, autoAttach) =>
            handleUploadRecommendations(
              files,
              autoAttach,
              'resume',
              masterResume.id,
              resumeAttachments
            )
          }
          onUpdateRecommendation={handleUpdateRecommendation}
          onDeleteRecommendation={handleDeleteRecommendation}
          onSetDefaultAttachments={(ids) => handleSetAttachedIds('resume', masterResume.id, ids)}
          onPreviewMaster={() => {
            setView('master');
            setMode('resume');
            setResumeTab('visual');
          }}
          onSeedFromRepo={handleSeedFromRepo}
          onImportJson={handleImportJson}
          onExportJson={handleExportJson}
        />
      ) : view === 'kanban' ? (
        <KanbanBoard
          companies={companies}
          jobs={jobs}
          resumes={resumes}
          masterResume={masterResume}
          onSelectJob={handleSelectJob}
          onChangeStage={handleQuickStageChange}
          onOpenNewJobModal={handleOpenNewJobModal}
        />
      ) : (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Context Header Bar */}
          <header className="h-14 shrink-0 border-b border-stone-200/90 bg-white px-4 flex items-center justify-between gap-3">
            {/* Left: Master / Role Context Breadcrumb */}
            <div className="flex items-center gap-2.5 min-w-0">
              {view === 'role' && activeJob ? (
                <>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-sky-700 truncate">
                        {activeJob.companyName}
                      </span>
                      <span className="text-stone-300">/</span>
                      <span className="text-sm font-semibold text-stone-900 truncate">
                        {activeJob.title}
                      </span>
                      {activeJob.url && (
                        <a
                          href={activeJob.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open original job posting"
                          className="w-6 h-6 rounded inline-flex items-center justify-center text-stone-400 hover:text-sky-700 hover:bg-sky-50 shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  <select
                    value={activeJob.stage}
                    onChange={(e) =>
                      handleQuickStageChange(activeJob.id, e.target.value as JobStage)
                    }
                    className="h-7 px-2 text-xs font-medium rounded-md border border-stone-200 bg-stone-50 text-stone-700 outline-none focus:border-sky-500 shrink-0"
                  >
                    {JOB_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-stone-900 truncate">Master Resume</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 shrink-0">
                    Base template for new roles
                  </span>
                </div>
              )}
            </div>

            {/* Center: Resume / Cover Letter Switcher */}
            <div className="inline-flex items-center rounded-lg bg-stone-100 p-0.5 border border-stone-200/80 shrink-0">
              <button
                type="button"
                onClick={() => setMode('resume')}
                className={`h-7 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all ${
                  mode === 'resume'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Resume
              </button>
              <button
                type="button"
                onClick={() => setMode('cover-letter')}
                className={`h-7 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-all ${
                  mode === 'cover-letter'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Cover Letter
              </button>
            </div>

            {/* Right: Save Status + Actions + Export PDF */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden xl:flex items-center gap-1.5 text-xs text-stone-500 mr-0.5">
                {saveStatus === 'saving' && (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-sky-600" />
                    <span>Saving</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Saved</span>
                  </>
                )}
                {saveStatus === 'dirty' && <span className="text-amber-600">Unsaved</span>}
                {saveStatus === 'error' && <span className="text-red-600">Save failed</span>}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  file.text().then(handleImportJson);
                  e.target.value = '';
                }}
              />

              {view === 'role' && activeJob ? (
                <button
                  type="button"
                  onClick={() =>
                    void handleCreateSnapshot(
                      `v${snapshots.length + 1} · ${new Date().toLocaleDateString()}`
                    )
                  }
                  title="Freeze an immutable snapshot of this role's resume & cover letter"
                  className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Snapshot</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSeedFromRepo}
                  title="Reload Master Resume from repo resume.json & config.yml"
                  className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md"
                >
                  <FolderSync className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Import Repo</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload resume.json into current resume"
                className="h-8 w-8 inline-flex items-center justify-center text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                disabled={!activeResume}
                title="Download current resume.json"
                className="h-8 w-8 inline-flex items-center justify-center text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md disabled:opacity-40"
              >
                <FileJson className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!preview.ready || exportingPdf || !activeResume}
                title={
                  activeAttachments.length > 0
                    ? `Export merged PDF with ${activeAttachments.length} attached recommendation ${activeAttachments.length === 1 ? 'letter' : 'letters'}`
                    : 'Export PDF'
                }
                className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-sky-700 hover:bg-sky-800 active:bg-sky-900 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {exportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>
                  {activeAttachments.length > 0
                    ? `Export PDF (+${activeAttachments.length})`
                    : 'Export PDF'}
                </span>
              </button>
            </div>
          </header>

          {/* Split-Pane Editor + Live Typst Preview */}
          <main className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left Editor Pane */}
            <section className="w-[47%] min-w-[370px] max-w-[660px] flex flex-col border-r border-stone-200/90 bg-stone-100/60 min-h-0">
              {/* Master Sync Banner when editing a role whose Master has newer changes */}
              {masterHasUpdates && mode === 'resume' && (
                <div className="px-3.5 py-2 border-b border-amber-200 bg-amber-50 flex items-center justify-between gap-2 text-xs text-amber-900 shrink-0">
                  <span className="truncate">
                    <strong>Master Resume updated</strong> — pull latest bullets into this role?
                  </span>
                  <button
                    type="button"
                    disabled={syncingMaster}
                    onClick={() => void handleSyncFromMaster(true)}
                    className="h-6 px-2.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingMaster ? 'animate-spin' : ''}`} />
                    Pull Updates
                  </button>
                </div>
              )}

              {mode === 'resume' ? (
                <>
                  <div className="h-10 shrink-0 px-2.5 border-b border-stone-200 bg-white flex items-center gap-1 overflow-x-auto">
                    {view === 'role' && (
                      <button
                        type="button"
                        onClick={() => setResumeTab('details')}
                        className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                          effectiveResumeTab === 'details'
                            ? 'bg-stone-900 text-white'
                            : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                        }`}
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        Job Details
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setResumeTab('visual')}
                      className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                        effectiveResumeTab === 'visual'
                          ? 'bg-stone-900 text-white'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Visual
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeTab('json')}
                      className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                        effectiveResumeTab === 'json'
                          ? 'bg-stone-900 text-white'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeTab('style')}
                      className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                        effectiveResumeTab === 'style'
                          ? 'bg-stone-900 text-white'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      <Palette className="w-3.5 h-3.5" />
                      Style
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeTab('letters')}
                      className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                        effectiveResumeTab === 'letters'
                          ? 'bg-stone-900 text-white'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      Letters
                      {resumeAttachments.length > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                            effectiveResumeTab === 'letters'
                              ? 'bg-sky-500 text-white'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {resumeAttachments.length}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    {view === 'role' && activeJob && activeResume && effectiveResumeTab === 'details' && (
                      <JobDetailsPanel
                        job={activeJob}
                        roleResume={activeResume}
                        masterResume={masterResume}
                        snapshots={snapshots}
                        syncingMaster={syncingMaster}
                        onUpdateJob={(patch) => handleUpdateJob(activeJob.id, patch)}
                        onDeleteJob={() => void handleDeleteJob(activeJob)}
                        onSyncFromMaster={handleSyncFromMaster}
                        onCreateSnapshot={handleCreateSnapshot}
                        onRestoreSnapshot={handleRestoreSnapshot}
                        onDeleteSnapshot={handleDeleteSnapshot}
                      />
                    )}
                    {activeResume && effectiveResumeTab === 'visual' && (
                      <VisualEditor data={activeResume.data} onChange={handleResumeDataChange} />
                    )}
                    {activeResume && effectiveResumeTab === 'json' && (
                      <JsonEditor data={activeResume.data} onChange={handleResumeDataChange} />
                    )}
                    {activeResume && effectiveResumeTab === 'style' && (
                      <StylePanel
                        config={activeResume.config}
                        onChange={handleResumeConfigChange}
                      />
                    )}
                    {activeResume && effectiveResumeTab === 'letters' && (
                      <RecommendationsPanel
                        targetLabel="Resume"
                        library={recommendations}
                        attached={resumeAttachments}
                        uploading={uploadingRecommendation}
                        onUploadFiles={(files, autoAttach) =>
                          handleUploadRecommendations(
                            files,
                            autoAttach,
                            'resume',
                            activeResume.id,
                            resumeAttachments
                          )
                        }
                        onUpdateLetter={handleUpdateRecommendation}
                        onDeleteLetter={handleDeleteRecommendation}
                        onSetAttachedIds={(ids) =>
                          handleSetAttachedIds('resume', activeResume.id, ids)
                        }
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="h-10 shrink-0 px-3 border-b border-stone-200 bg-white flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCoverLetterTab('write')}
                      className={`h-7 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                        coverLetterTab === 'write'
                          ? 'bg-stone-900 text-white'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Write Letter
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverLetterTab('letters')}
                      className={`h-7 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                        coverLetterTab === 'letters'
                          ? 'bg-stone-900 text-white'
                          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      Recommendations
                      {coverLetterAttachments.length > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                            coverLetterTab === 'letters'
                              ? 'bg-sky-500 text-white'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {coverLetterAttachments.length}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    {coverLetterTab === 'write' ? (
                      <CoverLetterEditor
                        letters={scopedLetters}
                        activeLetter={activeLetter}
                        onSelect={setActiveMasterLetterId}
                        onCreate={handleCreateLetter}
                        onDelete={handleDeleteLetter}
                        onChange={handleLetterChange}
                      />
                    ) : activeLetter ? (
                      <RecommendationsPanel
                        targetLabel="Cover Letter"
                        library={recommendations}
                        attached={coverLetterAttachments}
                        uploading={uploadingRecommendation}
                        onUploadFiles={(files, autoAttach) =>
                          handleUploadRecommendations(
                            files,
                            autoAttach,
                            'cover_letter',
                            activeLetter.id,
                            coverLetterAttachments
                          )
                        }
                        onUpdateLetter={handleUpdateRecommendation}
                        onDeleteLetter={handleDeleteRecommendation}
                        onSetAttachedIds={(ids) =>
                          handleSetAttachedIds('cover_letter', activeLetter.id, ids)
                        }
                      />
                    ) : (
                      <div className="p-6 text-center text-xs text-stone-500">
                        Create a cover letter first to attach letters of recommendation.
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* Right Live Typst Preview + Attached Recommendation Pages */}
            <PreviewPane preview={preview} mode={mode} attachments={activeAttachments} />
          </main>
        </div>
      )}

      {/* Create New Company / Job Posting Modal */}
      <NewJobModal
        open={newJobModalOpen}
        companies={companies}
        globalCoverLetters={globalCoverLetters}
        initialCompanyId={newJobInitialCompanyId}
        onClose={() => setNewJobModalOpen(false)}
        onCreate={handleCreateJob}
      />
    </div>
  );
}
