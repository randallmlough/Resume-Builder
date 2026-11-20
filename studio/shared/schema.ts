import { z } from 'zod';

export const ContactSchema = z.object({
  email: z.string().default(''),
  phone: z.string().default(''),
  linkedin: z.string().default(''),
  github: z.string().default(''),
  website: z.string().default(''),
});

export const PositionSchema = z.object({
  title: z.string().default(''),
  type: z.string().optional(),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  responsibilities: z.array(z.string()).default([]),
});

export const JobSchema = z.object({
  company: z.string().default(''),
  hide: z.boolean().optional().default(false),
  location: z.string().optional().default(''),
  website: z.string().optional().default(''),
  overview: z.string().optional().default(''),
  technologies: z.array(z.string()).optional().default([]),
  startDate: z.string().optional().default(''),
  endDate: z.string().optional().default(''),
  positions: z.array(PositionSchema).default([]),
});

export const ProjectSchema = z.object({
  name: z.string().default(''),
  hide: z.boolean().optional().default(false),
  description: z.string().optional().default(''),
  url: z.string().optional().default(''),
  github: z.string().optional().default(''),
  technologies: z.array(z.string()).optional().default([]),
  startDate: z.string().optional().default(''),
  endDate: z.string().optional().default(''),
  items: z.array(z.string()).optional().default([]),
});

export const EducationSchema = z.object({
  institution: z.string().default(''),
  hide: z.boolean().optional().default(false),
  college: z.string().optional().default(''),
  degree: z.string().default(''),
  fieldOfStudy: z.string().optional().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  location: z.string().optional().default(''),
  gpa: z.string().optional().default(''),
});

// Supports object, [name, years], or plain string format like the Go implementation
export const SkillObjectSchema = z.object({
  name: z.string().default(''),
  level: z.string().optional().default(''),
  years: z.string().optional().default(''),
  category: z.string().optional().default('Other'),
  keywords: z.array(z.string()).optional().default([]),
});

export const SkillSchema = z.union([
  SkillObjectSchema,
  z.tuple([z.string(), z.string()]).transform(([name, years]) => ({
    name,
    years,
    level: '',
    category: 'Other',
    keywords: [],
  })),
  z.string().transform((name) => ({
    name,
    years: '',
    level: '',
    category: 'Other',
    keywords: [],
  })),
]);

export const ResumeDataSchema = z.object({
  $schema: z.string().optional(),
  name: z.string().default(''),
  contact: ContactSchema.default({}),
  summary: z.string().default(''),
  experience: z.array(JobSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  awards: z.array(z.string()).optional().default([]),
});

export const BaseSectionConfigSchema = z.object({
  hide: z.boolean().default(false),
});

export const ExperienceConfigSchema = z.object({
  hide: z.boolean().default(false),
  hide_overview: z.boolean().default(false),
  hide_location: z.boolean().default(false),
  hide_date: z.boolean().default(true),
  hide_technologies: z.boolean().default(true),
});

export const ResumeConfigSchema = z.object({
  template_name: z.string().default('single-column'),
  cover_letter_template_name: z.string().default('cover-letter'),
  accent_color: z.string().default('1f79c7'),
  muted_color: z.string().default('5a5a5a'),
  font_sans: z.string().default('Merriweather Sans'),
  font_serif: z.string().default('Merriweather'),
  page_marker: BaseSectionConfigSchema.default({ hide: false }),
  contact: BaseSectionConfigSchema.default({ hide: false }),
  summary: BaseSectionConfigSchema.default({ hide: false }),
  skills: BaseSectionConfigSchema.default({ hide: false }),
  experience: ExperienceConfigSchema.default({
    hide: false,
    hide_overview: false,
    hide_location: false,
    hide_date: true,
    hide_technologies: true,
  }),
  education: BaseSectionConfigSchema.default({ hide: false }),
  projects: BaseSectionConfigSchema.default({ hide: false }),
  awards: BaseSectionConfigSchema.default({ hide: false }),
});

export const CreateResumeInputSchema = z.object({
  title: z.string().min(1).max(200),
  data: ResumeDataSchema,
  config: ResumeConfigSchema.optional(),
});

export const UpdateResumeInputSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  data: ResumeDataSchema.optional(),
  config: ResumeConfigSchema.optional(),
});

export const CreateCoverLetterInputSchema = z.object({
  resumeId: z.string().min(1),
  title: z.string().min(1).max(200),
  company: z.string().max(200).optional().default(''),
  bodyMarkdown: z.string().default(''),
});

export const UpdateCoverLetterInputSchema = z.object({
  resumeId: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  company: z.string().max(200).optional(),
  bodyMarkdown: z.string().optional(),
});

export const AttachmentTargetTypeSchema = z.enum(['resume', 'cover_letter']);

export const UpdateRecommendationInputSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  authorName: z.string().max(200).optional(),
  authorTitle: z.string().max(200).optional(),
});

export const SetAttachmentsInputSchema = z.object({
  letterIds: z.array(z.string().min(1)),
});

export const JobStageSchema = z.enum([
  'saved',
  'tailoring',
  'applied',
  'interviewing',
  'offer',
  'archived',
]);

