import { CS_CATEGORY_CONFIG } from './cs.mjs';
import { CNC_CATEGORY_CONFIG } from './cnc.mjs';

export const CATEGORY_CONFIG_BY_CURRICULUM = Object.freeze({
  [CS_CATEGORY_CONFIG.curriculumId]: CS_CATEGORY_CONFIG,
  [CNC_CATEGORY_CONFIG.curriculumId]: CNC_CATEGORY_CONFIG,
});

export function categoryConfigFor(curriculumId) {
  return CATEGORY_CONFIG_BY_CURRICULUM[curriculumId] ?? null;
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
