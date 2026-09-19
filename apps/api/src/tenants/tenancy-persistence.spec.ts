import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { model, Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { normalizeCnpj, normalizeCpf } from '../common/brazil-documents.js';
import { CpfCrypto, maskCpf } from '../common/cpf-crypto.js';
import { UserSchema } from '../users/user.schema.js';
import { TenantSchema } from './tenant.schema.js';
import { ProductSchema } from '../products/product.schema.js';
import { OrderSchema } from '../orders/order.schema.js';
import { CounterSchema } from '../orders/counter.schema.js';
import { ProductionSchema } from '../productions/production.schema.js';
import { StockMovementSchema } from '../productions/stock-movement.schema.js';
import { FinancialCategorySchema } from '../finance/schemas/financial-category.schema.js';
import { FinancialEntrySchema } from '../finance/schemas/financial-entry.schema.js';
import { FinancialRecurrenceSchema } from '../finance/schemas/financial-recurrence.schema.js';

if (process.env.TEST_MONGODB_URI !== 'mongodb://127.0.0.1:27017/salgados_financeiro_test') throw new Error('Exclusive test configuration required');
const User = model('PersistenceUser', UserSchema);
const Tenant = model('PersistenceTenant', TenantSchema);
const tenantId = new Types.ObjectId();
const user = (extra: Record<string, unknown> = {}) => new User({ tenantId, name: 'Schema Test', email: 'schema@example.test', passwordHash: '$2b$12$' + 'a'.repeat(53), role: 'OWNER', status: 'PENDING', ...extra });

describe('document validation and CPF protection', () => {
  it('normalizes and validates both check digits', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });
  it.each(['11111111111', '52998224724', 'x52998224725', { $ne: null }, null])('rejects invalid CPF %#', value => expect(() => normalizeCpf(value)).toThrow());
  it.each(['11111111111111', '11222333000180', 'x11222333000181', { $ne: null }, null])('rejects invalid CNPJ %#', value => expect(() => normalizeCnpj(value)).toThrow());
  it('encrypts nondeterministically, hashes deterministically and binds tenant', () => {
    const crypto = new CpfCrypto({ CPF_ENCRYPTION_KEY: randomBytes(32).toString('base64'), CPF_HASH_KEY: randomBytes(32).toString('base64') });
    const a = crypto.protect('52998224725', tenantId.toString());
    const b = crypto.protect('529.982.247-25', tenantId.toString());
    expect(a.cpfHash).toBe(b.cpfHash); expect(a.cpfEncrypted).not.toEqual(b.cpfEncrypted);
    expect(crypto.decrypt(a.cpfEncrypted, tenantId.toString())).toBe('52998224725');
    expect(() => crypto.decrypt(a.cpfEncrypted, new Types.ObjectId().toString())).toThrow();
    expect(maskCpf(a.cpfLastDigits)).toBe('***.***.***-25');
    expect(JSON.stringify(a)).not.toContain('52998224725');
  });
  it('rejects missing and reused keys', () => {
    expect(() => new CpfCrypto({})).toThrow(); const key = randomBytes(32).toString('base64');
    expect(() => new CpfCrypto({ CPF_ENCRYPTION_KEY: key, CPF_HASH_KEY: key })).toThrow();
  });
});
describe('tenant and user persistence invariants', () => {
  it('requires tenant for business identity', async () => { await expect(user({ tenantId: null }).validate()).rejects.toThrow(); });
  it('allows platform null tenant only', async () => {
    await expect(user({ role: 'PLATFORM_ADMIN', tenantId: null, status: 'ACTIVE' }).validate()).resolves.toBeUndefined();
    await expect(user({ role: 'PLATFORM_ADMIN', status: 'ACTIVE' }).validate()).rejects.toThrow();
  });
  it('allows role-less pending but never active', async () => {
    await expect(user({ role: null }).validate()).resolves.toBeUndefined();
    await expect(user({ role: null, status: 'ACTIVE' }).validate()).rejects.toThrow();
  });
  it('preserves legacy ADMIN with explicit tenant and status', async () => { await expect(user({ role: 'ADMIN', status: 'ACTIVE' }).validate()).resolves.toBeUndefined(); });
  it('normalizes email, mirrors status and hides sensitive fields', async () => {
    const doc = user({ email: '  SCHEMA@example.test ', status: 'ACTIVE' }); await doc.validate();
    expect(doc.email).toBe('schema@example.test'); expect(doc.active).toBe(true);
    expect(doc.toJSON()).not.toHaveProperty('passwordHash'); expect(doc.toJSON()).not.toHaveProperty('sessionVersion');
  });
  it('rejects partial CPF protection', async () => { await expect(user({ cpfHash: 'a'.repeat(64) }).validate()).rejects.toThrow(); });
  it('validates CNPJ persistently and defaults tenant to PENDING', async () => {
    const base = { cnpj: '11.222.333/0001-81', legalName: 'Test Company', tradeName: 'Test', corporateEmail: 'TEST@example.test', phone: '11999999999', ownerId: new Types.ObjectId() };
    const doc = new Tenant(base); await doc.validate(); expect(doc.status).toBe('PENDING'); expect(doc.cnpj).toBe('11222333000181');
    await expect(new Tenant({ ...base, cnpj: '11222333000180' }).validate()).rejects.toThrow();
  });
  it('requires reasons for rejection and suspension', async () => {
    const doc = new Tenant({ cnpj: '11222333000181', legalName: 'Company', tradeName: 'Company', corporateEmail: 'test@example.test', phone: '11999999999', ownerId: new Types.ObjectId(), decisionHistory: [{ action: 'suspended', actorId: new Types.ObjectId() }] });
    await expect(doc.validate()).rejects.toThrow();
  });
  it.each([ProductSchema, OrderSchema, CounterSchema, ProductionSchema, StockMovementSchema, FinancialCategorySchema, FinancialEntrySchema, FinancialRecurrenceSchema])('requires tenant and prefixes every business index %#', schema => {
    expect(schema.path('tenantId').options.required).toBe(true);
    expect(schema.path('tenantId').instance).toBe('ObjectId');
    const m = model('Casting' + new Types.ObjectId(), schema);
    expect(m.find({tenantId: String(tenantId)}).cast(m).tenantId).toEqual(tenantId);
    expect(schema.options.collection).toMatch(/_v2$/); expect(schema.options.autoIndex).toBe(false); expect(schema.options.autoCreate).toBe(false);
    for (const [keys] of schema.indexes()) expect(Object.keys(keys)[0]).toBe('tenantId');
  });
  it('scopes all four identity/order unique keys', () => {
    for (const schema of [UserSchema, OrderSchema, CounterSchema, FinancialCategorySchema]) {
      expect(schema.indexes().some(([keys, options]) => options.unique && Object.keys(keys)[0] === 'tenantId')).toBe(true);
      expect(schema.indexes().filter(([, options]) => options.unique).every(([keys]) => 'tenantId' in keys)).toBe(true);
    }
  });
});
