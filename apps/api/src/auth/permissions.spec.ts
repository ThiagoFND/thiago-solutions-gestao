import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { ALL_PERMISSIONS, AUTHORIZED_CAPABILITIES, legacyPermissions, Permissions } from './permissions.js';
import { UserRole } from '../common/enums.js';
import { RoleDto } from '../roles/roles.dto.js';
import { MemberRoleDto } from '../tenants/tenancy.dto.js';
import { CreateProductDto } from '../products/dto/product.dto.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
class Endpoint { @Permissions('produtos.editar') update() {} }
const guard = new RolesGuard(new Reflector(), { record: vi.fn() } as any);
function context(permissions:string[],body:any={},role=UserRole.CASHIER) {
  const req={method:'PATCH',path:'/api/products/123',body,user:{sub:'actor',role,status:'ACTIVE',tenantStatus:'ACTIVE',tenantId:'tenant',permissions}};
  return {req,context:{getHandler:()=>Endpoint.prototype.update,getClass:()=>Endpoint,switchToHttp:()=>({getRequest:()=>req})} as any};
}
describe('permission boundaries',()=>{
  it('member has no implicit capabilities',()=>expect(legacyPermissions(UserRole.MEMBER)).toEqual([]));
  it.each(['CASHIER','KITCHEN','ACCOUNTANT'])('member assignment rejects fixed role %s',async role=>{
    expect((await validate(plainToInstance(MemberRoleDto,{role}),{whitelist:true,forbidNonWhitelisted:true})).length).toBeGreaterThan(0);
  });
  it('member assignment accepts only a custom role reference',async()=>{
    expect(await validate(plainToInstance(MemberRoleDto,{customRoleId:'0123456789abcdef01234567'}),{whitelist:true,forbidNonWhitelisted:true})).toEqual([]);
    expect((await validate(plainToInstance(MemberRoleDto,{customRoleId:'0123456789abcdef01234567',role:'CASHIER'}),{whitelist:true,forbidNonWhitelisted:true})).length).toBeGreaterThan(0);
  });
  it('central catalog contains no duplicates and platform has no enterprise permissions',()=>{expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);expect(legacyPermissions(UserRole.PLATFORM_ADMIN)).toEqual([]);expect(legacyPermissions(UserRole.OWNER)).toEqual(ALL_PERMISSIONS);});
  it('unknown policy is rejected at startup',()=>expect(()=>Permissions('arbitrary.grant')).toThrow());
  it('custom capability authorizes independently of operational template',async()=>{const c=context(['produtos.editar']);expect(await guard.canActivate(c.context)).toBe(true);expect((c.req.user as any)[AUTHORIZED_CAPABILITIES]).toEqual(['produtos.editar']);});
  it('cannot rely on a legacy owner role to override explicit empty capabilities',async()=>{const c=context([],{},UserRole.OWNER);await expect(guard.canActivate(c.context)).rejects.toMatchObject({status:403});});
  it.each([{published:true},{manuallyHidden:false},{featured:true},{supplyMode:'PRODUZIDO_SOB_DEMANDA'},{publicOrder:3},{active:false}])('requires field-specific capability %j',async body=>{await expect(guard.canActivate(context(['produtos.editar'],body).context)).rejects.toMatchObject({status:403});});
  it('platform role is denied even with forged capabilities',async()=>{await expect(guard.canActivate(context(ALL_PERMISSIONS,{},UserRole.PLATFORM_ADMIN).context)).rejects.toMatchObject({status:403});});
  it('role DTO rejects unknown and duplicated permissions and tenant injection',async()=>{const dto=plainToInstance(RoleDto,{name:'Manager',description:'',permissions:['owner','owner'],tenantId:'forged'});const errors=await validate(dto,{whitelist:true,forbidNonWhitelisted:true});expect(errors.map(e=>e.property)).toEqual(expect.arrayContaining(['permissions','tenantId']));});
  it('new product requires category and supply mode and rejects forged stock',async()=>{const errors=await validate(plainToInstance(CreateProductDto,{name:'Service',origin:'PRODUCED',priceCents:100,availableStock:999}),{whitelist:true,forbidNonWhitelisted:true});expect(errors.map(e=>e.property)).toEqual(expect.arrayContaining(['categoryId','supplyMode','availableStock']));});
});
