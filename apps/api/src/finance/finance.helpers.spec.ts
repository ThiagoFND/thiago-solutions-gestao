import { describe, expect, it } from 'vitest';
import { civilDate, competence, effectiveStatus, occurrences, safeSum, todayRecife } from './finance.helpers.js';
import { FinancialFrequency as Frequency, FinancialStatus as Status } from './finance.enums.js';

describe('regras financeiras de calendário e valores', () => {
  it('valida calendário real e competência', () => {
    expect(civilDate('2024-02-29')).toBe('2024-02-29');
    for (const value of ['2026-02-30', '2026-02-29', '2026-13-01']) expect(() => civilDate(value)).toThrow();
    expect(() => competence('2026-13')).toThrow();
  });
  it('calcula hoje em Recife e preserva estados terminais', () => {
    expect(todayRecife(new Date('2026-09-13T01:00:00Z'))).toBe('2026-09-12');
    expect(effectiveStatus({ status: Status.PENDENTE, dueDate: '2026-09-12' }, '2026-09-12')).toBe(Status.PENDENTE);
    expect(effectiveStatus({ status: Status.PENDENTE, dueDate: '2026-09-11' }, '2026-09-12')).toBe(Status.VENCIDO);
    for (const status of [Status.PAGO, Status.CANCELADO]) expect(effectiveStatus({ status, dueDate: '2020-01-01' })).toBe(status);
  });
  it('preserva dia 31 após fevereiro e limita parcelas', () => {
    const recurrence = { startDate: '2026-01-31', billingDay: 31, frequency: Frequency.MENSAL, installments: 3 };
    expect(occurrences(recurrence, '2026-02')[0].dueDate).toBe('2026-02-28');
    expect(occurrences(recurrence, '2026-03')[0].dueDate).toBe('2026-03-31');
    expect(occurrences(recurrence, '2026-04')).toEqual([]);
    expect(occurrences(recurrence, '2025-12')).toEqual([]);
  });
  it('gera semanas individuais e aniversário bissexto', () => {
    const weeks = occurrences({ startDate: '2026-01-01', frequency: Frequency.SEMANAL }, '2026-01');
    expect(weeks).toHaveLength(5);
    expect(new Set(weeks.map(row => row.occurrenceKey)).size).toBe(5);
    expect(occurrences({ startDate: '2024-02-29', frequency: Frequency.ANUAL }, '2025-02')[0]).toEqual({ dueDate: '2025-02-28', occurrenceKey: '2025-02', installmentNumber: 2 });
  });
  it('rejeita totais que perderiam precisão', () => {
    expect(safeSum(100, 101)).toBe(201);
    expect(() => safeSum(Number.MAX_SAFE_INTEGER, 1)).toThrow();
  });
});
