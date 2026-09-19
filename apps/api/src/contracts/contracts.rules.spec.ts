import { describe, expect, it } from 'vitest';
import { civilDate, cycleDate } from './contracts.rules.js';
describe('civil contract recurrence',()=>{
  it('clamps day 31 in common February',()=>expect(cycleDate('2026-01-01','2027-12-31',1,31,'2027-02')).toBe('2027-02-28'));
  it('clamps day 31 in leap February',()=>expect(cycleDate('2026-01-01','2028-12-31',1,31,'2028-02')).toBe('2028-02-29'));
  it('retains day in long months',()=>expect(cycleDate('2026-01-01','2027-12-31',1,31,'2027-03')).toBe('2027-03-31'));
  it('rejects impossible civil dates',()=>expect(()=>civilDate('2026-02-30')).toThrow());
  it('rejects cycle before contract',()=>expect(()=>cycleDate('2026-09-01','2027-12-31',1,10,'2026-08')).toThrow());
  it('rejects due after end',()=>expect(()=>cycleDate('2026-09-01','2027-02-10',1,31,'2027-02')).toThrow());
  it('rejects wrong quarter',()=>expect(()=>cycleDate('2026-09-01','2027-12-31',3,10,'2026-10')).toThrow());
  it('accepts next quarter across year',()=>expect(cycleDate('2026-11-01','2027-12-31',3,10,'2027-02')).toBe('2027-02-10'));
  it('rejects fractional and unsupported cadence',()=>expect(()=>cycleDate('2026-09-01','2027-12-31',2,10,'2026-11')).toThrow());
  it('does not invent initial pro rata billing',()=>expect(()=>cycleDate('2026-09-18','2027-12-31',1,10,'2026-09')).toThrow());
});
