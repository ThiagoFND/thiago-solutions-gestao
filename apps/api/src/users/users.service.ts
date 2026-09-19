import { BadRequestException, ForbiddenException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import { AuthUser } from '../common/auth-user.js';
import { TenantStatus, UserRole, UserStatus } from '../common/enums.js';
import { UsersQueryDto } from '../tenants/tenancy.dto.js';
import { publicMember } from '../tenants/tenancy.service.js';
import { AuditService } from '../audit/audit.service.js';
import { supportedPermissions, legacyPermissions } from '../auth/permissions.js';
@Injectable()
export class UsersService {
  constructor(private readonly access: TenantAccessService, private readonly audit: AuditService) {}
  async profile(actor: AuthUser) {
    const fresh = await this.access.identity(actor.sub);
    const user = await this.access.users.findOne({ _id: fresh.sub, tenantId: fresh.tenantId }).select('+cpfLastDigits');
    if (!user) throw new NotFoundException('Perfil não encontrado');
    const tenant = fresh.tenantId ? await this.access.tenants.findById(fresh.tenantId).select('cnpj legalName tradeName status') : null;
    return { ...publicMember(user), customRoleName:fresh.customRoleName, createdAt:user.createdAt, updatedAt:user.updatedAt, company: tenant ? { legalName:tenant.legalName, tradeName:tenant.tradeName, status:tenant.status, cnpjMasked:tenant.cnpj.replace(/^(..)(...)(...)(....)(..)$/, '$1.$2.$3/$4-$5') } : null };
  }
  async denyProfileChange(actor: AuthUser) {
    await this.audit.record('profile.update', 'denied', actor, 'users', actor.sub);
    throw new ForbiddenException('Seu perfil é somente leitura. O proprietário não pode alterar o próprio cadastro.');
  }
  async list(actor: AuthUser, q: UsersQueryDto, pending = false) {
    const tenantId = await this.access.scope(actor, OWNERS);
    const filter = { tenantId, status: pending ? UserStatus.PENDING : q.status ?? UserStatus.ACTIVE };
    const users = await this.access.users.find(filter).select('+cpfLastDigits').sort({ requestedAt: -1, _id: -1 }).skip((q.page - 1) * q.limit).limit(q.limit);
    const total = await this.access.users.countDocuments(filter);
    const ids=users.map(u=>u.customRoleId).filter(Boolean);
    const roles=ids.length?await this.access.connection.model('CustomRole').find({tenantId,_id:{$in:ids}}).select('_id name').lean():[];
    const names=new Map(roles.map((r:any)=>[String(r._id),r.name]));
    return { items: users.map(u=>({...publicMember(u),customRoleName:names.get(String(u.customRoleId))})), total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) };
  }
  async count(actor: AuthUser) { return { count: await this.access.users.countDocuments({ tenantId: await this.access.scope(actor, OWNERS), status: UserStatus.PENDING }) }; }
  async get(actor: AuthUser, id: string) {
    const user = await this.access.users.findOne({ _id: id, tenantId: await this.access.scope(actor, OWNERS) }).select('+cpfLastDigits');
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return publicMember(user);
  }
  async change(actor: AuthUser, id: string, action: 'approve' | 'reject' | 'role' | 'status', value?: string, customRoleId?: string) {
    if (actor.sub === id) return this.denyProfileChange(actor);
    if (customRoleId && (value!==undefined || !['approve','role'].includes(action))) throw new BadRequestException('Selecione apenas um cargo.');
    return this.access.transaction(async session => {
      const fresh = await this.access.check(actor, OWNERS, false, session);
      if (!customRoleId && (action === 'approve' || action === 'role') && legacyPermissions(value as UserRole).some(p => !fresh.permissions?.includes(p))) throw new ForbiddenException('Não é permitido conceder permissões que você não possui.');
      const tenant = await this.access.tenants.findOneAndUpdate({ _id: fresh.tenantId, status: TenantStatus.ACTIVE }, { $inc: { membershipVersion: 1 } }, { session, new: true });
      if (!tenant) throw new ConflictException('Empresa indisponível');
      const user = await this.access.users.findOne({ _id: id, tenantId: tenant._id }).select('+cpfLastDigits +cpfEncrypted +cpfHash +sessionVersion').session(session);
      if (!user) throw new NotFoundException('Usuário não encontrado');
      const before={role:user.role,status:user.status,customRoleId:user.customRoleId?.toString()};
      if (user.status !== UserStatus.ACTIVE && (action === 'approve' || action === 'status' && value === UserStatus.ACTIVE)) await this.access.checkCapacity(String(tenant._id), 'activeUsers', session);
      let custom: any;
      if(customRoleId){
        if(user.role && (OWNERS.includes(user.role)||user.role===UserRole.PLATFORM_ADMIN))throw new ForbiddenException('O vínculo deste usuário é protegido.');
        custom=await this.access.connection.model('CustomRole').findOne({_id:customRoleId,tenantId:tenant._id,active:true,archived:false}).session(session);
        if(!custom)throw new NotFoundException('Cargo não encontrado ou indisponível.');
        if(supportedPermissions(custom.permissions).some((p:string)=>!fresh.permissions?.includes(p)))throw new ForbiddenException('Não é permitido conceder permissões que você não possui.');
      }
      if(action==='status' && value===UserStatus.ACTIVE){
        const rolePermissions=user.customRoleId?((await this.access.connection.model('CustomRole').findOne({_id:user.customRoleId,tenantId:tenant._id}).session(session)) as any)?.permissions??[]:legacyPermissions(user.role);
        if(supportedPermissions(rolePermissions).some((p:string)=>!fresh.permissions?.includes(p)))throw new ForbiddenException('Não é permitido ativar acesso superior ao seu.');
      }
      const wasOwner = user.status === UserStatus.ACTIVE && user.role && OWNERS.includes(user.role);
      if (action === 'approve' || action === 'reject') {
        if (user.status !== UserStatus.PENDING || user.role !== null) throw new ConflictException('Solicitação indisponível');
        user.status = action === 'approve' ? UserStatus.ACTIVE : UserStatus.REJECTED;
        if (action === 'approve') {user.role = custom ? UserRole.MEMBER : value as UserRole;if(custom)user.customRoleId=custom._id;}
        else user.rejectionReason = value;
        user.reviewedById = new Types.ObjectId(actor.sub); user.reviewedAt = new Date();
      } else {
        if (![UserStatus.ACTIVE, UserStatus.INACTIVE].includes(user.status)) throw new ConflictException('Transição indisponível');
        if (action === 'role') {
          if(custom){if(String(user.customRoleId)===customRoleId)throw new ConflictException('Cargo já aplicado');user.customRoleId=custom._id;user.role=UserRole.MEMBER;}
          else {if (user.role === value && !user.customRoleId) throw new ConflictException('Perfil já aplicado'); user.role = value as UserRole; user.customRoleId = undefined;}
        }
        else { if (user.status === value) throw new ConflictException('Status já aplicado'); user.status = value as UserStatus; }
      }
      if ((action === 'role' || action === 'approve') && ![UserRole.CASHIER, UserRole.KITCHEN, UserRole.ACCOUNTANT, ...(custom?[UserRole.MEMBER]:[])].includes(user.role!)) throw new ConflictException('Escolha um cargo válido');
      if (action === 'status' && ![UserStatus.ACTIVE, UserStatus.INACTIVE].includes(user.status)) throw new ConflictException('Status inválido');
      if (wasOwner && (user.status !== UserStatus.ACTIVE || !OWNERS.includes(user.role!))) {
        const other = await this.access.users.countDocuments({ tenantId: tenant._id, _id: { $ne: user._id }, status: UserStatus.ACTIVE, role: { $in: OWNERS } }).session(session);
        if (!other) throw new ConflictException('O último proprietário ativo deve ser preservado');
      }
      user.sessionVersion++; await user.save({ session });
      if((action==='approve'||action==='role')&&before.customRoleId!==user.customRoleId?.toString()){
        const roles=this.access.connection.model('CustomRole');
        if(before.customRoleId)await roles.updateOne({_id:before.customRoleId,tenantId:tenant._id},{$push:{history:{action:'removed',actorId:fresh.sub,userId:user._id}}},{session});
        if(user.customRoleId)await roles.updateOne({_id:user.customRoleId,tenantId:tenant._id},{$push:{history:{action:'assigned',actorId:fresh.sub,userId:user._id}}},{session});
      }
      await this.audit.record(`member.${action}`, 'success', fresh, 'users', id, undefined, session, undefined, {before,after:{role:user.role,status:user.status,customRoleId:user.customRoleId?.toString()}});
      return publicMember(user);
    });
  }
}
