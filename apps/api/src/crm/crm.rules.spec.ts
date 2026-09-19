import { describe, expect, it } from 'vitest';
import { opportunityTransition, proposalTotal } from './crm.rules.js';
describe('CRM commercial invariants', () => {
  it('computes integer cents and preserves discounts', () => { expect(proposalTotal([{ quantity: 3, unitCents: 1990 }], 970)).toEqual({ subtotalCents: 5970, discountCents: 970, totalCents: 5000 }); });
  it.each([-1, 5971, 1.2, Number.NaN])('rejects invalid discount %s', discount => expect(() => proposalTotal([{ quantity: 3, unitCents: 1990 }], discount)).toThrow());
  it('rejects overflow and empty proposals', () => { expect(() => proposalTotal([{ quantity: 1_000_000, unitCents: 1e12 }], 0)).toThrow(); expect(() => proposalTotal([], 0)).toThrow(); });
  it('does not change an already closed opportunity', () => { expect(() => opportunityTransition('WON', 'LOST', 'Motivo registrado')).toThrow(); });
  it('requires a meaningful result reason', () => { expect(() => opportunityTransition('OPEN', 'LOST', '  ')).toThrow(); expect(() => opportunityTransition('OPEN', 'WON', 'Cliente aprovou a proposta')).not.toThrow(); });
});
