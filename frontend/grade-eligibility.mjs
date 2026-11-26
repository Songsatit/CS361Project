// Shared by the Lambda validation path and the browser form.
// ACC eligibility is intentionally independent of curriculum category.
export const ACC_CONFIG = Object.freeze({
  allowedCoursePrefixes: Object.freeze(['TU']),
  // TODO: registrar must confirm the final ACC scope; change this config, not the predicate.
});

const THAI_PREFIX_ALIASES = Object.freeze({
  'มธ.': 'TU',
  'คคป.': 'CNC',
  'คพ.': 'CS',
  'สษ.': 'EL',
});

export function normalizeCourseCode(value) {
  let code = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  for (const [prefix, canonical] of Object.entries(THAI_PREFIX_ALIASES)) {
    if (code.startsWith(prefix)) return `${canonical}${code.slice(prefix.length)}`;
  }
  return code;
}

export function isAccEligible(courseCode, { config = ACC_CONFIG } = {}) {
  const normalized = normalizeCourseCode(courseCode);
  return config.allowedCoursePrefixes.some(prefix => normalized.startsWith(String(prefix).toUpperCase()));
}

if (typeof window !== 'undefined') {
  window.normalizeCourseCode = normalizeCourseCode;
  window.isAccEligible = isAccEligible;
}
