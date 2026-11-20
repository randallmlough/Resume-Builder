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

export const ALLOWED_RECOMMENDATION_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

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
  createdAt: string;
  updatedAt: string;
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
