import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { UpdateEntryDto } from './finance.dto.js';
import { FinanceService } from './finance.service.js';
import { EntryKind, FinancialOrigin, FinancialPaymentMethod, FinancialStatus, FinancialType } from './finance.enums.js';
import { UserRole } from '../common/enums.js';

describe('transições financeiras e auditoria atômica', () => {
  const user = { sub: new Types.ObjectId().toString(), name: 'Administrador', email: 'admin@test', role: UserRole.ADMIN };
  let row: any, model: any, service: FinanceService;
  const payment = { paidAmountCents: 950, paidOn: '2020-01-01', origin: FinancialOrigin.PF, method: FinancialPaymentMethod.PIX };
  beforeEach(() => {
    row = { _id: new Types.ObjectId(), status: FinancialStatus.PENDENTE, version: 0, expectedAmountCents: 1000, dueDate: '2020-01-01', history: [] };
    model = { findOne: vi.fn(() => ({ lean: () => ({ exec: async () => row }) })), findOneAndUpdate: vi.fn((_filter, update) => ({ lean: () => ({ exec: async () => ({ ...row, ...update.$set, version: row.version + 1 }) }) })) };
    service = new FinanceService({user} as any, {scope: async () => new Types.ObjectId()} as any, {} as any, model, {} as any, {} as any);
  });
  it('paga integralmente com diferença e grava evento no mesmo update', async () => {
    const result = await service.payment(String(row._id), payment, user);
    expect(result.status).toBe(FinancialStatus.PAGO); expect(result.differenceCents).toBe(-50);
    const [filter, update] = model.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ version: 0, status: FinancialStatus.PENDENTE });
    expect(update.$push.history).toMatchObject({ action: 'PAGAMENTO', userName: user.name, before: { status: 'PENDENTE' }, after: { status: 'PAGO' } });
    expect(update.$set.payment.registeredAt).toBeInstanceOf(Date);
  });
  it('rejeita pagamento duplicado, versão obsoleta e data futura', async () => {
    row.status = FinancialStatus.PAGO;
    await expect(service.payment(String(row._id), payment, user)).rejects.toThrow();
    row.status = FinancialStatus.PENDENTE;
    await expect(service.payment(String(row._id), { ...payment, version: 8 }, user)).rejects.toThrow();
    await expect(service.payment(String(row._id), { ...payment, paidOn: '2100-01-01' }, user)).rejects.toThrow();
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('correção exige confirmação e preserva autoria original', async () => {
    row.status = FinancialStatus.PAGO;
    row.payment = { ...payment, registeredAt: new Date('2020-01-02Z'), registeredById: new Types.ObjectId(), registeredByName: 'Original' };
    await expect(service.payment(String(row._id), payment, user, true)).rejects.toThrow();
    await service.payment(String(row._id), { ...payment, paidAmountCents: 1100, confirmed: true, reason: 'Corrigir valor' }, user, true);
    const update = model.findOneAndUpdate.mock.calls[0][1];
    expect(update.$set.payment.registeredByName).toBe('Original');
    expect(update.$set.payment.correctedByName).toBe(user.name);
    expect(update.$push.history.before.payment.paidAmountCents).toBe(950);
  });
  it('retorna conflito quando atualização concorrente vence', async () => {
    model.findOneAndUpdate.mockImplementation(() => ({ lean: () => ({ exec: async () => null }) }));
    await expect(service.payment(String(row._id), payment, user)).rejects.toThrow('simultaneamente');
  });
  it('impede cancelamento de conta paga e IDs inválidos', async () => {
    row.status = FinancialStatus.PAGO;
    await expect(service.cancel(String(row._id), { reason: 'Cancelar' }, user)).rejects.toThrow();
    await expect(service.getEntry('invalid')).rejects.toThrow('Identificador inválido');
  });
  it('preserva subcampos de produção ausentes no PATCH e limpa null explícito', async () => {
    const categoryId = new Types.ObjectId();
    row.categoryId = categoryId; row.type = 'CUSTO_PRODUCAO';
    row.production = { inputName: 'Farinha', quantity: 2, unit: 'KG', totalAmountCents: 1000 };
    const categories = { findOne: () => ({ lean: () => ({ exec: async () => ({ _id: categoryId, active: true, type: 'CUSTO_PRODUCAO' }) }) }) };
    service = new FinanceService({user} as any, {scope: async () => new Types.ObjectId()} as any, categories as any, model, {} as any, {} as any);
    const dto = plainToInstance(UpdateEntryDto, { production: { inputName: null }, version: 0 });
    await service.updateEntry(String(row._id), dto, user);
    expect(model.findOneAndUpdate.mock.calls[0][1].$set.production).toEqual({ quantity: 2, unit: 'KG', totalAmountCents: 1000 });
  });
});