export const JOB_STAGES = [
  { id: 'saved', label: 'Saved' },
  { id: 'tailoring', label: 'Tailoring' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offer', label: 'Offer' },
  { id: 'archived', label: 'Archived' },
] as const;

export const CreateCompanyInputSchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().max(500).optional().default(''),
  notes: z.string().optional().default(''),
});

export const UpdateCompanyInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  website: z.string().max(500).optional(),
  notes: z.string().optional(),
});

export const CreateJobPostingInputSchema = z.object({
  companyId: z.string().min(1).optional(),
  companyName: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(200),
  stage: JobStageSchema.optional().default('tailoring'),
  url: z.string().max(1000).optional().default(''),
  location: z.string().max(200).optional().default(''),
  compensation: z.string().max(200).optional().default(''),
  description: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  sourceResumeId: z.string().min(1).optional(),
  sourceCoverLetterId: z.string().min(1).optional(),
});

export const UpdateJobPostingInputSchema = z.object({
  companyId: z.string().min(1).optional(),
  title: z.string().min(1).max(200).optional(),
  stage: JobStageSchema.optional(),
  url: z.string().max(1000).optional(),
  location: z.string().max(200).optional(),
  compensation: z.string().max(200).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  appliedAt: z.string().nullable().optional(),
});

export const CreateSnapshotInputSchema = z.object({
  label: z.string().min(1).max(200),
});

export const ContactRelationshipSchema = z.enum([
  'hiring_manager',
  'decision_maker',
  'recruiter',
  'referral',
  'interviewer',
  'other',
]);

export const CONTACT_RELATIONSHIPS = [
  { id: 'hiring_manager', label: 'Hiring Manager' },
  { id: 'decision_maker', label: 'Decision Maker' },
  { id: 'recruiter', label: 'Recruiter' },
  { id: 'referral', label: 'Referral' },
  { id: 'interviewer', label: 'Interviewer' },
  { id: 'other', label: 'Other' },
] as const;

export const CreateContactInputSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().min(1).max(200),
  title: z.string().max(200).optional().default(''),
  email: z.string().max(300).optional().default(''),
  phone: z.string().max(100).optional().default(''),
  linkedin: z.string().max(500).optional().default(''),
  github: z.string().max(500).optional().default(''),
  twitter: z.string().max(500).optional().default(''),
  website: z.string().max(500).optional().default(''),
  notes: z.string().optional().default(''),
});

export const UpdateContactInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  title: z.string().max(200).optional(),
  email: z.string().max(300).optional(),
  phone: z.string().max(100).optional(),
  linkedin: z.string().max(500).optional(),
  github: z.string().max(500).optional(),
  twitter: z.string().max(500).optional(),
  website: z.string().max(500).optional(),
  notes: z.string().optional(),
});

export const LinkJobContactInputSchema = z.object({
  contactId: z.string().min(1),
  relationship: ContactRelationshipSchema.default('hiring_manager'),
});

export const ALLOWED_RECOMMENDATION_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

export type ContactRelationship = z.infer<typeof ContactRelationshipSchema>;
export type JobStage = z.infer<typeof JobStageSchema>;
export type AttachmentTargetType = z.infer<typeof AttachmentTargetTypeSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Job = z.infer<typeof JobSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Skill = z.infer<typeof SkillObjectSchema>;
export type ResumeData = z.infer<typeof ResumeDataSchema>;
export type ResumeConfig = z.infer<typeof ResumeConfigSchema>;

export interface ResumeRecord {
  id: string;
  title: string;
  data: ResumeData;
  config: ResumeConfig;
  isMaster: boolean;
  parentResumeId: string | null;
  baseSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyRecord {
  id: string;
  name: string;
  website: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobPostingRecord {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  stage: JobStage;
  url: string;
  location: string;
  compensation: string;
  description: string;
  notes: string;
  appliedAt: string | null;
  resumeId: string;
  coverLetterId: string | null;
  snapshotCount: number;
  attachmentCount: number;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyContactRecord {
  id: string;
  companyId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  twitter: string;
  website: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleContactRecord extends CompanyContactRecord {
  relationship: ContactRelationship;
}

export interface ResumeSnapshotRecord {
  id: string;
  jobPostingId: string;
  label: string;
  data: ResumeData;
  config: ResumeConfig;
  coverLetterMarkdown: string;
  attachedLetterIds: string[];
  createdAt: string;
}

export interface CoverLetterRecord {
  id: string;
  resumeId: string;
  title: string;
  company: string;
  bodyMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationLetterRecord {
  id: string;
  title: string;
  authorName: string;
  authorTitle: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  fileUrl: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_CONFIG: ResumeConfig = ResumeConfigSchema.parse({});

export const SKILL_CATEGORIES = [
  'Programming Languages',
  'Frameworks and Libraries',
  'Databases',
  'CI/CD, Infra, Monitoring',
  'AI & Developer Productivity',
  'Other',
] as const;

export function normalizeHex(color: string): string {
  const cleaned = color.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(cleaned) ? cleaned : '1f79c7';
}
