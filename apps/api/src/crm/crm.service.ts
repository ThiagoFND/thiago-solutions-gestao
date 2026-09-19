import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { Types, type Connection, type ClientSession } from 'mongoose';
import { TenantAccessService } from '../tenants/tenant-access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { UserStatus } from '../common/enums.js';
import { civilDate } from '../finance/finance.helpers.js';
import { csvCell } from '../finance/fiscal-sales.service.js';
import { CRM_MODELS } from './crm.schemas.js';
import { opportunityTransition, proposalTotal } from './crm.rules.js';
import * as D from './crm.dto.js';

@Injectable()
export class CrmService {
  constructor(@InjectConnection() private db: Connection, private access: TenantAccessService, private audit: AuditService) {}
  private model(name: string) { return this.db.model<any>(name); }
  private id(value: string) { if (!/^[a-f\d]{24}$/i.test(value)) throw new BadRequestException('Identificador inválido.'); return new Types.ObjectId(value); }
  private hash(value: unknown): string {
    const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canonical(v[k])])) : v;
    return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
  }
  private async write<T>(u: AuthUser, permission: string, action: string, work: (a: AuthUser, s: ClientSession) => Promise<T>) {
    for (const definition of CRM_MODELS) {
      let indexes: any[];
      try { indexes = await this.model(definition.name).collection.indexes(); } catch { throw new ServiceUnavailableException('Estrutura de CRM ainda não provisionada.'); }
      if (definition.schema.indexes().filter(([, o]) => o.unique).some(([key]) => !indexes.some(i => i.unique && JSON.stringify(i.key) === JSON.stringify(key)))) throw new ServiceUnavailableException('Índices obrigatórios de CRM ausentes.');
    }
    return this.access.transaction(async session => {
      const actor = await this.access.require(u, [permission], session);
      await this.access.tenants.updateOne({ _id: actor.tenantId }, { $inc: { membershipVersion: 1 } }, { session });
      const result = await work(actor, session);
      await this.audit.record(action, 'success', actor, 'crm', undefined, undefined, session);
      return result;
    });
  }
  private scope(a: AuthUser) { return { tenantId: this.id(a.tenantId!), ...(a.permissions?.includes('crm.equipe') ? {} : { assignedId: this.id(a.sub) }) }; }
  private async opportunity(a: AuthUser, id: string, session?: ClientSession) {
    const row = await this.model('CrmOpportunity').findOne({ _id: this.id(id), ...this.scope(a) }).session(session ?? null);
    if (!row) throw new NotFoundException('Negociação não encontrada no seu escopo.'); return row;
  }
  private async repeated(name: string, a: AuthUser, input: { requestId: string }, session: ClientSession) {
    const old = await this.model(name).findOne({ tenantId: a.tenantId, requestId: input.requestId }).session(session);
    if (old && old.inputHash !== this.hash(input)) throw new ConflictException('Referência já usada com outros dados.');
    if (old && String(old.actorId) !== a.sub && !a.permissions?.includes('crm.equipe')) throw new ForbiddenException('Referência indisponível.');
    return old;
  }
  async pipelines(u: AuthUser, q: D.CrmQuery) {
    const a = await this.access.require(u, ['crm.visualizar']), filter = { tenantId: a.tenantId };
    return { items: await this.model('CrmPipeline').find(filter).sort({ name: 1, _id: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).select('-inputHash -requestId').lean(), total: await this.model('CrmPipeline').countDocuments(filter) };
  }
  createPipeline(u: AuthUser, d: D.PipelineDto) {
    if (new Set(d.stages.map(s => s.code)).size !== d.stages.length) throw new BadRequestException('Cada etapa precisa ter código único.');
    return this.write(u, 'crm.configurar', 'crm.pipeline.created', async (a, s) => await this.repeated('CrmPipeline', a, d, s) ?? (await this.model('CrmPipeline').create([{ ...d, tenantId: a.tenantId, actorId: a.sub, inputHash: this.hash(d) }], { session: s }))[0]);
  }
  async lookups(u: AuthUser, q: D.CrmQuery, kind: 'people' | 'parties' | 'products') {
    const a = await this.access.require(u, ['crm.visualizar']);
    const filter: any = { tenantId: a.tenantId, ...(kind === 'people' ? { status: 'ACTIVE', role: { $ne: null } } : { active: true }) };
    if (q.search) filter.name = { $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const model = this.model(kind === 'people' ? 'User' : kind === 'parties' ? 'BusinessParty' : 'Product');
    return { items: await model.find(filter).select(kind === 'products' ? '_id name unit priceCents' : '_id name').sort({ name: 1, _id: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(), total: await model.countDocuments(filter) };
  }
  async export(u:AuthUser,q:D.CrmQuery){
    await this.access.require(u,['crm.exportar','crm.visualizar']);
    const page=await this.list(u,q);
    return '\uFEFF'+[['Negociação','Cliente','Situação','Etapa','Previsão','Valor estimado (centavos)'],...page.items.map((r:any)=>[r.title,r.partyName,r.status,r.stage,r.expectedDate,r.amountCents])].map(row=>row.map(csvCell).join(';')).join('\r\n');
  }
  async list(u: AuthUser, q: D.CrmQuery) {
    const a = await this.access.require(u, ['crm.visualizar']), filter: any = this.scope(a);
    if (q.status) filter.status = q.status;
    if (q.pipelineId) filter.pipelineId = this.id(q.pipelineId);
    if (q.assignedId) { if (!a.permissions?.includes('crm.equipe') && q.assignedId !== a.sub) throw new ForbiddenException('Consulta restrita às suas negociações.'); filter.assignedId = this.id(q.assignedId); }
    if (q.search) filter.$or = ['title', 'partyName'].map(key => ({ [key]: { $regex: q.search!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }));
    const model = this.model('CrmOpportunity');
    return { items: await model.find(filter).sort({ expectedDate: 1, _id: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).select('-inputHash -requestId').lean(), total: await model.countDocuments(filter), page: q.page, limit: q.limit };
  }
  create(u: AuthUser, d: D.OpportunityDto) {
    civilDate(d.expectedDate);
    return this.write(u, 'crm.criar', 'crm.opportunity.created', async (a, s) => {
      if (d.assignedId !== a.sub && !a.permissions?.includes('crm.equipe')) throw new ForbiddenException('Somente um gestor pode atribuir negociações a outras pessoas.');
      const old = await this.repeated('CrmOpportunity', a, d, s); if (old) return old;
      const party = await this.model('BusinessParty').findOne({ _id: d.partyId, tenantId: a.tenantId, active: true }).session(s);
      const pipeline = await this.model('CrmPipeline').findOne({ _id: d.pipelineId, tenantId: a.tenantId }).session(s);
      const assigned = await this.access.users.findOne({ _id: d.assignedId, tenantId: a.tenantId, status: UserStatus.ACTIVE, role: { $ne: null } }).session(s);
      if (!party || !pipeline || !assigned) throw new NotFoundException('Contato, funil ou responsável indisponível nesta empresa.');
      return (await this.model('CrmOpportunity').create([{ ...d, tenantId: a.tenantId, actorId: a.sub, inputHash: this.hash(d), partyName: party.name, pipelineName: pipeline.name, stages: pipeline.stages, stage: pipeline.stages[0].code, assignedName: assigned.name }], { session: s }))[0];
    });
  }
  async detail(u: AuthUser, id: string, q: D.CrmQuery) {
    const a = await this.access.require(u, ['crm.visualizar']), row = await this.opportunity(a, id);
    const filter = { tenantId: a.tenantId, opportunityId: row._id }, skip = (q.page - 1) * q.limit;
    const [activities, proposals, activityTotal, proposalCount] = await Promise.all([
      this.model('CrmActivity').find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(q.limit).select('-inputHash -requestId').lean(),
      this.model('CrmProposal').find(filter).sort({ revision: -1 }).skip(skip).limit(q.limit).select('-inputHash -requestId').lean(),
      this.model('CrmActivity').countDocuments(filter), this.model('CrmProposal').countDocuments(filter),
    ]);
    const opportunity = row.toObject(); delete opportunity.inputHash; delete opportunity.requestId;
    return { opportunity, activities, proposals, activityTotal, proposalTotal: proposalCount, page: q.page, limit: q.limit };
  }
  private async event(a: AuthUser, s: ClientSession, id: string, kind: string, description: string) {
    const requestId = randomUUID();
    await this.model('CrmActivity').create([{ tenantId: a.tenantId, actorId: a.sub, opportunityId: id, kind, description, requestId, inputHash: this.hash({ requestId }), done: true, completedAt: new Date() }], { session: s });
  }
  move(u: AuthUser, id: string, d: D.MoveDto) {
    return this.write(u, 'crm.editar', 'crm.opportunity.moved', async (a, s) => {
      const row = await this.opportunity(a, id, s);
      if (row.version !== d.version || row.status !== 'OPEN') throw new ConflictException('Negociação alterada ou encerrada.');
      if (!row.stages.some((stage: any) => stage.code === d.stage)) throw new BadRequestException('Etapa não pertence a este funil.');
      const before = row.stage; row.stage = d.stage; row.version++; await row.save({ session: s });
      await this.event(a, s, id, 'STAGE', `${before} → ${d.stage}: ${d.reason}`); return row;
    });
  }
  result(u: AuthUser, id: string, d: D.ResultDto) {
    return this.write(u, 'crm.editar', 'crm.opportunity.closed', async (a, s) => {
      const row = await this.opportunity(a, id, s);
      if (row.version !== d.version) throw new ConflictException('Negociação alterada.');
      try { opportunityTransition(row.status, d.status, d.reason); } catch (error) { throw new BadRequestException((error as Error).message); }
      row.status = d.status; row.reason = d.reason; row.closedAt = new Date(); row.version++; await row.save({ session: s });
      await this.event(a, s, id, 'RESULT', `${d.status}: ${d.reason}`); return row;
    });
  }
  activity(u: AuthUser, id: string, d: D.ActivityDto) {
    civilDate(d.dueDate);
    return this.write(u, 'crm.editar', 'crm.activity.created', async (a, s) => {
      await this.opportunity(a, id, s); const input = { ...d, opportunityId: id };
      return await this.repeated('CrmActivity', a, input, s) ?? (await this.model('CrmActivity').create([{ ...input, tenantId: a.tenantId, actorId: a.sub, inputHash: this.hash(input), done: d.kind === 'NOTE' }], { session: s }))[0];
    });
  }
  completeActivity(u: AuthUser, id: string, activityId: string, d: D.VersionReasonDto) {
    return this.write(u, 'crm.editar', 'crm.activity.completed', async (a, s) => {
      await this.opportunity(a, id, s);
      const row = await this.model('CrmActivity').findOneAndUpdate({ _id: this.id(activityId), tenantId: a.tenantId, opportunityId: this.id(id), done: false, version: d.version }, { $set: { done: true, completedAt: new Date() }, $inc: { version: 1 } }, { session: s, returnDocument: 'after' });
      if (!row) throw new ConflictException('Atividade já concluída ou alterada.');
      await this.event(a, s, id, 'NOTE', d.reason); return row;
    });
  }
  proposal(u: AuthUser, id: string, d: D.ProposalDto) {
    civilDate(d.validUntil); let totals: ReturnType<typeof proposalTotal>;
    try { totals = proposalTotal(d.lines, d.discountCents); } catch (error) { throw new BadRequestException((error as Error).message); }
    return this.write(u, 'crm.propor', 'crm.proposal.created', async (a, s) => {
      const opportunity = await this.opportunity(a, id, s), input = { ...d, opportunityId: id };
      const old = await this.repeated('CrmProposal', a, input, s); if (old) return old;
      if (opportunity.status !== 'OPEN') throw new ConflictException('Negociação encerrada.');
      for (const line of d.lines) if (line.productId && !await this.model('Product').exists({ _id: line.productId, tenantId: a.tenantId, active: true }).session(s)) throw new NotFoundException('Produto não encontrado na empresa.');
      const latest = await this.model('CrmProposal').findOne({ tenantId: a.tenantId, opportunityId: id }).sort({ revision: -1 }).session(s);
      return (await this.model('CrmProposal').create([{ ...input, ...totals, tenantId: a.tenantId, actorId: a.sub, inputHash: this.hash(input), partyId: opportunity.partyId, partyName: opportunity.partyName, revision: (latest?.revision ?? 0) + 1 }], { session: s }))[0];
    });
  }
  approveProposal(u: AuthUser, id: string, proposalId: string, d: D.VersionReasonDto) {
    return this.write(u, 'crm.aprovar', 'crm.proposal.approved', async (a, s) => {
      const opportunity = await this.opportunity(a, id, s);
      if (opportunity.status !== 'OPEN') throw new ConflictException('Negociação encerrada.');
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
      const row = await this.model('CrmProposal').findOneAndUpdate({ _id: this.id(proposalId), tenantId: a.tenantId, opportunityId: this.id(id), version: d.version, status: 'DRAFT', validUntil: { $gte: today } }, { $set: { status: 'APPROVED', approvedById: a.sub, approvedAt: new Date(), approvalReason: d.reason }, $inc: { version: 1 } }, { session: s, returnDocument: 'after' });
      if (!row) throw new ConflictException('Proposta alterada, vencida ou já aprovada.'); return row;
    });
  }
  async summary(u: AuthUser) {
    const a = await this.access.require(u, ['crm.visualizar']), scope = this.scope(a);
    const groups = await this.model('CrmOpportunity').aggregate([{ $match: scope }, { $group: { _id: { status: '$status', stage: '$stage', pipeline: '$pipelineName' }, count: { $sum: 1 }, amountCents: { $sum: '$amountCents' } } }]);
    return { groups, definition: 'Valores estimados das negociações, agrupados por funil, etapa e resultado. Não representam receita recebida.' };
  }
}
