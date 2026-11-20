import { useCallback, useEffect, useRef, useState } from 'react';
import { Code2, Mail, Palette, Paperclip, SlidersHorizontal } from 'lucide-react';
import {
  DEFAULT_CONFIG,
  ResumeDataSchema,
  type AttachmentTargetType,
  type CoverLetterRecord,
  type RecommendationLetterRecord,
  type ResumeConfig,
  type ResumeData,
  type ResumeRecord,
} from '@shared/schema';
import { api } from './api';
import { useTypst } from './typst/useTypst';
import { mergePdfWithAttachments } from './pdf/mergePdf';
import { TopBar } from './components/TopBar';
import { VisualEditor } from './components/VisualEditor';
import { JsonEditor } from './components/JsonEditor';
import { StylePanel } from './components/StylePanel';
import { CoverLetterEditor } from './components/CoverLetterEditor';
import { RecommendationsPanel } from './components/RecommendationsPanel';
import { PreviewPane } from './components/PreviewPane';

type ResumeTab = 'visual' | 'json' | 'style' | 'letters';
type CoverLetterTab = 'write' | 'letters';

export function App() {
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [letters, setLetters] = useState<CoverLetterRecord[]>([]);
  const [activeLetterId, setActiveLetterId] = useState<string | null>(null);

  const [recommendations, setRecommendations] = useState<RecommendationLetterRecord[]>([]);
  const [resumeAttachments, setResumeAttachments] = useState<RecommendationLetterRecord[]>([]);
  const [coverLetterAttachments, setCoverLetterAttachments] = useState<RecommendationLetterRecord[]>(
    []
  );
  const [uploadingRecommendation, setUploadingRecommendation] = useState(false);

  const [mode, setMode] = useState<'resume' | 'cover-letter'>('resume');
  const [resumeTab, setResumeTab] = useState<ResumeTab>('visual');
  const [coverLetterTab, setCoverLetterTab] = useState<CoverLetterTab>('write');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const letterSaveTimerRef = useRef<number | null>(null);

  const activeResume = resumes.find((r) => r.id === activeResumeId) ?? resumes[0] ?? null;
  const activeLetter = letters.find((l) => l.id === activeLetterId) ?? letters[0] ?? null;
  const activeAttachments = mode === 'resume' ? resumeAttachments : coverLetterAttachments;

  // Initial data load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loadedResumes, loadedLetters, loadedRecs] = await Promise.all([
          api.listResumes(),
          api.listCoverLetters(),
          api.listRecommendations(),
        ]);
        if (cancelled) return;
        setResumes(loadedResumes);
        setActiveResumeId(loadedResumes[0]?.id ?? null);
        setLetters(loadedLetters);
        setActiveLetterId(loadedLetters[0]?.id ?? null);
        setRecommendations(loadedRecs);
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

  // Load attachments whenever the active resume changes
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

  // Load attachments whenever the active cover letter changes
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

  // Typst WASM live preview
  const preview = useTypst(
    mode,
    activeResume?.data ?? null,
    activeResume?.config ?? null,
    activeLetter?.bodyMarkdown ?? ''
  );

  // Debounced autosave for active resume
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

  // Debounced autosave for active cover letter
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

  const handleRenameResume = async (title: string) => {
    if (!activeResume) return;
    setResumes((prev) => prev.map((r) => (r.id === activeResume.id ? { ...r, title } : r)));
    scheduleResumeSave(activeResume.id, { title });
  };

  const handleCreateResume = async () => {
    const created = await api.createResume({
      title: `New Resume ${resumes.length + 1}`,
      data: ResumeDataSchema.parse({
        name: activeResume?.data.name || 'Your Name',
        contact: activeResume?.data.contact ?? {},
        summary: 'Brief professional overview...',
        experience: [],
        projects: [],
        education: [],
        skills: [],
      }),
      config: DEFAULT_CONFIG,
    });
    setResumes((prev) => [created, ...prev]);
    setActiveResumeId(created.id);
    setMode('resume');
  };

  const handleCloneResume = async () => {
    if (!activeResume) return;
    const cloned = await api.cloneResume(activeResume.id);
    setResumes((prev) => [cloned, ...prev]);
    setActiveResumeId(cloned.id);
  };

  const handleDeleteResume = async () => {
    if (!activeResume || resumes.length <= 1) return;
    if (!window.confirm(`Delete "${activeResume.title}"?`)) return;
    await api.deleteResume(activeResume.id);
    const remaining = resumes.filter((r) => r.id !== activeResume.id);
    setResumes(remaining);
    setActiveResumeId(remaining[0]?.id ?? null);
  };

  const handleSeedFromRepo = async () => {
    const imported = await api.seedFromRepo();
    setResumes((prev) => [imported, ...prev]);
    setActiveResumeId(imported.id);
    setMode('resume');
  };

  const handleImportJson = async (text: string) => {
    try {
      const parsed = ResumeDataSchema.parse(JSON.parse(text));
      const created = await api.createResume({
        title: `${parsed.name || 'Imported'} (${new Date().toLocaleDateString()})`,
        data: parsed,
        config: activeResume?.config ?? DEFAULT_CONFIG,
      });
      setResumes((prev) => [created, ...prev]);
      setActiveResumeId(created.id);
      setMode('resume');
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
    const slug = activeResume.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.download = `${slug || 'resume'}.json`;
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
          ? `${activeLetter?.company || activeLetter?.title || 'cover-letter'}`
          : `${activeResume.data.name || activeResume.title}-resume`;
      a.download = `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(`PDF export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleCreateLetter = async () => {
    if (!activeResume) return;
    const created = await api.createCoverLetter({
      resumeId: activeResume.id,
      title: `Cover Letter ${letters.length + 1}`,
      company: 'Target Company',
      bodyMarkdown: `Dear Hiring Team,\n\nI am excited to apply for this role...\n\nBest regards,\n\n${activeResume.data.name}`,
    });
    setLetters((prev) => [created, ...prev]);
    setActiveLetterId(created.id);
    setCoverLetterTab('write');
  };

  const handleDeleteLetter = async (id: string) => {
    await api.deleteCoverLetter(id);
    const remaining = letters.filter((l) => l.id !== id);
    setLetters(remaining);
    setActiveLetterId(remaining[0]?.id ?? null);
  };

  const handleLetterChange = (
    patch: Partial<Pick<CoverLetterRecord, 'title' | 'company' | 'bodyMarkdown'>>
  ) => {
    if (!activeLetter) return;
    setLetters((prev) => prev.map((l) => (l.id === activeLetter.id ? { ...l, ...patch } : l)));
    scheduleLetterSave(activeLetter.id, patch);
  };

  // ── Recommendations & Attachments handlers ────────────────────────────────
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
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    []
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

  return (
    <div className="h-full flex flex-col bg-stone-100 overflow-hidden">
      <TopBar
        resumes={resumes}
        activeResume={activeResume}
        mode={mode}
        saveStatus={saveStatus}
        exportingPdf={exportingPdf}
        typstReady={preview.ready}
        attachedCount={activeAttachments.length}
        onSelectResume={setActiveResumeId}
        onRenameResume={handleRenameResume}
        onCreateResume={handleCreateResume}
        onCloneResume={handleCloneResume}
        onDeleteResume={handleDeleteResume}
        onSeedFromRepo={handleSeedFromRepo}
        onImportJson={handleImportJson}
        onExportJson={handleExportJson}
        onModeChange={setMode}
        onDownloadPdf={handleDownloadPdf}
      />

      {/* Split-Pane Studio */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Editor Pane */}
        <aside className="w-[46%] min-w-[380px] max-w-[680px] flex flex-col border-r border-stone-200/90 bg-stone-100/60 min-h-0">
          {mode === 'resume' ? (
            <>
              <div className="h-10 shrink-0 px-3 border-b border-stone-200 bg-white flex items-center gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setResumeTab('visual')}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                    resumeTab === 'visual'
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Visual Editor
                </button>
                <button
                  type="button"
                  onClick={() => setResumeTab('json')}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                    resumeTab === 'json'
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Raw JSON
                </button>
                <button
                  type="button"
                  onClick={() => setResumeTab('style')}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                    resumeTab === 'style'
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  Style &amp; Layout
                </button>
                <button
                  type="button"
                  onClick={() => setResumeTab('letters')}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors ${
                    resumeTab === 'letters'
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  Letters
                  {resumeAttachments.length > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                        resumeTab === 'letters'
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
                {activeResume && resumeTab === 'visual' && (
                  <VisualEditor data={activeResume.data} onChange={handleResumeDataChange} />
                )}
                {activeResume && resumeTab === 'json' && (
                  <JsonEditor data={activeResume.data} onChange={handleResumeDataChange} />
                )}
                {activeResume && resumeTab === 'style' && (
                  <StylePanel config={activeResume.config} onChange={handleResumeConfigChange} />
                )}
                {activeResume && resumeTab === 'letters' && (
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
                    onSetAttachedIds={(ids) => handleSetAttachedIds('resume', activeResume.id, ids)}
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
                    letters={letters}
                    activeLetter={activeLetter}
                    onSelect={setActiveLetterId}
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
        </aside>

        {/* Right Live Typst Preview + Attached Recommendation Pages */}
        <PreviewPane preview={preview} mode={mode} attachments={activeAttachments} />
      </main>
    </div>
  );
}
