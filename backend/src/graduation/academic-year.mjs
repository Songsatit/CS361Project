// Curriculum configuration and the database use Gregorian (CE) years internally.
export function normalizeAcademicYear(value, { sourceCalendar = 'CE' } = {}) {
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  if (sourceCalendar === 'CE') return year >= 2000 && year <= 2100 ? year : null;
  if (sourceCalendar === 'BE') return year >= 2543 && year <= 2643 ? year - 543 : null;
  return null;
}
