import { describe, expect, it, vi } from 'vitest';
import { ProductionsService } from './productions.service.js';

describe('ProductionsService', () => {
  it('salva o histórico e incrementa o saldo sem alterar o registro produzido', async () => {
    const product = { _id: '507f1f77bcf86cd799439011', id: '507f1f77bcf86cd799439011', name: 'Esfiha', origin: 'PRODUCED', active: true };
    const production = { id: 'prod-1', productName: 'Esfiha', quantity: 100 };
    const productModel = { findOneAndUpdate: vi.fn().mockResolvedValue({ ...product, availableStock: 100 }) };
    const products = { get: vi.fn().mockResolvedValue(product), modelRef: () => productModel };
    const productionModel = { create: vi.fn().mockResolvedValue(production) };
    const movementModel = { create: vi.fn().mockResolvedValue({}) };
    const events = { emitProduction: vi.fn(), emitStock: vi.fn() };
    const config = { get: vi.fn().mockReturnValue('-03:00') };
    const service = new ProductionsService({scope: async () => '507f1f77bcf86cd799439020'} as any, productionModel as never, movementModel as never, products as never, events as never, config as never, {has:async()=>true} as any);

    const result = await service.create(
      { productId: product.id, quantity: 100 },
      { sub: '507f1f77bcf86cd799439012', name: 'Cozinha', email: 'cozinha@loja.local', role: 'KITCHEN' as never },
    );

    expect(result.quantity).toBe(100);
    expect(productionModel.create).toHaveBeenCalledWith(expect.objectContaining({ quantity: 100 }));
    expect(productModel.findOneAndUpdate).toHaveBeenCalledWith({ tenantId: '507f1f77bcf86cd799439020', _id: product.id, origin: 'PRODUCED', active: true, availableStock: { $lte: 999900 } }, { $inc: { availableStock: 100 } }, { new: true });
    expect(events.emitProduction).toHaveBeenCalledWith(production);
  });
});
