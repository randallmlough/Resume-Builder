import { useMemo, useState } from 'react';
import {
  Camera,
  ExternalLink,
  GitBranch,
  History,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  JOB_STAGES,
  type JobPostingRecord,
  type JobStage,
  type ResumeRecord,
  type ResumeSnapshotRecord,
} from '@shared/schema';
import { computeResumeDiffs } from '@shared/resumeDiff';

interface JobDetailsPanelProps {
  job: JobPostingRecord;
  roleResume: ResumeRecord;
  masterResume: ResumeRecord | null;
  snapshots: ResumeSnapshotRecord[];
  syncingMaster: boolean;
  onUpdateJob: (
    patch: Partial<
      Pick<
        JobPostingRecord,
        'title' | 'stage' | 'url' | 'location' | 'compensation' | 'description' | 'notes'
      >
    >
  ) => void;
  onDeleteJob: () => void;
  onSyncFromMaster: (preserveCustomSummary: boolean) => Promise<void>;
  onCreateSnapshot: (label: string) => Promise<void>;
  onRestoreSnapshot: (snapshotId: string) => Promise<void>;
  onDeleteSnapshot: (snapshotId: string) => Promise<void>;
}

const inputCls =
  'w-full h-8 px-2.5 text-xs rounded-md border border-stone-200 bg-stone-50/70 focus:bg-white focus:border-sky-500 outline-none transition-colors';

