import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { createDatabase } from './db/index.js';
import { createApp } from './app.js';
import { seedIfEmpty } from './seed.js';

async function makeSamplePdf(pageCount: number, label: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`${label} — Page ${i + 1}`, { x: 72, y: 700, size: 18, font });
  }
  return doc.save();
}

describe('Resume Studio API (Hono + Drizzle + SQLite)', () => {
  it('seeds from parent repo resume.json & config.yml and supports full CRUD + clone', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-test-'));
    const { db, sqlite } = createDatabase(':memory:');
    await seedIfEmpty(db);
    const app = createApp(db, { uploadsDir: tmpDir });

    try {
      // Health check
      const healthRes = await app.request('/api/health');
      expect(healthRes.status).toBe(200);

      // Seeded resume list
      const listRes = await app.request('/api/resumes');
      expect(listRes.status).toBe(200);
      const list = await listRes.json();
      expect(list.length).toBe(1);
      expect(list[0].data.name).toBe('Randall Lough');
      expect(list[0].config.accent_color).toBe('1f79c7');
      expect(list[0].data.experience.length).toBeGreaterThan(0);

      // Clone resume
      const cloneRes = await app.request(`/api/resumes/${list[0].id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Staff Engineer — Acme' }),
      });
      expect(cloneRes.status).toBe(201);
      const cloned = await cloneRes.json();
      expect(cloned.title).toBe('Staff Engineer — Acme');
      expect(cloned.id).not.toBe(list[0].id);

      // Update cloned resume
      const updateRes = await app.request(`/api/resumes/${cloned.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Staff Engineer — Updated',
          config: { ...cloned.config, accent_color: '1d3557' },
        }),
      });
      expect(updateRes.status).toBe(200);
      const updated = await updateRes.json();
      expect(updated.title).toBe('Staff Engineer — Updated');
      expect(updated.config.accent_color).toBe('1d3557');

      // Cover letters CRUD
      const clListRes = await app.request('/api/cover-letters');
      expect(clListRes.status).toBe(200);
      const clList = await clListRes.json();
      expect(clList.length).toBe(1);

      const clCreateRes = await app.request('/api/cover-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: cloned.id,
          title: 'Acme Cover Letter',
          company: 'Acme Corp',
          bodyMarkdown: 'Hello **Acme**!',
        }),
      });
      expect(clCreateRes.status).toBe(201);
      const createdCl = await clCreateRes.json();
      expect(createdCl.company).toBe('Acme Corp');

      // Delete cloned resume cascades its cover letter
      const delRes = await app.request(`/api/resumes/${cloned.id}`, { method: 'DELETE' });
      expect(delRes.status).toBe(200);

      const clAfterRes = await app.request(`/api/cover-letters?resumeId=${cloned.id}`);
      expect(await clAfterRes.json()).toEqual([]);
    } finally {
      sqlite.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('uploads PDF & image recommendation letters, attaches/reorders on resume & cover letter, clones attachments, and cleans up files', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-rec-test-'));
    const { db, sqlite } = createDatabase(':memory:');
    await seedIfEmpty(db);
    const app = createApp(db, { uploadsDir: tmpDir });

    try {
      const [resume] = await (await app.request('/api/resumes')).json();
      const [coverLetter] = await (await app.request('/api/cover-letters')).json();

      // Upload a 2-page PDF recommendation letter
      const pdfBytes = await makeSamplePdf(2, 'Jane Doe Recommendation');
      const form1 = new FormData();
      form1.append(
        'file',
        new File([new Uint8Array(pdfBytes)], 'jane-doe-rec.pdf', { type: 'application/pdf' })
      );
      form1.append('authorName', 'Jane Doe');
      form1.append('authorTitle', 'VP of Engineering');

      const up1 = await app.request('/api/recommendations', { method: 'POST', body: form1 });
      expect(up1.status).toBe(201);
      const rec1 = await up1.json();
      expect(rec1.pageCount).toBe(2);
      expect(rec1.authorName).toBe('Jane Doe');
      expect(rec1.mimeType).toBe('application/pdf');

      // Stream back file bytes
      const fileRes = await app.request(rec1.fileUrl);
      expect(fileRes.status).toBe(200);
      expect(fileRes.headers.get('content-type')).toBe('application/pdf');
      expect((await fileRes.arrayBuffer()).byteLength).toBe(pdfBytes.byteLength);

      // Upload a 1x1 PNG image letter
      const pngBytes = Uint8Array.from(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64'
        )
      );
      const form2 = new FormData();
      form2.append('file', new File([pngBytes], 'cto-note.png', { type: 'image/png' }));
      form2.append('title', 'CTO Endorsement');

      const up2 = await app.request('/api/recommendations', { method: 'POST', body: form2 });
      expect(up2.status).toBe(201);
      const rec2 = await up2.json();
      expect(rec2.pageCount).toBe(1);
      expect(rec2.title).toBe('CTO Endorsement');

      // Attach both to resume in order [rec2, rec1]
      const setRes = await app.request(`/api/attachments/resume/${resume.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letterIds: [rec2.id, rec1.id] }),
      });
      expect(setRes.status).toBe(200);
      const attached = await setRes.json();
      expect(attached.map((l: { id: string }) => l.id)).toEqual([rec2.id, rec1.id]);

      // Attach rec1 to cover letter
      const setClRes = await app.request(`/api/attachments/cover_letter/${coverLetter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ letterIds: [rec1.id] }),
      });
      expect(setClRes.status).toBe(200);
      expect((await setClRes.json()).map((l: { id: string }) => l.id)).toEqual([rec1.id]);

      // Clone resume inherits its attached recommendation letters
      const cloneRes = await app.request(`/api/resumes/${resume.id}/clone`, { method: 'POST' });
      expect(cloneRes.status).toBe(201);
      const cloned = await cloneRes.json();
      const clonedAttachments = await (
        await app.request(`/api/attachments/resume/${cloned.id}`)
      ).json();
      expect(clonedAttachments.map((l: { id: string }) => l.id)).toEqual([rec2.id, rec1.id]);

      // Deleting rec1 removes file on disk and cascades from both resume & cover letter
      const delRec = await app.request(`/api/recommendations/${rec1.id}`, { method: 'DELETE' });
      expect(delRec.status).toBe(200);
      expect(fs.existsSync(path.join(tmpDir, `${rec1.id}.pdf`))).toBe(false);

      const resumeAttAfter = await (
        await app.request(`/api/attachments/resume/${resume.id}`)
      ).json();
      expect(resumeAttAfter.map((l: { id: string }) => l.id)).toEqual([rec2.id]);

      const clAttAfter = await (
        await app.request(`/api/attachments/cover_letter/${coverLetter.id}`)
      ).json();
      expect(clAttAfter).toEqual([]);
    } finally {
      sqlite.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('supports multiple job postings per company, per-role resumes/links, Master sync, and frozen snapshots', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-jobs-test-'));
    const { db, sqlite } = createDatabase(':memory:');
    await seedIfEmpty(db);
    const app = createApp(db, { uploadsDir: tmpDir });

    try {
      const [master] = await (await app.request('/api/resumes')).json();
      expect(master.isMaster).toBe(true);

      // Create a global cover letter template with {{company}} and {{role}} placeholders
      const globalClRes = await app.request('/api/cover-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: master.id,
          title: 'Frontend Template',
          company: '',
          bodyMarkdown: 'Hello {{company}}! Excited for {{role}}.',
        }),
      });
      const globalCl = await globalClRes.json();

      // Create first role at Stripe (auto-creates Stripe company and interpolates template)
      const createFe = await app.request('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Stripe',
          title: 'Senior Frontend Engineer',
          stage: 'tailoring',
          url: 'https://stripe.com/jobs/frontend',
          location: 'Remote',
          compensation: '$230k',
          description: 'Build Stripe Checkout UI',
          sourceCoverLetterId: globalCl.id,
        }),
      });
      expect(createFe.status).toBe(201);
      const feBundle = await createFe.json();
      expect(feBundle.company.name).toBe('Stripe');
      expect(feBundle.job.url).toBe('https://stripe.com/jobs/frontend');
      expect(feBundle.resume.parentResumeId).toBe(master.id);
      expect(feBundle.resume.isMaster).toBe(false);
      expect(feBundle.coverLetter.company).toBe('Stripe');
      expect(feBundle.coverLetter.bodyMarkdown).toBe(
        'Hello Stripe! Excited for Senior Frontend Engineer.'
      );

      // Create second role at the SAME company (Stripe)
      const createFs = await app.request('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: feBundle.company.id,
          title: 'Staff Full-Stack Engineer',
          stage: 'saved',
          url: 'https://stripe.com/jobs/fullstack',
        }),
      });
      expect(createFs.status).toBe(201);
      const fsBundle = await createFs.json();
      expect(fsBundle.job.companyId).toBe(feBundle.company.id);
      expect(fsBundle.resume.id).not.toBe(feBundle.resume.id);

      // Verify 1 company with 2 distinct postings
      const companiesList = await (await app.request('/api/companies')).json();
      expect(companiesList.length).toBe(1);
      const jobsList = await (await app.request('/api/jobs')).json();
      expect(jobsList.length).toBe(2);

      // Move Frontend role to 'applied' -> auto-populates appliedAt
      const moveRes = await app.request(`/api/jobs/${feBundle.job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'applied' }),
      });
      expect(moveRes.status).toBe(200);
      const movedJob = await moveRes.json();
      expect(movedJob.stage).toBe('applied');
      expect(movedJob.appliedAt).toBeTruthy();

      // Tailor Frontend role's summary + hide Beam, then freeze a snapshot
      const tailoredData = {
        ...feBundle.resume.data,
        summary: 'Frontend specialist focused on Stripe Checkout.',
        experience: feBundle.resume.data.experience.map((j: { company: string; hide?: boolean }) =>
          j.company === 'Beam' ? { ...j, hide: true } : j
        ),
      };
      await app.request(`/api/resumes/${feBundle.resume.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: tailoredData }),
      });

      const snapRes = await app.request(`/api/jobs/${feBundle.job.id}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'v1 · Submitted to Stripe' }),
      });
      expect(snapRes.status).toBe(201);
      const snap = await snapRes.json();
      expect(snap.label).toBe('v1 · Submitted to Stripe');

      // Update Master Resume's Duckbill bullet, then sync into Frontend role
      const updatedMasterData = {
        ...master.data,
        experience: master.data.experience.map((j: { company: string; positions: { responsibilities: string[] }[] }) =>
          j.company === 'Duckbill'
            ? {
                ...j,
                positions: j.positions.map((p, idx) =>
                  idx === 0 ? { ...p, responsibilities: ['Updated from Master!'] } : p
                ),
              }
            : j
        ),
      };
      await app.request(`/api/resumes/${master.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedMasterData }),
      });

      const syncRes = await app.request(`/api/jobs/${feBundle.job.id}/sync-master`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preserveCustomSummary: true }),
      });
      expect(syncRes.status).toBe(200);
      const syncedResume = await syncRes.json();
      // Preserved custom summary & hidden Beam while pulling updated Duckbill bullet
      expect(syncedResume.data.summary).toBe('Frontend specialist focused on Stripe Checkout.');
      expect(
        syncedResume.data.experience.find((j: { company: string }) => j.company === 'Beam').hide
      ).toBe(true);
      expect(
        syncedResume.data.experience.find((j: { company: string }) => j.company === 'Duckbill')
          .positions[0].responsibilities[0]
      ).toBe('Updated from Master!');

      // Restore v1 snapshot brings back pre-sync bullet
      const restoreRes = await app.request(
        `/api/jobs/${feBundle.job.id}/snapshots/${snap.id}/restore`,
        { method: 'POST' }
      );
      expect(restoreRes.status).toBe(200);
      const restored = await restoreRes.json();
      expect(
        restored.resume.data.experience.find((j: { company: string }) => j.company === 'Duckbill')
          .positions[0].responsibilities[0]
      ).not.toBe('Updated from Master!');

      // Deleting Stripe cleans up both postings and their role resumes, leaving Master intact
      const delComp = await app.request(`/api/companies/${feBundle.company.id}`, {
        method: 'DELETE',
      });
      expect(delComp.status).toBe(200);
      expect(await (await app.request('/api/jobs')).json()).toEqual([]);
      const remainingResumes = await (await app.request('/api/resumes')).json();
      expect(remainingResumes.length).toBe(1);
      expect(remainingResumes[0].id).toBe(master.id);
    } finally {
      sqlite.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
