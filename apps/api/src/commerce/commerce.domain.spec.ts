import { describe, expect, it } from 'vitest';
import { calculateQuote, cents, effectivePermissions, permittedSubscription, percentage, type Promotion } from './commerce.domain.js';
import { suggestedOffers } from './commerce.defaults.js';
const at = '2026-09-18T12:00:00.000Z';
const quote = (overrides: Partial<Parameters<typeof calculateQuote>[0]> = {}) => calculateQuote({ offers: suggestedOffers(), modules: ['SALES', 'INVENTORY', 'EXPENSES'], cycle: 'MONTHLY', promotions: [], at, installment: 1, ...overrides });
const promo = (overrides: Partial<Promotion> = {}): Promotion => ({ code: 'FOUNDER', name: 'Fundador', kind: 'PERCENT', value: 2000, scope: 'SUBTOTAL', modules: [], plans: [], startsAt: '2026-01-01T00:00:00Z', maxCycles: 12, combinable: false, active: true, ...overrides });
describe('Commercial calculation without persistence', () => {
  it('adds base and independent modules using integer cents', () => { const q = quote(); expect(q.subtotalCents).toBe(15960); expect(q.dependenciesAdded).toEqual([]); });
  it('uses the configured base alone', () => expect(quote({ modules: [] }).totalCents).toBe(4990));
  it('deduplicates choices without charging another module', () => expect(quote({ modules: ['SALES', 'SALES'] }).totalCents).toBe(8980));
  it('uses a closed package price, not its sum', () => { const q = quote({ planCode: 'OPERATIONAL', modules: [] }); expect(q.totalCents).toBe(13990); expect(q.limits.activeUsers).toBe(8); });
  it('rejects ambiguous additions to a closed package', () => expect(() => quote({ planCode: 'BASIC' })).toThrow());
  it('calculates the requested founder example and its post-promotion value', () => { const q = quote({ promotions: [promo()] }); expect(q.discountCents).toBe(3192); expect(q.totalCents).toBe(12768); expect(q.afterPromotionCents).toBe(15960); });
  it('stops applying after the configured number of installments', () => expect(quote({ promotions: [promo()], installment: 13 }).totalCents).toBe(15960));
  it('makes the first month free without a negative total', () => expect(quote({ promotions: [promo({ kind: 'FREE', value: 0, maxCycles: 1 })] }).totalCents).toBe(0));
  it('rejects fixed discounts above the eligible subtotal', () => { const q = quote({ promotions: [promo({ kind: 'FIXED', value: 999999 })] }); expect(q.totalCents).toBe(15960); expect(q.rejected).toHaveLength(1); });
  it('targets only the specified module', () => { const q = quote({ promotions: [promo({ scope: 'MODULE', modules: ['SALES'], kind: 'FIXED', value: 990 })] }); expect(q.totalCents).toBe(14970); expect(q.items[0].discountCents).toBe(0); });
  it('rejects module discounts on an unsplit package instead of inventing a module price', () => expect(quote({ modules: [], planCode: 'BASIC', promotions: [promo({ scope: 'MODULE', modules: ['SALES'] })] }).rejected).toHaveLength(1));
  it('does not stack by default and sorts by code deterministically', () => { const a = promo({ code: 'A' }), b = promo({ code: 'B' }); expect(quote({ promotions: [a, b] })).toEqual(quote({ promotions: [b, a] })); expect(quote({ promotions: [a, b] }).applied).toHaveLength(1); });
  it('stacks only with explicit agreement on both discounts', () => expect(quote({ promotions: [promo({ code: 'A', combinable: true }), promo({ code: 'B', combinable: true })] }).applied).toHaveLength(2));
  it.each([
    { active: false }, { endsAt: at }, { startsAt: '2027-01-01T00:00:00Z' }, { tenantId: 'other' }, { plans: ['BASIC'] }, { cycle: 'ANNUAL' as const },
  ])('rejects ineligible promotion %j', override => expect(quote({ promotions: [promo(override)] }).rejected).toHaveLength(1));
  it('charges an annual configured price', () => { const offers = suggestedOffers(); offers[0].annualCents = 49900; expect(quote({ offers, modules: [], cycle: 'ANNUAL' }).totalCents).toBe(49900); });
  it('falls back to twelve months for annual cycles without an annual price', () => expect(quote({ modules: [], cycle: 'ANNUAL' }).totalCents).toBe(59880));
  it('preserves an already calculated snapshot when catalog records change', () => { const offers = suggestedOffers(), before = quote({ offers }); offers[0].monthlyCents = 10000; expect(before.items[0].unitCents).toBe(4990); expect(quote({ offers }).totalCents).not.toBe(before.totalCents); });
  it('rejects inactive or unavailable offers', () => { const offers = suggestedOffers(); offers[0].available = false; expect(() => quote({ offers })).toThrow(); });
  it('allocates discount cents exactly', () => { const q = quote({ promotions: [promo({ value: 3333 })] }); expect(q.items.reduce((s, i) => s + i.discountCents, 0)).toBe(q.discountCents); expect(q.items.every(i => i.totalCents >= 0)).toBe(true); });
  it('rounds half up with integer arithmetic', () => { expect(percentage(1, 5000)).toBe(1); expect(percentage(1, 4999)).toBe(0); expect(percentage(1_000_000_000_000, 10000)).toBe(1_000_000_000_000); });
  it.each([-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER])('rejects invalid cents %s', value => expect(() => cents(value)).toThrow());
});
describe('Subscription access policy', () => {
  const state = { startsAt: '2026-09-01', endsAt: '2026-10-01' };
  it.each(['ACTIVE', 'TRIAL', 'CANCELED'] as const)('%s permits only its contracted period', status => { expect(permittedSubscription({ ...state, status }, new Date(at))).toBe(true); expect(permittedSubscription({ ...state, status }, new Date(state.endsAt))).toBe(false); });
  it.each(['SUSPENDED', 'EXPIRED'] as const)('%s is denied', status => expect(permittedSubscription({ ...state, status }, new Date(at))).toBe(false));
  it.each(['PENDING_PAYMENT', 'PAST_DUE'] as const)('%s requires explicit live grace', status => { expect(permittedSubscription({ ...state, status }, new Date(at))).toBe(false); expect(permittedSubscription({ ...state, status, graceUntil: '2026-09-19' }, new Date(at))).toBe(true); });
  it('does not activate a future subscription', () => expect(permittedSubscription({ ...state, status: 'ACTIVE', startsAt: '2026-10-01' }, new Date(at))).toBe(false));
  it('keeps base permissions and masks only modules not contracted', () => expect(effectivePermissions(['produtos.criar', 'cargos.criar', 'vendas.criar', 'financeiro.visualizar'], ['SALES'])).toEqual(['produtos.criar', 'cargos.criar', 'vendas.criar']));
});
