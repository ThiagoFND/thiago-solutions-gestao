import { safePassword } from '../common/business-validation.js';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import bcrypt from 'bcrypt';
import { TenantAccessService, OWNERS } from './tenant-access.service.js';
import { TenantStatus, UserRole, UserStatus } from '../common/enums.js';
import { AuthUser } from '../common/auth-user.js';
import { normalizeCnpj, normalizeCpf } from '../common/brazil-documents.js';
import { CpfCrypto, maskCpf } from '../common/cpf-crypto.js';
import { AuditService } from '../audit/audit.service.js';
import * as D from './tenancy.dto.js';

export const publicMember = (u: any) => ({ _id: u._id, name: u.name, email: u.email, role: u.role, customRoleId:u.customRoleId?.toString(), status: u.status, tenantId: u.tenantId, cpfMasked: maskCpf(u.cpfLastDigits), phone: u.phone, jobDescription: u.jobDescription, requestedAt: u.requestedAt, reviewedAt: u.reviewedAt, rejectionReason: u.rejectionReason });
export function documentNumber(value: string, cpf = false) { try { return cpf ? normalizeCpf(value) : normalizeCnpj(value); } catch { throw new BadRequestException('Documento inválido'); } }
@Injectable()
export class TenancyService {
  private readonly cpf = new CpfCrypto();
  constructor(private readonly access: TenantAccessService, private readonly audit: AuditService) {}
  private async password(dto: D.OwnerDto) {
    if (dto.password !== dto.passwordConfirmation) throw new BadRequestException('As senhas informadas não são iguais.');
    if (!safePassword(dto.password)) throw new BadRequestException('Senha inválida: use 12 a 72 caracteres, sem espaços nas pontas ou senha demonstrativa.');
    return bcrypt.hash(dto.password, 12);
  }
  private async unique<T>(work: () => Promise<T>) { try { return await work(); } catch (e: any) { if (e.code === 11000) throw new ConflictException('Cadastro já existente'); throw e; } }
  async onboarding(dto: D.OnboardingDto) {
    const cnpj = documentNumber(dto.company.cnpj), passwordHash = await this.password(dto.owner);
    const tenantId = new Types.ObjectId(), ownerId = new Types.ObjectId();
    return this.unique(() => this.access.transaction(async session => {
      await this.access.tenants.create([{ ...dto.company, cnpj, _id: tenantId, ownerId, status: TenantStatus.PENDING }], { session });
      await this.access.users.create([{ _id: ownerId, tenantId, name: dto.owner.name, email: dto.owner.email, passwordHash, role: UserRole.OWNER, status: UserStatus.PENDING }], { session });
      await this.audit.record('tenant.onboarding', 'success', undefined, 'tenants', String(tenantId), undefined, session, String(tenantId));
      return { tenantId, status: UserStatus.PENDING, message: 'Cadastro recebido. Aguarde aprovação da plataforma.' };
    }));
  }
  async lookup(cnpj: string) {
    const tenant = await this.access.tenants.findOne({ cnpj: documentNumber(cnpj), status: TenantStatus.ACTIVE });
    if (!tenant) throw new NotFoundException('Empresa indisponível para solicitação');
    return { acceptingRequests: true };
  }
  async request(dto: D.AccessRequestDto) {
    const cnpj = documentNumber(dto.cnpj), cpf = documentNumber(dto.cpf, true), passwordHash = await this.password(dto);
    return this.unique(() => this.access.transaction(async session => {
      const tenant = await this.access.tenants.findOneAndUpdate({ cnpj, status: TenantStatus.ACTIVE }, { $inc: { membershipVersion: 1 } }, { session, new: true });
      if (!tenant) throw new NotFoundException('Empresa indisponível para solicitação');
      const [user] = await this.access.users.create([{ tenantId: tenant._id, name: dto.name, email: dto.email, phone: dto.phone, jobDescription: dto.jobDescription, passwordHash, role: null, status: UserStatus.PENDING, ...this.cpf.protect(cpf, String(tenant._id)) }], { session });
      await this.audit.record('member.requested', 'success', { sub: user.id, tenantId: String(tenant._id) } as AuthUser, 'users', user.id, undefined, session);
      return { status: UserStatus.PENDING, message: 'Solicitação recebida. Aguarde aprovação da empresa.' };
    }));
  }
  async list(actor: AuthUser, q: D.TenantsQueryDto) {
    await this.access.check(actor, [UserRole.PLATFORM_ADMIN], true);
    const filter:any=q.status==='ALL'?{}:{status:q.status??TenantStatus.PENDING};
    if(q.search){const escaped=q.search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.$or=['tradeName','legalName','cnpj'].map(key=>({[key]:{$regex:escaped,$options:'i'}}));}
    const post:any={};if(q.plan)post.planCode=q.plan;if(q.subscriptionStatus)post.subscriptionStatus=q.subscriptionStatus;if(q.paymentStatus)post.paymentStatus=q.paymentStatus;
    const [result]=await this.access.tenants.aggregate([
      {$match:filter},
      {$lookup:{from:'commercial_subscriptions_v2',let:{tenant:'$_id'},pipeline:[{$match:{$expr:{$eq:['$tenantId','$$tenant']}}},{$limit:1},{$project:{status:1,snapshot:1,scheduled:1}}],as:'contract'}},
      {$lookup:{from:'commercial_invoices_v2',let:{tenant:'$_id'},pipeline:[{$match:{$expr:{$eq:['$tenantId','$$tenant']}}},{$sort:{createdAt:-1,_id:-1}},{$limit:1},{$project:{status:1,dueAt:1}}],as:'invoice'}},
      {$set:{contract:{$arrayElemAt:['$contract',0]},invoice:{$arrayElemAt:['$invoice',0]}}},
      {$set:{contract:{$cond:[{$and:[{$ne:[{$ifNull:['$contract.scheduled',null]},null]},{$lte:['$contract.scheduled.effectiveAt',new Date()]}]},{$mergeObjects:['$contract','$contract.scheduled']},'$contract']}}},
      {$set:{planCode:{$ifNull:['$contract.snapshot.planCode','NOT_CONTRACTED']},subscriptionStatus:{$ifNull:['$contract.status','NOT_CONTRACTED']},paymentStatus:{$cond:[{$and:[{$eq:['$invoice.status','OPEN']},{$lt:['$invoice.dueAt',new Date()]}]},'OVERDUE',{$ifNull:['$invoice.status','NONE']}]}}},
      {$match:post},{$facet:{items:[{$sort:{createdAt:-1,_id:-1}},{$skip:(q.page-1)*q.limit},{$limit:q.limit},{$project:{contract:0,invoice:0,decisionHistory:0,sessionVersion:0,membershipVersion:0}}],count:[{$count:'total'}]}}
    ]);
    const total=result?.count[0]?.total??0;return {items:result?.items??[],total,page:q.page,limit:q.limit,totalPages:Math.ceil(total/q.limit)};
  }

