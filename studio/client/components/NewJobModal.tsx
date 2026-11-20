import { useEffect, useState } from 'react';
import { Briefcase, Loader2, X } from 'lucide-react';
import { JOB_STAGES, type CompanyRecord, type CoverLetterRecord, type JobStage } from '@shared/schema';

interface NewJobModalProps {
  open: boolean;
  companies: CompanyRecord[];
  globalCoverLetters: CoverLetterRecord[];
  initialCompanyId?: string;
  onClose: () => void;
  onCreate: (input: {
    companyId?: string;
    companyName?: string;
    title: string;
    stage: JobStage;
    url: string;
    location: string;
    compensation: string;
    description: string;
    sourceCoverLetterId?: string;
  }) => Promise<void>;
}

const inputCls =
  'w-full h-9 px-3 text-xs rounded-md border border-stone-200 bg-stone-50 focus:bg-white focus:border-sky-500 outline-none';

export function NewJobModal({
  open,
  companies,
  globalCoverLetters,
  initialCompanyId,
  onClose,
  onCreate,
}: NewJobModalProps) {
  const [companyMode, setCompanyMode] = useState<'existing' | 'new'>('new');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<JobStage>('tailoring');
  const [url, setUrl] = useState('');
  const [location, setLocation] = useState('');
  const [compensation, setCompensation] = useState('');
  const [description, setDescription] = useState('');
  const [sourceCoverLetterId, setSourceCoverLetterId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTitle('');
    setUrl('');
    setLocation('');
    setCompensation('');
    setDescription('');
    setStage('tailoring');
    setSourceCoverLetterId(globalCoverLetters[0]?.id ?? '');
    if (initialCompanyId && companies.some((c) => c.id === initialCompanyId)) {
      setCompanyMode('existing');
      setSelectedCompanyId(initialCompanyId);
      setCompanyName('');
    } else if (companies.length > 0) {
      setCompanyMode('new');
      setSelectedCompanyId(companies[0].id);
      setCompanyName('');
    } else {
      setCompanyMode('new');
      setSelectedCompanyId('');
      setCompanyName('');
    }
  }, [open, initialCompanyId, companies]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Enter a role title (e.g., Frontend Engineer, Full-Stack Engineer).');
      return;
    }

    if (companyMode === 'existing' && !selectedCompanyId) {
      setError('Choose a company or create a new one.');
      return;
    }
    if (companyMode === 'new' && !companyName.trim()) {
      setError('Enter a company name.');
      return;
    }

    setSubmitting(true);
    try {
      await onCreate({
        companyId: companyMode === 'existing' ? selectedCompanyId : undefined,
        companyName: companyMode === 'new' ? companyName.trim() : undefined,
        title: trimmedTitle,
        stage,
        url: url.trim(),
        location: location.trim(),
        compensation: compensation.trim(),
        description,
        sourceCoverLetterId: sourceCoverLetterId || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job posting');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 border border-sky-200/80 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">New Job Posting</h2>
              <p className="text-[11px] text-stone-500">
                Forks Master Resume &amp; creates a dedicated Cover Letter for this role.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md inline-flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          {/* Company selection or creation */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-700">Company</label>
              {companies.length > 0 && (
                <div className="inline-flex rounded-md bg-stone-100 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCompanyMode('existing')}
                    className={`px-2 py-0.5 rounded font-medium ${
                      companyMode === 'existing' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500'
                    }`}
                  >
                    Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompanyMode('new')}
                    className={`px-2 py-0.5 rounded font-medium ${
                      companyMode === 'new' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500'
                    }`}
                  >
                    New Company
                  </button>
                </div>
              )}
            </div>

            {companyMode === 'existing' && companies.length > 0 ? (
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className={inputCls}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                autoFocus={!initialCompanyId}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Anthropic, Stripe, Linear…"
                className={inputCls}
              />
            )}
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-8">
              <label className="block text-xs font-semibold text-stone-700 mb-1">Role Title</label>
              <input
                autoFocus={Boolean(initialCompanyId)}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Senior Frontend Engineer"
                className={inputCls}
              />
            </div>
            <div className="col-span-4">
              <label className="block text-xs font-semibold text-stone-700 mb-1">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as JobStage)}
                className={inputCls}
              >
                {JOB_STAGES.filter((s) => s.id !== 'archived').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Job Posting Link (optional)
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://jobs.ashbyhq.com/..."
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote / SF"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Compensation
              </label>
              <input
                value={compensation}
                onChange={(e) => setCompensation(e.target.value)}
                placeholder="$220k–$260k"
                className={inputCls}
              />
            </div>
          </div>

          {globalCoverLetters.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Base Cover Letter Template
              </label>
              <select
                value={sourceCoverLetterId}
                onChange={(e) => setSourceCoverLetterId(e.target.value)}
                className={inputCls}
              >
                {globalCoverLetters.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.title}
                  </option>
                ))}
                <option value="">Blank starter letter</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Job Description / Notes (optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste key responsibilities, tech stack, or recruiter context…"
              className="w-full p-2.5 text-xs rounded-md border border-stone-200 bg-stone-50 focus:bg-white focus:border-sky-500 outline-none resize-y"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-md border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="h-8 px-4 rounded-md bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Role &amp; Fork Resume
          </button>
        </div>
      </form>
    </div>
  );
}
