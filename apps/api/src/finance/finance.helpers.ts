import { BadRequestException } from '@nestjs/common';
import { FinancialFrequency, FinancialStatus } from './finance.enums.js';
import { isFinancialCivilDate } from './schemas/financial-shared.schema.js';

export function todayRecife(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function civilDate(value: string) {
  if (!isFinancialCivilDate(value) || value < '2000-01-01' || value > '2100-12-31') throw new BadRequestException('Informe uma data real entre 2000 e 2100 (AAAA-MM-DD).');
  return value;
}
export function competence(value: string) {
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value)) throw new BadRequestException('Competência inválida (AAAA-MM, 2000 a 2100).');
  return value;
}
export function effectiveStatus(entry: { status: string; dueDate: string }, today = todayRecife()) {
  return entry.status === FinancialStatus.PENDENTE && entry.dueDate < today ? FinancialStatus.VENCIDO : entry.status;
}
export function safeSum(a: number, b: number) {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new BadRequestException('Total monetário excede o limite seguro.');
  return result;
}
export const normalizedName = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function occurrences(recurrence: { startDate: string; frequency: FinancialFrequency; billingDay?: number; installments?: number }, month: string) {
  competence(month);
  const [year, m] = month.split('-').map(Number);
  const [sy, sm, sd] = recurrence.startDate.split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const result: { dueDate: string; occurrenceKey: string; installmentNumber: number }[] = [];
  const add = (day: number, n: number, key = month) => {
    const dueDate = `${month}-${String(day).padStart(2, '0')}`;
    if (dueDate >= recurrence.startDate && n > 0 && (!recurrence.installments || n <= recurrence.installments)) result.push({ dueDate, occurrenceKey: key, installmentNumber: n });
  };
  if (recurrence.frequency === FinancialFrequency.MENSAL) add(Math.min(recurrence.billingDay!, last), (year - sy) * 12 + m - sm + 1);
  else if (recurrence.frequency === FinancialFrequency.ANUAL) { if (m === sm) add(Math.min(sd, last), year - sy + 1); }
  else {
    const start = Date.parse(`${recurrence.startDate}T12:00:00Z`);
    for (let day = 1; day <= last; day++) {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const days = (Date.parse(`${date}T12:00:00Z`) - start) / 86400000;
      if (days >= 0 && days % 7 === 0) add(day, days / 7 + 1, date);
    }
  }
  return result;
}
