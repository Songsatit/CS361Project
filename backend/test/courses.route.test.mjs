// Tests for route normalization of the public course routes in src/api.mjs.
//
// API Gateway HTTP API sets event.routeKey to a TEMPLATE such as
// "GET /api/courses/{courseId}". A request to "/api/courses/" (trailing slash) matches
// that template with an empty parameter, which used to reach getCourse and answer 400
// "courseId is required". normalizeRoute must send it to the list route instead.
//
// normalizeRoute is a pure function, so these tests never touch a database or the network.
// Run from backend/: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-not-for-deployment';

const { normalizeRoute } = await import('../src/api.mjs');

// Builds an HTTP API v2 style event the way API Gateway sends it.
const event = (routeKey, { rawPath, pathParameters } = {}) => ({
  version: '2.0',
  routeKey,
  rawPath,
  pathParameters,
  headers: {},
  requestContext: { http: { method: routeKey.split(' ')[0] } },
});

test('/api/courses/ (empty {courseId}) is treated as the list route', () => {
  assert.equal(
    normalizeRoute(event('GET /api/courses/{courseId}', { rawPath: '/api/courses/', pathParameters: { courseId: '' } })),
    'GET /api/courses',
  );
});

test('/api/courses/ with no pathParameters at all is treated as the list route', () => {
  assert.equal(
    normalizeRoute(event('GET /api/courses/{courseId}', { rawPath: '/api/courses/' })),
    'GET /api/courses',
  );
});

test('the {courseCode} template with an empty value is also the list route', () => {
  assert.equal(
    normalizeRoute(event('GET /api/courses/{courseCode}', { rawPath: '/api/courses/', pathParameters: { courseCode: '' } })),
    'GET /api/courses',
  );
});

test('/api/courses (no trailing slash) stays the list route', () => {
  assert.equal(normalizeRoute(event('GET /api/courses', { rawPath: '/api/courses' })), 'GET /api/courses');
});

test('/api/courses/BSC-CNC-2568 keeps its detail route', () => {
  assert.equal(
    normalizeRoute(event('GET /api/courses/{courseId}', { rawPath: '/api/courses/BSC-CNC-2568', pathParameters: { courseId: 'BSC-CNC-2568' } })),
    'GET /api/courses/{courseId}',
  );
});

test('the prerequisites route is unchanged', () => {
  assert.equal(
    normalizeRoute(event('GET /api/courses/{courseId}/prerequisites', { rawPath: '/api/courses/CS100/prerequisites', pathParameters: { courseId: 'CS100' } })),
    'GET /api/courses/{courseId}/prerequisites',
  );
});

test('DELETE /api/courses/{courseCode} is never rewritten to the list route', () => {
  assert.equal(
    normalizeRoute(event('DELETE /api/courses/{courseCode}', { rawPath: '/api/courses/CS100', pathParameters: { courseCode: 'CS100' } })),
    'DELETE /api/courses/{courseCode}',
  );
});

test('without a routeKey the trailing slash is dropped from the path', () => {
  assert.equal(
    normalizeRoute({ rawPath: '/api/courses/', requestContext: { http: { method: 'GET' } } }),
    'GET /api/courses',
  );
});

test('without a routeKey the root path "/" is not emptied', () => {
  assert.equal(
    normalizeRoute({ rawPath: '/', requestContext: { http: { method: 'GET' } } }),
    'GET /',
  );
});
