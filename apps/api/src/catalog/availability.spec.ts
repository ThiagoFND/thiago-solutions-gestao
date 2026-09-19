import { describe, expect, it } from 'vitest';
import { publicAvailability, supplyOf } from './availability.js';
import { AvailabilityMode, SupplyMode } from '../common/enums.js';
const category = { active: true, published: true };
const product = { active: true, published: true, manuallyHidden: false, availableStock: 0, supplyMode: SupplyMode.CONTROLADO_POR_ESTOQUE };
describe('public availability contract', () => {
  it('shows zero stock unavailable and supports hiding it', () => {
    expect(publicAvailability(true, true, category, product)).toEqual({ visible: true, available: false, onDemand: false });
    expect(publicAvailability(true, true, category, product, true).visible).toBe(false);
  });
  it('restores availability when stock returns without changing flags', () => {
    expect(publicAvailability(true, true, category, { ...product, availableStock: 2 }).available).toBe(true);
    expect(product.published).toBe(true);
  });
  for (const supplyMode of [SupplyMode.PRODUZIDO_SOB_DEMANDA, SupplyMode.COMPRADO_SOB_DEMANDA]) {
    it(`${supplyMode} does not require stock and manual hide is reversible`, () => {
      const demand = { ...product, supplyMode, availableStock: -10 };
      expect(publicAvailability(true, true, category, demand, true).available).toBe(true);
      expect(publicAvailability(true, true, category, { ...demand, manuallyHidden: true }).visible).toBe(false);
      expect(publicAvailability(true, true, category, demand).available).toBe(true);
    });
  }
  it.each([
    [false, true, category, product], [true, false, category, product],
    [true, true, { ...category, active: false }, product], [true, true, { ...category, published: false }, product],
    [true, true, { ...category, archived: true }, product], [true, true, undefined, product],
    [true, true, category, { ...product, active: false }], [true, true, category, { ...product, published: false }],
  ] as const)('requires every publication boundary %#', (company, published, cat, p) => {
    expect(publicAvailability(company, published, cat, p).visible).toBe(false);
  });
  it('reads legacy demand without a migration', () => expect(supplyOf({ availabilityMode: AvailabilityMode.MADE_TO_ORDER })).toBe(SupplyMode.PRODUZIDO_SOB_DEMANDA));
});
