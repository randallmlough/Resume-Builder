import { useMemo, useState } from 'react';
import {
  Camera,
  ExternalLink,
  GitBranch,
  History,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  CONTACT_RELATIONSHIPS,
  JOB_STAGES,
  type CompanyContactRecord,
  type ContactRelationship,
  type JobPostingRecord,
  type JobStage,
  type ResumeRecord,
  type ResumeSnapshotRecord,
  type RoleContactRecord,
} from '@shared/schema';
import { computeResumeDiffs } from '@shared/resumeDiff';
import { ContactFormCard, ContactLinksBar, type ContactDraft } from './ContactFormCard';

const RELATIONSHIP_BADGE: Record<ContactRelationship, string> = {
  hiring_manager: 'bg-sky-50 text-sky-800 border-sky-200',
  decision_maker: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  recruiter: 'bg-amber-50 text-amber-800 border-amber-200',
  referral: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  interviewer: 'bg-stone-100 text-stone-700 border-stone-200',
  other: 'bg-stone-100 text-stone-600 border-stone-200',
};

interface JobDetailsPanelProps {
  job: JobPostingRecord;
  roleResume: ResumeRecord;
  masterResume: ResumeRecord | null;
  snapshots: ResumeSnapshotRecord[];
  companyContacts: CompanyContactRecord[];
  roleContacts: RoleContactRecord[];
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
  onCreateAndLinkContact: (draft: ContactDraft) => Promise<void>;
  onUpdateContact: (contactId: string, draft: ContactDraft) => Promise<void>;
  onLinkContact: (contactId: string, relationship: ContactRelationship) => Promise<void>;
  onUnlinkContact: (contactId: string) => Promise<void>;
  onOpenCompanyPage: () => void;
}

const inputCls =
  'w-full h-8 px-2.5 text-xs rounded-md border border-stone-200 bg-stone-50/70 focus:bg-white focus:border-sky-500 outline-none transition-colors';

export function JobDetailsPanel({
  job,
  roleResume,
  masterResume,
  snapshots,
  companyContacts,
  roleContacts,
  syncingMaster,
  onUpdateJob,
  onDeleteJob,
  onSyncFromMaster,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onCreateAndLinkContact,
  onUpdateContact,
  onLinkContact,
  onUnlinkContact,
  onOpenCompanyPage,
}: JobDetailsPanelProps) {
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [preserveSummary, setPreserveSummary] = useState(true);
  const [freezing, setFreezing] = useState(false);

  const [addingContact, setAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [selectedRelationship, setSelectedRelationship] =
    useState<ContactRelationship>('hiring_manager');

  const linkedIds = new Set(roleContacts.map((c) => c.id));
  const availableCompanyContacts = companyContacts.filter((c) => !linkedIds.has(c.id));

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

      {/* Role Contacts (Hiring Manager / Decision Makers) */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-4 h-4 text-sky-700 shrink-0" />
              <h3 className="text-sm font-semibold text-stone-900 truncate">
                Role Contacts ({roleContacts.length})
              </h3>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onOpenCompanyPage}
                className="h-7 px-2 rounded-md text-[11px] font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-100"
              >
                Directory
              </button>
              {!addingContact && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingContactId(null);
                    setAddingContact(true);
                  }}
                  className="h-7 px-2.5 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/80 text-xs font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  New
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-stone-500">
            Hiring manager, decision makers, recruiters, or referrals for this posting.
          </p>
        </div>

        {/* Link existing contact from this company */}
        {availableCompanyContacts.length > 0 && !addingContact && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={selectedExistingId}
              onChange={(e) => setSelectedExistingId(e.target.value)}
              className="flex-1 min-w-[140px] h-8 px-2 text-xs rounded-md border border-stone-200 bg-stone-50 focus:bg-white focus:border-sky-500 outline-none"
            >
              <option value="">Link existing {job.companyName} contact…</option>
              {availableCompanyContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.title ? ` — ${c.title}` : ''}
                </option>
              ))}
            </select>
            <select
              value={selectedRelationship}
              onChange={(e) => setSelectedRelationship(e.target.value as ContactRelationship)}
              className="h-8 px-2 text-xs rounded-md border border-stone-200 bg-stone-50 focus:bg-white focus:border-sky-500 outline-none"
            >
              {CONTACT_RELATIONSHIPS.map((rel) => (
                <option key={rel.id} value={rel.id}>
                  {rel.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedExistingId}
              onClick={async () => {
                if (!selectedExistingId) return;
                await onLinkContact(selectedExistingId, selectedRelationship);
                setSelectedExistingId('');
              }}
              className="h-8 px-2.5 rounded-md bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium inline-flex items-center gap-1 disabled:opacity-40"
            >
              <UserPlus className="w-3 h-3" />
              Link
            </button>
          </div>
        )}

        {addingContact && (
          <ContactFormCard
            showRelationship
            submitLabel="Create & Link"
            onSubmit={async (draft) => {
              await onCreateAndLinkContact(draft);
              setAddingContact(false);
            }}
            onCancel={() => setAddingContact(false)}
          />
        )}

        {roleContacts.length === 0 && !addingContact ? (
          <div className="text-xs text-stone-400 text-center py-3 border border-dashed border-stone-200 rounded-lg">
            No contacts linked to this role yet.
          </div>
        ) : (
          <div className="space-y-2">
            {roleContacts.map((contact) =>
              editingContactId === contact.id ? (
                <ContactFormCard
                  key={contact.id}
                  initial={contact}
                  showRelationship
                  submitLabel="Save Contact"
                  onSubmit={async (draft) => {
                    await onUpdateContact(contact.id, draft);
                    if (draft.relationship && draft.relationship !== contact.relationship) {
                      await onLinkContact(contact.id, draft.relationship);
                    }
                    setEditingContactId(null);
                  }}
                  onCancel={() => setEditingContactId(null)}
                />
              ) : (
                <div
                  key={contact.id}
                  className="rounded-lg border border-stone-200 bg-stone-50/60 p-3 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-stone-900">
                          {contact.name}
                        </span>
                        <select
                          value={contact.relationship}
                          onChange={(e) =>
                            void onLinkContact(contact.id, e.target.value as ContactRelationship)
                          }
                          aria-label={`Relationship for ${contact.name}`}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border outline-none cursor-pointer ${
                            RELATIONSHIP_BADGE[contact.relationship]
                          }`}
                        >
                          {CONTACT_RELATIONSHIPS.map((rel) => (
                            <option key={rel.id} value={rel.id}>
                              {rel.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {contact.title && (
                        <div className="text-[11px] text-stone-500 mt-0.5">{contact.title}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingContact(false);
                          setEditingContactId(contact.id);
                        }}
                        title="Edit contact details"
                        className="w-6 h-6 rounded inline-flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-white"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onUnlinkContact(contact.id)}
                        title="Unlink contact from this role (keeps in company directory)"
                        className="w-6 h-6 rounded inline-flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <ContactLinksBar contact={contact} />

                  {contact.notes && (
                    <p className="text-[11px] text-stone-600 pt-0.5 leading-relaxed">
                      {contact.notes}
                    </p>
                  )}
                </div>
              )
            )}
          </div>
        )}
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
