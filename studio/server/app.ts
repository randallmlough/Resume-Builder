import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { and, asc, desc, eq } from 'drizzle-orm';
import { serveStatic } from '@hono/node-server/serve-static';
import { PDFDocument } from 'pdf-lib';
import {
  ALLOWED_RECOMMENDATION_MIMES,
  AttachmentTargetTypeSchema,
  ContactRelationshipSchema,
  CreateCompanyInputSchema,
  CreateContactInputSchema,
  CreateCoverLetterInputSchema,
  CreateJobPostingInputSchema,
  CreateResumeInputSchema,
  CreateSnapshotInputSchema,
  DEFAULT_CONFIG,
  JobStageSchema,
  LinkJobContactInputSchema,
  ResumeConfigSchema,
  ResumeDataSchema,
  SetAttachmentsInputSchema,
  UpdateCompanyInputSchema,
  UpdateContactInputSchema,
  UpdateCoverLetterInputSchema,
  UpdateJobPostingInputSchema,
  UpdateRecommendationInputSchema,
  UpdateResumeInputSchema,
  type AttachmentTargetType,
  type CompanyContactRecord,
  type CompanyRecord,
  type CoverLetterRecord,
  type JobPostingRecord,
  type RecommendationLetterRecord,
  type ResumeRecord,
  type ResumeSnapshotRecord,
  type RoleContactRecord,
} from '../shared/schema.js';
import { pullUpdatesFromMaster } from '../shared/resumeDiff.js';
import type { StudioDb } from './db/index.js';
import {
  companies,
  contacts,
  coverLetters,
  documentAttachments,
  jobPostingContacts,
  jobPostings,
  recommendationLetters,
  resumes,
  resumeSnapshots,
  type CompanyRow,
  type ContactRow,
  type CoverLetterRow,
  type JobPostingRow,
  type RecommendationLetterRow,
  type ResumeRow,
  type ResumeSnapshotRow,
} from './db/schema.js';
import { loadRepoResumeAndConfig } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