  async detail(actor: AuthUser, id: string) {
    await this.access.check(actor, [UserRole.PLATFORM_ADMIN], true);
    const tenant = await this.access.tenants.findById(id).lean();
    if (!tenant) throw new NotFoundException('Empresa não encontrada');
    const owner = await this.access.users.findOne({ _id: tenant.ownerId, tenantId: tenant._id }).select('name email status').lean();
    return { ...tenant, owner };
  }
  async history(actor: AuthUser, id: string, q: D.TenantsQueryDto) {
    const tenant = await this.detail(actor, id), items = [...tenant.decisionHistory].reverse();
    return { items: items.slice((q.page - 1) * q.limit, q.page * q.limit), total: items.length, page: q.page, limit: q.limit, totalPages: Math.ceil(items.length / q.limit) };
  }
  async decide(actor: AuthUser, id: string, action: 'approved' | 'rejected' | 'suspended' | 'reactivated', reason?: string) {
    if (action !== 'approved' && (!reason || reason.trim().length < 3)) throw new BadRequestException('Informe o motivo');
    return this.access.transaction(async session => {
      await this.access.check(actor, [UserRole.PLATFORM_ADMIN], true, session);
      const from = action === 'approved' || action === 'rejected' ? [TenantStatus.PENDING] : action === 'suspended' ? [TenantStatus.ACTIVE] : [TenantStatus.SUSPENDED, TenantStatus.INACTIVE];
      const to = action === 'rejected' ? TenantStatus.REJECTED : action === 'suspended' ? TenantStatus.SUSPENDED : TenantStatus.ACTIVE;
      const tenant = await this.access.tenants.findOneAndUpdate({ _id: id, status: { $in: from } }, { $set: { status: to }, $inc: { membershipVersion: 1, sessionVersion: 1 }, $push: { decisionHistory: { action, actorId: actor.sub, occurredAt: new Date(), reason } } }, { new: true, runValidators: true, session });
      if (!tenant) throw new ConflictException('Empresa inexistente ou transição indisponível');
      if (from.includes(TenantStatus.PENDING)) {
        const status = action === 'approved' ? UserStatus.ACTIVE : UserStatus.REJECTED;
        const result = await this.access.users.updateOne({ _id: tenant.ownerId, tenantId: tenant._id, status: UserStatus.PENDING, role: UserRole.OWNER }, { $set: { status, active: status === UserStatus.ACTIVE, reviewedById: actor.sub, reviewedAt: new Date() }, $inc: { sessionVersion: 1 } }, { session, runValidators: true });
        if (result.modifiedCount !== 1) throw new ConflictException('Proprietário indisponível');
      }
      await this.audit.record(`tenant.${action}`, 'success', actor, 'tenants', id, undefined, session, id);
      return tenant;
    });
  }
}
