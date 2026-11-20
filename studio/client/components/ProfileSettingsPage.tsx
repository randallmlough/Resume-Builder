import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Check,
  Code2,
  Eye,
  EyeOff,
  FileJson,
  FileText,
  FolderGit2,
  FolderSync,
  GraduationCap,
  Loader2,
  Mail,
  Palette,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  SKILL_CATEGORIES,
  type CoverLetterRecord,
  type Education,
  type Job,
  type Position,
  type Project,
  type RecommendationLetterRecord,
  type ResumeConfig,
  type ResumeData,
  type Skill,
} from '@shared/schema';
import { CoverLetterEditor } from './CoverLetterEditor';
import { RecommendationsPanel } from './RecommendationsPanel';
import { StylePanel } from './StylePanel';

type ProfileSection =
  | 'personal'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'education'
  | 'cover-letters'
  | 'recommendations'
  | 'style';

interface ProfileSettingsPageProps {
  data: ResumeData;
  config: ResumeConfig;
  saveStatus: 'saved' | 'saving' | 'dirty' | 'error';
  globalCoverLetters: CoverLetterRecord[];
  activeGlobalLetter: CoverLetterRecord | null;
  recommendations: RecommendationLetterRecord[];
  defaultAttachedRecommendations: RecommendationLetterRecord[];
  uploadingRecommendation: boolean;
  onDataChange: (next: ResumeData) => void;
  onConfigChange: (next: ResumeConfig) => void;
  onSelectGlobalLetter: (id: string) => void;
  onCreateGlobalLetter: () => void;
  onUploadGlobalLetter: (title: string, markdown: string) => void;
  onUpdateGlobalLetter: (
    patch: Partial<Pick<CoverLetterRecord, 'title' | 'company' | 'bodyMarkdown'>>
  ) => void;
  onDeleteGlobalLetter: (id: string) => void;
  onUploadRecommendations: (files: FileList | File[], autoAttach: boolean) => Promise<void>;
  onUpdateRecommendation: (
    id: string,
    patch: { title?: string; authorName?: string; authorTitle?: string }
  ) => Promise<void>;
  onDeleteRecommendation: (id: string) => Promise<void>;
  onSetDefaultAttachments: (letterIds: string[]) => Promise<void>;
  onPreviewMaster: () => void;
  onSeedFromRepo: () => void;
  onImportJson: (jsonText: string) => void;
  onExportJson: () => void;
}

const inputCls =
  'w-full h-9 px-3 text-sm rounded-lg border border-stone-200 bg-stone-50/60 focus:bg-white focus:border-sky-500 outline-none transition-colors';
