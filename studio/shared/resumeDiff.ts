import type { ResumeConfig, ResumeData } from './schema.js';

export interface ResumeDiffItem {
  area: string;
  detail: string;
}

/**
 * Computes human-readable differences between a role-tailored resume and the Master resume.
 */
export function computeResumeDiffs(
  masterData: ResumeData,
  masterConfig: ResumeConfig,
  roleData: ResumeData,
  roleConfig: ResumeConfig
): ResumeDiffItem[] {
  const diffs: ResumeDiffItem[] = [];

  if (roleData.summary.trim() !== masterData.summary.trim()) {
    diffs.push({ area: 'Summary', detail: 'Customized overview paragraph for this role' });
  }

  if (
    roleConfig.accent_color.toLowerCase() !== masterConfig.accent_color.toLowerCase() ||
    roleConfig.muted_color.toLowerCase() !== masterConfig.muted_color.toLowerCase()
  ) {
    diffs.push({
      area: 'Colors',
      detail: `Accent #${roleConfig.accent_color} (Master: #${masterConfig.accent_color})`,
    });
  }

  // Experience visibility & content changes
  const masterJobs = new Map(masterData.experience.map((j) => [j.company, j]));
  for (const job of roleData.experience) {
    const base = masterJobs.get(job.company);
    if (!base) {
      diffs.push({ area: 'Experience', detail: `Added ${job.company}` });
      continue;
    }
    if (Boolean(job.hide) !== Boolean(base.hide)) {
      diffs.push({
        area: 'Experience',
        detail: `${job.hide ? 'Hidden' : 'Shown'}: ${job.company}`,
      });
    } else if (JSON.stringify(job.positions) !== JSON.stringify(base.positions)) {
      diffs.push({ area: 'Experience', detail: `Edited bullets/roles at ${job.company}` });
    }
  }

  // Project visibility & content changes
  const masterProjects = new Map(masterData.projects.map((p) => [p.name, p]));
  for (const proj of roleData.projects) {
    const base = masterProjects.get(proj.name);
    if (!base) {
      diffs.push({ area: 'Projects', detail: `Added project ${proj.name}` });
      continue;
    }
    if (Boolean(proj.hide) !== Boolean(base.hide)) {
      diffs.push({
        area: 'Projects',
        detail: `${proj.hide ? 'Hidden' : 'Shown'}: ${proj.name}`,
      });
    } else if (JSON.stringify(proj.items) !== JSON.stringify(base.items)) {
      diffs.push({ area: 'Projects', detail: `Edited highlights for ${proj.name}` });
    }
  }

  // Education visibility changes
  const masterEdu = new Map(masterData.education.map((e) => [e.institution, e]));
  for (const edu of roleData.education) {
    const base = masterEdu.get(edu.institution);
    if (base && Boolean(edu.hide) !== Boolean(base.hide)) {
      diffs.push({
        area: 'Education',
        detail: `${edu.hide ? 'Hidden' : 'Shown'}: ${edu.institution}`,
      });
    }
  }

  // Skills diff
  if (JSON.stringify(roleData.skills) !== JSON.stringify(masterData.skills)) {
    diffs.push({
      area: 'Skills',
      detail: `${roleData.skills.length} skills (Master: ${masterData.skills.length})`,
    });
  }

  return diffs;
}

/**
 * Pulls latest content from Master Resume into a role's tailored resume while preserving
 * the role's custom summary (if customized) and per-company/project/education hide overrides.
 */
export function pullUpdatesFromMaster(
  masterData: ResumeData,
  roleData: ResumeData,
  preserveCustomSummary = true
): ResumeData {
  const jobHideByCompany = new Map(roleData.experience.map((j) => [j.company, Boolean(j.hide)]));
  const projectHideByName = new Map(roleData.projects.map((p) => [p.name, Boolean(p.hide)]));
  const eduHideByInst = new Map(roleData.education.map((e) => [e.institution, Boolean(e.hide)]));

  const summary =
    preserveCustomSummary && roleData.summary.trim() !== ''
      ? roleData.summary
      : masterData.summary;

  return {
    ...masterData,
    summary,
    experience: masterData.experience.map((job) => ({
      ...job,
      hide: jobHideByCompany.has(job.company) ? jobHideByCompany.get(job.company)! : job.hide,
    })),
    projects: masterData.projects.map((proj) => ({
      ...proj,
      hide: projectHideByName.has(proj.name) ? projectHideByName.get(proj.name)! : proj.hide,
    })),
    education: masterData.education.map((edu) => ({
      ...edu,
      hide: eduHideByInst.has(edu.institution) ? eduHideByInst.get(edu.institution)! : edu.hide,
    })),
  };
}
