import { describe, expect, it } from 'vitest';
import { balancedTotal } from './accounting.rules.js';
describe('Double entry bookkeeping',()=>{
 it('accepts split balanced entries in integer cents',()=>expect(balancedTotal([{debitCents:100,creditCents:0},{debitCents:0,creditCents:60},{debitCents:0,creditCents:40}])).toBe(100));
 it.each([
  [{debitCents:100,creditCents:0},{debitCents:0,creditCents:99}],
  [{debitCents:0,creditCents:0},{debitCents:0,creditCents:0}],
  [{debitCents:100,creditCents:100},{debitCents:0,creditCents:0}],
  [{debitCents:0.1,creditCents:0},{debitCents:0,creditCents:0.1}],
  [{debitCents:-1,creditCents:0},{debitCents:0,creditCents:-1}],
 ])('rejects unbalanced or invalid lines %j',lines=>expect(()=>balancedTotal(lines)).toThrow());
});
