// Tests for the HttpOnly cookie auth flow and CSRF defense in src/api.mjs.
// These exercise the Lambda handler directly and never touch a database or the network:
// every assertion is about a response that returns before any DB call.
//
// Run from backend/: npm test   (node --test picks up every test/*.test.mjs file)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-not-for-deployment';

const { handler, authHandler, authCookie, AUTH_COOKIE_MAX_AGE } = await import('../src/api.mjs');

const tokenFor = (role, username, name = username) =>
  jwt.sign({ sub: username, role, name }, process.env.JWT_SECRET, {
    expiresIn: '5m',
    issuer: 'cs361-curriculum-api',
    audience: 'cs361-frontend',
    algorithm: 'HS256',
  });

// Builds an HTTP API v2 style event. Auth can travel in a cookie, a Bearer header, or neither.
function httpEvent(routeKey, { cookieToken, bearerToken, csrf, pathParameters, body } = {}) {
  const headers = {};
  if (cookieToken !== undefined) headers.cookie = `token=${cookieToken}`;
  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;
  if (csrf) headers['x-cs361-csrf'] = csrf;
  return {
    routeKey,
    rawPath: `/${routeKey.split(' ')[1] ?? ''}`,
    requestContext: { http: { method: routeKey.split(' ')[0], sourceIp: '127.0.0.1' } },
    headers,
    pathParameters,
    body,
  };
}

const setCookieOf = (res) => res.headers['Set-Cookie'];

// ---------- Cookie shape used at login ----------
// tuLogin sets the cookie with authCookie(token, AUTH_COOKIE_MAX_AGE). We assert the exact
// attributes here so the login path's cookie is covered without a database connection.

test('login cookie has HttpOnly, Secure, SameSite=Lax, Path and the 15m Max-Age', () => {
  const cookie = authCookie(tokenFor('student', 'DEMO0001'), AUTH_COOKIE_MAX_AGE);
  assert.match(cookie, /^token=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=900/);
  assert.equal(AUTH_COOKIE_MAX_AGE, 15 * 60);
});

// ---------- GET /api/auth/me ----------

test('GET /api/auth/me with a valid cookie returns 200 and the user', async () => {
  const res = await handler(httpEvent('GET /api/auth/me', { cookieToken: tokenFor('staff', 'staff01', 'Staff One') }));
  assert.equal(res.statusCode, 200);
  const { user } = JSON.parse(res.body).data;
  assert.equal(user.username, 'staff01');
  assert.equal(user.role, 'staff');
  assert.equal(user.roleLabel, 'เจ้าหน้าที่');
  assert.equal(user.displayNameTh, 'Staff One');
});

test('GET /api/auth/me without any token returns 401', async () => {
  const res = await handler(httpEvent('GET /api/auth/me'));
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).data, undefined);
});

test('GET /api/auth/me with an invalid cookie token returns 401', async () => {
  const res = await handler(httpEvent('GET /api/auth/me', { cookieToken: 'not-a-jwt' }));
  assert.equal(res.statusCode, 401);
});

// ---------- POST /api/auth/logout ----------

test('logout clears the cookie with Max-Age=0 and an empty value', async () => {
  const res = await handler(httpEvent('POST /api/auth/logout', { csrf: '1' }));
  assert.equal(res.statusCode, 200);
  const cookie = setCookieOf(res);
  assert.match(cookie, /^token=;/);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
});

// ---------- CSRF defense on state-changing routes ----------

test('a state-changing request without the CSRF header gets 403', async () => {
  const res = await handler(httpEvent('POST /api/graduation/assignments', {
    cookieToken: tokenFor('staff', 'staff'),
    body: '{}',
  }));
  assert.equal(res.statusCode, 403);
  assert.match(JSON.parse(res.body).error, /CSRF/);
});

test('logout without the CSRF header gets 403', async () => {
  const res = await handler(httpEvent('POST /api/auth/logout'));
  assert.equal(res.statusCode, 403);
});

test('the CSRF check runs before auth, so a bad cookie still gets 403 without the header', async () => {
  const res = await handler(httpEvent('DELETE /api/courses/{courseCode}', {
    cookieToken: 'not-a-jwt',
    pathParameters: { courseCode: 'CS100' },
  }));
  assert.equal(res.statusCode, 403);
});

test('a GET request never needs the CSRF header', async () => {
  // Protected GET with no token still reaches the 401 path, proving GET is not CSRF-gated.
  const res = await handler(httpEvent('GET /api/graduation/me'));
  assert.equal(res.statusCode, 401);
});

// ---------- Bearer fallback during the transition ----------

test('Bearer token is still accepted as a fallback for reads', async () => {
  // instructor is forbidden from the student-only /me route; a 403 (not 401) proves the
  // Bearer token authenticated successfully even without a cookie.
  const res = await handler(httpEvent('GET /api/graduation/me', { bearerToken: tokenFor('instructor', 'inst') }));
  assert.equal(res.statusCode, 403);
});

test('a valid cookie plus the CSRF header passes both gates (reaches input validation)', async () => {
  // staff assigning a student passes CSRF and auth, then hits input validation. An invalid
  // studentYear returns 400 before any DB call, proving the request cleared CSRF and auth
  // via the cookie without needing a Bearer header or a database connection.
  const res = await handler(httpEvent('POST /api/graduation/assignments', {
    cookieToken: tokenFor('staff', 'staff'),
    csrf: '1',
    body: JSON.stringify({ studentId: 'DEMO0001', studentYear: 99 }),
  }));
  assert.equal(res.statusCode, 400);
});

// ---------- authHandler GET still serves the student profile route (unchanged behavior) ----------

test('authHandler rejects an anonymous GET (profile): only students may read it', async () => {
  // No token means not authenticated and not a student, so the profile route returns 403.
  const res = await authHandler(httpEvent('GET /api/auth'));
  assert.equal(res.statusCode, 403);
});
