import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { count } from 'drizzle-orm';
import {
  DEFAULT_CONFIG,
  ResumeConfigSchema,
  ResumeDataSchema,
  type ResumeConfig,
  type ResumeData,
} from '../shared/schema.js';
import type { StudioDb } from './db/index.js';
import { coverLetters, resumes } from './db/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

function readDotEnvOverrides(): Record<string, string> {
  const envPath = path.join(REPO_ROOT, '.env');
  const overrides: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return overrides;
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (val) overrides[key] = val;
    }
  } catch {
    // ignore unreadable .env
  }
  return overrides;
}

export function loadRepoResumeAndConfig(): { data: ResumeData; config: ResumeConfig } {
  const resumePath = path.join(REPO_ROOT, 'resume.json');
  const configPath = path.join(REPO_ROOT, 'config.yml');

  let rawResume: unknown = {
    name: 'Your Name',
    contact: {
      email: 'you@example.com',
      phone: '555-123-4567',
      linkedin: 'linkedin.com/in/yourprofile',
      github: 'github.com/yourusername',
    },
    summary: 'Full-stack engineer building fast, reliable software.',
    experience: [],
    projects: [],
    education: [],
    skills: [],
  };

  if (fs.existsSync(resumePath)) {
    rawResume = JSON.parse(fs.readFileSync(resumePath, 'utf8'));
  }

  const parsedResume = ResumeDataSchema.parse(rawResume);

  // Mirror Go's PHONE_NUMBER / EMAIL overrides if present in env or .env
  const dotEnv = readDotEnvOverrides();
  const phone = process.env.PHONE_NUMBER || dotEnv.PHONE_NUMBER;
  const email = process.env.EMAIL || dotEnv.EMAIL;
  if (phone && (!parsedResume.contact.phone || parsedResume.contact.phone === 'REDACTED')) {
    parsedResume.contact.phone = phone;
  }
  if (email && (!parsedResume.contact.email || parsedResume.contact.email === 'REDACTED')) {
    parsedResume.contact.email = email;
  }

  let parsedConfig = DEFAULT_CONFIG;
  if (fs.existsSync(configPath)) {
    const rawCfg = YAML.parse(fs.readFileSync(configPath, 'utf8')) ?? {};
    // YAML unquoted numeric-looking hex strings may parse cleanly or need String()
    if (rawCfg.accent_color !== undefined) rawCfg.accent_color = String(rawCfg.accent_color);
    if (rawCfg.muted_color !== undefined) rawCfg.muted_color = String(rawCfg.muted_color);
    parsedConfig = ResumeConfigSchema.parse(rawCfg);
  }

  return { data: parsedResume, config: parsedConfig };
}

const SAMPLE_COVER_LETTER = `Dear Hiring Team,

I am excited to apply for the Senior Full-Stack Engineer role. Over the past 8+ years, I have built web and mobile products end to end across **TypeScript**, **React**, **Go**, and **Python**, with a recent focus on AI-native interfaces and the verification loops that keep agent-written code production-ready.

### Highlights

- **AI-Native Product Engineering**: Took conversational AI agent UIs from prototype to production with interactive, task-specific widgets and strongly typed tool schemas.
- **Reliability & Velocity**: Built end-to-end verification gates combining lint rules, Storybook coverage, and Playwright suites so teams can ship daily with confidence.
- **Full-Stack Ownership**: Delivered high-leverage rewrites and customer-facing storefronts spanning design systems, GraphQL/REST APIs, and cloud infrastructure.

I would love to discuss how my background can help your team ship faster without compromising quality.

Best regards,

Randall Lough`;

export async function seedIfEmpty(db: StudioDb) {
  const [{ value }] = await db.select({ value: count() }).from(resumes);
  if (value > 0) return;

  const { data, config } = loadRepoResumeAndConfig();
  const now = new Date().toISOString();
  const resumeId = crypto.randomUUID();

  await db.insert(resumes).values({
    id: resumeId,
    title: 'Master Resume (Imported from repo)',
    dataJson: JSON.stringify(data),
    configJson: JSON.stringify(config),
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(coverLetters).values({
    id: crypto.randomUUID(),
    resumeId,
    title: 'General Cover Letter',
    company: 'Sample Company',
    bodyMarkdown: SAMPLE_COVER_LETTER,
    createdAt: now,
    updatedAt: now,
  });
}
