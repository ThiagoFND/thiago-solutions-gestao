/** Explicit, additive v2 provisioning and migration. No application bootstrap. */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const authorizedUri = 'mongodb://127.0.0.1:27017/salgados_financeiro_test';
const mode = process.argv[2] ?? 'diagnose';
// Validate BEFORE loading mongoose, schemas or connecting. No implicit dotenv.
if (process.env.TEST_MONGODB_URI !== authorizedUri) throw new Error('Exclusive test database configuration required');
if (!['diagnose', 'dry-run', 'apply', 'provision'].includes(mode)) throw new Error('Invalid command');
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mappings = [
  ['users', 'users_v2', 'User', 'users/user.schema.js'],
  ['products', 'products_v2', 'Product', 'products/product.schema.js'],
  ['orders', 'orders_v2', 'Order', 'orders/order.schema.js'],
  ['counters', 'counters_v2', 'Counter', 'orders/counter.schema.js'],
  ['productions', 'productions_v2', 'Production', 'productions/production.schema.js'],
  ['stockmovements', 'stock_movements_v2', 'StockMovement', 'productions/stock-movement.schema.js'],
  ['categorias_financeiras', 'categorias_financeiras_v2', 'FinancialCategory', 'finance/schemas/financial-category.schema.js'],
  ['lancamentos_financeiros', 'lancamentos_financeiros_v2', 'FinancialEntry', 'finance/schemas/financial-entry.schema.js'],
  ['recorrencias_financeiras', 'recorrencias_financeiras_v2', 'FinancialRecurrence', 'finance/schemas/financial-recurrence.schema.js'],
  ['security_audit_events', 'security_audit_events_v2', 'AuditEvent', 'audit/audit-event.schema.js'],
];
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
};
const fingerprint = value => createHash('sha256').update(JSON.stringify(canonical(EJSON.serialize(value)))).digest('hex');
let connection;
try {
  connection = await mongoose.createConnection(authorizedUri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 }).asPromise();
  const db = connection.db;
  const inventory = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = new Set(inventory.map(item => item.name));
  const source = {};
  const report = { mode, collections: [], conflicts: [], referencesMissing: 0, usersWithoutTenant: 0, admins: { active: 0, inactive: 0 } };
  for (const [oldName, target] of mappings) {
    source[oldName] = names.has(oldName) ? await db.collection(oldName).find({}).sort({ _id: 1 }).toArray() : [];
    report.collections.push({ source: oldName, target, sourceCount: source[oldName].length,
      targetCount: names.has(target) ? await db.collection(target).countDocuments() : 0,
      sourceIndexes: names.has(oldName) ? (await db.collection(oldName).indexes()).map(i => ({ key: i.key, unique: !!i.unique })) : [] });
  }
  const checkUnique = (items, key, label) => {
    const seen = new Set();
    for (const item of items) { const value = key(item); if (value == null) continue; if (seen.has(value)) report.conflicts.push(label); seen.add(value); }
  };
  checkUnique(source.users, u => typeof u.email === 'string' ? u.email.trim().toLowerCase() : null, 'users.email');
  checkUnique(source.orders, o => o.number, 'orders.number');
  checkUnique(source.counters, c => c.key, 'counters.key');
  checkUnique(source.categorias_financeiras, c => `${c.type}:${String(c.normalizedName).trim().toLowerCase()}`, 'categories.name');
  checkUnique(source.categorias_financeiras, c => c.seedKey, 'categories.seedKey');
  checkUnique(source.lancamentos_financeiros, e => e.recurrenceId && e.occurrenceKey ? `${e.recurrenceId}:${e.occurrenceKey}` : null, 'entries.occurrence');
  const ids = Object.fromEntries(Object.entries(source).map(([name, rows]) => [name, new Set(rows.map(row => String(row._id)))]));
  const ref = (id, collection) => { if (id != null && !ids[collection].has(String(id))) report.referencesMissing++; };
  for (const row of source.orders) { ref(row.openedById, 'users'); ref(row.finalizedById, 'users'); for (const item of row.items ?? []) ref(item.productId, 'products'); }
  for (const row of source.productions) { ref(row.productId, 'products'); ref(row.createdById, 'users'); }
  for (const row of source.stockmovements) { ref(row.productId, 'products'); ref(row.userId, 'users'); }
  for (const collection of ['categorias_financeiras', 'lancamentos_financeiros', 'recorrencias_financeiras']) for (const row of source[collection]) {
    ref(row.createdById, 'users'); ref(row.categoryId, 'categorias_financeiras'); ref(row.recurrenceId, 'recorrencias_financeiras');
    ref(row.production?.productId, 'products'); ref(row.payment?.registeredById, 'users'); ref(row.payment?.correctedById, 'users');
    for (const event of row.history ?? []) ref(event.userId, 'users');
  }
  for (const row of source.security_audit_events) ref(row.actorId, 'users');
  for (const row of source.users) {
    if (!row.tenantId) report.usersWithoutTenant++;
    else report.conflicts.push('legacy.users.alreadyAssigned');
    if (row.role === 'ADMIN') report.admins[row.active === false ? 'inactive' : 'active']++;
    if ('cpf' in row || 'password' in row) report.conflicts.push('legacy.sensitivePlaintext.requiresManualRemediation');
  }
  report.conflicts = [...new Set(report.conflicts)];
  if (mode === 'diagnose') { console.log(JSON.stringify(report, null, 2)); }
  else {
    const models = {};
    const extraModels = [
      [null, 'tenants_v2', 'Tenant', 'tenants/tenant.schema.js'],
      [null, 'product_categories_v2', 'Category', 'catalog/category.schema.js'],
      [null, 'landing_configs_v2', 'LandingConfig', 'catalog/landing.schema.js'],
      [null, 'custom_roles_v2', 'CustomRole', 'roles/custom-role.schema.js'],
      [null, 'catalog_images_v2', 'CatalogImage', 'catalog/images.module.js'],
      ...['Ingredient','IngredientReceipt','IngredientMovement','Recipe'].map(name => [null, null, name, 'inventory/inventory.schema.js']),
    ];
    for (const [, , name, file] of [...mappings, ...extraModels]) {
      const module = await import(pathToFileURL(path.join(root, 'apps/api/dist', file)).href);
      models[name] = connection.model(name, module[`${name}Schema`]);
    }
    if (mode === 'provision') {
      // createCollection/createIndexes are additive; never synchronize/drop.
      for (const model of Object.values(models)) { await model.createCollection(); await model.createIndexes(); }
      await db.createCollection('tenancy_migrations_v2').catch(error => { if (error.code !== 48) throw error; });
      console.log(JSON.stringify({ mode, provisionedCollections: Object.keys(models).length + 1 }));
    } else {
      if (!process.env.TENANCY_MIGRATION_PLAN) throw new Error('TENANCY_MIGRATION_PLAN file required');
      const plan = JSON.parse(await readFile(process.env.TENANCY_MIGRATION_PLAN, 'utf8'));
      if (typeof plan.effectiveAt !== 'string' || !Number.isFinite(new Date(plan.effectiveAt).getTime())) throw new Error('Stable effectiveAt required');
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(plan.runId ?? '') || !mongoose.isObjectIdOrHexString(plan.tenantId) || !mongoose.isObjectIdOrHexString(plan.ownerId)) throw new Error('Invalid migration plan identifiers');
      const tenantId = new mongoose.Types.ObjectId(plan.tenantId);
      const owner = source.users.find(u => String(u._id) === plan.ownerId && u.role === 'ADMIN' && u.active !== false);
      if (!owner) report.conflicts.push('active.legacy.admin.owner.required');
      const tenant = new models.Tenant({ ...plan.company, _id: tenantId, ownerId: plan.ownerId, status: 'ACTIVE', decisionHistory: [], createdAt: new Date(plan.effectiveAt), updatedAt: new Date(plan.effectiveAt) });
      await tenant.validate();
      const candidates = [{ collection: 'tenants_v2', doc: tenant.toObject() }];
      for (const [oldName, target, modelName] of mappings) for (const original of source[oldName]) {
        const data = { ...original, tenantId: modelName === 'AuditEvent' && !original.actorId ? null : tenantId };
        if (modelName === 'User') { data.status = original.active === false ? 'INACTIVE' : 'ACTIVE'; data.email = original.email.trim().toLowerCase(); data.sessionVersion = (original.sessionVersion ?? 0) + 1; data.requestedAt = original.createdAt ?? new Date(plan.effectiveAt); }
        if (modelName === 'Counter' && original.key === 'orders') data.value = Math.max(original.value, ...source.orders.map(order => order.number));
        const document = new models[modelName](data);
        try { await document.validate(); } catch { report.conflicts.push(`schema.${modelName}`); continue; }
        candidates.push({ collection: target, doc: document.toObject() });
      }
      if (!source.counters.some(c => c.key === 'orders')) {
        if (!mongoose.isObjectIdOrHexString(plan.counterId)) throw new Error('Stable counterId required when legacy order counter is absent');
        candidates.push({ collection: 'counters_v2', doc: new models.Counter({ _id: plan.counterId, tenantId, key: 'orders', value: Math.max(0, ...source.orders.map(o => o.number)) }).toObject() });
      }
      const checksum = fingerprint(source);
      const destinationChecksum = fingerprint(candidates);
      const manifest = await db.collection('tenancy_migrations_v2').findOne({ _id: plan.runId });
      if (manifest && (manifest.checksum !== checksum || manifest.destinationChecksum !== destinationChecksum)) report.conflicts.push('manifest.changed');
      let existing = 0;
      for (const candidate of candidates) {
        const current = await db.collection(candidate.collection).findOne({ _id: candidate.doc._id });
        if (current) { if (fingerprint(current) !== fingerprint(candidate.doc)) report.conflicts.push(`destination.changed.${candidate.collection}`); else existing++; }
      }
      report.conflicts = [...new Set(report.conflicts)];
      Object.assign(report, { runId: plan.runId, checksum, destinationChecksum, planned: candidates.length, identicalExisting: existing, ready: !report.conflicts.length && report.referencesMissing === 0 });
      console.log(JSON.stringify(report, null, 2));
      if (mode === 'apply') {
        if (!report.ready || process.env.TENANCY_MIGRATION_APPROVAL !== plan.runId || process.env.TENANCY_REVIEWED_CHECKSUM !== checksum) throw new Error('Reviewed dry-run and explicit authorization required');
        const hello = await db.admin().command({ hello: 1 });
        if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('Transactions required');
        const required = [...new Set(candidates.map(c => c.collection)), 'tenancy_migrations_v2'];
        if (required.some(name => !names.has(name))) throw new Error('Explicit additive provision required before migration');
        await connection.transaction(async session => {
          // Detect source changes again inside the snapshot before any insert.
          const snapshot = {};
          for (const [oldName] of mappings) snapshot[oldName] = await db.collection(oldName).find({}, { session }).sort({ _id: 1 }).toArray();
          if (fingerprint(snapshot) !== checksum) throw new Error('Source changed since dry-run');
          for (const { collection, doc } of candidates) {
            const current = await db.collection(collection).findOne({ _id: doc._id }, { session });
            if (current && fingerprint(current) !== fingerprint(doc)) throw new Error('Destination conflict');
            await db.collection(collection).updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true, session });
          }
          await db.collection('tenancy_migrations_v2').updateOne({ _id: plan.runId }, { $setOnInsert: { checksum, destinationChecksum, tenantId, completed: true, completedAt: new Date(), counts: report.collections.map(({ source, target, sourceCount }) => ({ source, target, count: sourceCount })) } }, { upsert: true, session });
        });
        console.log(JSON.stringify({ runId: plan.runId, completed: true, inserted: candidates.length - existing }));
      }
    }
  }
} catch {
  // Driver/schema messages may contain credentials, document values or URI.
  console.error('Tenancy command failed; inspect sanitized report and configuration. No database error details are logged.');
  process.exitCode = 1;
} finally { if (connection) await connection.close(); }
