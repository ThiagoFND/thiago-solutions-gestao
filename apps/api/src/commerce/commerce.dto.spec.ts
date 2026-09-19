import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { AdminQuoteDto, AssignDto, DiscountDto, OfferDto, QuoteDto, SubscriptionRequestDto } from './commerce.dto.js';
import { MODULE_CODES } from './commerce.domain.js';

const quote = { modules: [...MODULE_CODES], cycle: 'MONTHLY' };
const reason = 'Regressão do catálogo de módulos';
const cases = [
  [QuoteDto, quote],
  [AdminQuoteDto, quote],
  [AssignDto, { ...quote, version: 0, status: 'ACTIVE', startsAt: '2026-09-18', endsAt: '2026-10-18', nextDueAt: '2026-10-22', reason }],
  [SubscriptionRequestDto, { ...quote, kind: 'CHANGE', note: reason }],
  [OfferDto, { code: 'ALL_MODULES', kind: 'PLAN', name: 'Todos os módulos', description: '', monthlyCents: 1000, currency: 'BRL', modules: [...MODULE_CODES], active: true, available: true, featured: false, order: 0, limits: { activeUsers: 1, products: 0, categories: 0, storageBytes: 0, landingPages: 0 }, version: 0, reason }],
  [DiscountDto, { code: 'ALL_MODULES', name: 'Todos os módulos', kind: 'PERCENT', value: 1000, scope: 'MODULE', modules: [...MODULE_CODES], plans: [], startsAt: '2026-09-18', combinable: false, active: true, version: 0, reason }],
] as const;

describe('Canonical modules in commercial DTOs without persistence', () => {
  for (const [Dto, payload] of cases) {
    const errors = (value: object) => validateSync(plainToInstance(Dto as new () => object, value));
    it(`${Dto.name} accepts all permitted modules`, () => {
      expect(MODULE_CODES).toEqual(expect.arrayContaining(['CRM','SERVICE_ORDERS','CONTRACTS','LOYALTY']));
      expect(new Set(MODULE_CODES).size).toBe(MODULE_CODES.length);
      expect(errors(payload)).toEqual([]);
    });
    it(`${Dto.name} rejects an unknown module`, () => {
      expect(errors({ ...payload, modules: ['UNKNOWN_MODULE'] }).find(error => error.property === 'modules')?.constraints).toHaveProperty('isIn');
    });
    it(`${Dto.name} rejects a list exceeding the canonical count`, () => {
      expect(errors({ ...payload, modules: [...MODULE_CODES, 'SALES'] }).find(error => error.property === 'modules')?.constraints).toHaveProperty('arrayMaxSize');
    });
  }
});
