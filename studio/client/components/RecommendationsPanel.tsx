import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileImage,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { RecommendationLetterRecord } from '@shared/schema';

interface RecommendationsPanelProps {
  targetLabel: 'Resume' | 'Cover Letter';
  library: RecommendationLetterRecord[];
  attached: RecommendationLetterRecord[];
  uploading: boolean;
  onUploadFiles: (files: FileList | File[], autoAttach: boolean) => Promise<void>;
  onUpdateLetter: (
    id: string,
    patch: { title?: string; authorName?: string; authorTitle?: string }
  ) => Promise<void>;
  onDeleteLetter: (id: string) => Promise<void>;
  onSetAttachedIds: (letterIds: string[]) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RecommendationsPanel({
  targetLabel,
  library,
  attached,
  uploading,
  onUploadFiles,
  onUpdateLetter,
  onDeleteLetter,
  onSetAttachedIds,
}: RecommendationsPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [autoAttach, setAutoAttach] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: '', authorName: '', authorTitle: '' });

  const attachedIds = attached.map((l) => l.id);
  const attachedSet = new Set(attachedIds);
  const totalAttachedPages = attached.reduce((sum, l) => sum + (l.pageCount || 1), 0);

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    try {
      await onUploadFiles(files, autoAttach);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const toggleAttach = (letterId: string) => {
    if (attachedSet.has(letterId)) {
      onSetAttachedIds(attachedIds.filter((id) => id !== letterId));
    } else {
      onSetAttachedIds([...attachedIds, letterId]);
    }
  };

  const moveAttached = (idx: number, delta: number) => {
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= attachedIds.length) return;
    const next = [...attachedIds];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    onSetAttachedIds(next);
  };

  const startEdit = (letter: RecommendationLetterRecord) => {
    setEditingId(letter.id);
    setEditDraft({
      title: letter.title,
      authorName: letter.authorName,
      authorTitle: letter.authorTitle,
    });
  };

  const commitEdit = async () => {
    if (!editingId) return;
    const id = editingId;
    setEditingId(null);
    await onUpdateLetter(id, {
      title: editDraft.title.trim() || 'Letter of Recommendation',
      authorName: editDraft.authorName.trim(),
      authorTitle: editDraft.authorTitle.trim(),
    });
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Attached to active Resume / Cover Letter */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              Attached to This {targetLabel}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Appended in order to the live preview and merged into your exported PDF.
            </p>
          </div>
          {attached.length > 0 && (
            <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80">
              +{totalAttachedPages} {totalAttachedPages === 1 ? 'page' : 'pages'}
            </span>
          )}
        </div>

        {attached.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/70 px-3 py-4 text-center text-xs text-stone-500">
            No letters attached to this {targetLabel.toLowerCase()} yet. Upload a PDF/image below or
            attach one from your library.
          </div>
        ) : (
          <div className="space-y-2">
            {attached.map((letter, idx) => (
              <div
                key={letter.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-sky-200/80 bg-sky-50/40 px-3 py-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-sky-700 text-white text-[11px] font-semibold inline-flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-stone-900 truncate">
                      {letter.title}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">
                      {[
                        letter.authorName,
                        letter.authorTitle,
                        `${letter.pageCount} ${letter.pageCount === 1 ? 'page' : 'pages'}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveAttached(idx, -1)}
                    title="Move earlier"
                    className="w-7 h-7 inline-flex items-center justify-center rounded text-stone-500 hover:text-stone-900 hover:bg-white disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === attached.length - 1}
                    onClick={() => moveAttached(idx, 1)}
                    title="Move later"
                    className="w-7 h-7 inline-flex items-center justify-center rounded text-stone-500 hover:text-stone-900 hover:bg-white disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAttach(letter.id)}
                    title={`Detach from ${targetLabel.toLowerCase()}`}
                    className="w-7 h-7 inline-flex items-center justify-center rounded text-stone-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Dropzone */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-stone-900">Upload Letter of Recommendation</h3>
          <label className="inline-flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoAttach}
              onChange={(e) => setAutoAttach(e.target.checked)}
              className="rounded border-stone-300 accent-sky-700"
            />
            Auto-attach to this {targetLabel.toLowerCase()}
          </label>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              void handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) {
              void handleFiles(e.dataTransfer.files);
            }
          }}
          className={`rounded-lg border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-sky-500 bg-sky-50/70'
              : 'border-stone-200 bg-stone-50/60 hover:border-stone-300 hover:bg-stone-50'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-sky-700">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs font-medium">Uploading &amp; indexing pages…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-9 h-9 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-600 shadow-2xs">
                <Upload className="w-4 h-4" />
              </div>
              <div className="text-xs font-semibold text-stone-800">
                Drop PDF, PNG, or JPG letters here, or click to browse
              </div>
              <div className="text-[11px] text-stone-500">
                Preserves original letterhead &amp; signatures · up to 15 MB per file
              </div>
            </div>
          )}
        </div>

        {uploadError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {uploadError}
          </div>
        )}
      </div>

      {/* Reusable Letters Library */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Your Letters Library</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Upload once, attach to any resume variant or cover letter.
            </p>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
            {library.length} {library.length === 1 ? 'letter' : 'letters'}
          </span>
        </div>

        {library.length === 0 ? (
          <div className="text-xs text-stone-500 py-3 text-center">
            Your library is empty. Uploaded letters will appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {library.map((letter) => {
              const isAttached = attachedSet.has(letter.id);
              const isEditing = editingId === letter.id;
              const isPdf = letter.mimeType === 'application/pdf';

              return (
                <div
                  key={letter.id}
                  className="rounded-lg border border-stone-200 p-3 space-y-2 bg-stone-50/40"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        value={editDraft.title}
                        onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                        placeholder="Letter title"
                        className="w-full h-8 px-2.5 text-xs rounded-md border border-stone-200 bg-white focus:border-sky-500 outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={editDraft.authorName}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, authorName: e.target.value }))
                          }
                          placeholder="Recommender name"
                          className="h-8 px-2.5 text-xs rounded-md border border-stone-200 bg-white focus:border-sky-500 outline-none"
                        />
                        <input
                          value={editDraft.authorTitle}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, authorTitle: e.target.value }))
                          }
                          placeholder="Title / Company"
                          className="h-8 px-2.5 text-xs rounded-md border border-stone-200 bg-white focus:border-sky-500 outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="h-7 px-2.5 text-xs rounded-md border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void commitEdit()}
                          className="h-7 px-2.5 text-xs font-medium rounded-md bg-sky-700 text-white hover:bg-sky-800"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-md bg-white border border-stone-200 flex items-center justify-center text-stone-600 shrink-0 mt-0.5">
                          {isPdf ? (
                            <FileText className="w-4 h-4 text-red-600" />
                          ) : (
                            <FileImage className="w-4 h-4 text-sky-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-stone-900 truncate">
                            {letter.title}
                          </div>
                          {(letter.authorName || letter.authorTitle) && (
                            <div className="text-[11px] text-stone-600 truncate">
                              {[letter.authorName, letter.authorTitle].filter(Boolean).join(' — ')}
                            </div>
                          )}
                          <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="uppercase font-mono text-[10px] px-1.5 py-0.2 rounded bg-stone-200/70 text-stone-600">
                              {isPdf ? 'PDF' : letter.mimeType.replace('image/', '')}
                            </span>
                            <span>
                              {letter.pageCount} {letter.pageCount === 1 ? 'pg' : 'pgs'}
                            </span>
                            <span>·</span>
                            <span>{formatBytes(letter.sizeBytes)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleAttach(letter.id)}
                          className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                            isAttached
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-white text-stone-700 border border-stone-200 hover:border-sky-400 hover:text-sky-700'
                          }`}
                        >
                          {isAttached ? (
                            <>
                              <Check className="w-3 h-3" />
                              Attached
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              Attach
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(letter)}
                          title="Edit details"
                          className="w-7 h-7 inline-flex items-center justify-center rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200/60"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete "${letter.title}" from your library? It will also be detached from any resumes or cover letters.`
                              )
                            ) {
                              void onDeleteLetter(letter.id);
                            }
                          }}
                          title="Delete letter"
                          className="w-7 h-7 inline-flex items-center justify-center rounded text-stone-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
