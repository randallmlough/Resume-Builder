import { useMemo, useState } from 'react';
import {
  Archive,
  Briefcase,
  ExternalLink,
  GitBranch,
  MapPin,
  Paperclip,
  Plus,
  Search,
} from 'lucide-react';
import {
  JOB_STAGES,
  type CompanyRecord,
  type JobPostingRecord,
  type JobStage,
  type ResumeRecord,
} from '@shared/schema';
import { computeResumeDiffs } from '@shared/resumeDiff';

const STAGE_DOT_CLASS: Record<JobStage, string> = {
  saved: 'bg-stone-400',
  tailoring: 'bg-amber-500',
  applied: 'bg-sky-500',
  interviewing: 'bg-indigo-500',
  offer: 'bg-emerald-500',
  archived: 'bg-stone-300',
};

interface KanbanBoardProps {
  companies: CompanyRecord[];
  jobs: JobPostingRecord[];
  resumes: ResumeRecord[];
  masterResume: ResumeRecord | null;
  onSelectJob: (jobId: string) => void;
  onChangeStage: (jobId: string, stage: JobStage) => void;
  onOpenNewJobModal: (companyId?: string) => void;
}

export function KanbanBoard({
  companies,
  jobs,
  resumes,
  masterResume,
  onSelectJob,
  onChangeStage,
  onOpenNewJobModal,
}: KanbanBoardProps) {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<JobStage | null>(null);

  const resumesById = useMemo(() => new Map(resumes.map((r) => [r.id, r])), [resumes]);

  const diffCountsByJobId = useMemo(() => {
    const map = new Map<string, number>();
    if (!masterResume) return map;
    for (const job of jobs) {
      const r = resumesById.get(job.resumeId);
      if (!r) continue;
      map.set(
        job.id,
        computeResumeDiffs(masterResume.data, masterResume.config, r.data, r.config).length
      );
    }
    return map;
  }, [jobs, resumesById, masterResume]);

  const visibleStages = showArchived
    ? JOB_STAGES
    : JOB_STAGES.filter((s) => s.id !== 'archived');

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (companyFilter !== 'all' && job.companyId !== companyFilter) return false;
      if (!q) return true;
      return (
        job.companyName.toLowerCase().includes(q) ||
        job.title.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q)
      );
    });
  }, [jobs, search, companyFilter]);

  const stats = useMemo(() => {
    const active = jobs.filter((j) => j.stage !== 'archived');
    const submitted = jobs.filter((j) => ['applied', 'interviewing', 'offer'].includes(j.stage));
    const interviewing = jobs.filter((j) => j.stage === 'interviewing');
    const offers = jobs.filter((j) => j.stage === 'offer');
    return {
      total: active.length,
      companiesCount: companies.length,
      submitted: submitted.length,
      interviewing: interviewing.length,
      offers: offers.length,
    };
  }, [jobs, companies.length]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-stone-100 overflow-hidden">
      {/* Pipeline Top Header */}
      <header className="h-14 shrink-0 border-b border-stone-200/90 bg-white px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-bold text-stone-900 truncate">Global Job Pipeline</h1>
          <div className="hidden md:flex items-center gap-3 text-xs text-stone-500">
            <span>
              <strong className="text-stone-800">{stats.total}</strong> active roles
            </span>
            <span>·</span>
            <span>
              <strong className="text-stone-800">{stats.companiesCount}</strong> companies
            </span>
            <span>·</span>
            <span>
              <strong className="text-sky-700">{stats.submitted}</strong> applied+
            </span>
            {stats.interviewing > 0 && (
              <>
                <span>·</span>
                <span>
                  <strong className="text-indigo-700">{stats.interviewing}</strong> interviewing
                </span>
              </>
            )}
            {stats.offers > 0 && (
              <>
                <span>·</span>
                <span>
                  <strong className="text-emerald-700">{stats.offers}</strong> offers
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter company or role…"
              className="h-8 pl-8 pr-2.5 text-xs rounded-md border border-stone-200 bg-stone-50 focus:bg-white focus:border-sky-500 outline-none w-44 sm:w-52"
            />
          </div>

          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-md border border-stone-200 bg-stone-50 focus:bg-white focus:border-sky-500 outline-none max-w-[160px]"
          >
            <option value="all">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            className={`h-8 px-2.5 rounded-md text-xs font-medium border inline-flex items-center gap-1.5 transition-colors ${
              showArchived
                ? 'bg-stone-800 text-white border-stone-800'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Archived</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onOpenNewJobModal(companyFilter !== 'all' ? companyFilter : undefined)
            }
            className="h-8 px-3.5 rounded-md bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            New Role
          </button>
        </div>
      </header>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-5">
        {jobs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center space-y-3 shadow-xs">
              <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/80 flex items-center justify-center mx-auto">
                <Briefcase className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-stone-900">Start Tracking Your Job Search</h2>
              <p className="text-xs text-stone-500 leading-relaxed">
                Create a company and add one or more role postings (e.g., <em>Frontend Engineer</em>,{' '}
                <em>Full-Stack Engineer</em>). Each role forks your Master Resume, creates its own
                WYSIWYG Cover Letter, and tracks its pipeline stage here.
              </p>
              <button
                type="button"
                onClick={() => onOpenNewJobModal()}
                className="h-9 px-4 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Create First Job Posting
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex gap-4 items-stretch">
            {visibleStages.map((stage) => {
              const colJobs = filteredJobs.filter((j) => j.stage === stage.id);
              const isOver = overStage === stage.id;

              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (overStage !== stage.id) setOverStage(stage.id);
                  }}
                  onDragLeave={() => {
                    if (overStage === stage.id) setOverStage(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverStage(null);
                    if (draggedJobId) {
                      onChangeStage(draggedJobId, stage.id);
                      setDraggedJobId(null);
                    }
                  }}
                  className={`w-72 shrink-0 rounded-xl border flex flex-col min-h-0 transition-colors ${
                    isOver
                      ? 'border-sky-500 bg-sky-50/50 ring-1 ring-sky-400'
                      : 'border-stone-200/90 bg-stone-50/80'
                  }`}
                >
                  {/* Column Header */}
                  <div className="px-3.5 py-2.5 border-b border-stone-200/80 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${STAGE_DOT_CLASS[stage.id]}`} />
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                        {stage.label}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-600">
                      {colJobs.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                    {colJobs.length === 0 ? (
                      <div className="py-8 px-3 text-center text-xs text-stone-400 border border-dashed border-stone-200 rounded-lg">
                        Drop role here
                      </div>
                    ) : (
                      colJobs.map((job) => {
                        const diffCount = diffCountsByJobId.get(job.id) ?? 0;
                        const isDragging = draggedJobId === job.id;

                        return (
                          <div
                            key={job.id}
                            draggable
                            onDragStart={() => setDraggedJobId(job.id)}
                            onDragEnd={() => {
                              setDraggedJobId(null);
                              setOverStage(null);
                            }}
                            onClick={() => onSelectJob(job.id)}
                            className={`rounded-lg border border-stone-200 bg-white p-3 space-y-2.5 cursor-pointer hover:border-sky-400 hover:shadow-xs transition-all ${
                              isDragging ? 'opacity-40' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 truncate">
                                  {job.companyName}
                                </div>
                                <div className="text-sm font-semibold text-stone-900 leading-snug">
                                  {job.title}
                                </div>
                              </div>
                              {job.url && (
                                <a
                                  href={job.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Open job posting URL"
                                  className="w-6 h-6 rounded inline-flex items-center justify-center text-stone-400 hover:text-sky-700 hover:bg-sky-50 shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>

                            {(job.location || job.compensation) && (
                              <div className="flex items-center gap-2 flex-wrap text-[11px] text-stone-500">
                                {job.location && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-stone-400" />
                                    {job.location}
                                  </span>
                                )}
                                {job.compensation && (
                                  <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-700 font-medium">
                                    {job.compensation}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                                <GitBranch className="w-3 h-3 text-stone-400" />
                                {diffCount > 0 ? `${diffCount} tailored` : 'Master copy'}
                              </span>
                              {job.attachmentCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                                  <Paperclip className="w-3 h-3" />
                                  {job.attachmentCount}
                                </span>
                              )}
                              {job.snapshotCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono">
                                  v{job.snapshotCount}
                                </span>
                              )}
                            </div>

                            <div
                              className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-[11px] text-stone-400 truncate">
                                {job.appliedAt
                                  ? `Applied ${new Date(job.appliedAt).toLocaleDateString()}`
                                  : 'Not submitted yet'}
                              </span>
                              <select
                                value={job.stage}
                                onChange={(e) => onChangeStage(job.id, e.target.value as JobStage)}
                                aria-label={`Stage for ${job.companyName} ${job.title}`}
                                className="h-6 px-1.5 text-[11px] rounded border border-stone-200 bg-stone-50 text-stone-700 outline-none focus:border-sky-500"
                              >
                                {JOB_STAGES.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
