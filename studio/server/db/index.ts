import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema.js';

export type StudioDb = ReturnType<typeof createDatabase>['db'];

function toParamValue(v: unknown): string | number | Uint8Array | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' || typeof v === 'number' || v instanceof Uint8Array) {
    return v;
  }
  return String(v);
}

function ensureColumn(sqlite: DatabaseSync, table: string, column: string, definition: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export function createDatabase(dbPath: string) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      data_json TEXT NOT NULL,
      config_json TEXT NOT NULL,
      is_master INTEGER NOT NULL DEFAULT 0,
      parent_resume_id TEXT,
      base_synced_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cover_letters (
      id TEXT PRIMARY KEY NOT NULL,
      resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      body_markdown TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      website TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_postings (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'tailoring',
      url TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      compensation TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      applied_at TEXT,
      resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      cover_letter_id TEXT REFERENCES cover_letters(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resume_snapshots (
      id TEXT PRIMARY KEY NOT NULL,
      job_posting_id TEXT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      data_json TEXT NOT NULL,
      config_json TEXT NOT NULL,
      cover_letter_markdown TEXT NOT NULL DEFAULT '',
      attached_letter_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recommendation_letters (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      author_name TEXT NOT NULL DEFAULT '',
      author_title TEXT NOT NULL DEFAULT '',
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      page_count INTEGER NOT NULL DEFAULT 1,
      storage_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      letter_id TEXT NOT NULL REFERENCES recommendation_letters(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY NOT NULL,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      linkedin TEXT NOT NULL DEFAULT '',
      github TEXT NOT NULL DEFAULT '',
      twitter TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_posting_contacts (
      id TEXT PRIMARY KEY NOT NULL,
      job_posting_id TEXT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      relationship TEXT NOT NULL DEFAULT 'hiring_manager',
      created_at TEXT NOT NULL,
      UNIQUE(job_posting_id, contact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_document_attachments_target
      ON document_attachments(target_type, target_id, position);
    CREATE INDEX IF NOT EXISTS idx_job_postings_company
      ON job_postings(company_id);
    CREATE INDEX IF NOT EXISTS idx_resume_snapshots_job
      ON resume_snapshots(job_posting_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_contacts_company
      ON contacts(company_id);
    CREATE INDEX IF NOT EXISTS idx_job_posting_contacts_job
      ON job_posting_contacts(job_posting_id);
  `);

  // Safe additive migration for pre-existing studio.db files
  ensureColumn(sqlite, 'resumes', 'is_master', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(sqlite, 'resumes', 'parent_resume_id', 'TEXT');
  ensureColumn(sqlite, 'resumes', 'base_synced_at', 'TEXT');

  // Ensure an existing DB with resumes has a designated Master Resume
  const hasMaster = sqlite
    .prepare('SELECT COUNT(*) as cnt FROM resumes WHERE is_master = 1')
    .get() as { cnt: number };
  if (hasMaster.cnt === 0) {
    const first = sqlite
      .prepare('SELECT id FROM resumes ORDER BY created_at ASC LIMIT 1')
      .get() as { id: string } | undefined;
    if (first) {
      sqlite.prepare('UPDATE resumes SET is_master = 1 WHERE id = ?').run(first.id);
    }
  }

  const db = drizzle(
    async (sqlStr, params, method) => {
      const stmt = sqlite.prepare(sqlStr);
      const bound = params.map(toParamValue);

      if (method === 'run') {
        stmt.run(...bound);
        return { rows: [] };
      }

      if (method === 'get') {
        const row = stmt.get(...bound) as Record<string, unknown> | undefined;
        return { rows: row ? (Object.values(row) as unknown[]) : (undefined as unknown as unknown[]) };
      }

      const rows = stmt.all(...bound) as Record<string, unknown>[];
      return { rows: rows.map((r) => Object.values(r)) };
    },
    { schema }
  );

  return { db, sqlite };
}
