import { describe, expect, it } from 'vitest';
import { permissionPreview } from './permission-preview.js';
describe('Permission comparison in proposals', () => {
  const configured=['produtos.visualizar','vendas.criar','tesouraria.visualizar'];
  it('first contract starts with no current access and adds base and selected modules',()=>{
    const p=permissionPreview(configured,[],['SALES']);expect(p.currentCount).toBe(0);expect(p.addedCount).toBe(2);expect(p.permissions.map(p=>p.key)).toEqual(['produtos.visualizar','vendas.criar']);
  });
  it('shows upgrades and retained permissions',()=>{
    const p=permissionPreview(configured,['produtos.visualizar','vendas.criar'],['SALES','FINANCE']);expect(p.addedCount).toBe(1);expect(p.keptCount).toBe(2);expect(p.removedCount).toBe(0);
  });
  it('shows loss on downgrade without changing the current list',()=>{
    const current=[...configured];const p=permissionPreview(configured,current,['SALES']);expect(p.removedCount).toBe(1);expect(current).toEqual(configured);
  });
  it('never grants permissions outside the configured role',()=>expect(permissionPreview(['produtos.visualizar'],[],['SALES']).proposedCount).toBe(1));
  it('expenses does not grant treasury permissions',()=>expect(permissionPreview(configured,configured,['SALES','EXPENSES']).removedCount).toBe(1));
});