export function JobDetailsPanel({
  job,
  roleResume,
  masterResume,
  snapshots,
  syncingMaster,
  onUpdateJob,
  onDeleteJob,
  onSyncFromMaster,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
}: JobDetailsPanelProps) {
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [preserveSummary, setPreserveSummary] = useState(true);
  const [freezing, setFreezing] = useState(false);

  const diffs = useMemo(() => {
    if (!masterResume) return [];
    return computeResumeDiffs(
      masterResume.data,
      masterResume.config,
      roleResume.data,
      roleResume.config
    );
  }, [masterResume, roleResume]);

  const masterHasUpdates = Boolean(
    masterResume && roleResume.baseSyncedAt && masterResume.updatedAt > roleResume.baseSyncedAt
  );

  const handleFreeze = async () => {
    setFreezing(true);
    try {
      const nextNum = snapshots.length + 1;
      const label =
        snapshotLabel.trim() ||
        `v${nextNum} · ${job.stage === 'applied' ? 'Submitted' : 'Checkpoint'} (${new Date().toLocaleDateString()})`;
      await onCreateSnapshot(label);
      setSnapshotLabel('');
    } finally {
      setFreezing(false);
    }
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Role & Posting Details */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">
              {job.companyName}
            </div>
            <h3 className="text-sm font-bold text-stone-900">Job Posting Details</h3>
          </div>
          <button
            type="button"
            onClick={onDeleteJob}
            title="Delete this role posting"
            className="h-7 px-2 rounded-md text-xs text-stone-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Role
          </button>
        </div>

        <div className="grid grid-cols-12 gap-2.5">
          <div className="col-span-8">
            <label className="block text-[11px] font-medium text-stone-500 mb-1">Role Title</label>
            <input
              value={job.title}
              onChange={(e) => onUpdateJob({ title: e.target.value })}
              className={inputCls}
              placeholder="e.g., Senior Frontend Engineer"
            />
          </div>
          <div className="col-span-4">
            <label className="block text-[11px] font-medium text-stone-500 mb-1">Stage</label>
            <select
              value={job.stage}
              onChange={(e) => onUpdateJob({ stage: e.target.value as JobStage })}
              className={inputCls}
            >
              {JOB_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-stone-500 mb-1">
            Job Posting URL
          </label>
          <div className="flex items-center gap-1.5">
            <input
              value={job.url}
              onChange={(e) => onUpdateJob({ url: e.target.value })}
              className={inputCls}
              placeholder="https://boards.greenhouse.io/..."
            />
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-2.5 shrink-0 rounded-md border border-stone-200 bg-stone-50 hover:bg-sky-50 hover:border-sky-300 text-xs font-medium text-sky-700 inline-flex items-center gap-1"
              >
                Open
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-medium text-stone-500 mb-1">Location</label>
            <input
              value={job.location}
              onChange={(e) => onUpdateJob({ location: e.target.value })}
              className={inputCls}
              placeholder="Remote / San Francisco"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-stone-500 mb-1">
              Compensation
            </label>
            <input
              value={job.compensation}
              onChange={(e) => onUpdateJob({ compensation: e.target.value })}
              className={inputCls}
              placeholder="$220k–$260k"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-stone-500 mb-1">
            Job Description / Key Requirements
          </label>
          <textarea
            rows={4}
            value={job.description}
            onChange={(e) => onUpdateJob({ description: e.target.value })}
            placeholder="Paste the job posting highlights or key requirements to tailor against…"
            className="w-full p-2.5 text-xs leading-relaxed rounded-md border border-stone-200 bg-stone-50/70 focus:bg-white focus:border-sky-500 outline-none resize-y"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-stone-500 mb-1">
            Notes / Interview Log / Contacts
          </label>
          <textarea
            rows={3}
            value={job.notes}
            onChange={(e) => onUpdateJob({ notes: e.target.value })}
            placeholder="Referral name, recruiter notes, upcoming interview rounds…"
            className="w-full p-2.5 text-xs leading-relaxed rounded-md border border-stone-200 bg-stone-50/70 focus:bg-white focus:border-sky-500 outline-none resize-y"
          />
        </div>
      </div>

      {/* Master Resume Diff & Sync */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-sky-700" />
            <h3 className="text-sm font-semibold text-stone-900">Tailored Changes vs Master</h3>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
            {diffs.length} {diffs.length === 1 ? 'diff' : 'diffs'}
          </span>
        </div>

        {masterHasUpdates && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>Master Resume was updated</strong> since this role last synced. Pull latest
            bullets &amp; entries below while keeping your visibility toggles intact.
          </div>
        )}

        {diffs.length === 0 ? (
          <div className="text-xs text-stone-500 bg-stone-50 rounded-lg px-3 py-2.5 border border-stone-100">
            Currently identical to Master Resume. Switch to the <strong>Visual</strong>,{' '}
            <strong>Raw JSON</strong>, or <strong>Style</strong> tabs to tailor this role.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {diffs.map((d, i) => (
              <li
                key={i}
                className="text-xs flex items-start gap-2 rounded-md bg-stone-50 border border-stone-200/70 px-2.5 py-1.5"
              >
                <span className="font-semibold text-sky-800 shrink-0">{d.area}:</span>
                <span className="text-stone-700">{d.detail}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
          <label className="inline-flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preserveSummary}
              onChange={(e) => setPreserveSummary(e.target.checked)}
              className="accent-sky-700"
            />
            Keep custom summary &amp; hide toggles
          </label>
          <button
            type="button"
            disabled={syncingMaster || !masterResume}
            onClick={() => void onSyncFromMaster(preserveSummary)}
            className="h-7 px-3 rounded-md text-xs font-medium border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${syncingMaster ? 'animate-spin' : ''}`} />
            Pull from Master
          </button>
        </div>
      </div>

      {/* Frozen Submission Snapshots */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-700" />
            <div>
              <h3 className="text-sm font-semibold text-stone-900">Submission Snapshots</h3>
              <p className="text-[11px] text-stone-500">
                Freeze the exact resume &amp; cover letter you submitted so future edits stay safe.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
            {snapshots.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={snapshotLabel}
            onChange={(e) => setSnapshotLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleFreeze();
            }}
            placeholder={`v${snapshots.length + 1} · Submitted via Greenhouse`}
            className={inputCls}
          />
          <button
            type="button"
            disabled={freezing}
            onClick={() => void handleFreeze()}
            className="h-8 px-3 shrink-0 rounded-md bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5" />
            Freeze
          </button>
        </div>

        {snapshots.length === 0 ? (
          <div className="text-xs text-stone-400 text-center py-3 border border-dashed border-stone-200 rounded-lg">
            No frozen snapshots yet.
          </div>
        ) : (
          <div className="space-y-2">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-2 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-stone-800 truncate">{snap.label}</div>
                  <div className="text-[11px] text-stone-500">
                    {new Date(snap.createdAt).toLocaleString()}
                    {snap.attachedLetterIds.length > 0
                      ? ` · ${snap.attachedLetterIds.length} attached`
                      : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Restore "${snap.label}" into the active working draft for this role?`
                        )
                      ) {
                        void onRestoreSnapshot(snap.id);
                      }
                    }}
                    title="Restore snapshot"
                    className="h-7 px-2 rounded border border-stone-200 bg-white hover:bg-stone-100 text-[11px] font-medium text-stone-700 inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteSnapshot(snap.id)}
                    title="Delete snapshot"
                    className="w-7 h-7 rounded inline-flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
