import 'reflect-metadata';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { UsersService } from '../users/users.service.js';
import { TenancyService } from './tenancy.service.js';
import { UserSchema } from '../users/user.schema.js';
import { CpfCrypto } from '../common/cpf-crypto.js';
import { UserRole, UserStatus, TenantStatus } from '../common/enums.js';
import { legacyPermissions } from '../auth/permissions.js';
const User = model('MembershipRules',UserSchema);
describe('membership business rules with real document validation (unit, not transaction evidence)',()=>{
 let access:any,audit:any,service:UsersService,user:any,save:any;
 const tenantId=new Types.ObjectId(),actor={sub:new Types.ObjectId().toString(),tenantId:String(tenantId),name:'Owner',email:'owner@example.invalid',role:UserRole.OWNER,status:UserStatus.ACTIVE,tenantStatus:TenantStatus.ACTIVE,permissions:legacyPermissions(UserRole.OWNER)};
 beforeEach(()=>{
  vi.stubEnv('CPF_ENCRYPTION_KEY',randomBytes(32).toString('base64'));vi.stubEnv('CPF_HASH_KEY',randomBytes(32).toString('base64'));
  user=new User({tenantId,name:'Requested',email:'requested@example.invalid',passwordHash:'$2b$12$'+'a'.repeat(53),role:null,status:'PENDING',...new CpfCrypto().protect('52998224725',String(tenantId))});
  save=vi.spyOn(user,'save').mockImplementation(async()=>{await user.validate();return user;});
  access={checkCapacity:vi.fn(async()=>undefined),transaction:async(fn:any)=>fn({testSession:true}),check:async()=>actor,tenants:{findOneAndUpdate:vi.fn(async()=>({_id:tenantId}))},users:{findOne:()=>({select:()=>({session:async()=>user})}),countDocuments:vi.fn(()=>({session:async()=>0}))}};
  audit={record:vi.fn()};service=new UsersService(access,audit);
 });
 afterEach(()=>vi.unstubAllEnvs());
 it('approves only explicit operational role, preserves encrypted CPF, revokes and audits',async()=>{
  const result=await service.change(actor,user.id,'approve','CASHIER');expect(result.role).toBe('CASHIER');expect(result.status).toBe('ACTIVE');expect(result.cpfMasked).toBe('***.***.***-25');expect(user.sessionVersion).toBe(1);expect(user.active).toBe(true);expect(result).not.toHaveProperty('cpfEncrypted');expect(audit.record).toHaveBeenCalledWith('member.approve','success',actor,'users',user.id,undefined,{testSession:true},undefined,expect.objectContaining({before:expect.objectContaining({status:'PENDING'}),after:expect.objectContaining({status:'ACTIVE'})}));
 });
 it.each(['OWNER','ADMIN','PLATFORM_ADMIN',undefined])('refuses implicit or privileged approval %s',async role=>{await expect(service.change(actor,user.id,'approve',role)).rejects.toMatchObject({status:409});expect(save).not.toHaveBeenCalled();});
 it('rejects pending member without granting a role',async()=>{const result=await service.change(actor,user.id,'reject','Not approved');expect(result).toMatchObject({status:'REJECTED',role:null,rejectionReason:'Not approved'});expect(user.sessionVersion).toBe(1);});
 it('cannot activate PENDING using status endpoint',async()=>{await expect(service.change(actor,user.id,'status','ACTIVE')).rejects.toMatchObject({status:409});expect(save).not.toHaveBeenCalled();});
 it.each([['role','CASHIER'],['status','INACTIVE']])('protects the last active OWNER %s',async(action,value)=>{user.status='ACTIVE';user.role='OWNER';await expect(service.change(actor,user.id,action as any,value)).rejects.toMatchObject({status:409});expect(save).not.toHaveBeenCalled();});
 it('OWNER cannot change self even with another owner',async()=>{access.users.countDocuments.mockReturnValue({session:async()=>1});await expect(service.change(actor,actor.sub,'role','CASHIER')).rejects.toMatchObject({status:403});expect(audit.record).toHaveBeenCalledWith('profile.update','denied',actor,'users',actor.sub);expect(save).not.toHaveBeenCalled();});
 it('allows removing owner privileges only if another active owner remains',async()=>{user.status='ACTIVE';user.role='OWNER';access.users.countDocuments.mockReturnValue({session:async()=>1});await expect(service.change(actor,user.id,'role','ACCOUNTANT')).resolves.toMatchObject({role:'ACCOUNTANT'});});
 it('inactivation and role change revoke sessions',async()=>{user.status='ACTIVE';user.role='CASHIER';await service.change(actor,user.id,'status','INACTIVE');expect(user.active).toBe(false);expect(user.sessionVersion).toBe(1);await service.change(actor,user.id,'role','KITCHEN');expect(user.sessionVersion).toBe(2);await service.change(actor,user.id,'status','ACTIVE');expect(user.active).toBe(true);expect(user.sessionVersion).toBe(3);});
 it.each(['approved','rejected','suspended','reactivated'])('company decision %s shares session and increments tenant version',async action=>{
  const session={testSession:true},platform={...actor,tenantId:null,role:UserRole.PLATFORM_ADMIN};
  access.transaction=async(fn:any)=>fn(session);access.check=vi.fn(async()=>platform);access.tenants.findOneAndUpdate.mockResolvedValue({_id:tenantId,ownerId:new Types.ObjectId()});access.users.updateOne=vi.fn(async()=>({modifiedCount:1}));
  await new TenancyService(access,audit).decide(platform,String(tenantId),action as any,'QA decision');
  const update=access.tenants.findOneAndUpdate.mock.calls[0][1];expect(update.$inc.sessionVersion).toBe(1);expect(update.$push.decisionHistory.action).toBe(action);expect(access.tenants.findOneAndUpdate.mock.calls[0][2].session).toBe(session);expect(audit.record.mock.calls[0][6]).toBe(session);
 });
});
