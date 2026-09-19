import { Injectable, ForbiddenException, UnauthorizedException, ServiceUnavailableException, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Connection, ClientSession } from 'mongoose';
import { Tenant } from './tenant.schema.js';
import { User } from '../users/user.schema.js';
import { AuthUser } from '../common/auth-user.js';
import { TenantStatus, UserRole, UserStatus } from '../common/enums.js';
import { AUTHORIZED_CAPABILITIES, legacyPermissions, supportedPermissions } from '../auth/permissions.js';
import { CustomRole } from '../roles/custom-role.schema.js';
import { EntitlementsService } from '../commerce/entitlements.service.js';
import { effectivePermissions } from '../commerce/commerce.domain.js';
export const OWNERS = [UserRole.OWNER, UserRole.ADMIN];
@Injectable()
export class TenantAccessService implements OnModuleInit {
  constructor(@InjectModel(Tenant.name) readonly tenants: Model<Tenant>, @InjectModel(User.name) readonly users: Model<User>, @InjectConnection() readonly connection: Connection, private readonly entitlements: EntitlementsService) {}
  async onModuleInit() {
    if (process.env.TENANCY_V2_ENABLED !== 'true') throw new Error('TENANCY_V2_ENABLED must explicitly enable the provisioned v2 storage');
    if (process.env.NODE_ENV === 'production' && process.env.TENANCY_NEW_INSTALLATION !== 'true' && !await this.connection.collection('tenancy_migrations_v2').findOne({ completed: true })) throw new Error('A completed migration or explicit new installation is required');
  }
  async identity(id: string, session?: ClientSession): Promise<AuthUser & { sessionVersion: number; tenantVersion: number }> {
    const user = await this.users.findById(id).select('+sessionVersion').session(session ?? null);
    if (!user || ![UserStatus.ACTIVE, UserStatus.PENDING].includes(user.status)) throw new UnauthorizedException('Sessão inválida');
    if (user.role === UserRole.PLATFORM_ADMIN) {
      if (user.tenantId != null || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('Sessão inválida');
      return { sub: user.id, name: user.name, email: user.email, role: user.role, status: user.status, tenantId: null, tenantStatus: null, sessionVersion: user.sessionVersion, tenantVersion: 0 };
    }
    if (!user.tenantId) throw new UnauthorizedException('Sessão inválida');
    const tenant = await this.tenants.findById(user.tenantId).select('+sessionVersion').session(session ?? null);
    if (!tenant || ![TenantStatus.ACTIVE, TenantStatus.PENDING].includes(tenant.status)) throw new UnauthorizedException('Sessão inválida');
    const custom = user.customRoleId && !OWNERS.includes(user.role!) ? await this.connection.model<CustomRole>(CustomRole.name).findOne({ _id: user.customRoleId, tenantId: tenant._id }).session(session ?? null) : null;
    const configured = user.customRoleId && !OWNERS.includes(user.role!) ? custom?.active && !custom.archived ? custom.permissions : [] : legacyPermissions(user.role);
    const commercial = this.entitlements.enabled ? await this.entitlements.resolve(String(tenant._id), session) : undefined;
    const permissions = supportedPermissions(commercial ? commercial.allowed ? effectivePermissions(configured, commercial.modules) : [] : configured);
    return { sub: user.id, name: user.name, email: user.email, role: user.role, status: user.status, tenantId: String(tenant._id), tenantStatus: tenant.status, sessionVersion: user.sessionVersion, tenantVersion: tenant.sessionVersion, permissions, subscriptionAllowed: commercial?.allowed, contractedModules: commercial?.modules, customRoleId: user.customRoleId?.toString(), customRoleName: custom?.name };
  }
  async check(actor: AuthUser, roles: UserRole[], platform = false, session?: ClientSession) {
    if (!actor?.sub) throw new UnauthorizedException('Identidade obrigatória');
    const fresh = await this.identity(actor.sub, session);
    if (fresh.tenantId !== actor.tenantId || (actor.sessionVersion !== undefined && actor.sessionVersion !== fresh.sessionVersion) || (actor.tenantVersion !== undefined && actor.tenantVersion !== fresh.tenantVersion)) throw new UnauthorizedException('Sessão revogada');
    const capabilities = !platform ? actor[AUTHORIZED_CAPABILITIES] : undefined;
    const allowed = capabilities?.length ? capabilities.every(p => fresh.permissions?.includes(p)) : !!fresh.role && roles.includes(fresh.role);
    if (fresh.status !== UserStatus.ACTIVE || !allowed || (platform ? fresh.tenantId !== null : !fresh.tenantId || fresh.tenantStatus !== TenantStatus.ACTIVE)) throw new ForbiddenException('Acesso não permitido');
    return fresh;
  }
  async require(actor: AuthUser, permissions: string[], session?: ClientSession) {
    const fresh = await this.check({ ...actor, [AUTHORIZED_CAPABILITIES]: permissions }, [], false, session);
    return fresh;
  }
  async scope(actor: AuthUser, roles: UserRole[]) { const user = await this.check(actor, roles); return new Types.ObjectId(user.tenantId!); }
  async checkCapacity(tenantId: string, key: 'activeUsers' | 'products' | 'categories', session: ClientSession) { return this.entitlements.checkCapacity(tenantId, key, session); }
  async limitedCreation<T>(tenantId: string, key: 'products' | 'categories', work: (session?: ClientSession) => Promise<T>): Promise<T> {
    if (!this.entitlements.enabled) return work();
    return this.transaction(async session => { await this.entitlements.checkCapacity(tenantId, key, session); return work(session); });
  }
  async transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const hello = await this.connection.db!.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new ServiceUnavailableException({ code: 'TRANSACTIONS_REQUIRED', message: 'Esta operação exige MongoDB com suporte a transações.' });
    return this.connection.transaction(work);
  }
}
