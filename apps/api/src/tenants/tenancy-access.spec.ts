import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { TenantAccessService } from './tenant-access.service.js';
import { TenantStatus, UserStatus, UserRole } from '../common/enums.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MemberRoleDto, OnboardingDto } from './tenancy.dto.js';
const tenantId = new Types.ObjectId().toString();
const actor = { sub: new Types.ObjectId().toString(), name: 'QA', email: 'qa@example.invalid', role: UserRole.OWNER, status: UserStatus.ACTIVE, tenantId, tenantStatus: TenantStatus.ACTIVE, sessionVersion: 1, tenantVersion: 2 };
const context = (user: any, klass: any) => ({ getClass: () => klass, getHandler: () => () => {}, switchToHttp: () => ({ getRequest: () => ({ user, path: '/api/products' }) }) }) as any;
describe('tenant session and authorization', () => {
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.CASHIER) class Operations {}
  @Roles(UserRole.PLATFORM_ADMIN) class Platform {}
  for (const role of Object.values(UserRole)) it(`checks ${role} in both domains without bypass`, async () => {
    const guard = new RolesGuard(new Reflector(), { record: vi.fn() } as any);
    const user = { ...actor, role, tenantId: role === UserRole.PLATFORM_ADMIN ? null : tenantId };
    if ([UserRole.OWNER, UserRole.ADMIN, UserRole.CASHIER].includes(role)) await expect(guard.canActivate(context(user, Operations))).resolves.toBe(true);
    else await expect(guard.canActivate(context(user, Operations))).rejects.toMatchObject({ status: 403 });
    if (role === UserRole.PLATFORM_ADMIN) await expect(guard.canActivate(context(user, Platform))).resolves.toBe(true);
    else await expect(guard.canActivate(context(user, Platform))).rejects.toMatchObject({ status: 403 });
  });
  it.each(Object.values(TenantStatus).filter(s => s !== TenantStatus.ACTIVE))('blocks company status %s', async status => {
    await expect(new RolesGuard(new Reflector(), { record: vi.fn() } as any).canActivate(context({ ...actor, tenantStatus: status }, Operations))).rejects.toMatchObject({ status: 403 });
  });
  it.each(Object.values(UserStatus).filter(s => s !== UserStatus.ACTIVE))('blocks user status %s', async status => {
    await expect(new RolesGuard(new Reflector(), { record: vi.fn() } as any).canActivate(context({ ...actor, status }, Operations))).rejects.toMatchObject({ status: 403 });
  });
  it('revalidates tenant and both session versions', async () => {
    const access = new TenantAccessService({} as any, {} as any, {} as any, {} as any);
    vi.spyOn(access, 'identity').mockResolvedValue(actor);
    for (const stale of [{ tenantId: new Types.ObjectId().toString() }, { sessionVersion: 0 }, { tenantVersion: 1 }]) await expect(access.check({ ...actor, ...stale }, [UserRole.OWNER])).rejects.toMatchObject({ status: 401 });
    await expect(access.scope(actor, [UserRole.OWNER])).resolves.toEqual(new Types.ObjectId(tenantId));
  });
  it('standalone refuses transaction before invoking any write callback', async () => {
    const work = vi.fn(), transaction = vi.fn();
    const access = new TenantAccessService({} as any, {} as any, { db: { admin: () => ({ command: async () => ({ ok: 1 }) }) }, transaction } as any, {} as any);
    await expect(access.transaction(work)).rejects.toMatchObject({ status: 503 });
    expect(work).not.toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled();
  });
  it.each([undefined, null, 'OWNER', 'ADMIN', 'PLATFORM_ADMIN'])('requires explicit operational approval role %s', async role => {
    expect((await validate(plainToInstance(MemberRoleDto, { role }))).length).toBeGreaterThan(0);
  });
  it('requires nested company and owner objects', async () => {
    expect((await validate(plainToInstance(OnboardingDto, { company: null, owner: null }))).length).toBe(2);
  });
});