const textareaCls =
  'w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-stone-50/60 focus:bg-white focus:border-sky-500 outline-none transition-colors resize-y';

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function ProfileSettingsPage({
  data,
  config,
  saveStatus,
  globalCoverLetters,
  activeGlobalLetter,
  recommendations,
  defaultAttachedRecommendations,
  uploadingRecommendation,
  onDataChange,
  onConfigChange,
  onSelectGlobalLetter,
  onCreateGlobalLetter,
  onUploadGlobalLetter,
  onUpdateGlobalLetter,
  onDeleteGlobalLetter,
  onUploadRecommendations,
  onUpdateRecommendation,
  onDeleteRecommendation,
  onSetDefaultAttachments,
  onPreviewMaster,
  onSeedFromRepo,
  onImportJson,
  onExportJson,
}: ProfileSettingsPageProps) {
  const [section, setSection] = useState<ProfileSection>('personal');
  const [newSkillByCat, setNewSkillByCat] = useState<Record<string, string>>({});
  const [customCategoryName, setCustomCategoryName] = useState('');
  const jsonUploadRef = useRef<HTMLInputElement | null>(null);

  const navItems: {
    id: ProfileSection;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }[] = [
    { id: 'personal', label: 'Personal & Contact', icon: <User className="w-4 h-4" /> },
    {
      id: 'experience',
      label: 'Work History',
      icon: <Briefcase className="w-4 h-4" />,
      badge: data.experience.length,
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: <FolderGit2 className="w-4 h-4" />,
      badge: data.projects.length,
    },
    {
      id: 'skills',
      label: 'Skills',
      icon: <Code2 className="w-4 h-4" />,
      badge: data.skills.length,
    },
    {
      id: 'education',
      label: 'Education',
      icon: <GraduationCap className="w-4 h-4" />,
      badge: data.education.length,
    },
    {
      id: 'cover-letters',
      label: 'Global Cover Letters',
      icon: <Mail className="w-4 h-4" />,
      badge: globalCoverLetters.length,
    },
    {
      id: 'recommendations',
      label: 'Recommendation Letters',
      icon: <Paperclip className="w-4 h-4" />,
      badge: recommendations.length,
    },
    { id: 'style', label: 'Default Style', icon: <Palette className="w-4 h-4" /> },
  ];

  // Helpers for Experience / Projects / Skills / Education
  const updateJob = (idx: number, patch: Partial<Job>) => {
    onDataChange({
      ...data,
      experience: data.experience.map((j, i) => (i === idx ? { ...j, ...patch } : j)),
    });
  };

  const updatePosition = (jobIdx: number, posIdx: number, patch: Partial<Position>) => {
    const job = data.experience[jobIdx];
    updateJob(jobIdx, {
      positions: job.positions.map((p, i) => (i === posIdx ? { ...p, ...patch } : p)),
    });
  };

  const updateProject = (idx: number, patch: Partial<Project>) => {
    onDataChange({
      ...data,
      projects: data.projects.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    });
  };

  const updateEducation = (idx: number, patch: Partial<Education>) => {
    onDataChange({
      ...data,
      education: data.education.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    });
  };

  const categoryOrder: string[] = [];
  for (const s of data.skills) {
    const cat = s.category || 'Other';
    if (!categoryOrder.includes(cat)) categoryOrder.push(cat);
  }
  for (const c of SKILL_CATEGORIES) {
    if (!categoryOrder.includes(c)) categoryOrder.push(c);
  }

  const addSkills = (category: string) => {
    const raw = (newSkillByCat[category] ?? '').trim();
    if (!raw) return;
    const additions: Skill[] = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name, category, level: 'Advanced', years: '', keywords: [] }));
    onDataChange({ ...data, skills: [...data.skills, ...additions] });
    setNewSkillByCat((prev) => ({ ...prev, [category]: '' }));
  };

  const removeSkill = (category: string, name: string) => {
    const idx = data.skills.findIndex(
      (s) => (s.category || 'Other') === category && s.name === name
    );
    if (idx === -1) return;
    const next = [...data.skills];
    next.splice(idx, 1);
    onDataChange({ ...data, skills: next });
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-stone-100 overflow-hidden">
      {/* Top Header */}
      <header className="h-14 shrink-0 border-b border-stone-200/90 bg-white px-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-bold text-stone-900 truncate">
              Global Profile &amp; Career Data
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-800 border border-sky-200/80">
              Source of Truth
            </span>
          </div>
        </div>

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
            ref={jsonUploadRef}
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
            title="Reload from parent repo resume.json & config.yml"
            className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md"
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Import Repo</span>
          </button>

          <button
            type="button"
            onClick={() => jsonUploadRef.current?.click()}
            title="Import resume.json"
            className="h-8 w-8 inline-flex items-center justify-center text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onExportJson}
            title="Export resume.json"
            className="h-8 w-8 inline-flex items-center justify-center text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-md"
          >
            <FileJson className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onPreviewMaster}
            className="h-8 px-3.5 rounded-md bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            Preview Master PDF
          </button>
        </div>
      </header>

      {/* Two-Column Settings Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Settings Section Navigation */}
        <nav className="w-56 shrink-0 border-r border-stone-200/80 bg-white/80 p-3 overflow-y-auto space-y-1">
          <div className="px-2.5 pb-2 text-[11px] text-stone-500 leading-relaxed">
            Maintain your complete profile here. New job postings fork from this data automatically.
          </div>
          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors ${
                  active
                    ? 'bg-sky-50 text-sky-900 border border-sky-200/90 font-semibold'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-transparent'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  <span className={active ? 'text-sky-700' : 'text-stone-400'}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`font-mono text-[11px] px-1.5 py-0.2 rounded-full ${
                      active ? 'bg-sky-100 text-sky-800' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Main Settings Content Area */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* ── 1. PERSONAL & CONTACT ──────────────────────────────────── */}
            {section === 'personal' && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-stone-900">Personal &amp; Contact</h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Used on your Master Resume header, Cover Letters, and every newly forked job
                    application.
                  </p>
                </div>

                <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4 shadow-2xs">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Full Name
                    </label>
                    <input
                      value={data.name}
                      onChange={(e) => onDataChange({ ...data, name: e.target.value })}
                      className={inputCls}
                      placeholder="Randall Lough"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={data.contact.email}
                        onChange={(e) =>
                          onDataChange({
                            ...data,
                            contact: { ...data.contact, email: e.target.value },
                          })
                        }
                        className={inputCls}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Phone Number
                      </label>
                      <input
                        value={data.contact.phone}
                        onChange={(e) =>
                          onDataChange({
                            ...data,
                            contact: { ...data.contact, phone: e.target.value },
                          })
                        }
                        className={inputCls}
                        placeholder="555-123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        LinkedIn
                      </label>
                      <input
                        value={data.contact.linkedin}
                        onChange={(e) =>
                          onDataChange({
                            ...data,
                            contact: { ...data.contact, linkedin: e.target.value },
                          })
                        }
                        className={inputCls}
                        placeholder="linkedin.com/in/yourprofile"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        GitHub
                      </label>
                      <input
                        value={data.contact.github}
                        onChange={(e) =>
                          onDataChange({
                            ...data,
                            contact: { ...data.contact, github: e.target.value },
                          })
                        }
                        className={inputCls}
                        placeholder="github.com/yourusername"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Personal Website (optional)
                      </label>
                      <input
                        value={data.contact.website}
                        onChange={(e) =>
                          onDataChange({
                            ...data,
                            contact: { ...data.contact, website: e.target.value },
                          })
                        }
                        className={inputCls}
                        placeholder="https://yoursite.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-2.5 shadow-2xs">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">
                      Default Professional Overview
                    </h3>
                    <p className="text-xs text-stone-500">
                      Your baseline summary paragraph — you can override this per role without
                      affecting your master profile.
                    </p>
                  </div>
                  <textarea
                    rows={4}
                    value={data.summary}
                    onChange={(e) => onDataChange({ ...data, summary: e.target.value })}
                    className={textareaCls}
                    placeholder="Write your core professional summary..."
                  />
                </div>
              </>
            )}

            {/* ── 2. WORK HISTORY ────────────────────────────────────────── */}
            {section === 'experience' && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">Work History</h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Store your complete career history here. Hide older roles by default while
                      keeping them available to toggle on for relevant job postings.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onDataChange({
                        ...data,
                        experience: [
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
                                responsibilities: [''],
                              },
                            ],
                          },
                          ...data.experience,
                        ],
                      })
                    }
                    className="h-8 px-3 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Company
                  </button>
                </div>

                <div className="space-y-4">
                  {data.experience.map((job, jobIdx) => (
                    <div
                      key={jobIdx}
                      className={`rounded-xl border bg-white p-5 space-y-4 shadow-2xs ${
                        job.hide ? 'border-stone-200/80 opacity-75' : 'border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-bold text-stone-900 truncate">
                            {job.company || 'Untitled Company'}
                          </span>
                          {job.hide && (
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                              Hidden by default
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateJob(jobIdx, { hide: !job.hide })}
                            title={job.hide ? 'Show by default' : 'Hide by default'}
                            className={`h-7 px-2 rounded-md text-xs font-medium inline-flex items-center gap-1 ${
                              job.hide
                                ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                            }`}
                          >
                            {job.hide ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" /> Hidden
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" /> Visible
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={jobIdx === 0}
                            onClick={() =>
                              onDataChange({
                                ...data,
                                experience: moveItem(data.experience, jobIdx, jobIdx - 1),
                              })
                            }
                            className="w-7 h-7 rounded inline-flex items-center justify-center text-stone-400 hover:text-stone-800 hover:bg-stone-100 disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={jobIdx === data.experience.length - 1}
                            onClick={() =>
                              onDataChange({
                                ...data,
                                experience: moveItem(data.experience, jobIdx, jobIdx + 1),
                              })
                            }
                            className="w-7 h-7 rounded inline-flex items-center justify-center text-stone-400 hover:text-stone-800 hover:bg-stone-100 disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onDataChange({
                                ...data,
                                experience: data.experience.filter((_, i) => i !== jobIdx),
                              })
                            }
                            className="w-7 h-7 rounded inline-flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Company Name
                          </label>
                          <input
                            value={job.company}
                            onChange={(e) => updateJob(jobIdx, { company: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Location
                          </label>
                          <input
                            value={job.location ?? ''}
                            onChange={(e) => updateJob(jobIdx, { location: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Company Overview (optional)
                          </label>
                          <input
                            value={job.overview ?? ''}
                            onChange={(e) => updateJob(jobIdx, { overview: e.target.value })}
                            className={inputCls}
                            placeholder="Brief one-line description of the company…"
                          />
                        </div>
                      </div>

                      {/* Positions */}
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                            Roles &amp; Impact Bullets
                          </span>
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
                            <Plus className="w-3.5 h-3.5" /> Add Role
                          </button>
                        </div>

                        {job.positions.map((pos, posIdx) => (
                          <div
                            key={posIdx}
                            className="rounded-lg border border-stone-200/90 bg-stone-50/50 p-3.5 space-y-3"
                          >
                            <div className="grid grid-cols-12 gap-2.5 items-end">
                              <div className="col-span-5">
                                <label className="block text-[11px] font-medium text-stone-500 mb-1">
                                  Title
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
                                <label className="block text-[11px] font-medium text-stone-500 mb-1">
                                  Start Date
                                </label>
                                <input
                                  value={pos.startDate}
                                  onChange={(e) =>
                                    updatePosition(jobIdx, posIdx, { startDate: e.target.value })
                                  }
                                  className={inputCls}
                                />
                              </div>
                              <div className="col-span-3">
                                <label className="block text-[11px] font-medium text-stone-500 mb-1">
                                  End Date
                                </label>
                                <input
                                  value={pos.endDate}
                                  onChange={(e) =>
                                    updatePosition(jobIdx, posIdx, { endDate: e.target.value })
                                  }
                                  className={inputCls}
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
                                    className="h-9 w-8 inline-flex items-center justify-center text-stone-400 hover:text-red-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium text-stone-500">
                                  Responsibilities &amp; Achievements
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updatePosition(jobIdx, posIdx, {
                                      responsibilities: [...pos.responsibilities, ''],
                                    })
                                  }
                                  className="text-xs font-medium text-sky-700 hover:text-sky-800 inline-flex items-center gap-0.5"
                                >
                                  <Plus className="w-3 h-3" /> Add Bullet
                                </button>
                              </div>
                              {pos.responsibilities.map((bullet, bIdx) => (
                                <div key={bIdx} className="flex items-start gap-2">
                                  <span className="text-stone-400 text-sm mt-2 select-none">•</span>
                                  <textarea
                                    rows={2}
                                    value={bullet}
                                    onChange={(e) => {
                                      const next = [...pos.responsibilities];
                                      next[bIdx] = e.target.value;
                                      updatePosition(jobIdx, posIdx, { responsibilities: next });
                                    }}
                                    className="flex-1 px-2.5 py-1.5 text-xs leading-relaxed rounded-md border border-stone-200 bg-white focus:border-sky-500 outline-none resize-y"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updatePosition(jobIdx, posIdx, {
                                        responsibilities: pos.responsibilities.filter(
                                          (_, i) => i !== bIdx
                                        ),
                                      })
                                    }
                                    className="mt-1.5 p-1 text-stone-300 hover:text-red-500"
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
                  ))}
                </div>
              </>
            )}

            {/* ── 3. PROJECTS ────────────────────────────────────────────── */}
            {section === 'projects' && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">Projects</h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Keep all side projects and open-source work here, then pick which ones to
                      feature per role.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onDataChange({
                        ...data,
                        projects: [
                          {
                            name: 'New Project',
                            hide: false,
                            description: '',
                            url: '',
                            github: '',
                            technologies: [],
                            startDate: '',
                            endDate: '',
                            items: [''],
                          },
                          ...data.projects,
                        ],
                      })
                    }
                    className="h-8 px-3 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Project
                  </button>
                </div>

                <div className="space-y-4">
                  {data.projects.map((proj, pIdx) => (
                    <div
                      key={pIdx}
                      className={`rounded-xl border bg-white p-5 space-y-3.5 shadow-2xs ${
                        proj.hide ? 'border-stone-200/80 opacity-75' : 'border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                        <span className="text-sm font-bold text-stone-900">
                          {proj.name || 'Untitled Project'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateProject(pIdx, { hide: !proj.hide })}
                            className={`h-7 px-2 rounded-md text-xs font-medium inline-flex items-center gap-1 ${
                              proj.hide
                                ? 'bg-stone-100 text-stone-600'
                                : 'bg-sky-50 text-sky-700'
                            }`}
                          >
                            {proj.hide ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" /> Hidden
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" /> Visible
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onDataChange({
                                ...data,
                                projects: data.projects.filter((_, i) => i !== pIdx),
                              })
                            }
                            className="w-7 h-7 rounded inline-flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Project Name
                          </label>
                          <input
                            value={proj.name}
                            onChange={(e) => updateProject(pIdx, { name: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
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
                          <label className="block text-xs font-medium text-stone-600 mb-1">
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
                          <label className="block text-xs font-medium text-stone-600 mb-1">
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

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-stone-600">Highlights</span>
                          <button
                            type="button"
                            onClick={() =>
                              updateProject(pIdx, { items: [...(proj.items ?? []), ''] })
                            }
                            className="text-xs font-medium text-sky-700 hover:text-sky-800 inline-flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" /> Add Bullet
                          </button>
                        </div>
                        {(proj.items ?? []).map((item, bIdx) => (
                          <div key={bIdx} className="flex items-start gap-2">
                            <span className="text-stone-400 text-sm mt-2">•</span>
                            <textarea
                              rows={2}
                              value={item}
                              onChange={(e) => {
                                const next = [...(proj.items ?? [])];
                                next[bIdx] = e.target.value;
                                updateProject(pIdx, { items: next });
                              }}
                              className="flex-1 px-2.5 py-1.5 text-xs leading-relaxed rounded-md border border-stone-200 bg-stone-50/40 focus:bg-white focus:border-sky-500 outline-none resize-y"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateProject(pIdx, {
                                  items: (proj.items ?? []).filter((_, i) => i !== bIdx),
                                })
                              }
                              className="mt-1.5 p-1 text-stone-300 hover:text-red-500"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── 4. TECHNICAL SKILLS ────────────────────────────────────── */}
            {section === 'skills' && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-stone-900">Technical Skills</h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Grouped by category in the order shown on your resume. Type comma-separated
                    skills and press Enter to add quickly.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {categoryOrder.map((category) => {
                    const items = data.skills.filter((s) => (s.category || 'Other') === category);
                    return (
                      <div
                        key={category}
                        className="rounded-xl border border-stone-200 bg-white p-4 space-y-3 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-stone-900">{category}</span>
                          <span className="text-[11px] font-mono text-stone-400">
                            {items.length} skills
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((sk, idx) => (
                            <span
                              key={`${sk.name}-${idx}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-stone-100 text-stone-800 border border-stone-200"
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
                        <div className="flex gap-2">
                          <input
                            value={newSkillByCat[category] ?? ''}
                            onChange={(e) =>
                              setNewSkillByCat((prev) => ({ ...prev, [category]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addSkills(category);
                              }
                            }}
                            placeholder={`Add to ${category} (e.g., Rust, Kafka)…`}
                            className="flex-1 h-8 px-3 text-xs rounded-md border border-stone-200 bg-stone-50 focus:bg-white focus:border-sky-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => addSkills(category)}
                            className="h-8 px-3 text-xs font-medium rounded-md border border-stone-200 bg-white hover:bg-stone-50 text-stone-700"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Custom Category */}
                  <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 p-4 flex items-center gap-2">
                    <input
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      placeholder="Add a custom skill category (e.g., Cloud & Security)…"
                      className="flex-1 h-8 px-3 text-xs rounded-md border border-stone-200 bg-white focus:border-sky-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const name = customCategoryName.trim();
                        if (!name) return;
                        onDataChange({
                          ...data,
                          skills: [
                            ...data.skills,
                            { name: 'New Skill', category: name, level: 'Advanced', years: '', keywords: [] },
                          ],
                        });
                        setCustomCategoryName('');
                      }}
                      className="h-8 px-3 rounded-md bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium"
                    >
                      Add Category
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── 5. EDUCATION ───────────────────────────────────────────── */}
            {section === 'education' && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">Education</h2>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Degrees, bootcamps, and certifications. Toggle default visibility per entry.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onDataChange({
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
                    className="h-8 px-3 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Education
                  </button>
                </div>

                <div className="space-y-4">
                  {data.education.map((edu, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border bg-white p-5 space-y-3.5 shadow-2xs ${
                        edu.hide ? 'border-stone-200/80 opacity-75' : 'border-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-100">
                        <span className="text-sm font-bold text-stone-900">
                          {edu.institution || 'Institution'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateEducation(idx, { hide: !edu.hide })}
                            className={`h-7 px-2 rounded-md text-xs font-medium inline-flex items-center gap-1 ${
                              edu.hide
                                ? 'bg-stone-100 text-stone-600'
                                : 'bg-sky-50 text-sky-700'
                            }`}
                          >
                            {edu.hide ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" /> Hidden
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" /> Visible
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onDataChange({
                                ...data,
                                education: data.education.filter((_, i) => i !== idx),
                              })
                            }
                            className="w-7 h-7 rounded inline-flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Institution
                          </label>
                          <input
                            value={edu.institution}
                            onChange={(e) =>
                              updateEducation(idx, { institution: e.target.value })
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            College / School (optional)
                          </label>
                          <input
                            value={edu.college ?? ''}
                            onChange={(e) => updateEducation(idx, { college: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Degree
                          </label>
                          <input
                            value={edu.degree}
                            onChange={(e) => updateEducation(idx, { degree: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Start
                            </label>
                            <input
                              value={edu.startDate}
                              onChange={(e) =>
                                updateEducation(idx, { startDate: e.target.value })
                              }
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              End
                            </label>
                            <input
                              value={edu.endDate}
                              onChange={(e) => updateEducation(idx, { endDate: e.target.value })}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              GPA
                            </label>
                            <input
                              value={edu.gpa ?? ''}
                              onChange={(e) => updateEducation(idx, { gpa: e.target.value })}
                              className={inputCls}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── 6. GLOBAL COVER LETTERS ────────────────────────────────── */}
            {section === 'cover-letters' && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-stone-900">Global Cover Letter Templates</h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Create reusable cover letters or upload <code className="bg-stone-200/70 px-1 rounded">.md</code>/<code className="bg-stone-200/70 px-1 rounded">.txt</code> files.
                    Use <code className="bg-stone-200/70 px-1 rounded">{'{{company}}'}</code> and{' '}
                    <code className="bg-stone-200/70 px-1 rounded">{'{{role}}'}</code> placeholders
                    to auto-fill when forking a new job posting.
                  </p>
                </div>

                <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-2xs h-[560px]">
                  <CoverLetterEditor
                    letters={globalCoverLetters}
                    activeLetter={activeGlobalLetter}
                    onSelect={onSelectGlobalLetter}
                    onCreate={onCreateGlobalLetter}
                    onUploadFile={onUploadGlobalLetter}
                    onDelete={onDeleteGlobalLetter}
                    onChange={onUpdateGlobalLetter}
                  />
                </div>
              </>
            )}

            {/* ── 7. RECOMMENDATION LETTERS LIBRARY ──────────────────────── */}
            {section === 'recommendations' && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-stone-900">
                    Letters of Recommendation Library
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Upload PDF, PNG, or JPG recommendation letters once. Letters attached to your
                    Master profile here are automatically inherited by every new role posting.
                  </p>
                </div>

                <div className="-m-4">
                  <RecommendationsPanel
                    targetLabel="Resume"
                    library={recommendations}
                    attached={defaultAttachedRecommendations}
                    uploading={uploadingRecommendation}
                    onUploadFiles={onUploadRecommendations}
                    onUpdateLetter={onUpdateRecommendation}
                    onDeleteLetter={onDeleteRecommendation}
                    onSetAttachedIds={onSetDefaultAttachments}
                  />
                </div>
              </>
            )}

            {/* ── 8. DEFAULT RESUME STYLE ────────────────────────────────── */}
            {section === 'style' && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-stone-900">Default Resume Style</h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Baseline colors and section visibility toggles inherited by every newly forked
                    role resume.
                  </p>
                </div>

                <div className="-m-5">
                  <StylePanel config={config} onChange={onConfigChange} />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
