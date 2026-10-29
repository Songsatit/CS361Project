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

// ---------- Token verify failures still return 401 (no auth is relaxed) ----------
// The catch in actorFromRequest now logs error.name/message via console.warn. These tests
// assert two things at once: the response stays 401 for every bad token, and the warning
// is emitted without ever containing the token string or the JWT secret.

// Signs a token the same way signAccessToken does, but with overridable claims/options so
// each case can break exactly one thing (signature, expiry, or issuer).
function signWith({ secret = process.env.JWT_SECRET, issuer = 'cs361-curriculum-api', audience = 'cs361-frontend', expiresIn = '5m' } = {}) {
  return jwt.sign({ sub: 'staff01', role: 'staff', name: 'Staff One' }, secret, {
    expiresIn, issuer, audience, algorithm: 'HS256',
  });
}

// Runs fn while capturing console.warn output, then restores the original.
async function captureWarn(fn) {
  const original = console.warn;
  const lines = [];
  console.warn = (...args) => lines.push(args.map(String).join(' '));
  try {
    await fn();
  } finally {
    console.warn = original;
  }
  return lines.join('\n');
}

const cookieEvent = (token) => ({
  routeKey: 'GET /api/auth/me',
  rawPath: '/api/auth/me',
  requestContext: { http: { method: 'GET', sourceIp: '127.0.0.1' } },
  headers: { cookie: `token=${token}` },
});

test('an expired token returns 401 and logs TokenExpiredError (no token/secret leaked)', async () => {
  const expired = signWith({ expiresIn: '-1s' });
  let res;
  const warning = await captureWarn(async () => { res = await handler(cookieEvent(expired)); });
  assert.equal(res.statusCode, 401);
  assert.match(warning, /auth token verify failed/);
  assert.match(warning, /TokenExpiredError|jwt expired/);
  assert.ok(!warning.includes(expired), 'the warning must not contain the token');
  assert.ok(!warning.includes(process.env.JWT_SECRET), 'the warning must not contain the secret');
});

test('a token signed with the wrong secret returns 401 and logs a JsonWebTokenError', async () => {
  const badSig = signWith({ secret: 'a-different-secret' });
  let res;
  const warning = await captureWarn(async () => { res = await handler(cookieEvent(badSig)); });
  assert.equal(res.statusCode, 401);
  assert.match(warning, /auth token verify failed/);
  assert.match(warning, /JsonWebTokenError|invalid signature/);
  assert.ok(!warning.includes(badSig));
  assert.ok(!warning.includes(process.env.JWT_SECRET));
});

test('a token with the wrong issuer returns 401 and logs the mismatch', async () => {
  const wrongIssuer = signWith({ issuer: 'someone-else' });
  let res;
  const warning = await captureWarn(async () => { res = await handler(cookieEvent(wrongIssuer)); });
  assert.equal(res.statusCode, 401);
  assert.match(warning, /auth token verify failed/);
  assert.match(warning, /jwt issuer invalid|JsonWebTokenError/);
  assert.ok(!warning.includes(wrongIssuer));
});

test('a token with the wrong audience returns 401', async () => {
  const wrongAudience = signWith({ audience: 'some-other-app' });
  let res;
  const warning = await captureWarn(async () => { res = await handler(cookieEvent(wrongAudience)); });
  assert.equal(res.statusCode, 401);
  assert.match(warning, /auth token verify failed/);
});

test('a valid staff cookie does NOT trigger the verify-failure warning', async () => {
  let res;
  const warning = await captureWarn(async () => { res = await handler(cookieEvent(tokenFor('staff', 'staff01', 'Staff One'))); });
  assert.equal(res.statusCode, 200);
  assert.equal(warning, '', 'a successful verify must not log a failure');
});

// ---------- Real HTTP API (payload 2.0) cookie delivery ----------
// AWS::Serverless::HttpApi uses payload format 2.0: API Gateway removes the Cookie header
// from event.headers and passes cookies as a "name=value" array in event.cookies. The tests
// above put the cookie in headers.cookie, which a deployed Lambda never receives. These
// build the event the way API Gateway really sends it.

function payloadV2Event(routeKey, { cookies, headers = {} } = {}) {
  return {
    version: '2.0',
    routeKey,
    rawPath: `/${routeKey.split(' ')[1] ?? ''}`,
    ...(cookies ? { cookies } : {}),
    headers,
    requestContext: { http: { method: routeKey.split(' ')[0], sourceIp: '127.0.0.1' } },
  };
}

test('payload 2.0: a staff token in event.cookies authenticates GET /api/auth/me', async () => {
  const token = tokenFor('staff', 'staff01', 'Staff One');
  const res = await handler(payloadV2Event('GET /api/auth/me', { cookies: [`token=${token}`] }));
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).data.user.role, 'staff');
});

test('payload 2.0: the token is found among several cookies', async () => {
  const token = tokenFor('staff', 'staff01', 'Staff One');
  const res = await handler(payloadV2Event('GET /api/auth/me', { cookies: ['theme=dark', `token=${token}`, 'lang=th'] }));
  assert.equal(res.statusCode, 200);
});

test('payload 2.0: a protected route passes the auth gate with the cookie in event.cookies', async () => {
  // A staff token on the staff-only assignment route reaches input validation (400) only if
  // the 401/403 gates were cleared using the cookie from event.cookies.
  const token = tokenFor('staff', 'staff01');
  const res = await handler(payloadV2Event('POST /api/graduation/assignments', {
    cookies: [`token=${token}`],
    headers: { 'x-cs361-csrf': '1' },
  }));
  assert.notEqual(res.statusCode, 401);
  assert.notEqual(res.statusCode, 403);
});

test('payload 2.0: no cookies field still returns 401', async () => {
  const res = await handler(payloadV2Event('GET /api/auth/me'));
  assert.equal(res.statusCode, 401);
});

test('payload 2.0: an unrelated cookie without a token returns 401', async () => {
  const res = await handler(payloadV2Event('GET /api/auth/me', { cookies: ['theme=dark'] }));
  assert.equal(res.statusCode, 401);
});

test('payload 2.0: a forged token in event.cookies is still rejected with 401', async () => {
  const forged = jwt.sign({ sub: 'x', role: 'staff' }, 'a-different-secret', {
    expiresIn: '5m', issuer: 'cs361-curriculum-api', audience: 'cs361-frontend', algorithm: 'HS256',
  });
  const res = await handler(payloadV2Event('GET /api/auth/me', { cookies: [`token=${forged}`] }));
  assert.equal(res.statusCode, 401);
});