function inferMimeType(file: File): string {
  if ((ALLOWED_RECOMMENDATION_MIMES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  const ext = path.extname(file.name).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return file.type;
}

function toResumeRecord(row: ResumeRow): ResumeRecord {
  return {
    id: row.id,
    title: row.title,
    data: ResumeDataSchema.parse(JSON.parse(row.dataJson)),
    config: ResumeConfigSchema.parse(JSON.parse(row.configJson)),
    isMaster: Boolean(row.isMaster),
    parentResumeId: row.parentResumeId ?? null,
    baseSyncedAt: row.baseSyncedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCoverLetterRecord(row: CoverLetterRow): CoverLetterRecord {
  return {
    id: row.id,
    resumeId: row.resumeId,
    title: row.title,
    company: row.company,
    bodyMarkdown: row.bodyMarkdown,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCompanyRecord(row: CompanyRow): CompanyRecord {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toContactRecord(row: ContactRow): CompanyContactRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    linkedin: row.linkedin,
    github: row.github,
    twitter: row.twitter,
    website: row.website,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRecommendationRecord(row: RecommendationLetterRow): RecommendationLetterRecord {
  return {
    id: row.id,
    title: row.title,
    authorName: row.authorName,
    authorTitle: row.authorTitle,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    pageCount: row.pageCount,
    fileUrl: `/api/recommendations/${row.id}/file`,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSnapshotRecord(row: ResumeSnapshotRow): ResumeSnapshotRecord {
  let attachedIds: string[] = [];
  try {
    const parsed = JSON.parse(row.attachedLetterIdsJson);
    if (Array.isArray(parsed)) attachedIds = parsed.map(String);
  } catch {
    attachedIds = [];
  }
  return {
    id: row.id,
    jobPostingId: row.jobPostingId,
    label: row.label,
    data: ResumeDataSchema.parse(JSON.parse(row.dataJson)),
    config: ResumeConfigSchema.parse(JSON.parse(row.configJson)),
    coverLetterMarkdown: row.coverLetterMarkdown,
    attachedLetterIds: attachedIds,
    createdAt: row.createdAt,
  };
}

export interface CreateAppOptions {
  uploadsDir?: string;
}

export function createApp(db: StudioDb, options: CreateAppOptions = {}) {
  const uploadsDir = options.uploadsDir ?? path.resolve(__dirname, '../data/uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const app = new Hono();

  app.use('/api/*', cors());

  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', engine: 'typst-wasm', timestamp: new Date().toISOString() });
  });

  async function listAttachedLetters(
    targetType: AttachmentTargetType,
    targetId: string
  ): Promise<RecommendationLetterRecord[]> {
    const links = await db
      .select()
      .from(documentAttachments)
      .where(
        and(
          eq(documentAttachments.targetType, targetType),
          eq(documentAttachments.targetId, targetId)
        )
      )
      .orderBy(asc(documentAttachments.position));

    if (links.length === 0) return [];

    const allLetters = await db.select().from(recommendationLetters);
    const byId = new Map(allLetters.map((l) => [l.id, l]));

    const ordered: RecommendationLetterRecord[] = [];
    for (const link of links) {
      const letter = byId.get(link.letterId);
      if (letter) ordered.push(toRecommendationRecord(letter));
    }
    return ordered;
  }

  async function enrichJobPostings(rows: JobPostingRow[]): Promise<JobPostingRecord[]> {
    const [allCompanies, allSnapshots, allAttachments, allJobContacts] = await Promise.all([
      db.select().from(companies),
      db.select().from(resumeSnapshots),
      db.select().from(documentAttachments),
      db.select().from(jobPostingContacts),
    ]);

    const companyMap = new Map(allCompanies.map((c) => [c.id, c.name]));

    const snapCountByJob = new Map<string, number>();
    for (const s of allSnapshots) {
      snapCountByJob.set(s.jobPostingId, (snapCountByJob.get(s.jobPostingId) ?? 0) + 1);
    }

    const attCountByTarget = new Map<string, number>();
    for (const a of allAttachments) {
      const key = `${a.targetType}:${a.targetId}`;
      attCountByTarget.set(key, (attCountByTarget.get(key) ?? 0) + 1);
    }

    const contactCountByJob = new Map<string, number>();
    for (const jc of allJobContacts) {
      contactCountByJob.set(jc.jobPostingId, (contactCountByJob.get(jc.jobPostingId) ?? 0) + 1);
    }

    return rows.map((row) => ({
      id: row.id,
      companyId: row.companyId,
      companyName: companyMap.get(row.companyId) ?? 'Unknown Company',
      title: row.title,
      stage: JobStageSchema.catch('tailoring').parse(row.stage),
      url: row.url,
      location: row.location,
      compensation: row.compensation,
      description: row.description,
      notes: row.notes,
      appliedAt: row.appliedAt ?? null,
      resumeId: row.resumeId,
      coverLetterId: row.coverLetterId ?? null,
      snapshotCount: snapCountByJob.get(row.id) ?? 0,
      attachmentCount:
        (attCountByTarget.get(`resume:${row.resumeId}`) ?? 0) +
        (row.coverLetterId ? (attCountByTarget.get(`cover_letter:${row.coverLetterId}`) ?? 0) : 0),
      contactCount: contactCountByJob.get(row.id) ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async function listJobContacts(jobPostingId: string): Promise<RoleContactRecord[]> {
    const links = await db
      .select()
      .from(jobPostingContacts)
      .where(eq(jobPostingContacts.jobPostingId, jobPostingId))
      .orderBy(asc(jobPostingContacts.createdAt));

    if (links.length === 0) return [];

    const allContacts = await db.select().from(contacts);
    const byId = new Map(allContacts.map((c) => [c.id, c]));

    const result: RoleContactRecord[] = [];
    for (const link of links) {
      const row = byId.get(link.contactId);
      if (row) {
        result.push({
          ...toContactRecord(row),
          relationship: ContactRelationshipSchema.catch('other').parse(link.relationship),
        });
      }
    }
    return result;
  }

  async function findMasterResumeRow(): Promise<ResumeRow | undefined> {
    const [master] = await db.select().from(resumes).where(eq(resumes.isMaster, 1));
    if (master) return master;
    const all = await db.select().from(resumes).orderBy(asc(resumes.createdAt));
    return all[0];
  }

  // ── Resumes CRUD ──────────────────────────────────────────────────────────
  app.get('/api/resumes', async (c) => {
    const rows = await db
      .select()
      .from(resumes)
      .orderBy(desc(resumes.isMaster), desc(resumes.updatedAt));
    return c.json(rows.map(toResumeRecord));
  });

  app.get('/api/resumes/:id', async (c) => {
    const id = c.req.param('id');
    const [row] = await db.select().from(resumes).where(eq(resumes.id, id));
    if (!row) return c.json({ error: 'Resume not found' }, 404);
    return c.json(toResumeRecord(row));
  });

  app.post('/api/resumes', async (c) => {
    const body = await c.req.json();
    const parsed = CreateResumeInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const config = parsed.data.config ?? DEFAULT_CONFIG;

    await db.insert(resumes).values({
      id,
      title: parsed.data.title,
      dataJson: JSON.stringify(parsed.data.data),
      configJson: JSON.stringify(config),
      isMaster: 0,
      parentResumeId: null,
      baseSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db.select().from(resumes).where(eq(resumes.id, id));
    return c.json(toResumeRecord(created), 201);
  });

  app.put('/api/resumes/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(resumes).where(eq(resumes.id, id));
    if (!existing) return c.json({ error: 'Resume not found' }, 404);

    const body = await c.req.json();
    const parsed = UpdateResumeInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const now = new Date().toISOString();
    await db
      .update(resumes)
      .set({
        title: parsed.data.title ?? existing.title,
        dataJson: parsed.data.data ? JSON.stringify(parsed.data.data) : existing.dataJson,
        configJson: parsed.data.config ? JSON.stringify(parsed.data.config) : existing.configJson,
        updatedAt: now,
      })
      .where(eq(resumes.id, id));

    const [updated] = await db.select().from(resumes).where(eq(resumes.id, id));
    return c.json(toResumeRecord(updated));
  });

  app.post('/api/resumes/:id/set-master', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(resumes).where(eq(resumes.id, id));
    if (!existing) return c.json({ error: 'Resume not found' }, 404);

    await db.update(resumes).set({ isMaster: 0 });
    await db
      .update(resumes)
      .set({ isMaster: 1, parentResumeId: null, updatedAt: new Date().toISOString() })
      .where(eq(resumes.id, id));

    const [updated] = await db.select().from(resumes).where(eq(resumes.id, id));
    return c.json(toResumeRecord(updated));
  });

  app.post('/api/resumes/:id/clone', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(resumes).where(eq(resumes.id, id));
    if (!existing) return c.json({ error: 'Resume not found' }, 404);

    let customTitle: string | undefined;
    try {
      const body = await c.req.json();
      if (typeof body?.title === 'string' && body.title.trim()) {
        customTitle = body.title.trim();
      }
    } catch {
      // empty body ok
    }

    const now = new Date().toISOString();
    const newId = crypto.randomUUID();
    await db.insert(resumes).values({
      id: newId,
      title: customTitle ?? `${existing.title} (Copy)`,
      dataJson: existing.dataJson,
      configJson: existing.configJson,
      isMaster: 0,
      parentResumeId: existing.id,
      baseSyncedAt: existing.updatedAt,
      createdAt: now,
      updatedAt: now,
    });

    const existingLinks = await db
      .select()
      .from(documentAttachments)
      .where(
        and(eq(documentAttachments.targetType, 'resume'), eq(documentAttachments.targetId, id))
      )
      .orderBy(asc(documentAttachments.position));

    for (const link of existingLinks) {
      await db.insert(documentAttachments).values({
        id: crypto.randomUUID(),
        targetType: 'resume',
        targetId: newId,
        letterId: link.letterId,
        position: link.position,
        createdAt: now,
      });
    }

    const [created] = await db.select().from(resumes).where(eq(resumes.id, newId));
    return c.json(toResumeRecord(created), 201);
  });

  app.delete('/api/resumes/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(resumes).where(eq(resumes.id, id));
    if (!existing) return c.json({ error: 'Resume not found' }, 404);

    const childLetters = await db
      .select()
      .from(coverLetters)
      .where(eq(coverLetters.resumeId, id));
    for (const cl of childLetters) {
      await db
        .delete(documentAttachments)
        .where(
          and(
            eq(documentAttachments.targetType, 'cover_letter'),
            eq(documentAttachments.targetId, cl.id)
          )
        );
    }
    await db
      .delete(documentAttachments)
      .where(
        and(eq(documentAttachments.targetType, 'resume'), eq(documentAttachments.targetId, id))
      );

    await db.delete(resumes).where(eq(resumes.id, id));
    return c.json({ deleted: true, id });
  });

  app.post('/api/seed-from-repo', async (c) => {
    const { data, config } = loadRepoResumeAndConfig();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const stamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    await db.insert(resumes).values({
      id,
      title: `Repo Import (${stamp})`,
      dataJson: JSON.stringify(data),
      configJson: JSON.stringify(config),
      isMaster: 0,
      parentResumeId: null,
      baseSyncedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db.select().from(resumes).where(eq(resumes.id, id));
    return c.json(toResumeRecord(created), 201);
  });

  // ── Companies CRUD ────────────────────────────────────────────────────────
  app.get('/api/companies', async (c) => {
    const rows = await db.select().from(companies).orderBy(asc(companies.name));
    return c.json(rows.map(toCompanyRecord));
  });

  app.post('/api/companies', async (c) => {
    const body = await c.req.json();
    const parsed = CreateCompanyInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.insert(companies).values({
      id,
      name: parsed.data.name.trim(),
      website: parsed.data.website.trim(),
      notes: parsed.data.notes,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db.select().from(companies).where(eq(companies.id, id));
    return c.json(toCompanyRecord(created), 201);
  });

  app.put('/api/companies/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(companies).where(eq(companies.id, id));
    if (!existing) return c.json({ error: 'Company not found' }, 404);

    const body = await c.req.json();
    const parsed = UpdateCompanyInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const now = new Date().toISOString();
    await db
      .update(companies)
      .set({
        name: parsed.data.name?.trim() ?? existing.name,
        website: parsed.data.website?.trim() ?? existing.website,
        notes: parsed.data.notes ?? existing.notes,
        updatedAt: now,
      })
      .where(eq(companies.id, id));

    const [updated] = await db.select().from(companies).where(eq(companies.id, id));
    return c.json(toCompanyRecord(updated));
  });

  app.delete('/api/companies/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(companies).where(eq(companies.id, id));
    if (!existing) return c.json({ error: 'Company not found' }, 404);

    // Clean up all role resumes, cover letters, and attachments owned by this company's postings
    const postings = await db.select().from(jobPostings).where(eq(jobPostings.companyId, id));
    for (const p of postings) {
      if (p.coverLetterId) {
        await db
          .delete(documentAttachments)
          .where(
            and(
              eq(documentAttachments.targetType, 'cover_letter'),
              eq(documentAttachments.targetId, p.coverLetterId)
            )
          );
      }
      await db
        .delete(documentAttachments)
        .where(
          and(
            eq(documentAttachments.targetType, 'resume'),
            eq(documentAttachments.targetId, p.resumeId)
          )
        );
      const [roleResume] = await db.select().from(resumes).where(eq(resumes.id, p.resumeId));
      if (roleResume && !roleResume.isMaster) {
        await db.delete(resumes).where(eq(resumes.id, p.resumeId));
      }
    }

    await db.delete(companies).where(eq(companies.id, id));
    return c.json({ deleted: true, id });
  });

  // ── Company Contacts CRUD ─────────────────────────────────────────────────
  app.get('/api/contacts', async (c) => {
    const companyId = c.req.query('companyId');
    const rows = companyId
      ? await db
          .select()
          .from(contacts)
          .where(eq(contacts.companyId, companyId))
          .orderBy(asc(contacts.name))
      : await db.select().from(contacts).orderBy(asc(contacts.name));
    return c.json(rows.map(toContactRecord));
  });

  app.post('/api/contacts', async (c) => {
    const body = await c.req.json();
    const parsed = CreateContactInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const [comp] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, parsed.data.companyId));
    if (!comp) return c.json({ error: 'Company not found' }, 404);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(contacts).values({
      id,
      companyId: parsed.data.companyId,
      name: parsed.data.name.trim(),
      title: parsed.data.title.trim(),
      email: parsed.data.email.trim(),
      phone: parsed.data.phone.trim(),
      linkedin: parsed.data.linkedin.trim(),
      github: parsed.data.github.trim(),
      twitter: parsed.data.twitter.trim(),
      website: parsed.data.website.trim(),
      notes: parsed.data.notes,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db.select().from(contacts).where(eq(contacts.id, id));
    return c.json(toContactRecord(created), 201);
  });

  app.put('/api/contacts/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(contacts).where(eq(contacts.id, id));
    if (!existing) return c.json({ error: 'Contact not found' }, 404);

    const body = await c.req.json();
    const parsed = UpdateContactInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const now = new Date().toISOString();
    await db
      .update(contacts)
      .set({
        name: parsed.data.name?.trim() ?? existing.name,
        title: parsed.data.title !== undefined ? parsed.data.title.trim() : existing.title,
        email: parsed.data.email !== undefined ? parsed.data.email.trim() : existing.email,
        phone: parsed.data.phone !== undefined ? parsed.data.phone.trim() : existing.phone,
        linkedin:
          parsed.data.linkedin !== undefined ? parsed.data.linkedin.trim() : existing.linkedin,
        github: parsed.data.github !== undefined ? parsed.data.github.trim() : existing.github,
        twitter: parsed.data.twitter !== undefined ? parsed.data.twitter.trim() : existing.twitter,
        website: parsed.data.website !== undefined ? parsed.data.website.trim() : existing.website,
        notes: parsed.data.notes ?? existing.notes,
        updatedAt: now,
      })
      .where(eq(contacts.id, id));

    const [updated] = await db.select().from(contacts).where(eq(contacts.id, id));
    return c.json(toContactRecord(updated));
  });

  app.delete('/api/contacts/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(contacts).where(eq(contacts.id, id));
    if (!existing) return c.json({ error: 'Contact not found' }, 404);

    await db.delete(contacts).where(eq(contacts.id, id));
    return c.json({ deleted: true, id });
  });

  // ── Role Contacts (Hiring Manager / Decision Maker / Recruiter per Role) ──
  app.get('/api/jobs/:id/contacts', async (c) => {
    const id = c.req.param('id');
    return c.json(await listJobContacts(id));
  });

  app.post('/api/jobs/:id/contacts', async (c) => {
    const jobId = c.req.param('id');
    const [job] = await db.select().from(jobPostings).where(eq(jobPostings.id, jobId));
    if (!job) return c.json({ error: 'Job posting not found' }, 404);

    const body = await c.req.json();
    const parsed = LinkJobContactInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, parsed.data.contactId));
    if (!contact) return c.json({ error: 'Contact not found' }, 404);

    const [existingLink] = await db
      .select()
      .from(jobPostingContacts)
      .where(
        and(
          eq(jobPostingContacts.jobPostingId, jobId),
          eq(jobPostingContacts.contactId, parsed.data.contactId)
        )
      );

    if (existingLink) {
      await db
        .update(jobPostingContacts)
        .set({ relationship: parsed.data.relationship })
        .where(eq(jobPostingContacts.id, existingLink.id));
    } else {
      await db.insert(jobPostingContacts).values({
        id: crypto.randomUUID(),
        jobPostingId: jobId,
        contactId: parsed.data.contactId,
        relationship: parsed.data.relationship,
        createdAt: new Date().toISOString(),
      });
    }

    return c.json(await listJobContacts(jobId), 201);
  });

  app.delete('/api/jobs/:id/contacts/:contactId', async (c) => {
    const jobId = c.req.param('id');
    const contactId = c.req.param('contactId');
    await db
      .delete(jobPostingContacts)
      .where(
        and(
          eq(jobPostingContacts.jobPostingId, jobId),
          eq(jobPostingContacts.contactId, contactId)
        )
      );
    return c.json(await listJobContacts(jobId));
  });

  // ── Job Postings CRUD (multiple roles per company!) ───────────────────────
  app.get('/api/jobs', async (c) => {
    const companyId = c.req.query('companyId');
    const rows = companyId
      ? await db
          .select()
          .from(jobPostings)
          .where(eq(jobPostings.companyId, companyId))
          .orderBy(desc(jobPostings.updatedAt))
      : await db.select().from(jobPostings).orderBy(desc(jobPostings.updatedAt));

    return c.json(await enrichJobPostings(rows));
  });

  app.post('/api/jobs', async (c) => {
    const body = await c.req.json();
    const parsed = CreateJobPostingInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const now = new Date().toISOString();

    // Resolve or create Company
    let companyId = parsed.data.companyId;
    let companyName = parsed.data.companyName?.trim() ?? '';

    if (companyId) {
      const [comp] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!comp) return c.json({ error: 'Company not found' }, 404);
      companyName = comp.name;
    } else if (companyName) {
      // Reuse existing company if case-insensitive match exists, otherwise create new
      const allCompanies = await db.select().from(companies);
      const existingComp = allCompanies.find(
        (comp) => comp.name.toLowerCase() === companyName.toLowerCase()
      );
      if (existingComp) {
        companyId = existingComp.id;
        companyName = existingComp.name;
      } else {
        companyId = crypto.randomUUID();
        await db.insert(companies).values({
          id: companyId,
          name: companyName,
          website: '',
          notes: '',
          createdAt: now,
          updatedAt: now,
        });
      }
    } else {
      return c.json({ error: 'Either companyId or companyName is required' }, 400);
    }

    // Fork Master (or specified sourceResumeId) into a dedicated role resume
    let sourceResume: ResumeRow | undefined;
    if (parsed.data.sourceResumeId) {
      const [src] = await db
        .select()
        .from(resumes)
        .where(eq(resumes.id, parsed.data.sourceResumeId));
      sourceResume = src;
    }
    if (!sourceResume) {
      sourceResume = await findMasterResumeRow();
    }
    if (!sourceResume) {
      return c.json({ error: 'No Master resume available to fork from' }, 400);
    }

    const roleResumeId = crypto.randomUUID();
    const roleTitle = parsed.data.title.trim();
    await db.insert(resumes).values({
      id: roleResumeId,
      title: `${companyName} — ${roleTitle}`,
      dataJson: sourceResume.dataJson,
      configJson: sourceResume.configJson,
      isMaster: 0,
      parentResumeId: sourceResume.id,
      baseSyncedAt: sourceResume.updatedAt,
      createdAt: now,
      updatedAt: now,
    });

    // Copy any default attachments from the source resume
    const srcAttachments = await db
      .select()
      .from(documentAttachments)
      .where(
        and(
          eq(documentAttachments.targetType, 'resume'),
          eq(documentAttachments.targetId, sourceResume.id)
        )
      )
      .orderBy(asc(documentAttachments.position));
    for (const att of srcAttachments) {
      await db.insert(documentAttachments).values({
        id: crypto.randomUUID(),
        targetType: 'resume',
        targetId: roleResumeId,
        letterId: att.letterId,
        position: att.position,
        createdAt: now,
      });
    }

    // Create a dedicated Cover Letter linked to this role's resume
    const sourceResumeData = ResumeDataSchema.parse(JSON.parse(sourceResume.dataJson));
    const coverLetterId = crypto.randomUUID();

    let templateBody = `Dear ${companyName} Hiring Team,\n\nI am excited to apply for the **${roleTitle}** role at **${companyName}**.\n\nBest regards,\n\n${sourceResumeData.name || 'Your Name'}`;
    let sourceCoverRow: CoverLetterRow | undefined;

    if (parsed.data.sourceCoverLetterId) {
      const [cl] = await db
        .select()
        .from(coverLetters)
        .where(eq(coverLetters.id, parsed.data.sourceCoverLetterId));
      sourceCoverRow = cl;
    } else {
      // Default to the most recent global cover letter on the source/Master resume if available
      const globalLetters = await db
        .select()
        .from(coverLetters)
        .where(eq(coverLetters.resumeId, sourceResume.id))
        .orderBy(desc(coverLetters.updatedAt));
      sourceCoverRow = globalLetters[0];
    }

    if (sourceCoverRow && sourceCoverRow.bodyMarkdown.trim()) {
      templateBody = sourceCoverRow.bodyMarkdown
        .replace(/\{\{\s*company\s*\}\}/gi, companyName)
        .replace(/\{\{\s*role\s*\}\}/gi, roleTitle);
    }

    await db.insert(coverLetters).values({
      id: coverLetterId,
      resumeId: roleResumeId,
      title: `${companyName} — ${roleTitle}`,
      company: companyName,
      bodyMarkdown: templateBody,
      createdAt: now,
      updatedAt: now,
    });

    // Copy any default attachments from the chosen global cover letter
    if (sourceCoverRow) {
      const srcClAttachments = await db
        .select()
        .from(documentAttachments)
        .where(
          and(
            eq(documentAttachments.targetType, 'cover_letter'),
            eq(documentAttachments.targetId, sourceCoverRow.id)
          )
        )
        .orderBy(asc(documentAttachments.position));
      for (const att of srcClAttachments) {
        await db.insert(documentAttachments).values({
          id: crypto.randomUUID(),
          targetType: 'cover_letter',
          targetId: coverLetterId,
          letterId: att.letterId,
          position: att.position,
          createdAt: now,
        });
      }
    }

    const jobId = crypto.randomUUID();
    const appliedAt = parsed.data.stage === 'applied' ? now : null;
    await db.insert(jobPostings).values({
      id: jobId,
      companyId,
      title: roleTitle,
      stage: parsed.data.stage,
      url: parsed.data.url.trim(),
      location: parsed.data.location.trim(),
      compensation: parsed.data.compensation.trim(),
      description: parsed.data.description,
      notes: parsed.data.notes,
      appliedAt,
      resumeId: roleResumeId,
      coverLetterId,
      createdAt: now,
      updatedAt: now,
    });

    const [createdJob] = await db.select().from(jobPostings).where(eq(jobPostings.id, jobId));
    const [enrichedJob] = await enrichJobPostings([createdJob]);
    const [createdResume] = await db.select().from(resumes).where(eq(resumes.id, roleResumeId));
    const [createdCover] = await db
      .select()
      .from(coverLetters)
      .where(eq(coverLetters.id, coverLetterId));
    const [companyRow] = await db.select().from(companies).where(eq(companies.id, companyId));

    return c.json(
      {
        job: enrichedJob,
        company: toCompanyRecord(companyRow),
        resume: toResumeRecord(createdResume),
        coverLetter: toCoverLetterRecord(createdCover),
      },
      201
    );
  });

  app.put('/api/jobs/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
    if (!existing) return c.json({ error: 'Job posting not found' }, 404);

    const body = await c.req.json();
    const parsed = UpdateJobPostingInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const now = new Date().toISOString();
    const nextStage = parsed.data.stage ?? existing.stage;
    let nextAppliedAt =
      parsed.data.appliedAt !== undefined ? parsed.data.appliedAt : existing.appliedAt;
    if (nextStage === 'applied' && !nextAppliedAt) {
      nextAppliedAt = now;
    }

    await db
      .update(jobPostings)
      .set({
        companyId: parsed.data.companyId ?? existing.companyId,
        title: parsed.data.title?.trim() ?? existing.title,
        stage: nextStage,
        url: parsed.data.url !== undefined ? parsed.data.url.trim() : existing.url,
        location:
          parsed.data.location !== undefined ? parsed.data.location.trim() : existing.location,
        compensation:
          parsed.data.compensation !== undefined
            ? parsed.data.compensation.trim()
            : existing.compensation,
        description: parsed.data.description ?? existing.description,
        notes: parsed.data.notes ?? existing.notes,
        appliedAt: nextAppliedAt,
        updatedAt: now,
      })
      .where(eq(jobPostings.id, id));

    const [updated] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
    const [enriched] = await enrichJobPostings([updated]);
    return c.json(enriched);
  });

  app.delete('/api/jobs/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
    if (!existing) return c.json({ error: 'Job posting not found' }, 404);

    if (existing.coverLetterId) {
      await db
        .delete(documentAttachments)
        .where(
          and(
            eq(documentAttachments.targetType, 'cover_letter'),
            eq(documentAttachments.targetId, existing.coverLetterId)
          )
        );
    }
    await db
      .delete(documentAttachments)
      .where(
        and(
          eq(documentAttachments.targetType, 'resume'),
          eq(documentAttachments.targetId, existing.resumeId)
        )
      );

    await db.delete(jobPostings).where(eq(jobPostings.id, id));

    // Delete the role-specific resume (cascades its cover letter too), guarding Master
    const [roleResume] = await db.select().from(resumes).where(eq(resumes.id, existing.resumeId));
    if (roleResume && !roleResume.isMaster) {
      await db.delete(resumes).where(eq(resumes.id, existing.resumeId));
    }

    return c.json({ deleted: true, id });
  });

  // Pull latest Master Resume updates into a Job Posting's tailored resume
  app.post('/api/jobs/:id/sync-master', async (c) => {
    const id = c.req.param('id');
    const [job] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
    if (!job) return c.json({ error: 'Job posting not found' }, 404);

    const masterRow = await findMasterResumeRow();
    const [roleResumeRow] = await db.select().from(resumes).where(eq(resumes.id, job.resumeId));
    if (!masterRow || !roleResumeRow) {
      return c.json({ error: 'Resume records not found' }, 404);
    }

    let preserveCustomSummary = true;
    try {
      const body = await c.req.json();
      if (typeof body?.preserveCustomSummary === 'boolean') {
        preserveCustomSummary = body.preserveCustomSummary;
      }
    } catch {
      // default true
    }

    const masterData = ResumeDataSchema.parse(JSON.parse(masterRow.dataJson));
    const roleData = ResumeDataSchema.parse(JSON.parse(roleResumeRow.dataJson));
    const mergedData = pullUpdatesFromMaster(masterData, roleData, preserveCustomSummary);

    const now = new Date().toISOString();
    await db
      .update(resumes)
      .set({
        dataJson: JSON.stringify(mergedData),
        parentResumeId: masterRow.id,
        baseSyncedAt: masterRow.updatedAt,
        updatedAt: now,
      })
      .where(eq(resumes.id, roleResumeRow.id));

    const [updated] = await db.select().from(resumes).where(eq(resumes.id, roleResumeRow.id));
    return c.json(toResumeRecord(updated));
  });

  // ── Frozen Submission Snapshots per Job Posting ───────────────────────────
  app.get('/api/jobs/:id/snapshots', async (c) => {
    const id = c.req.param('id');
    const rows = await db
      .select()
      .from(resumeSnapshots)
      .where(eq(resumeSnapshots.jobPostingId, id))
      .orderBy(desc(resumeSnapshots.createdAt));
    return c.json(rows.map(toSnapshotRecord));
  });

  app.post('/api/jobs/:id/snapshots', async (c) => {
    const id = c.req.param('id');
    const [job] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
    if (!job) return c.json({ error: 'Job posting not found' }, 404);

    const body = await c.req.json();
    const parsed = CreateSnapshotInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const [roleResume] = await db.select().from(resumes).where(eq(resumes.id, job.resumeId));
    if (!roleResume) return c.json({ error: 'Role resume not found' }, 404);

    let coverMarkdown = '';
    if (job.coverLetterId) {
      const [cl] = await db
        .select()
        .from(coverLetters)
        .where(eq(coverLetters.id, job.coverLetterId));
      if (cl) coverMarkdown = cl.bodyMarkdown;
    }

    const attached = await listAttachedLetters('resume', job.resumeId);
    const snapId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(resumeSnapshots).values({
      id: snapId,
      jobPostingId: id,
      label: parsed.data.label.trim(),
      dataJson: roleResume.dataJson,
      configJson: roleResume.configJson,
      coverLetterMarkdown: coverMarkdown,
      attachedLetterIdsJson: JSON.stringify(attached.map((a) => a.id)),
      createdAt: now,
    });

    const [created] = await db
      .select()
      .from(resumeSnapshots)
      .where(eq(resumeSnapshots.id, snapId));
    return c.json(toSnapshotRecord(created), 201);
  });

  app.post('/api/jobs/:id/snapshots/:snapshotId/restore', async (c) => {
    const jobId = c.req.param('id');
    const snapshotId = c.req.param('snapshotId');

    const [job] = await db.select().from(jobPostings).where(eq(jobPostings.id, jobId));
    if (!job) return c.json({ error: 'Job posting not found' }, 404);

    const [snap] = await db
      .select()
      .from(resumeSnapshots)
      .where(and(eq(resumeSnapshots.id, snapshotId), eq(resumeSnapshots.jobPostingId, jobId)));
    if (!snap) return c.json({ error: 'Snapshot not found' }, 404);

    const now = new Date().toISOString();
    await db
      .update(resumes)
      .set({
        dataJson: snap.dataJson,
        configJson: snap.configJson,
        updatedAt: now,
      })
      .where(eq(resumes.id, job.resumeId));

    let restoredCover: CoverLetterRecord | null = null;
    if (job.coverLetterId) {
      await db
        .update(coverLetters)
        .set({
          bodyMarkdown: snap.coverLetterMarkdown,
          updatedAt: now,
        })
        .where(eq(coverLetters.id, job.coverLetterId));
      const [cl] = await db
        .select()
        .from(coverLetters)
        .where(eq(coverLetters.id, job.coverLetterId));
      if (cl) restoredCover = toCoverLetterRecord(cl);
    }

    const [restoredResume] = await db.select().from(resumes).where(eq(resumes.id, job.resumeId));
    return c.json({
      resume: toResumeRecord(restoredResume),
      coverLetter: restoredCover,
    });
  });

  app.delete('/api/jobs/:id/snapshots/:snapshotId', async (c) => {
    const jobId = c.req.param('id');
    const snapshotId = c.req.param('snapshotId');
    await db
      .delete(resumeSnapshots)
      .where(and(eq(resumeSnapshots.id, snapshotId), eq(resumeSnapshots.jobPostingId, jobId)));
    return c.json({ deleted: true, id: snapshotId });
  });

  // ── Cover Letters CRUD ────────────────────────────────────────────────────
  app.get('/api/cover-letters', async (c) => {
    const resumeId = c.req.query('resumeId');
    const rows = resumeId
      ? await db
          .select()
          .from(coverLetters)
          .where(eq(coverLetters.resumeId, resumeId))
          .orderBy(desc(coverLetters.updatedAt))
      : await db.select().from(coverLetters).orderBy(desc(coverLetters.updatedAt));
    return c.json(rows.map(toCoverLetterRecord));
  });

  app.post('/api/cover-letters', async (c) => {
    const body = await c.req.json();
    const parsed = CreateCoverLetterInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.insert(coverLetters).values({
      id,
      resumeId: parsed.data.resumeId,
      title: parsed.data.title,
      company: parsed.data.company,
      bodyMarkdown: parsed.data.bodyMarkdown,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db.select().from(coverLetters).where(eq(coverLetters.id, id));
    return c.json(toCoverLetterRecord(created), 201);
  });

  app.put('/api/cover-letters/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(coverLetters).where(eq(coverLetters.id, id));
    if (!existing) return c.json({ error: 'Cover letter not found' }, 404);

    const body = await c.req.json();
    const parsed = UpdateCoverLetterInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const now = new Date().toISOString();
    await db
      .update(coverLetters)
      .set({
        resumeId: parsed.data.resumeId ?? existing.resumeId,
        title: parsed.data.title ?? existing.title,
        company: parsed.data.company ?? existing.company,
        bodyMarkdown: parsed.data.bodyMarkdown ?? existing.bodyMarkdown,
        updatedAt: now,
      })
      .where(eq(coverLetters.id, id));

    const [updated] = await db.select().from(coverLetters).where(eq(coverLetters.id, id));
    return c.json(toCoverLetterRecord(updated));
  });

  app.delete('/api/cover-letters/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(coverLetters).where(eq(coverLetters.id, id));
    if (!existing) return c.json({ error: 'Cover letter not found' }, 404);

    await db
      .delete(documentAttachments)
      .where(
        and(
          eq(documentAttachments.targetType, 'cover_letter'),
          eq(documentAttachments.targetId, id)
        )
      );
    await db.delete(coverLetters).where(eq(coverLetters.id, id));
    return c.json({ deleted: true, id });
  });

  // ── Letters of Recommendation Library ─────────────────────────────────────
  app.get('/api/recommendations', async (c) => {
    const rows = await db
      .select()
      .from(recommendationLetters)
      .orderBy(desc(recommendationLetters.createdAt));
    return c.json(rows.map(toRecommendationRecord));
  });

  app.post('/api/recommendations', async (c) => {
    const form = await c.req.formData();
    const fileEntry = form.get('file');
    if (!(fileEntry instanceof File)) {
      return c.json({ error: 'Missing file field in multipart form data' }, 400);
    }

    const mimeType = inferMimeType(fileEntry);
    if (!(ALLOWED_RECOMMENDATION_MIMES as readonly string[]).includes(mimeType)) {
      return c.json(
        { error: `Unsupported file type "${mimeType}". Upload a PDF, PNG, or JPG.` },
        400
      );
    }

    const bytes = new Uint8Array(await fileEntry.arrayBuffer());
    if (bytes.byteLength === 0) {
      return c.json({ error: 'Uploaded file is empty' }, 400);
    }
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return c.json({ error: 'File exceeds the 15 MB upload limit' }, 400);
    }

    let pageCount = 1;
    if (mimeType === 'application/pdf') {
      try {
        const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        pageCount = Math.max(1, pdfDoc.getPageCount());
      } catch {
        return c.json({ error: 'Could not read PDF file — make sure it is a valid PDF.' }, 400);
      }
    }

    const id = crypto.randomUUID();
    const ext = EXT_BY_MIME[mimeType] ?? '.bin';
    const storedName = `${id}${ext}`;
    const fullPath = path.join(uploadsDir, storedName);
    fs.writeFileSync(fullPath, bytes);

    const rawTitle = String(form.get('title') ?? '').trim();
    const defaultTitle =
      path.basename(fileEntry.name, path.extname(fileEntry.name)).replace(/[_-]+/g, ' ').trim() ||
      'Letter of Recommendation';
    const authorName = String(form.get('authorName') ?? '').trim();
    const authorTitle = String(form.get('authorTitle') ?? '').trim();
    const now = new Date().toISOString();

    await db.insert(recommendationLetters).values({
      id,
      title: rawTitle || defaultTitle,
      authorName,
      authorTitle,
      originalFilename: fileEntry.name || storedName,
      mimeType,
      sizeBytes: bytes.byteLength,
      pageCount,
      storagePath: storedName,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(recommendationLetters)
      .where(eq(recommendationLetters.id, id));
    return c.json(toRecommendationRecord(created), 201);
  });

  app.put('/api/recommendations/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db
      .select()
      .from(recommendationLetters)
      .where(eq(recommendationLetters.id, id));
    if (!existing) return c.json({ error: 'Recommendation letter not found' }, 404);

    const body = await c.req.json();
    const parsed = UpdateRecommendationInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const now = new Date().toISOString();
    await db
      .update(recommendationLetters)
      .set({
        title: parsed.data.title ?? existing.title,
        authorName: parsed.data.authorName ?? existing.authorName,
        authorTitle: parsed.data.authorTitle ?? existing.authorTitle,
        updatedAt: now,
      })
      .where(eq(recommendationLetters.id, id));

    const [updated] = await db
      .select()
      .from(recommendationLetters)
      .where(eq(recommendationLetters.id, id));
    return c.json(toRecommendationRecord(updated));
  });

  app.get('/api/recommendations/:id/file', async (c) => {
    const id = c.req.param('id');
    const [row] = await db
      .select()
      .from(recommendationLetters)
      .where(eq(recommendationLetters.id, id));
    if (!row) return c.json({ error: 'Recommendation letter not found' }, 404);

    const fullPath = path.join(uploadsDir, path.basename(row.storagePath));
    if (!fs.existsSync(fullPath)) {
      return c.json({ error: 'Stored file missing on disk' }, 404);
    }

    const data = fs.readFileSync(fullPath);
    const safeFilename = row.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': row.mimeType,
        'Content-Length': String(data.byteLength),
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  });

  app.delete('/api/recommendations/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db
      .select()
      .from(recommendationLetters)
      .where(eq(recommendationLetters.id, id));
    if (!existing) return c.json({ error: 'Recommendation letter not found' }, 404);

    await db.delete(recommendationLetters).where(eq(recommendationLetters.id, id));
    const fullPath = path.join(uploadsDir, path.basename(existing.storagePath));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return c.json({ deleted: true, id });
  });

  // ── Document Attachments (Resume & Cover Letter) ──────────────────────────
  app.get('/api/attachments/:targetType/:targetId', async (c) => {
    const targetParsed = AttachmentTargetTypeSchema.safeParse(c.req.param('targetType'));
    if (!targetParsed.success) {
      return c.json({ error: 'Invalid targetType (must be resume or cover_letter)' }, 400);
    }
    const targetId = c.req.param('targetId');
    const attached = await listAttachedLetters(targetParsed.data, targetId);
    return c.json(attached);
  });

  app.put('/api/attachments/:targetType/:targetId', async (c) => {
    const targetParsed = AttachmentTargetTypeSchema.safeParse(c.req.param('targetType'));
    if (!targetParsed.success) {
      return c.json({ error: 'Invalid targetType (must be resume or cover_letter)' }, 400);
    }
    const targetType = targetParsed.data;
    const targetId = c.req.param('targetId');

    const body = await c.req.json();
    const parsed = SetAttachmentsInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const uniqueIds = Array.from(new Set(parsed.data.letterIds));
    const existingLetters = await db.select().from(recommendationLetters);
    const validSet = new Set(existingLetters.map((l) => l.id));
    const filteredIds = uniqueIds.filter((id) => validSet.has(id));

    await db
      .delete(documentAttachments)
      .where(
        and(
          eq(documentAttachments.targetType, targetType),
          eq(documentAttachments.targetId, targetId)
        )
      );

    const now = new Date().toISOString();
    for (let i = 0; i < filteredIds.length; i++) {
      await db.insert(documentAttachments).values({
        id: crypto.randomUUID(),
        targetType,
        targetId,
        letterId: filteredIds[i],
        position: i,
        createdAt: now,
      });
    }

    const updated = await listAttachedLetters(targetType, targetId);
    return c.json(updated);
  });

  // ── Production static client serving ──────────────────────────────────────
  const clientDist = path.resolve(__dirname, '../dist/client');
  if (fs.existsSync(clientDist)) {
    app.use('/fonts/*', async (c, next) => {
      await next();
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
    });
    app.use('/assets/*', async (c, next) => {
      await next();
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
    });
    app.use('/*', serveStatic({ root: './dist/client' }));
    app.get('*', (c) => {
      const indexHtml = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf8');
      return c.html(indexHtml);
    });
  }

  return app;
}
