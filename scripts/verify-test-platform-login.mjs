/** Isolated HTTP smoke. Reads one JSON line from stdin; never prints credentials. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

const uri = 'mongodb://127.0.0.1:27017/salgados_financeiro_test';
const origin = 'http://127.0.0.1';
let app;
let stage = 'input';
let restoreRaw;
const timedOut = () => {
  console.error(JSON.stringify({ status: 'timeout', stage }));
  restoreRaw?.();
  void app?.close().catch(() => {});
  process.exit(1);
};
let timeout = setTimeout(timedOut, 120_000);

try {
  const line = await new Promise((resolve, reject) => {
    const input = process.stdin;
    const previousRaw = input.isRaw;
    if (input.isTTY) input.setRawMode(true);
    restoreRaw = () => { if (input.isTTY) input.setRawMode(Boolean(previousRaw)); };
    let buffer = '';
    const finish = (error, value) => {
      input.off('data', receive);
      input.off('end', end);
      input.off('error', fail);
      input.pause();
      restoreRaw();
      restoreRaw = undefined;
      if (error) reject(error); else resolve(value);
    };
    const receive = chunk => {
      buffer += chunk.toString('utf8');
      if (buffer.length > 8192 || buffer.includes('\u0003')) return finish(new Error('Invalid input'));
      const at = buffer.search(/[\r\n]/);
      if (at >= 0) finish(null, buffer.slice(0, at));
    };
    const end = () => finish(new Error('Input line required'));
    const fail = () => finish(new Error('Input unavailable'));
    input.on('data', receive);
    input.once('end', end);
    input.once('error', fail);
    input.resume();
    console.log(JSON.stringify({ status: 'ready', stage: 'input' }));
  });
  clearTimeout(timeout);
  timeout = setTimeout(timedOut, 20_000);
  const credentials = JSON.parse(line ?? '');
  assert.equal(typeof credentials.email, 'string');
  assert.equal(typeof credentials.password, 'string');
  assert.ok(credentials.email.trim() && credentials.password);

  stage = 'configuration';
  loadEnvFile(fileURLToPath(new URL('../apps/api/.env', import.meta.url)));
  Object.assign(process.env, {
    NODE_ENV: 'test', MONGODB_URI: uri, TEST_MONGODB_URI: uri,
    TENANCY_V2_ENABLED: 'true', MONGODB_USER: '', MONGODB_PASSWORD: '',
    MONGODB_TLS: 'false', MONGODB_TLS_CA_FILE: '', FRONTEND_URL: origin,
  });
  process.chdir(fileURLToPath(new URL('../apps/api/', import.meta.url)));
  const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { getConnectionToken } = require('@nestjs/mongoose');
  const { AppModule } = await import('../apps/api/dist/app.module.js');
  const { configureSecurityHttp } = await import('../apps/api/dist/common/security-http.js');
  stage = 'boot';
  app = await NestFactory.create(AppModule, { bodyParser: false, logger: false, abortOnError: false });
  assert.equal(app.get(getConnectionToken()).name, 'salgados_financeiro_test');
  configureSecurityHttp(app);
  await app.listen(0, '127.0.0.1');
  const baseURL = await app.getUrl();
  const cookies = new Map();
  let csrf;
  const request = async (method, path, body) => {
    const response = await fetch(`${baseURL}/api${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10_000),
    });
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';', 1)[0];
      const at = pair.indexOf('=');
      cookies.set(pair.slice(0, at), pair.slice(at + 1));
    }
    assert.equal(response.status, 200);
    return response.json();
  };
  stage = 'csrf';
  csrf = (await request('GET', '/auth/csrf')).csrfToken;
  assert.match(csrf, /^[a-f\d]{64}$/);
  stage = 'platform-login';
  const { user } = await request('POST', '/auth/platform-login', {
    email: credentials.email, password: credentials.password,
  });
  credentials.password = '';
  assert.equal(user.role, 'PLATFORM_ADMIN');
  assert.equal(user.status, 'ACTIVE');
  assert.equal(user.tenantId, null);
  assert.equal(user.email, credentials.email.trim().toLowerCase());
  assert.equal(typeof user.name, 'string');
  assert.ok(user.name.trim().length >= 2);
  stage = 'identity';
  const identity = await request('GET', '/auth/me');
  for (const field of ['sub', 'name', 'email', 'role', 'status', 'tenantId']) {
    assert.equal(identity[field], user[field]);
  }
  stage = 'platform-tenants';
  const tenants = await request('GET', '/platform/tenants');
  assert.ok(Array.isArray(tenants.items));
  assert.ok(Number.isSafeInteger(tenants.total) && tenants.total >= 0);
  assert.ok(tenants.total >= tenants.items.length);
  stage = 'close';
  await app.close();
  app = undefined;
  console.log(JSON.stringify({ status: 'passed', httpChecks: 4, identityChecks: 6, tenantItems: tenants.items.length, tenantTotal: tenants.total }));
} catch {
  console.error(JSON.stringify({ status: 'failed', stage }));
  process.exitCode = 1;
} finally {
  if (app) { try { await app.close(); } catch { process.exitCode = 1; } }
  clearTimeout(timeout);
}
