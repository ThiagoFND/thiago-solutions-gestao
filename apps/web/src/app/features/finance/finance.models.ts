export interface Page<T> { items: T[]; total: number; page: number; limit: number; totalPages: number }
export interface Category { _id: string; name: string; type: string; active: boolean }
export interface Production { productId?: string; inputName?: string; quantity?: number; unit?: string; unitAmountCents?: number; totalAmountCents?: number }
export interface Payment { paidAmountCents: number; paidOn: string; origin: string; method: string; notes?: string; registeredAt: string; registeredByName: string; correctedAt?: string; correctedByName?: string }
export interface Entry { _id: string; entryKind?: 'INPUT_PURCHASE' | 'PRODUCTION_COST' | 'OPERATING_EXPENSE' | 'PERSONAL_EXPENSE' | 'RECURRING'; description: string; categoryId: string; type: string; nature: string; expectedAmountCents: number; dueDate: string; competence: string; status: string; version: number; supplier?: string; notes?: string; production?: Production; payment?: Payment; differenceCents?: number; recurring: boolean; installmentNumber?: number; createdAt: string; createdByName: string }
export interface Recurrence extends Omit<Entry, 'dueDate' | 'competence' | 'status' | 'recurring' | 'payment' | 'differenceCents' | 'installmentNumber'> { frequency: string; startDate: string; billingDay?: number; installments?: number; active: boolean }
export interface History { _id: string; action: string; occurredAt: string; userName: string; reason?: string; before: unknown; after: unknown }
export interface CategoryTotal { categoryId: string; categoryName: string; type: string; count: number; expectedCents: number; paidCents: number; pendingCents: number; overdueCents: number }
export interface Summary { competence: string; count: number; canceledCount: number; expectedCents: number; paidCents: number; pendingCents: number; overdueCents: number; productionCostsCents: number; operationalExpensesCents: number; personalExpensesCents: number; paidPfCents: number; paidPjCents: number; byCategory: CategoryTotal[] }
export function moneyInput(value: string): number {
  const text = String(value).trim();
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(text)) throw new Error('Informe o valor sem separador de milhar, com no máximo duas casas decimais.');
  const [whole, fraction = ''] = text.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 1e12) throw new Error('O valor deve ser positivo e até R$ 10 bilhões.');
  return cents;
}
export function today(): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
