import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { MongoClient, BSON } = require('mongodb');
const uri = 'mongodb://127.0.0.1:27017/salgados_financeiro_test';
if (process.env.TEST_MONGODB_URI !== uri) throw new Error('Exact test URI required');
if (!/^[a-zA-Z0-9_-]+$/.test(process.env.SECURITY_QA_RUN ?? '')) throw new Error('Unique SECURITY_QA_RUN required');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
const folder = new URL(`../docs/security-qa/${process.env.SECURITY_QA_RUN}/`, import.meta.url);
await mkdir(folder, { recursive: true });
const hash = value => createHash('sha256').update(BSON.EJSON.stringify(value, { relaxed: false })).digest('hex');
try {
  await client.connect();
  const snapshot = {};
  for (const dbName of ['salgados_financeiro_test']) {
    const db = client.db(dbName); snapshot[dbName] = {};
    for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
      const rows = await db.collection(name).find().sort({ _id: 1 }).toArray();
      snapshot[dbName][name] = Object.fromEntries(rows.map(row => [String(row._id), hash(row)]));
    }
  }
  const mode = process.argv[2];
  if (!['before', 'after'].includes(mode)) throw new Error('Use before ou after.');
  await writeFile(new URL(`${mode}-db.json`, folder), JSON.stringify(snapshot, null, 2));
  if (mode === 'after') {
    const before = JSON.parse(await readFile(new URL('before-db.json', folder), 'utf8'));
    const errors = [];
    for (const [db, collections] of Object.entries(before)) for (const [name, rows] of Object.entries(collections)) for (const [id, digest] of Object.entries(rows)) {
      if (snapshot[db]?.[name]?.[id] !== digest) errors.push(`${db}.${name}:${id} alterado ou removido`);
    }

    const result = { passed: errors.length === 0, errors, counts: Object.fromEntries(Object.entries(snapshot).map(([db, collections]) => [db, Object.fromEntries(Object.entries(collections).map(([name, rows]) => [name, Object.keys(rows).length]))])) };
    await writeFile(new URL('preservation.json', folder), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    if (errors.length) process.exitCode = 1;
  } else console.log('Snapshot de hashes salvo; apenas leitura nos bancos.');
} finally { await client.close(); }
