import { model, Types } from 'mongoose';
import { FinancialEntrySchema } from './financial-entry.schema.js';
import { FinancialCategorySchema } from './financial-category.schema.js';
import { FinancialRecurrenceSchema } from './financial-recurrence.schema.js';
import { EntryKind, FinancialFrequency, FinancialNature, FinancialStatus, FinancialType } from '../finance.enums.js';

const Entry = model('FinancialSchemaTestEntry', FinancialEntrySchema);
const Recurrence = model('FinancialSchemaTestRecurrence', FinancialRecurrenceSchema);
const Category = model('FinancialSchemaTestCategory', FinancialCategorySchema);
const base = () => ({
  tenantId: new Types.ObjectId(),
  description: 'Despesa mensal', categoryId: new Types.ObjectId(), type: FinancialType.DESPESA_OPERACIONAL,
  nature: FinancialNature.FIXA, expectedAmountCents: 12000, createdById: new Types.ObjectId(), createdByName: 'Admin',
});

describe('Despesas pessoais nos schemas financeiros', () => {
  it('aceita categoria, lancamento e recorrencia de despesa pessoal', () => {
    const personal = { ...base(), type: FinancialType.DESPESA_PESSOAL };
    const category = new Category({ tenantId: personal.tenantId, name: 'Pessoal', normalizedName: 'pessoal', type: personal.type });
    const entry = new Entry({ ...personal, entryKind: EntryKind.PERSONAL_EXPENSE, dueDate: '2026-09-16', competence: '2026-09' });
    const recurrence = new Recurrence({ ...personal, frequency: FinancialFrequency.MENSAL, startDate: '2026-09-16', billingDay: 16 });
    expect(category.validateSync()).toBeUndefined();
    expect(entry.validateSync()).toBeUndefined();
    expect(recurrence.validateSync()).toBeUndefined();
    expect(entry.toObject()).toMatchObject({ type: 'DESPESA_PESSOAL', entryKind: 'PERSONAL_EXPENSE' });
  });

  it('continua rejeitando tipos e modalidades desconhecidos', () => {
    const entry = new Entry({ ...base(), type: 'TIPO_INVALIDO', entryKind: 'KIND_INVALIDO', dueDate: '2026-09-16', competence: '2026-09' });
    expect(entry.validateSync()?.errors.type).toBeDefined();
    expect(entry.validateSync()?.errors.entryKind).toBeDefined();
  });
});

describe('Persistência financeira', () => {
  it('aceita centavos inteiros e datas civis reais', () => {
    const entry = new Entry({ ...base(), dueDate: '2028-02-29', competence: '2028-02' });
    expect(entry.validateSync()).toBeUndefined();
    expect(entry.status).toBe(FinancialStatus.PENDENTE);
    expect(entry.version).toBe(0);
  });

  it.each([1.5, 0, -1, 1_000_000_000_001, Number.MAX_SAFE_INTEGER + 1])('rejeita dinheiro inválido %s', (amount) => {
    const entry = new Entry({ ...base(), expectedAmountCents: amount, dueDate: '2026-09-10', competence: '2026-09' });
    expect(entry.validateSync()?.errors.expectedAmountCents).toBeDefined();
  });

  it.each(['2026-02-30', '2026-02-29', '10/09/2026'])('rejeita data inválida %s', (dueDate) => {
    expect(new Entry({ ...base(), dueDate, competence: '2026-09' }).validateSync()?.errors.dueDate).toBeDefined();
  });

  it('não persiste status derivado VENCIDO', () => {
    expect(new Entry({ ...base(), dueDate: '2026-09-10', competence: '2026-09', status: FinancialStatus.VENCIDO }).validateSync()?.errors.status).toBeDefined();
  });

  it('exige dia de cobrança para mensal e limita parcelas', () => {
    const recurrence = new Recurrence({ ...base(), frequency: FinancialFrequency.MENSAL, startDate: '2026-09-10', installments: 601 });
    expect(recurrence.validateSync()?.errors.billingDay).toBeDefined();
    expect(recurrence.validateSync()?.errors.installments).toBeDefined();
    recurrence.billingDay = 10;
    recurrence.installments = 12;
    expect(recurrence.validateSync()).toBeUndefined();
  });

  it('declara unicidade parcial de ocorrência e de seed estável', () => {
    const occurrence = FinancialEntrySchema.indexes().find(([keys]) => keys.recurrenceId === 1);
    expect(occurrence?.[1]).toMatchObject({ unique: true, partialFilterExpression: { recurrenceId: { $type: 'objectId' }, occurrenceKey: { $type: 'string' } } });
    expect(FinancialCategorySchema.indexes().find(([keys]) => keys.seedKey === 1)?.[1]).toMatchObject({ unique: true, partialFilterExpression: { seedKey: { $type: 'string' } } });
  });
});
