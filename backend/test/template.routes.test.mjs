// Verifies that auth routes in template.yaml are wired to the Lambda that actually
// implements them. logout() and me() live in the `handler` export (src/api.handler),
// not in `authHandler` (src/api.authHandler, which only serves login and the student
// profile). A mismatch deploys routes that reach the wrong function and return 400/403.
//
// No YAML library is available, so this parses the template structurally by indentation.
// Run from backend/: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(path.join(backendDir, 'template.yaml'), 'utf8');

// Maps each HttpApi route ("METHOD /path") to the Handler of the function that owns it.
// Resources sit at 2-space indent; a function's Handler and its Events are nested under it.
function routeHandlerMap(text) {
  const lines = text.split(/\r?\n/);
  const map = new Map();
  let currentHandler = null;
  let pendingPath = null;
  let pendingMethod = null;

  const indentOf = (line) => line.length - line.trimStart().length;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // A new top-level resource (indent 2, ends with ':') resets the current function.
    if (indentOf(line) === 2 && /^[A-Za-z0-9]+:$/.test(trimmed)) {
      // Keep currentHandler until we see the next Handler; a resource without a Handler
      // (e.g. the API or DB resources) simply never contributes routes.
    }

    const handlerMatch = trimmed.match(/^Handler:\s*(\S+)$/);
    if (handlerMatch) {
      currentHandler = handlerMatch[1];
      continue;
    }

    const pathMatch = trimmed.match(/^Path:\s*(\S+)$/);
    if (pathMatch) {
      pendingPath = pathMatch[1];
      pendingMethod = null;
      continue;
    }

    const methodMatch = trimmed.match(/^Method:\s*(\S+)$/);
    if (methodMatch && pendingPath) {
      pendingMethod = methodMatch[1].toUpperCase();
      map.set(`${pendingMethod} ${pendingPath}`, currentHandler);
      pendingPath = null;
      pendingMethod = null;
    }
  }
  return map;
}

const routes = routeHandlerMap(template);

test('template parse found the known login route (sanity check of the parser)', () => {
  assert.equal(routes.get('POST /api/auth/login'), 'src/api.authHandler');
});

test('POST /api/auth/logout is wired to the main router handler (src/api.handler)', () => {
  assert.equal(routes.get('POST /api/auth/logout'), 'src/api.handler');
});

test('GET /api/auth/me is wired to the main router handler (src/api.handler)', () => {
  assert.equal(routes.get('GET /api/auth/me'), 'src/api.handler');
});
