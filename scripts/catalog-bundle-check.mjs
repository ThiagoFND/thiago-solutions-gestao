import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = new URL('../apps/web/dist/web/browser/', import.meta.url);
const rules = {
  databaseUri: /mongodb(?:\+srv)?:\/\//i,
  privateKey: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  jwtConfiguration: /JWT_SECRET|CPF_ENCRYPTION_KEY|CPF_HASH_SECRET/,
  embeddedJwt: /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}/,
  awsAccessKey: /AKIA[0-9A-Z]{16}/,
};
const files = [], findings = [];
for (const name of await readdir(base)) {
  if (!name.endsWith('.js')) continue;
  const content = await readFile(new URL(name, base));
  files.push({ name, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
  for (const [rule, pattern] of Object.entries(rules)) if (pattern.test(content.toString('utf8'))) findings.push({ file: name, rule });
}
if (!files.length) throw new Error('Current frontend build required');
const report = { generatedAt: new Date().toISOString(), scanned: files.length, findings, files,
  limitation: 'Heuristic inspection of current JavaScript bundles; not proof that every possible secret is absent.' };
await writeFile(new URL('../docs/vitrine-qa/bundle-scan.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ scanned: files.length, findings: findings.length }));
if (findings.length) process.exitCode = 1;
