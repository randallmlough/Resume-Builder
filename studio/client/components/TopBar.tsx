import { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileJson,
  FileText,
  FolderSync,
  Loader2,
  Mail,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ResumeRecord } from '@shared/schema';

interface TopBarProps {
  resumes: ResumeRecord[];
  activeResume: ResumeRecord | null;
  mode: 'resume' | 'cover-letter';
  saveStatus: 'saved' | 'saving' | 'dirty' | 'error';
  exportingPdf: boolean;
  typstReady: boolean;
  attachedCount: number;
  onSelectResume: (id: string) => void;
  onRenameResume: (title: string) => void;
  onCreateResume: () => void;
  onCloneResume: () => void;
  onDeleteResume: () => void;
  onSeedFromRepo: () => void;
  onImportJson: (jsonText: string) => void;
  onExportJson: () => void;
  onModeChange: (mode: 'resume' | 'cover-letter') => void;
  onDownloadPdf: () => void;
}

export function TopBar({
  resumes,
  activeResume,
  mode,
  saveStatus,
  exportingPdf,
  typstReady,
  attachedCount,
  onSelectResume,
  onRenameResume,
  onCreateResume,
  onCloneResume,
  onDeleteResume,
  onSeedFromRepo,
  onImportJson,
  onExportJson,
  onModeChange,
  onDownloadPdf,
}: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  const startRename = () => {
    if (!activeResume) return;
    setDraftTitle(activeResume.title);
    setEditingTitle(true);
  };

  const commitRename = () => {
    setEditingTitle(false);
    const trimmed = draftTitle.trim();
    if (trimmed && activeResume && trimmed !== activeResume.title) {
      onRenameResume(trimmed);
    }
  };

  return (
    <header className="h-14 shrink-0 border-b border-stone-200/90 bg-white px-4 flex items-center justify-between gap-3 z-20">
      {/* Left: Brand + Resume Switcher */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-sky-700 text-white flex items-center justify-center font-serif font-bold text-sm shadow-xs">
            R
          </div>
          <span className="font-semibold text-sm tracking-tight text-stone-900 hidden sm:inline">
            Resume Studio
          </span>
        </div>

        <div className="h-5 w-px bg-stone-200 hidden sm:block" />

        {/* Document Picker */}
        <div className="flex items-center gap-1.5 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              className="h-8 px-2.5 text-sm font-medium bg-stone-50 border border-sky-500 rounded-md outline-none w-56"
            />
          ) : (
            <select
              value={activeResume?.id ?? ''}
              onChange={(e) => onSelectResume(e.target.value)}
              onDoubleClick={startRename}
              title="Double-click or use rename to edit title"
              className="h-8 max-w-[230px] truncate rounded-md border border-stone-200 bg-stone-50 px-2.5 text-sm font-medium text-stone-800 hover:border-stone-300 focus:border-sky-500 focus:outline-none"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={startRename}
            disabled={!activeResume}
            title="Rename resume"
            className="h-8 px-2 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors disabled:opacity-40"
          >
            Rename
          </button>

          <button
            type="button"
            onClick={onCloneResume}
            disabled={!activeResume}
            title="Clone resume to tailor for a specific role"
            className="h-8 px-2 inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors disabled:opacity-40"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Clone</span>
          </button>

          <button
            type="button"
            onClick={onCreateResume}
            title="Create blank resume"
            className="h-8 w-8 inline-flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>

          {resumes.length > 1 && (
            <button
              type="button"
              onClick={onDeleteResume}
              title="Delete current resume"
              className="h-8 w-8 inline-flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Center: Resume / Cover Letter Mode Switch */}
      <div className="inline-flex items-center rounded-lg bg-stone-100 p-0.5 border border-stone-200/80 shrink-0">
        <button
          type="button"
          onClick={() => onModeChange('resume')}
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
          onClick={() => onModeChange('cover-letter')}
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

      {/* Right: Save Status, Import/Export, Download PDF */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden md:flex items-center gap-1.5 text-xs text-stone-500 mr-1">
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
            file.text().then(onImportJson);
            e.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={onSeedFromRepo}
          title="Import latest resume.json & config.yml from parent repo"
          className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition-colors"
        >
          <FolderSync className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Import Repo</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Upload a resume.json file"
          className="h-8 w-8 inline-flex items-center justify-center text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onExportJson}
          disabled={!activeResume}
          title="Download resume.json"
          className="h-8 w-8 inline-flex items-center justify-center text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md transition-colors disabled:opacity-40"
        >
          <FileJson className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={!typstReady || exportingPdf || !activeResume}
          title={
            attachedCount > 0
              ? `Export merged PDF with ${attachedCount} attached recommendation ${attachedCount === 1 ? 'letter' : 'letters'}`
              : 'Export PDF'
          }
          className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-md bg-sky-700 hover:bg-sky-800 active:bg-sky-900 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
        >
          {exportingPdf ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>{attachedCount > 0 ? `Export PDF (+${attachedCount})` : 'Export PDF'}</span>
        </button>
      </div>
    </header>
  );
}