describe('personal expenses', () => {
  const tenantId = new Types.ObjectId();
  const user = { sub: new Types.ObjectId().toString(), tenantId: String(tenantId), name: 'Owner', email: 'owner@test', role: UserRole.ADMIN };
  const categoryId = new Types.ObjectId();
  const dto = { description: 'Personal expense', categoryId: String(categoryId), type: FinancialType.DESPESA_PESSOAL, nature: 'VARIAVEL', expectedAmountCents: 100, dueDate: '2020-01-01', competence: '2020-01', entryKind: EntryKind.PERSONAL_EXPENSE };
  function setup(type = FinancialType.DESPESA_PESSOAL) {
    const categories = { findOne: vi.fn(() => ({ lean: () => ({ exec: async () => ({ _id: categoryId, type, active: true }) }) })) };
    const entries = { create: vi.fn(async (data: any) => ({ toObject: () => data })) };
    const service = new FinanceService({ user }, { scope: async () => tenantId } as any, categories as any, entries as any, {} as any, {} as any);
    return { service, entries, categories };
  }
  it('accepts personal classification and preserves tenant scope', async () => {
    const { service, categories } = setup();
    const result = await service.createEntry(dto as any, user);
    expect(result).toMatchObject({ type: FinancialType.DESPESA_PESSOAL, entryKind: EntryKind.PERSONAL_EXPENSE, tenantId });
    expect(categories.findOne).toHaveBeenCalledWith({ _id: categoryId, tenantId });
  });
  it('rejects production details and input purchases for personal expenses', async () => {
    const { service, entries } = setup();
    await expect(service.createEntry({ ...dto, production: { inputName: 'Input' } } as any, user)).rejects.toThrow();
    await expect(service.createEntry({ ...dto, entryKind: EntryKind.INPUT_PURCHASE, purchaseDate: '2020-01-01' } as any, user)).rejects.toThrow();
    expect(entries.create).not.toHaveBeenCalled();
  });
  it.each([FinancialType.DESPESA_OPERACIONAL, FinancialType.CUSTO_PRODUCAO])('rejects personal classification on %s', async type => {
    const { service, entries } = setup(type);
    await expect(service.createEntry({ ...dto, type } as any, user)).rejects.toThrow();
    expect(entries.create).not.toHaveBeenCalled();
  });
  it('rejects a type change that retains an incompatible personal classification', async () => {
    const { service, entries } = setup(FinancialType.DESPESA_OPERACIONAL);
    const row = { ...dto, _id: new Types.ObjectId(), status: FinancialStatus.PENDENTE, version: 0 };
    Object.assign(entries, { findOne: () => ({ lean: () => ({ exec: async () => row }) }) });
    await expect(service.updateEntry(String(row._id), { type: FinancialType.DESPESA_OPERACIONAL }, user)).rejects.toThrow();
  });
  it.each([
    [FinancialType.DESPESA_OPERACIONAL, EntryKind.OPERATING_EXPENSE, FinancialType.DESPESA_PESSOAL, EntryKind.PERSONAL_EXPENSE],
    [FinancialType.DESPESA_PESSOAL, EntryKind.PERSONAL_EXPENSE, FinancialType.DESPESA_OPERACIONAL, EntryKind.OPERATING_EXPENSE],
  ])('changes %s to a compatible type with an explicit classification', async (previousType, previousKind, type, entryKind) => {
    const { service, entries } = setup(type as FinancialType);
    const row = { ...dto, _id: new Types.ObjectId(), type: previousType, entryKind: previousKind, status: FinancialStatus.PENDENTE, version: 0 };
    const update = vi.fn((_filter, changes) => ({ lean: () => ({ exec: async () => ({ ...row, ...changes.$set, version: 1 }) }) }));
    Object.assign(entries, { findOne: () => ({ lean: () => ({ exec: async () => row }) }), findOneAndUpdate: update });
    const result = await service.updateEntry(String(row._id), { type: type as FinancialType, entryKind: entryKind as EntryKind }, user);
    expect(result).toMatchObject({ type, entryKind, version: 1 });
    expect(update.mock.calls[0][1].$push.history).toMatchObject({ before: { type: previousType, entryKind: previousKind }, after: { type, entryKind } });
  });
  it('rejects production details on a personal recurrence before insertion', async () => {
    const { service } = setup();
    await expect(service.createRecurrence({ ...dto, frequency: 'ANUAL', startDate: '2020-01-01', production: { inputName: 'Input' } } as any, user)).rejects.toThrow();
  });
  it('separates expected totals while PF and PJ include every financial type', async () => {
    const rows = [
      { type: FinancialType.DESPESA_OPERACIONAL, expectedAmountCents: 100, paid: 90, origin: FinancialOrigin.PF },
      { type: FinancialType.CUSTO_PRODUCAO, expectedAmountCents: 200, paid: 210, origin: FinancialOrigin.PJ },
      { type: FinancialType.DESPESA_PESSOAL, expectedAmountCents: 300, paid: 320, origin: FinancialOrigin.PJ },
      { type: FinancialType.DESPESA_PESSOAL, expectedAmountCents: 400, paid: 400, origin: FinancialOrigin.PF },
    ].map(row => ({ ...row, categoryId: new Types.ObjectId(), status: FinancialStatus.PAGO, payment: { paidAmountCents: row.paid, origin: row.origin } }));
    const canceled = { ...rows[2], status: FinancialStatus.CANCELADO, expectedAmountCents: 999 };
    const entries = { find: vi.fn(() => ({ select: () => ({ lean: async () => [...rows, canceled] }) })) };
    const categories = { find: vi.fn(() => ({ lean: async () => [] })) };
    const service = new FinanceService({ user }, { scope: async () => tenantId } as any, categories as any, entries as any, {} as any, {} as any);
    const result = await service.summary({ year: 2020, month: 1 });
    expect(result).toMatchObject({ count: 4, canceledCount: 1, expectedCents: 1000, paidCents: 1020, operationalExpensesCents: 100, productionCostsCents: 200, personalExpensesCents: 700, paidPfCents: 490, paidPjCents: 530 });
    expect(result.byCategory.filter((row: any) => row.type === FinancialType.DESPESA_PESSOAL)).toHaveLength(2);
    expect(entries.find).toHaveBeenCalledWith({ tenantId, competence: '2020-01' });
    expect(categories.find).toHaveBeenCalledWith(expect.objectContaining({ tenantId }));
  });
});
