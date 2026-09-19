import { describe, expect, it } from 'vitest';
import { effectivePermissions } from './commerce.domain.js';
describe('shared core scoped to purchased functionality',()=>{
 const permissions=['produtos.visualizar','categorias.visualizar','cadastros.visualizar','usuarios.visualizar','cargos.editar','vendas.visualizar','contratos.visualizar','fidelidade.resgatar'];
 it('showcase exposes catalog but not contact operations',()=>expect(effectivePermissions(permissions,['LANDING_PAGE'])).toEqual(['produtos.visualizar','categorias.visualizar','usuarios.visualizar','cargos.editar']));
 it('standalone expenses exposes contacts without physical catalog or sales',()=>expect(effectivePermissions(permissions,['EXPENSES'])).toEqual(['cadastros.visualizar','usuarios.visualizar','cargos.editar']));
 it('contracts and loyalty do not grant sales or physical catalog',()=>expect(effectivePermissions(permissions,['CONTRACTS','LOYALTY'])).toEqual(['cadastros.visualizar','usuarios.visualizar','cargos.editar','contratos.visualizar','fidelidade.resgatar']));
 it('inventory includes its own central products categories and suppliers',()=>expect(effectivePermissions(permissions,['INVENTORY'])).toEqual(['produtos.visualizar','categorias.visualizar','cadastros.visualizar','usuarios.visualizar','cargos.editar']));
});
