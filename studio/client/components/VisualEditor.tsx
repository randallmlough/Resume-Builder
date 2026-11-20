import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  SKILL_CATEGORIES,
  type Education,
  type Job,
  type Position,
  type Project,
  type ResumeData,
  type Skill,
} from '@shared/schema';

interface VisualEditorProps {
  data: ResumeData;
  onChange: (next: ResumeData) => void;
}

function SectionCard({
  title,
  badge,
  defaultOpen = false,
  action,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="w-full px-4 py-3 flex items-center justify-between gap-2 bg-stone-50/70 hover:bg-stone-50 cursor-pointer select-none border-b border-stone-100"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-stone-500 shrink-0" />
          )}
          <span className="text-sm font-semibold text-stone-900">{title}</span>
          {badge && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-200/70 text-stone-600">
              {badge}
            </span>
          )}
        </div>
        {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
      </div>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

const inputCls =
  'w-full h-8 px-2.5 text-sm rounded-md border border-stone-200 bg-stone-50/60 focus:bg-white focus:border-sky-500 outline-none transition-colors';
const textareaCls =
  'w-full px-2.5 py-2 text-sm rounded-md border border-stone-200 bg-stone-50/60 focus:bg-white focus:border-sky-500 outline-none transition-colors resize-y';

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function VisualEditor({ data, onChange }: VisualEditorProps) {
  const [newSkillText, setNewSkillText] = useState<Record<string, string>>({});
  const [expandedJobs, setExpandedJobs] = useState<Record<number, boolean>>({ 0: true });
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});

  const updateJob = (idx: number, patch: Partial<Job>) => {
    const next = data.experience.map((j, i) => (i === idx ? { ...j, ...patch } : j));
    onChange({ ...data, experience: next });
  };

  const updatePosition = (jobIdx: number, posIdx: number, patch: Partial<Position>) => {
    const job = data.experience[jobIdx];
    const positions = job.positions.map((p, i) => (i === posIdx ? { ...p, ...patch } : p));
    updateJob(jobIdx, { positions });
  };

  const updateProject = (idx: number, patch: Partial<Project>) => {
    const next = data.projects.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onChange({ ...data, projects: next });
  };

  const updateEdu = (idx: number, patch: Partial<Education>) => {
    const next = data.education.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    onChange({ ...data, education: next });
  };

  const visibleExpCount = data.experience.filter((j) => !j.hide).length;
  const visibleProjCount = data.projects.filter((p) => !p.hide).length;
  const visibleEduCount = data.education.filter((e) => !e.hide).length;

  // Group skills by category (preserving existing order + standard categories)
  const categoryOrder: string[] = [];
  for (const s of data.skills) {
    const cat = s.category || 'Other';
    if (!categoryOrder.includes(cat)) categoryOrder.push(cat);
  }
  for (const c of SKILL_CATEGORIES) {
    if (!categoryOrder.includes(c)) categoryOrder.push(c);
  }

  const addSkillToCategory = (category: string) => {
    const raw = (newSkillText[category] ?? '').trim();
    if (!raw) return;
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const additions: Skill[] = names.map((name) => ({
      name,
      category,
      level: 'Advanced',
      years: '',
      keywords: [],
    }));
    onChange({ ...data, skills: [...data.skills, ...additions] });
    setNewSkillText((prev) => ({ ...prev, [category]: '' }));
  };

  const removeSkill = (category: string, name: string) => {
    const idx = data.skills.findIndex(
      (s) => (s.category || 'Other') === category && s.name === name
    );
    if (idx === -1) return;
    const next = [...data.skills];
    next.splice(idx, 1);
    onChange({ ...data, skills: next });
  };

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      {/* Personal & Contact */}
      <SectionCard title="Header & Contact" defaultOpen>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Full Name</label>
            <input
              value={data.name}
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              className={inputCls}
              placeholder="Randall Lough"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Email</label>
              <input
                value={data.contact.email}
                onChange={(e) =>
                  onChange({ ...data, contact: { ...data.contact, email: e.target.value } })
                }
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Phone</label>
              <input
                value={data.contact.phone}
                onChange={(e) =>
                  onChange({ ...data, contact: { ...data.contact, phone: e.target.value } })
                }
                className={inputCls}
                placeholder="555-123-4567"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">LinkedIn</label>
              <input
                value={data.contact.linkedin}
                onChange={(e) =>
                  onChange({ ...data, contact: { ...data.contact, linkedin: e.target.value } })
                }
                className={inputCls}
                placeholder="linkedin.com/in/handle"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">GitHub</label>
              <input
                value={data.contact.github}
                onChange={(e) =>
                  onChange({ ...data, contact: { ...data.contact, github: e.target.value } })
                }
                className={inputCls}
                placeholder="github.com/handle"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Summary / Overview */}
      <SectionCard title="Overview" defaultOpen>
        <textarea
          rows={4}
          value={data.summary}
          onChange={(e) => onChange({ ...data, summary: e.target.value })}
          className={textareaCls}
          placeholder="Concise professional summary..."
        />
      </SectionCard>

      {/* Experience */}
      <SectionCard
        title="Experience"
        badge={`${visibleExpCount}/${data.experience.length} shown`}
        defaultOpen
        action={
          <button
            type="button"
            onClick={() => {
              const idx = data.experience.length;
              onChange({
                ...data,
                experience: [
                  ...data.experience,
                  {
                    company: 'New Company',
                    hide: false,
                    location: 'Remote',
                    website: '',
                    overview: '',
                    technologies: [],
                    startDate: '',
                    endDate: '',
                    positions: [
                      {
                        title: 'Senior Software Engineer',
                        startDate: 'Jan 2025',
                        endDate: 'Present',
                        responsibilities: ['Built high-impact feature...'],
                      },
                    ],
                  },
                ],
              });
              setExpandedJobs((prev) => ({ ...prev, [idx]: true }));
            }}
            className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md text-xs font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/70"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Company
          </button>
        }
      >
        <div className="space-y-3">
          {data.experience.map((job, jobIdx) => {
            const isOpen = !!expandedJobs[jobIdx];
            return (
              <div
                key={jobIdx}
                className={`rounded-lg border transition-colors ${
                  job.hide
                    ? 'border-stone-200/80 bg-stone-50/70 opacity-70'
                    : 'border-stone-200 bg-white'
                }`}
              >
                <div className="px-3 py-2 flex items-center justify-between gap-2 bg-stone-50/50 border-b border-stone-100">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedJobs((prev) => ({ ...prev, [jobIdx]: !prev[jobIdx] }))
                    }
                    className="flex items-center gap-2 min-w-0 text-left flex-1"
                  >
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-stone-800 truncate">
                      {job.company || 'Untitled Company'}
                    </span>
                    {job.location && (
                      <span className="text-xs text-stone-400 truncate hidden sm:inline">
                        · {job.location}
                      </span>
                    )}
                    {job.hide && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-stone-200 text-stone-600">
                        Hidden
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateJob(jobIdx, { hide: !job.hide })}
                      title={job.hide ? 'Show on resume' : 'Hide from resume'}
                      className={`w-7 h-7 inline-flex items-center justify-center rounded transition-colors ${
                        job.hide
                          ? 'text-stone-400 hover:text-stone-700 hover:bg-stone-200/60'
                          : 'text-sky-700 hover:bg-sky-50'
                      }`}
                    >
                      {job.hide ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      disabled={jobIdx === 0}
                      onClick={() =>
                        onChange({
                          ...data,
                          experience: moveItem(data.experience, jobIdx, jobIdx - 1),
                        })
                      }
                      className="w-7 h-7 inline-flex items-center justify-center rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={jobIdx === data.experience.length - 1}
                      onClick={() =>
                        onChange({
                          ...data,
                          experience: moveItem(data.experience, jobIdx, jobIdx + 1),
                        })
                      }
                      className="w-7 h-7 inline-flex items-center justify-center rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...data,
                          experience: data.experience.filter((_, i) => i !== jobIdx),
                        })
                      }
                      className="w-7 h-7 inline-flex items-center justify-center rounded text-stone-400 hover:text-red-600 hover:bg-red-50"
                      title="Remove company"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-500 mb-1">
                          Company
                        </label>
                        <input
                          value={job.company}
                          onChange={(e) => updateJob(jobIdx, { company: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-500 mb-1">
                          Location
                        </label>
                        <input
                          value={job.location ?? ''}
                          onChange={(e) => updateJob(jobIdx, { location: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-stone-500 mb-1">
                        Company Overview (optional)
                      </label>
                      <input
                        value={job.overview ?? ''}
                        onChange={(e) => updateJob(jobIdx, { overview: e.target.value })}
                        className={inputCls}
                        placeholder="Short one-line description of the company..."
                      />
                    </div>

                    {/* Positions */}
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-600">Positions</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateJob(jobIdx, {
                              positions: [
                                ...job.positions,
                                {
                                  title: 'Software Engineer',
                                  startDate: '',
                                  endDate: '',
                                  responsibilities: [''],
                                },
                              ],
                            })
                          }
                          className="text-xs font-medium text-sky-700 hover:text-sky-800 inline-flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Role
                        </button>
                      </div>

                      {job.positions.map((pos, posIdx) => (
                        <div
                          key={posIdx}
                          className="rounded-md border border-stone-200/80 bg-stone-50/40 p-2.5 space-y-2.5"
                        >
                          <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5">
                              <label className="block text-[11px] font-medium text-stone-500 mb-0.5">
                                Role Title
                              </label>
                              <input
                                value={pos.title}
                                onChange={(e) =>
                                  updatePosition(jobIdx, posIdx, { title: e.target.value })
                                }
                                className={inputCls}
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block text-[11px] font-medium text-stone-500 mb-0.5">
                                Start
                              </label>
                              <input
                                value={pos.startDate}
                                onChange={(e) =>
                                  updatePosition(jobIdx, posIdx, { startDate: e.target.value })
                                }
                                className={inputCls}
                                placeholder="Oct 2025"
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block text-[11px] font-medium text-stone-500 mb-0.5">
                                End
                              </label>
                              <input
                                value={pos.endDate}
                                onChange={(e) =>
                                  updatePosition(jobIdx, posIdx, { endDate: e.target.value })
                                }
                                className={inputCls}
                                placeholder="Present"
                              />
                            </div>
                            <div className="col-span-1 flex justify-end">
                              {job.positions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateJob(jobIdx, {
                                      positions: job.positions.filter((_, i) => i !== posIdx),
                                    })
                                  }
                                  className="h-8 w-7 inline-flex items-center justify-center text-stone-400 hover:text-red-600"
                                  title="Delete role"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Bullet items */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-stone-500">
                                Impact Bullets
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updatePosition(jobIdx, posIdx, {
                                    responsibilities: [...pos.responsibilities, ''],
                                  })
                                }
                                className="text-[11px] font-medium text-sky-700 hover:text-sky-800 inline-flex items-center gap-0.5"
                              >
                                <Plus className="w-3 h-3" /> Bullet
                              </button>
                            </div>
                            {pos.responsibilities.map((bullet, bIdx) => (
                              <div key={bIdx} className="flex items-start gap-1.5">
                                <span className="text-stone-400 text-xs mt-2 select-none">•</span>
                                <textarea
                                  rows={2}
                                  value={bullet}
                                  onChange={(e) => {
                                    const next = [...pos.responsibilities];
                                    next[bIdx] = e.target.value;
                                    updatePosition(jobIdx, posIdx, { responsibilities: next });
                                  }}
                                  className="flex-1 px-2 py-1.5 text-xs leading-relaxed rounded border border-stone-200 bg-white focus:border-sky-500 outline-none resize-y"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = pos.responsibilities.filter((_, i) => i !== bIdx);
                                    updatePosition(jobIdx, posIdx, { responsibilities: next });
                                  }}
                                  className="mt-1 p-1 text-stone-300 hover:text-red-500"
                                  title="Remove bullet"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Projects */}
      <SectionCard
        title="Projects"
        badge={`${visibleProjCount}/${data.projects.length} shown`}
        action={
          <button
            type="button"
            onClick={() => {
              const idx = data.projects.length;
              onChange({
                ...data,
                projects: [
                  ...data.projects,
                  {
                    name: 'New Project',
                    hide: false,
                    description: '',
                    url: '',
                    github: '',
                    technologies: ['TypeScript'],
                    startDate: '',
                    endDate: '',
                    items: ['Built...'],
                  },
                ],
              });
              setExpandedProjects((prev) => ({ ...prev, [idx]: true }));
            }}
            className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md text-xs font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/70"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Project
          </button>
        }
      >
        <div className="space-y-2.5">
          {data.projects.map((proj, pIdx) => {
            const isOpen = !!expandedProjects[pIdx];
            return (
              <div
                key={pIdx}
                className={`rounded-lg border ${
                  proj.hide ? 'border-stone-200/80 bg-stone-50/70 opacity-70' : 'border-stone-200'
                }`}
              >
                <div className="px-3 py-2 flex items-center justify-between gap-2 bg-stone-50/50 border-b border-stone-100">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedProjects((prev) => ({ ...prev, [pIdx]: !prev[pIdx] }))
                    }
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-stone-800 truncate">
                      {proj.name || 'Untitled Project'}
                    </span>
                    {proj.hide && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-stone-200 text-stone-600">
                        Hidden
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateProject(pIdx, { hide: !proj.hide })}
                      className={`w-7 h-7 inline-flex items-center justify-center rounded ${
                        proj.hide ? 'text-stone-400 hover:bg-stone-200/60' : 'text-sky-700 hover:bg-sky-50'
                      }`}
                    >
                      {proj.hide ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...data,
                          projects: data.projects.filter((_, i) => i !== pIdx),
                        })
                      }
                      className="w-7 h-7 inline-flex items-center justify-center rounded text-stone-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="p-3 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-500 mb-0.5">
                          Project Name
                        </label>
                        <input
                          value={proj.name}
                          onChange={(e) => updateProject(pIdx, { name: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-500 mb-0.5">
                          Technologies (comma-separated)
                        </label>
                        <input
                          value={(proj.technologies ?? []).join(', ')}
                          onChange={(e) =>
                            updateProject(pIdx, {
                              technologies: e.target.value
                                .split(',')
                                .map((t) => t.trim())
                                .filter(Boolean),
                            })
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-500 mb-0.5">
                          Website URL
                        </label>
                        <input
                          value={proj.url ?? ''}
                          onChange={(e) => updateProject(pIdx, { url: e.target.value })}
                          className={inputCls}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-500 mb-0.5">
                          GitHub URL
                        </label>
                        <input
                          value={proj.github ?? ''}
                          onChange={(e) => updateProject(pIdx, { github: e.target.value })}
                          className={inputCls}
                          placeholder="https://github.com/..."
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-stone-500">Highlights</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateProject(pIdx, { items: [...(proj.items ?? []), ''] })
                          }
                          className="text-[11px] font-medium text-sky-700 hover:text-sky-800 inline-flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" /> Bullet
                        </button>
                      </div>
                      {(proj.items ?? []).map((item, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-1.5">
                          <span className="text-stone-400 text-xs mt-2">•</span>
                          <textarea
                            rows={2}
                            value={item}
                            onChange={(e) => {
                              const next = [...(proj.items ?? [])];
                              next[bIdx] = e.target.value;
                              updateProject(pIdx, { items: next });
                            }}
                            className="flex-1 px-2 py-1.5 text-xs leading-relaxed rounded border border-stone-200 bg-white focus:border-sky-500 outline-none resize-y"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateProject(pIdx, {
                                items: (proj.items ?? []).filter((_, i) => i !== bIdx),
                              })
                            }
                            className="mt-1 p-1 text-stone-300 hover:text-red-500"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Skills */}
      <SectionCard title="Technical Skills" badge={`${data.skills.length} skills`}>
        <div className="space-y-4">
          {categoryOrder.map((category) => {
            const items = data.skills.filter((s) => (s.category || 'Other') === category);
            return (
              <div key={category} className="space-y-1.5">
                <div className="text-xs font-semibold text-stone-700">{category}</div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((sk, idx) => (
                    <span
                      key={`${sk.name}-${idx}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-stone-100 text-stone-800 border border-stone-200"
                    >
                      {sk.name}
                      <button
                        type="button"
                        onClick={() => removeSkill(category, sk.name)}
                        className="text-stone-400 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    value={newSkillText[category] ?? ''}
                    onChange={(e) =>
                      setNewSkillText((prev) => ({ ...prev, [category]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkillToCategory(category);
                      }
                    }}
                    placeholder={`Add skill to ${category} (comma-separated)...`}
                    className="flex-1 h-7 px-2.5 text-xs rounded-md border border-stone-200 bg-stone-50 focus:bg-white focus:border-sky-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => addSkillToCategory(category)}
                    className="h-7 px-2.5 text-xs font-medium rounded-md border border-stone-200 bg-white hover:bg-stone-50 text-stone-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Education */}
      <SectionCard
        title="Education"
        badge={`${visibleEduCount}/${data.education.length} shown`}
        action={
          <button
            type="button"
            onClick={() =>
              onChange({
                ...data,
                education: [
                  ...data.education,
                  {
                    institution: 'University Name',
                    college: '',
                    degree: 'B.S. in Computer Science',
                    fieldOfStudy: '',
                    startDate: '2016',
                    endDate: '2020',
                    location: '',
                    gpa: '',
                    hide: false,
                  },
                ],
              })
            }
            className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md text-xs font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/70"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Education
          </button>
        }
      >
        <div className="space-y-3">
          {data.education.map((edu, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-3 space-y-2.5 ${
                edu.hide ? 'border-stone-200/80 bg-stone-50/70 opacity-70' : 'border-stone-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stone-700">
                  {edu.institution || 'Institution'}
                  {edu.hide && ' (Hidden)'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateEdu(idx, { hide: !edu.hide })}
                    className="w-7 h-7 inline-flex items-center justify-center rounded text-stone-500 hover:bg-stone-100"
                  >
                    {edu.hide ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-sky-700" />}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...data,
                        education: data.education.filter((_, i) => i !== idx),
                      })
                    }
                    className="w-7 h-7 inline-flex items-center justify-center rounded text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={edu.institution}
                  onChange={(e) => updateEdu(idx, { institution: e.target.value })}
                  className={inputCls}
                  placeholder="Institution"
                />
                <input
                  value={edu.college ?? ''}
                  onChange={(e) => updateEdu(idx, { college: e.target.value })}
                  className={inputCls}
                  placeholder="College (optional)"
                />
                <input
                  value={edu.degree}
                  onChange={(e) => updateEdu(idx, { degree: e.target.value })}
                  className={inputCls}
                  placeholder="Degree"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  <input
                    value={edu.startDate}
                    onChange={(e) => updateEdu(idx, { startDate: e.target.value })}
                    className={inputCls}
                    placeholder="Start"
                  />
                  <input
                    value={edu.endDate}
                    onChange={(e) => updateEdu(idx, { endDate: e.target.value })}
                    className={inputCls}
                    placeholder="End"
                  />
                  <input
                    value={edu.gpa ?? ''}
                    onChange={(e) => updateEdu(idx, { gpa: e.target.value })}
                    className={inputCls}
                    placeholder="GPA"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
