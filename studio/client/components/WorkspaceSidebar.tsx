import { useState } from 'react';
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  Kanban,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  UserCircle2,
} from 'lucide-react';
import type { CompanyRecord, JobPostingRecord, JobStage, ResumeRecord } from '@shared/schema';

export type WorkspaceView = 'profile' | 'kanban' | 'master' | 'role';

const STAGE_DOT: Record<JobStage, string> = {
  saved: 'bg-stone-400',
  tailoring: 'bg-amber-500',
  applied: 'bg-sky-500',
  interviewing: 'bg-indigo-500',
  offer: 'bg-emerald-500',
  archived: 'bg-stone-300',
};

interface WorkspaceSidebarProps {
  collapsed: boolean;
  view: WorkspaceView;
  companies: CompanyRecord[];
  jobs: JobPostingRecord[];
  resumes: ResumeRecord[];
  masterResume: ResumeRecord | null;
  activeJobId: string | null;
  onToggleCollapse: () => void;
  onSelectProfile: () => void;
  onSelectKanban: () => void;
  onSelectMaster: () => void;
  onSelectJob: (jobId: string) => void;
  onOpenNewJobModal: (companyId?: string) => void;
  onDeleteCompany: (company: CompanyRecord) => void;
}

export function WorkspaceSidebar({
  collapsed,
  view,
  companies,
  jobs,
  resumes,
  masterResume,
  activeJobId,
  onToggleCollapse,
  onSelectProfile,
  onSelectKanban,
  onSelectMaster,
  onSelectJob,
  onOpenNewJobModal,
  onDeleteCompany,
}: WorkspaceSidebarProps) {
  const [collapsedCompanies, setCollapsedCompanies] = useState<Record<string, boolean>>({});

  const resumesById = new Map(resumes.map((r) => [r.id, r]));
  const activeJobCount = jobs.filter((j) => j.stage !== 'archived').length;

  const hasMasterUpdate = (job: JobPostingRecord): boolean => {
    if (!masterResume) return false;
    const roleResume = resumesById.get(job.resumeId);
    if (!roleResume?.baseSyncedAt) return false;
    return masterResume.updatedAt > roleResume.baseSyncedAt;
  };

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 border-r border-stone-200/90 bg-stone-50 flex flex-col items-center py-3 gap-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand sidebar"
          className="w-8 h-8 rounded-md inline-flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-200/70"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <div className="w-6 h-px bg-stone-200 my-1" />
        <button
          type="button"
          onClick={onSelectProfile}
          title="Profile Settings (Source of Truth)"
          className={`w-8 h-8 rounded-md inline-flex items-center justify-center transition-colors ${
            view === 'profile'
              ? 'bg-sky-700 text-white'
              : 'text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
          }`}
        >
          <UserCircle2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onSelectKanban}
          title="Global Pipeline (Kanban)"
          className={`w-8 h-8 rounded-md inline-flex items-center justify-center transition-colors ${
            view === 'kanban'
              ? 'bg-sky-700 text-white'
              : 'text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
          }`}
        >
          <Kanban className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onSelectMaster}
          title="Master Resume"
          className={`w-8 h-8 rounded-md inline-flex items-center justify-center transition-colors ${
            view === 'master'
              ? 'bg-sky-700 text-white'
              : 'text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
          }`}
        >
          <FileText className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpenNewJobModal()}
          title="Add new job posting"
          className="w-8 h-8 rounded-md inline-flex items-center justify-center text-sky-700 hover:bg-sky-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-60 shrink-0 border-r border-stone-200/90 bg-stone-50/95 flex flex-col min-h-0">
      {/* Sidebar Header */}
      <div className="h-14 shrink-0 px-3.5 border-b border-stone-200/90 flex items-center justify-between gap-2 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-sky-700 text-white flex items-center justify-center font-serif font-bold text-sm shrink-0">
            R
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-xs text-stone-900 truncate">Resume Studio</div>
            <div className="text-[11px] text-stone-400 truncate">Typst Live Workspace</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collapse sidebar"
          className="w-7 h-7 rounded-md inline-flex items-center justify-center text-stone-400 hover:text-stone-800 hover:bg-stone-100 shrink-0"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Navigation */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {/* Global Views */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={onSelectProfile}
            className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors ${
              view === 'profile'
                ? 'bg-white text-stone-900 shadow-2xs border border-stone-200'
                : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900 border border-transparent'
            }`}
          >
            <span className="inline-flex items-center gap-2 truncate">
              <UserCircle2 className="w-3.5 h-3.5 text-sky-700 shrink-0" />
              <span className="truncate">Profile Settings</span>
            </span>
            <span className="font-mono text-[10px] uppercase px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200/70">
              Source
            </span>
          </button>

          <button
            type="button"
            onClick={onSelectKanban}
            className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors ${
              view === 'kanban'
                ? 'bg-white text-stone-900 shadow-2xs border border-stone-200'
                : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900 border border-transparent'
            }`}
          >
            <span className="inline-flex items-center gap-2 truncate">
              <Kanban className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <span className="truncate">Global Pipeline</span>
            </span>
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-stone-100 text-stone-600 border border-stone-200/80">
              {activeJobCount}
            </span>
          </button>

          <button
            type="button"
            onClick={onSelectMaster}
            className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors ${
              view === 'master'
                ? 'bg-white text-stone-900 shadow-2xs border border-stone-200'
                : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900 border border-transparent'
            }`}
          >
            <span className="inline-flex items-center gap-2 truncate">
              <FileText className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <span className="truncate">Master Preview</span>
            </span>
            <span className="font-mono text-[10px] uppercase px-1.5 py-0.2 rounded bg-stone-200/70 text-stone-600">
              PDF
            </span>
          </button>
        </div>

        {/* Companies & Role Postings Tree */}
        <div className="space-y-1.5">
          <div className="px-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Companies &amp; Roles
            </span>
            <button
              type="button"
              onClick={() => onOpenNewJobModal()}
              title="Add new company or role"
              className="h-6 px-1.5 rounded text-[11px] font-medium text-sky-700 hover:bg-sky-50 inline-flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" />
              Role
            </button>
          </div>

          {companies.length === 0 ? (
            <div className="mx-1 p-3 rounded-lg border border-dashed border-stone-200 bg-white/60 text-center space-y-2">
              <div className="text-xs text-stone-500">No job postings yet.</div>
              <button
                type="button"
                onClick={() => onOpenNewJobModal()}
                className="h-7 px-2.5 rounded-md bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add First Role
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {companies.map((company) => {
                const companyJobs = jobs.filter((j) => j.companyId === company.id);
                const isCollapsed = !!collapsedCompanies[company.id];

                return (
                  <div key={company.id} className="space-y-0.5">
                    <div className="group flex items-center justify-between gap-1 px-1.5 py-1.5 rounded-md hover:bg-stone-200/50">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedCompanies((prev) => ({
                            ...prev,
                            [company.id]: !prev[company.id],
                          }))
                        }
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        )}
                        <Building2 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                        <span className="text-xs font-semibold text-stone-800 truncate">
                          {company.name}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400 shrink-0">
                          {companyJobs.length}
                        </span>
                      </button>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenNewJobModal(company.id)}
                          title={`Add role at ${company.name}`}
                          className="w-5 h-5 rounded inline-flex items-center justify-center text-stone-500 hover:text-sky-700 hover:bg-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCompany(company)}
                          title={`Delete ${company.name} and its roles`}
                          className="w-5 h-5 rounded inline-flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="pl-5 space-y-0.5">
                        {companyJobs.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => onOpenNewJobModal(company.id)}
                            className="w-full px-2 py-1 text-[11px] text-stone-400 hover:text-sky-700 text-left"
                          >
                            + Add role posting…
                          </button>
                        ) : (
                          companyJobs.map((job) => {
                            const isActive = view === 'role' && activeJobId === job.id;
                            const stale = hasMasterUpdate(job);
                            return (
                              <button
                                key={job.id}
                                type="button"
                                onClick={() => onSelectJob(job.id)}
                                className={`w-full px-2 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 text-left transition-colors ${
                                  isActive
                                    ? 'bg-sky-700 text-white font-medium shadow-2xs'
                                    : 'text-stone-600 hover:bg-white hover:text-stone-900'
                                }`}
                              >
                                <span className="inline-flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      isActive ? 'bg-sky-200' : STAGE_DOT[job.stage]
                                    }`}
                                  />
                                  <span className="truncate">{job.title}</span>
                                </span>
                                {stale && (
                                  <span
                                    title="Master Resume has newer edits available to sync"
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      isActive ? 'bg-amber-300' : 'bg-amber-500'
                                    }`}
                                  />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer Hint */}
      <div className="px-3.5 py-2.5 border-t border-stone-200/80 text-[11px] text-stone-400 flex items-center gap-1.5">
        <Briefcase className="w-3 h-3 shrink-0" />
        <span className="truncate">Each role owns its resume &amp; letter</span>
      </div>
    </aside>
  );
}
