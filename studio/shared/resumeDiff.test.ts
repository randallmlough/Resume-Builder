import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, ResumeDataSchema } from './schema.js';
import { computeResumeDiffs, pullUpdatesFromMaster } from './resumeDiff.js';

describe('resumeDiff & Master sync', () => {
  const master = ResumeDataSchema.parse({
    name: 'Randall Lough',
    summary: 'Master summary',
    experience: [
      { company: 'Duckbill', hide: false, positions: [{ title: 'Senior SWE', startDate: '2025', endDate: '2026', responsibilities: ['Master bullet'] }] },
      { company: 'Beam', hide: false, positions: [{ title: 'SWE', startDate: '2021', endDate: '2023', responsibilities: ['Built CLI'] }] },
    ],
    projects: [
      { name: 'Camelot', hide: false, items: ['SwiftUI'] },
      { name: 'Don\'t Forget', hide: true, items: ['PowerSync'] },
    ],
    education: [{ institution: 'UA', degree: 'BS', startDate: '2009', endDate: '2012', hide: false }],
    skills: [{ name: 'TypeScript', category: 'Programming Languages' }],
  });

  it('detects summary, visibility, bullet, and color differences against Master', () => {
    const roleData = ResumeDataSchema.parse({
      ...master,
      summary: 'Tailored Frontend summary',
      experience: [
        master.experience[0],
        { ...master.experience[1], hide: true },
      ],
      projects: [
        master.projects[0],
        { ...master.projects[1], hide: false },
      ],
    });
    const roleConfig = { ...DEFAULT_CONFIG, accent_color: '1f6f54' };

    const diffs = computeResumeDiffs(master, DEFAULT_CONFIG, roleData, roleConfig);
    expect(diffs.map((d) => d.area)).toContain('Summary');
    expect(diffs.map((d) => d.area)).toContain('Colors');
    expect(diffs.some((d) => d.detail === 'Hidden: Beam')).toBe(true);
    expect(diffs.some((d) => d.detail === 'Shown: Don\'t Forget')).toBe(true);
  });

  it('pulls updated bullets from Master while preserving role visibility overrides and summary', () => {
    const updatedMaster = ResumeDataSchema.parse({
      ...master,
      experience: [
        { ...master.experience[0], positions: [{ title: 'Senior SWE', startDate: '2025', endDate: '2026', responsibilities: ['Updated Master bullet'] }] },
        master.experience[1],
      ],
    });
    const roleData = ResumeDataSchema.parse({
      ...master,
      summary: 'Custom role summary',
      experience: [master.experience[0], { ...master.experience[1], hide: true }],
      projects: [master.projects[0], { ...master.projects[1], hide: false }],
    });

    const synced = pullUpdatesFromMaster(updatedMaster, roleData, true);
    expect(synced.summary).toBe('Custom role summary');
    expect(synced.experience[0].positions[0].responsibilities[0]).toBe('Updated Master bullet');
    expect(synced.experience[1].hide).toBe(true);
    expect(synced.projects[1].hide).toBe(false);
  });
});
