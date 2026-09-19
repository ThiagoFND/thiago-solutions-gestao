import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntitlementsService } from './entitlements.service.js';

describe('Mandatory subscription access', () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each(['false', 'true', undefined])('does not let rollout configuration %s bypass subscription checks', flag => {
    vi.stubEnv('COMMERCIAL_ENTITLEMENTS_ENABLED', flag);
    expect(new EntitlementsService({} as never).enabled).toBe(true);
  });
  it('masks base permissions as well as paid permissions without a valid contract', async () => {
    const service = new EntitlementsService({} as never);
    vi.spyOn(service, 'resolve').mockResolvedValue({ allowed: false, status: 'NOT_CONTRACTED', modules: [], version: 0 });
    expect(await service.filter('tenant', ['produtos.criar', 'usuarios.visualizar', 'vendas.criar'])).toEqual([]);
  });
  it('a valid contract restores only base and purchased modules', async () => {
    const service = new EntitlementsService({} as never);
    vi.spyOn(service, 'resolve').mockResolvedValue({ allowed: true, status: 'ACTIVE', modules: ['SALES'], version: 1 });
    expect(await service.filter('tenant', ['produtos.criar', 'vendas.criar', 'financeiro.visualizar'])).toEqual(['produtos.criar', 'vendas.criar']);
  });
});
