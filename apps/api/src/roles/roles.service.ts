import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { ClientSession } from 'mongoose';
import { AuthUser } from '../common/auth-user.js';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import { TenantStatus, UserRole, UserStatus } from '../common/enums.js';
import { supportedPermissions, PERMISSION_CATALOG } from '../auth/permissions.js';
import { AuditService } from '../audit/audit.service.js';
import { CustomRole } from './custom-role.schema.js';
import { RoleDto } from './roles.dto.js';
import { effectivePermissions, type ModuleCode } from '../commerce/commerce.domain.js';
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const snapshot = (r: any) => ({ name: r.name, description: r.description, permissions: [...r.permissions], active: r.active, archived: r.archived });
@Injectable()
export class RolesService {
  constructor(@InjectModel(CustomRole.name) private readonly roles: Model<CustomRole>, private readonly access: TenantAccessService, private readonly audit: AuditService) {}
  async catalog(u: AuthUser) { const actor = await this.access.require(u, ['cargos.visualizar']); const available=new Set(effectivePermissions(PERMISSION_CATALOG.map(p=>p.key),(actor.contractedModules??[]) as ModuleCode[])); return PERMISSION_CATALOG.filter(p=>available.has(p.key)).map(p => ({ ...p, assignable: actor.permissions!.includes(p.key) })); }
  async list(u: AuthUser, page: number, limit: number) {
    const actor = await this.access.require(u, ['cargos.visualizar']);
    const filter = { tenantId: actor.tenantId };
    const items = await this.roles.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean();
    const total = await this.roles.countDocuments(filter);
    return { items: items.map(role => ({ ...role, permissions: supportedPermissions(role.permissions) })), total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  private validate(dto: RoleDto, actor: AuthUser) {
    if (['owner', 'admin', 'platform_admin'].includes(normalize(dto.name))) throw new BadRequestException('Nome reservado para cargo protegido.');
    if (dto.permissions.some(p => !actor.permissions?.includes(p))) throw new ForbiddenException('Não é permitido conceder uma permissão que você não possui.');
  }
  private async lock(actor: AuthUser, session: ClientSession) {
    if (!await this.access.tenants.findOneAndUpdate({ _id: actor.tenantId, status: TenantStatus.ACTIVE }, { $inc: { membershipVersion: 1 } }, { session })) throw new ConflictException('Empresa indisponível.');
  }
  async create(dto: RoleDto, u: AuthUser) {
    return this.access.transaction(async session => {
      const actor = await this.access.require(u, ['cargos.criar'], session); this.validate(dto, actor); await this.lock(actor, session);
      const fields = { name: dto.name, normalizedName: normalize(dto.name), description: dto.description, permissions: dto.permissions, active: dto.active ?? true, archived: dto.archived ?? false };
      const [role] = await this.roles.create([{ ...fields, tenantId: actor.tenantId!, history: [{ action: 'created', actorId: actor.sub, after: snapshot(fields) }] }], { session });
      await this.audit.record('role.created', 'success', actor, 'roles', role.id, undefined, session);
      return { ...role.toObject(), history: undefined };
    });
  }
  async update(id: string, dto: RoleDto, u: AuthUser) {
    return this.access.transaction(async session => {
      const actor = await this.access.require(u, ['cargos.editar', ...(dto.archived ? ['cargos.arquivar'] : [])], session); this.validate(dto, actor); await this.lock(actor, session);
      const role = await this.roles.findOne({ _id: id, tenantId: actor.tenantId }).session(session);
      if (!role) throw new NotFoundException('Cargo não encontrado.');
      if (actor.customRoleId === id) throw new ForbiddenException('Você não pode editar seu próprio cargo.');
      if (supportedPermissions(role.permissions).some(p => !actor.permissions?.includes(p))) throw new ForbiddenException('Cargo fora das suas permissões.');
      if (dto.version !== role.version) throw new ConflictException('Cargo alterado. Atualize a tela.');
      const after = { name: dto.name, description: dto.description, permissions: dto.permissions, active: dto.active ?? role.active, archived: dto.archived ?? role.archived };
      const result = await this.roles.findOneAndUpdate({ _id: id, tenantId: actor.tenantId, version: role.version }, { $set: { ...after, normalizedName: normalize(dto.name) }, $inc: { version: 1 }, $push: { history: { action: 'updated', actorId: actor.sub, before: snapshot(role), after } } }, { new: true, session, runValidators: true });
      if (!result) throw new ConflictException('Cargo alterado. Atualize a tela.');
      await this.access.users.updateMany({ tenantId: actor.tenantId, customRoleId: role._id }, { $inc: { sessionVersion: 1 } }, { session });
      await this.audit.record('role.permissions_changed', 'success', actor, 'roles', id, undefined, session, undefined, {before:{permissions:[...role.permissions]},after:{permissions:[...after.permissions]}});
      return result;
    });
  }
  async duplicate(id: string, name: string, u: AuthUser) {
    const actor = await this.access.require(u, ['cargos.criar']);
    const role = await this.roles.findOne({ _id: id, tenantId: actor.tenantId });
    if (!role) throw new NotFoundException('Cargo não encontrado.');
    return this.create({ name, description: role.description, permissions: supportedPermissions(role.permissions) }, u);
  }
  async assign(id: string, userId: string, u: AuthUser) {
    if (userId === u.sub) { await this.audit.record('role.self_change', 'denied', u, 'users', userId); throw new ForbiddenException('Você não pode alterar o próprio cargo.'); }
    return this.access.transaction(async session => {
      const actor = await this.access.require(u, ['cargos.atribuir', 'usuarios.alterar_cargo'], session); await this.lock(actor, session);
      const role = await this.roles.findOne({ _id: id, tenantId: actor.tenantId, active: true, archived: false }).session(session);
      if (!role) throw new NotFoundException('Cargo não encontrado ou indisponível.');
      this.validate({ name: role.name, description: role.description, permissions: supportedPermissions(role.permissions) }, actor);
      const member = await this.access.users.findOne({ _id: userId, tenantId: actor.tenantId }).select('+sessionVersion').session(session);
      if (!member) throw new NotFoundException('Usuário não encontrado.');
      if (OWNERS.includes(member.role!) || member.role === UserRole.PLATFORM_ADMIN || ![UserStatus.ACTIVE, UserStatus.INACTIVE].includes(member.status)) throw new ForbiddenException('O vínculo deste usuário é protegido.');
      const beforeId = member.customRoleId, beforeRole=member.role;
      member.customRoleId = role._id; member.role=UserRole.MEMBER; member.sessionVersion++; await member.save({ session });
      await this.roles.updateOne({ _id: id, tenantId: actor.tenantId }, { $push: { history: { action: 'assigned', actorId: actor.sub, userId: member._id } } }, { session });
      if (beforeId && String(beforeId) !== id) await this.roles.updateOne({ _id: beforeId, tenantId: actor.tenantId }, { $push: { history: { action: 'removed', actorId: actor.sub, userId: member._id } } }, { session });
      await this.audit.record('role.assigned', 'success', actor, 'users', userId, undefined, session, undefined, {before:{role:beforeRole,customRoleId:beforeId?.toString()},after:{role:member.role,customRoleId:id}});
      return { success: true };
    });
  }
  async members(id: string, u: AuthUser, page: number, limit: number) {
    const actor = await this.access.require(u, ['cargos.visualizar', 'usuarios.visualizar']);
    if (!await this.roles.exists({ _id: id, tenantId: actor.tenantId })) throw new NotFoundException('Cargo não encontrado.');
    const filter = { tenantId: actor.tenantId, customRoleId: new Types.ObjectId(id) };
    const items = await this.access.users.find(filter).select('_id name email status').sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean();
    const total = await this.access.users.countDocuments(filter); return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  async history(id: string, u: AuthUser, page: number, limit: number) {
    const actor = await this.access.require(u, ['cargos.visualizar']);
    const role = await this.roles.findOne({ _id: id, tenantId: actor.tenantId }).select('+history');
    if (!role) throw new NotFoundException('Cargo não encontrado.');
    const total = role.history.length; return { items: [...role.history].reverse().slice((page - 1) * limit, page * limit), total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
