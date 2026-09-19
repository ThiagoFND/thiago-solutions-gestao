/** Explicit additional QA administrator; never imported by application startup.
 * Credentials: JSON { name, email, password } on stdin (never command arguments).
 * Requires both Mongo URI variables and TENANCY_BOOTSTRAP_CONFIRM=ADD_TEST_PLATFORM_ADMIN.
 * Standalone-safe ordering: inactive identity -> audit -> activation. No rollback/deletion.
 */
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const uri = 'mongodb://127.0.0.1:27017/salgados_financeiro_test';
const runId = randomUUID();
let connection;
let stage = 'configuration';
let userId;
let auditId;
let userInserted = false;
let auditInserted = false;
let activated = false;
let restoreRawMode = false;

try {
  if (process.env.MONGODB_URI !== uri || process.env.TEST_MONGODB_URI !== uri) {
    throw new Error('Exact test database required');
  }
  if (process.env.TENANCY_BOOTSTRAP_CONFIRM !== 'ADD_TEST_PLATFORM_ADMIN') {
    throw new Error('Explicit additional test administrator confirmation required');
  }

  stage = 'credentials';
  if (process.stdin.isTTY && !process.stdin.isRaw) {
    process.stdin.setRawMode(true);
    restoreRawMode = true;
  }
  process.stdin.setEncoding('utf8');
  let input = await new Promise((resolve, reject) => {
    let value = '';
    let bytes = 0;
    const finish = (error) => {
      process.stdin.off('data', onData);
      process.stdin.off('end', onEnd);
      process.stdin.off('error', onError);
      process.stdin.pause();
      if (error) reject(error);
      else resolve(value.split(/[\r\n]/, 1)[0]);
    };
    const onData = chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 8192 || chunk.includes('\u0003')) return finish(new Error('Input rejected'));
      value += chunk;
      if (/[\r\n]/.test(value)) finish();
    };
    const onEnd = () => finish();
    const onError = () => finish(new Error('Input unavailable'));
    process.stdin.on('data', onData);
    process.stdin.once('end', onEnd);
    process.stdin.once('error', onError);
    process.stdin.resume();
  });
  const credentials = JSON.parse(input);
  input = '';
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)
    || Object.keys(credentials).some(key => !['name', 'email', 'password'].includes(key))) {
    throw new Error('Invalid credentials object');
  }
  const name = typeof credentials.name === 'string' ? credentials.name.trim() : '';
  const email = typeof credentials.email === 'string' ? credentials.email.trim().toLowerCase() : '';
  if (name.length < 2 || name.length > 120 || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || typeof credentials.password !== 'string' || credentials.password.length < 12
    || Buffer.byteLength(credentials.password) > 72) {
    throw new Error('Invalid administrator credentials');
  }

  stage = 'load_schemas';
  const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
  require('reflect-metadata');
  const mongoose = require('mongoose');
  const bcrypt = require('bcrypt');
  const { UserSchema } = await import('../apps/api/dist/users/user.schema.js');
  const { AuditEventSchema } = await import('../apps/api/dist/audit/audit-event.schema.js');
  const passwordHash = await bcrypt.hash(credentials.password, 12);
  delete credentials.password;

  stage = 'connect';
  connection = await mongoose.createConnection(uri, {
    autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 5000,
  }).asPromise();
  if (connection.name !== 'salgados_financeiro_test') throw new Error('Unexpected database');
  const User = connection.model('User', UserSchema);
  const Audit = connection.model('AuditEvent', AuditEventSchema);

  stage = 'unique_index';
  const indexes = await User.collection.listIndexes().toArray();
  const uniqueIdentityIndex = indexes.some(index => index.unique === true
    && !index.partialFilterExpression && !index.sparse
    && Object.keys(index.key).length === 2
    && index.key.tenantId === 1 && index.key.email === 1);
  if (!uniqueIdentityIndex) throw new Error('Existing full unique identity index required');

  stage = 'existing_identity';
  if (await User.exists({ tenantId: null, email })) throw new Error('Identity already exists');
  const before = {
    users: await User.countDocuments({}),
    platformAdmins: await User.countDocuments({ role: 'PLATFORM_ADMIN' }),
    audits: await Audit.countDocuments({}),
  };

  stage = 'validate_documents';
  const admin = new User({ name, email, passwordHash, tenantId: null,
    role: 'PLATFORM_ADMIN', status: 'INACTIVE', active: false });
  const audit = new Audit({ tenantId: null, actorId: admin._id, actorRole: 'PLATFORM_ADMIN',
    action: 'platform.test_admin_created', outcome: 'success', resourceType: 'users',
    resourceId: admin._id, reasonCode: `explicit_test_admin:${runId}` });
  await admin.validate();
  await audit.validate();
  userId = admin._id.toString();
  auditId = audit._id.toString();

  stage = 'insert_inactive_user';
  await admin.save();
  userInserted = true;
  stage = 'insert_audit';
  await audit.save();
  auditInserted = true;
  stage = 'activate_user';
  const result = await User.updateOne({ _id: admin._id, tenantId: null,
    role: 'PLATFORM_ADMIN', status: 'INACTIVE', active: false },
  { $set: { status: 'ACTIVE', active: true } }, { runValidators: true });
  if (result.matchedCount !== 1 || result.modifiedCount !== 1) throw new Error('Activation conflict');
  activated = true;

  stage = 'verify';
  if (!await User.exists({ _id: admin._id, role: 'PLATFORM_ADMIN', status: 'ACTIVE', active: true })
    || !await Audit.exists({ _id: audit._id, resourceId: admin._id,
      action: 'platform.test_admin_created', reasonCode: `explicit_test_admin:${runId}` })) {
    throw new Error('Persistence verification failed');
  }
  const after = {
    users: await User.countDocuments({}),
    platformAdmins: await User.countDocuments({ role: 'PLATFORM_ADMIN' }),
    audits: await Audit.countDocuments({}),
  };
  console.log(JSON.stringify({ ok: true, runId, userId, auditId, created: 1,
    role: 'PLATFORM_ADMIN', audited: true, activated, before, after }));
} catch {
  // Never print Mongo/Mongoose errors: they can contain identity fields or password hashes.
  console.error(JSON.stringify({ ok: false, runId, stage, userId, auditId,
    acknowledged: { userInserted, auditInserted, activated },
    message: 'Failed safely; existing records were preserved. Writes may be partial or unacknowledged. Inspect the reported IDs before retrying; no automatic cleanup or account overwrite is performed.' }));
  process.exitCode = 1;
} finally {
  if (restoreRawMode) process.stdin.setRawMode(false);
  if (connection) {
    try { await connection.close(); }
    catch {
      console.error(JSON.stringify({ ok: false, runId, stage: 'disconnect' }));
      process.exitCode = 1;
    }
  }
}
