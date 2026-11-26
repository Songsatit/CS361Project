import { CS_GRADE_POLICY } from './cs.mjs';
import { CNC_GRADE_POLICY } from './cnc.mjs';

export const GRADE_POLICY_BY_CURRICULUM = Object.freeze({
  [CS_GRADE_POLICY.curriculumId]: CS_GRADE_POLICY,
  [CNC_GRADE_POLICY.curriculumId]: CNC_GRADE_POLICY,
});

export function gradePolicyFor(curriculumId) {
  return GRADE_POLICY_BY_CURRICULUM[curriculumId] ?? null;
}
