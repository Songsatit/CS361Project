import { CS_CATEGORY_CONFIG } from './cs.mjs';
import { CNC_CATEGORY_CONFIG } from './cnc.mjs';

export const CATEGORY_CONFIG_BY_CURRICULUM = Object.freeze({
  [CS_CATEGORY_CONFIG.curriculumId]: CS_CATEGORY_CONFIG,
  [CNC_CATEGORY_CONFIG.curriculumId]: CNC_CATEGORY_CONFIG,
});

export function categoryConfigFor(curriculumId) {
  return CATEGORY_CONFIG_BY_CURRICULUM[curriculumId]
    ?? Object.values(CATEGORY_CONFIG_BY_CURRICULUM).find(item => String(curriculumId ?? '').startsWith(item.curriculumId))
    ?? null;
}

const CATEGORY_BY_CODE = new Map(
  Object.values(CATEGORY_CONFIG_BY_CURRICULUM)
    .flatMap(config => config.categories.map(category => [`${config.curriculumId}:${category.code}`, category])),
);

const normalize = value => String(value ?? '').trim();

// Only exact, authoritative labels are mapped. Ambiguous generic labels stay uncategorized.
const LABEL_ALIASES = Object.freeze({
  general_education: new Set(['วิชาศึกษาทั่วไป']),
  free_elective: new Set(['วิชาเลือกเสรี']),
  major_core: new Set(['วิชาเฉพาะ–วิชาแกน', 'วิชาเฉพาะ - วิชาแกน']),
  major_specific: new Set(['วิชาเฉพาะ–วิชาเฉพาะด้าน', 'วิชาเฉพาะ - วิชาเฉพาะด้าน']),
  major: new Set(['วิชาเอก']),
  outside_major_required: new Set(['วิชาบังคับนอกสาขา']),
  mathematics_foundation: new Set(['วิชาเฉพาะ–พื้นฐานด้านคณิตศาสตร์', 'วิชาเฉพาะ - พื้นฐานด้านคณิตศาสตร์']),
  major_required: new Set(['วิชาเฉพาะ–วิชาบังคับ', 'วิชาเฉพาะ - วิชาบังคับ']),
  project_or_coop: new Set(['วิชาโครงงาน/สหกิจศึกษา', 'วิชาโครงงาน', 'วิชาสหกิจศึกษา']),
});

export function categoryForCode(curriculumId, code) {
  return CATEGORY_BY_CODE.get(`${curriculumId}:${code}`) ?? null;
}

function groupHasCode(group, code) {
  const normalized = normalize(code).replace(/\s+/g, '').toUpperCase();
  if ((group.courses ?? []).some(item => normalize(item).replace(/\s+/g, '').toUpperCase() === normalized)) return true;
  if (Object.values(group.coursesByMajor ?? {}).some(items => items.some(item => normalize(item).replace(/\s+/g, '').toUpperCase() === normalized))) return true;
  const range = group.courseCodeRange;
  const match = range && normalized.match(new RegExp(`^${normalize(range.prefix)}(\\d+)$`, 'i'));
  return Boolean(match && Number(match[1]) >= Number(range.minNumber) && Number(match[1]) <= Number(range.maxNumber));
}

export function categoryForCourseCode(curriculumId, code) {
  const config = CATEGORY_CONFIG_BY_CURRICULUM[curriculumId]
    ?? Object.values(CATEGORY_CONFIG_BY_CURRICULUM).find(item => String(curriculumId).startsWith(item.curriculumId));
  for (const category of config?.categories ?? []) {
    const groups = [...(category.groups ?? []), ...Object.values(category.groupsByMajor ?? {}).flat()];
    const visit = group => groupHasCode(group, code) || (group.subgroups ?? []).some(visit) || (group.groups ?? []).some(visit);
    if (groups.some(visit)) return { code: category.code, label: category.label };
  }
  return null;
}

export function classifyCurriculumCourse({ curriculumId, courseGroup, classificationCode } = {}) {
  const config = CATEGORY_CONFIG_BY_CURRICULUM[curriculumId];
  if (!config) return { code: 'uncategorized', label: 'ไม่ทราบหมวด' };
  const candidates = [normalize(courseGroup), normalize(classificationCode)];
  const category = config.categories.find(item => candidates.some(value => value && LABEL_ALIASES[item.code]?.has(value)));
  return category ?? { code: 'uncategorized', label: 'ไม่ทราบหมวด' };
}

export function categoryConfigTotals() {
  return Object.fromEntries(Object.values(CATEGORY_CONFIG_BY_CURRICULUM).map(config => [config.curriculumId, {
    totalCredits: config.totalCredits,
    categoryCredits: config.categories.reduce((sum, item) => sum + item.minimumCredits, 0),
  }]));
}
