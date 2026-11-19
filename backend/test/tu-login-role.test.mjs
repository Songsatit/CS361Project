// Tests for TU login role assignment in src/api.mjs.
//
// roleFromTuType(username, type, queryFn) maps a TU account to an internal role:
//   - type 'student'                 -> 'student'
//   - non-student found in allowlist -> the stored role
//   - non-student, not in allowlist  -> 'public'
//   - allowlist query throws         -> 'public' (never escalate on error)
// queryFn is injected so these run with a stub, never a real database or the TU network.
//
// demoLogin is covered separately to prove demo accounts keep their hard-coded role and
// never pass through the allowlist.
//
// Run from backend/: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.JWT_SECRET = 'test-secret-not-for-deployment';
process.env.ENABLE_DEMO_LOGIN = 'true';
process.env.TU_APPLICATION_KEY = 'test-application-key-not-for-deployment';

// Build a scrypt hash in the exact encoding verifyPassword expects: scrypt$saltHex$digestHex.
function scryptHash(password) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${digest.toString('hex')}`;
}
// Set the demo staff password hash before importing the module so demoAccounts picks it up.
process.env.DEMO_STAFF_PASSWORD_HASH = scryptHash('demo-staff-pass');

const { roleFromTuType, demoLogin, tuLogin } = await import('../src/api.mjs');

// A fake allowlist table. queryFn receives (sql, params); params[0] is the lower-cased username.
function allowlistStub(table) {
  return async (_sql, params) => {
    const username = params[0];
    const role = table[username];
    return role ? [{ role }] : [];
  };
}
const throwingQuery = async () => {
  throw new Error('simulated DB failure');
};

test('student type maps to student (allowlist is never consulted)', async () => {
  let consulted = false;
  const role = await roleFromTuType('anyone', 'student', async () => {
    consulted = true;
    return [];
  });
  assert.equal(role, 'student');
  assert.equal(consulted, false);
});

test('non-student not in the allowlist falls back to public', async () => {
  const role = await roleFromTuType('nobody', 'employee', allowlistStub({}));
  assert.equal(role, 'public');
});

test('non-student listed with role=staff is granted staff', async () => {
  const role = await roleFromTuType('emp01', 'employee', allowlistStub({ emp01: 'staff' }));
  assert.equal(role, 'staff');
});

test('non-student listed with role=instructor is granted instructor', async () => {
  const role = await roleFromTuType('teacher01', 'employee', allowlistStub({ teacher01: 'instructor' }));
  assert.equal(role, 'instructor');
});

test('non-student listed with role=curriculum_admin is granted curriculum_admin', async () => {
  const role = await roleFromTuType('admin01', 'employee', allowlistStub({ admin01: 'curriculum_admin' }));
  assert.equal(role, 'curriculum_admin');
});

test('an unexpected role value in the allowlist is ignored and falls back to public', async () => {
  const role = await roleFromTuType('sneaky', 'employee', allowlistStub({ sneaky: 'superuser' }));
  assert.equal(role, 'public');
});

test('a failing allowlist query falls back to public, never escalating', async () => {
  const role = await roleFromTuType('emp01', 'employee', throwingQuery);
  assert.equal(role, 'public');
});

test('the username is lower-cased before the allowlist lookup', async () => {
  const seen = [];
  const queryFn = async (_sql, params) => {
    seen.push(params[0]);
    return [];
  };
  await roleFromTuType('Emp.One', 'employee', queryFn);
  assert.deepEqual(seen, ['emp.one']);
});

// ---------- demo accounts keep their hard-coded role, bypassing the allowlist ----------

test('a demo staff account logs in with its code-defined staff role', () => {
  const user = demoLogin('staff', 'demo-staff-pass');
  assert.ok(user, 'demo login should succeed with the correct password');
  assert.equal(user.role, 'staff');
  assert.equal(user.type, 'demo');
});

test('a demo login with the wrong password is rejected', () => {
  assert.equal(demoLogin('staff', 'wrong-password'), null);
});

function loginEvent(username = 'b65test01') {
  return {
    body: JSON.stringify({ username, password: 'not-a-real-password' }),
    requestContext: { http: { sourceIp: '127.0.0.1' } },
  };
}

test('TU 200 with status=false is treated as a password failure', async () => {
  const originalFetch = globalThis.fetch;
  let failedLoginCalls = 0;
  globalThis.fetch = async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
    return new Response(JSON.stringify({ status: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await tuLogin(loginEvent(), {
      isLoginLockedFn: async () => 0,
      failedLoginFn: async () => {
        failedLoginCalls += 1;
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid username or password' }) };
      },
    });
    assert.equal(result.statusCode, 401);
    assert.equal(failedLoginCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TU 400 is treated as a password failure and records the attempt', async () => {
  const originalFetch = globalThis.fetch;
  let failedLoginCalls = 0;
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'User or Password Invalid!' }), { status: 400 });
  try {
    const result = await tuLogin(loginEvent(), {
      isLoginLockedFn: async () => 0,
      failedLoginFn: async () => {
        failedLoginCalls += 1;
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid username or password' }) };
      },
    });
    assert.equal(result.statusCode, 401);
    assert.equal(failedLoginCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TU 403 is returned as 502 without recording a login failure', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs = [];
  let failedLoginCalls = 0;
  console.error = (...args) => logs.push(args);
  globalThis.fetch = async () => new Response('', { status: 403 });
  try {
    const result = await tuLogin(loginEvent(), {
      isLoginLockedFn: async () => 0,
      failedLoginFn: async () => {
        failedLoginCalls += 1;
        return { statusCode: 401 };
      },
    });
    assert.equal(result.statusCode, 502);
    assert.deepEqual(JSON.parse(result.body), { error: 'TU authentication service unavailable' });
    assert.equal(failedLoginCalls, 0);
    assert.equal(logs.length, 1);
    assert.equal(logs[0][1].status, 403);
    assert.deepEqual(logs[0][1], { status: 403 });
    assert.doesNotMatch(JSON.stringify(logs), /b65test01|not-a-real-password/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test('TU fetch failure is returned as 502 without recording a login failure', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs = [];
  let failedLoginCalls = 0;
  console.error = (...args) => logs.push(args);
  globalThis.fetch = async () => { throw new TypeError('simulated timeout'); };
  try {
    const result = await tuLogin(loginEvent(), {
      isLoginLockedFn: async () => 0,
      failedLoginFn: async () => {
        failedLoginCalls += 1;
        return { statusCode: 401 };
      },
    });
    assert.equal(result.statusCode, 502);
    assert.equal(failedLoginCalls, 0);
    assert.deepEqual(logs[0][1], { status: null });
    assert.doesNotMatch(JSON.stringify(logs), /b65test01|not-a-real-password|simulated timeout/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test('TU 401 is returned as 502 without recording a login failure', async () => {
  const originalFetch = globalThis.fetch;
  let failedLoginCalls = 0;
  globalThis.fetch = async () => new Response('', { status: 401 });
  try {
    const result = await tuLogin(loginEvent(), {
      isLoginLockedFn: async () => 0,
      failedLoginFn: async () => {
        failedLoginCalls += 1;
        return { statusCode: 401 };
      },
    });
    assert.equal(result.statusCode, 502);
    assert.equal(failedLoginCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TU 200 with status=true keeps the successful login flow', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: true,
    username: 'b65test01',
    type: 'employee',
  }), { status: 200 });
  try {
    const result = await tuLogin(loginEvent(), {
      isLoginLockedFn: async () => 0,
      resetLoginAttemptsFn: async () => {},
      safeLoginAuditFn: async () => {},
      signAccessTokenFn: () => 'test-token',
      recordDirectoryLoginFn: async () => {},
    });
    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(result.body).user.role, 'staff');
    assert.match(result.headers['Set-Cookie'], /HttpOnly/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
