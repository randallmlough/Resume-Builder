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

    CREATE INDEX IF NOT EXISTS idx_document_attachments_target
      ON document_attachments(target_type, target_id, position);
  `);

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

      // 'all' or 'values'
      const rows = stmt.all(...bound) as Record<string, unknown>[];
      return { rows: rows.map((r) => Object.values(r)) };
    },
    { schema }
  );

  return { db, sqlite };
}
