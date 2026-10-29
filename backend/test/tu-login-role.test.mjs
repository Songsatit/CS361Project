// Tests for roleFromTuType in src/api.mjs: the mapping from a TU account type to an
// internal role. A non-student (or missing) type must NOT be granted 'staff'; it defaults
// to the least-privileged 'public' role. These are pure, synchronous assertions with no
// database or network access.
//
// Run from backend/: npm test   (node --test picks up every test/*.test.mjs file)
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-not-for-deployment';

const { roleFromTuType } = await import('../src/api.mjs');

test("TU type 'student' maps to the student role", () => {
  assert.equal(roleFromTuType('student'), 'student');
});

test("TU type 'staff' does NOT get the staff role; it falls back to public", () => {
  assert.equal(roleFromTuType('staff'), 'public');
});

test("TU type 'instructor' falls back to public, not staff", () => {
  assert.equal(roleFromTuType('instructor'), 'public');
});

test('a missing/undefined TU type falls back to public', () => {
  assert.equal(roleFromTuType(undefined), 'public');
});
