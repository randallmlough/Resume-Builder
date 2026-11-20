import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createDatabase } from './db/index.js';
import { seedIfEmpty } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH ?? path.resolve(__dirname, '../data/studio.db');
const PORT = Number(process.env.PORT ?? 8787);

async function main() {
  const { db } = createDatabase(DB_PATH);
  await seedIfEmpty(db);

  const app = createApp(db);

  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`[studio-api] listening on http://localhost:${info.port}`);
    console.log(`[studio-api] sqlite db: ${DB_PATH}`);
  });
}

main().catch((err) => {
  console.error('[studio-api] failed to start:', err);
  process.exit(1);
});
