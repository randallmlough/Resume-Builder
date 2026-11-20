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
  CreateCoverLetterInputSchema,
  CreateResumeInputSchema,
  DEFAULT_CONFIG,
  ResumeConfigSchema,
  ResumeDataSchema,
  SetAttachmentsInputSchema,
  UpdateCoverLetterInputSchema,
  UpdateRecommendationInputSchema,
  UpdateResumeInputSchema,
  type AttachmentTargetType,
  type CoverLetterRecord,
  type RecommendationLetterRecord,
  type ResumeRecord,
} from '../shared/schema.js';
import type { StudioDb } from './db/index.js';
import {
  coverLetters,
  documentAttachments,
  recommendationLetters,
  resumes,
  type CoverLetterRow,
  type RecommendationLetterRow,
  type ResumeRow,
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

export interface CreateAppOptions {
  uploadsDir?: string;
}

export function createApp(db: StudioDb, options: CreateAppOptions = {}) {
  const uploadsDir =
    options.uploadsDir ?? path.resolve(__dirname, '../data/uploads');
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

  // ── Resumes CRUD ──────────────────────────────────────────────────────────
  app.get('/api/resumes', async (c) => {
    const rows = await db.select().from(resumes).orderBy(desc(resumes.updatedAt));
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
      createdAt: now,
      updatedAt: now,
    });

    // Copy any attached recommendation letters to the cloned resume
    const existingLinks = await db
      .select()
      .from(documentAttachments)
      .where(
        and(
          eq(documentAttachments.targetType, 'resume'),
          eq(documentAttachments.targetId, id)
        )
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

    // Clean up attachment rows for this resume and any cascaded cover letters
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
        and(
          eq(documentAttachments.targetType, 'resume'),
          eq(documentAttachments.targetId, id)
        )
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
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db.select().from(resumes).where(eq(resumes.id, id));
    return c.json(toResumeRecord(created), 201);
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

    // Deduplicate while preserving user's chosen order
    const uniqueIds = Array.from(new Set(parsed.data.letterIds));

    // Verify each letter exists
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
