import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import type { AuthUser } from '../common/auth-user.js';
import { UserStatus, StockMovementType } from '../common/enums.js';
import { OperationalStore } from '../common/operational-store.js';
import { EntitlementsService } from '../commerce/entitlements.service.js';
import { proposalTotal } from '../crm/crm.rules.js';
import { SERVICE_MODELS } from './service-orders.schemas.js';
import * as D from './service-orders.dto.js';
export function appointmentWindow(startsAt: string, durationMinutes: number, preparationMinutes: number) {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(startsAt)) throw new BadRequestException('O horário precisa incluir fuso.');
  const start = new Date(startsAt); if (!Number.isFinite(start.getTime())) throw new BadRequestException('Horário inválido.');
  return { startsAt: start, endsAt: new Date(start.getTime() + durationMinutes * 60000), occupiedStartAt: new Date(start.getTime() - preparationMinutes * 60000) };
}
const transitions: Record<string, string[]> = { OPEN: ['ANALYSIS', 'CANCELED'], ANALYSIS: ['WAITING_APPROVAL', 'CANCELED'], WAITING_APPROVAL: ['APPROVED', 'CANCELED'], APPROVED: ['IN_PROGRESS', 'CANCELED'], IN_PROGRESS: ['CANCELED'], COMPLETED: ['DELIVERED'], DELIVERED: [], CANCELED: [] };
const appointmentTransitions: Record<string, string[]> = { BOOKED: ['CONFIRMED', 'ARRIVED', 'NO_SHOW', 'CANCELED'], CONFIRMED: ['ARRIVED', 'NO_SHOW', 'CANCELED'], ARRIVED: ['IN_PROGRESS', 'CANCELED'], IN_PROGRESS: ['DONE'], DONE: [], NO_SHOW: [], CANCELED: [] };
@Injectable()
export class ServiceOrdersService {
  constructor(private store: OperationalStore, private entitlements: EntitlementsService) {}
  private write<T>(u: AuthUser, p: string, event: string, fn: (a: AuthUser, s: ClientSession) => Promise<T>) { return this.store.write(u, p, event, SERVICE_MODELS, fn); }
  private scope(a: AuthUser) { return { tenantId: this.store.id(a.tenantId!), ...(a.permissions?.includes('servicos.equipe') ? {} : { assignedId: this.store.id(a.sub) }) }; }
  private async row(name: string, a: AuthUser, id: string, s?: ClientSession) { const row = await this.store.model(name).findOne({ _id: this.store.id(id), ...this.scope(a) }).session(s ?? null); if (!row) throw new NotFoundException('Registro indisponível no seu escopo.'); return row; }
  private async references(a: AuthUser, d: { partyId: string; assignedId: string; serviceId: string }, s: ClientSession) {
    if (d.assignedId !== a.sub && !a.permissions?.includes('servicos.equipe')) throw new ForbiddenException('Atribuição a outra pessoa exige gestão da equipe.');
    const party = await this.store.model('BusinessParty').findOne({ _id: d.partyId, tenantId: a.tenantId, active: true }).session(s);
    const service = await this.store.model('BusinessServiceDefinition').findOne({ _id: d.serviceId, tenantId: a.tenantId, active: true }).session(s);
    const assigned = await this.store.access.users.findOne({ _id: d.assignedId, tenantId: a.tenantId, status: UserStatus.ACTIVE, role: { $ne: null } }).session(s);
    if (!party || !service || !assigned) throw new NotFoundException('Cliente, serviço ou técnico não encontrado na empresa.'); return { party, service, assigned };
  }
  private present(a: AuthUser, value: any) {
    const row = value.toObject ? value.toObject() : { ...value }; delete row.inputHash; delete row.requestId;
    if (!a.permissions?.includes('servicos.valores')) {
      for (const key of ['priceCents', 'laborCents', 'budgetCents', 'approvedBudgetCents', 'actualCents']) delete row[key];
      for (const key of ['materials', 'actualMaterials']) if (row[key]) row[key] = row[key].map(({ unitCents: _cost, ...line }: any) => line);
    }
    return row;
  }
  async catalog(u: AuthUser, q: D.ServiceQuery, kind: 'services' | 'resources' | 'people' | 'parties' | 'products') {
    const a = await this.store.access.require(u, ['servicos.visualizar']);
    const names = { services: 'BusinessServiceDefinition', resources: 'ServiceResource', people: 'User', parties: 'BusinessParty', products: 'Product' };
    const filter: any = { tenantId: a.tenantId, ...(kind === 'people' ? { status: UserStatus.ACTIVE, role: { $ne: null } } : { active: true }) };
    if (q.search) filter.name = { $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const select = kind === 'people' || kind === 'parties' ? '_id name' : kind === 'products' ? '_id name unit' : '-inputHash -requestId';
    const result = await this.store.page(names[kind], filter, q, { name: 1, _id: 1 }, select); return { ...result, items: result.items.map(r => this.present(a, r)) };
  }
  createService(u: AuthUser, d: D.ServiceDefinitionDto) { return this.write(u, 'servicos.configurar', 'services.definition.created', async (a, s) => await this.store.replay('BusinessServiceDefinition', a, d, s) ?? (await this.store.model('BusinessServiceDefinition').create([{ ...d, ...this.store.fields(a, d) }], { session: s }))[0]); }
  createResource(u: AuthUser, d: D.ResourceDto) { return this.write(u, 'servicos.configurar', 'services.resource.created', async (a, s) => await this.store.replay('ServiceResource', a, d, s) ?? (await this.store.model('ServiceResource').create([{ ...d, ...this.store.fields(a, d) }], { session: s }))[0]); }
  private async noConflict(a: AuthUser, s: ClientSession, assignedId: string, resourceId: string | undefined, window: ReturnType<typeof appointmentWindow>, exclude?: string) {
    const alternatives: any[] = [{ assignedId: this.store.id(assignedId) }]; if (resourceId) alternatives.push({ resourceId: this.store.id(resourceId) });
    if (await this.store.model('ServiceAppointment').exists({ tenantId: a.tenantId, ...(exclude ? { _id: { $ne: this.store.id(exclude) } } : {}), status: { $nin: ['CANCELED', 'NO_SHOW'] }, $or: alternatives, occupiedStartAt: { $lt: window.endsAt }, endsAt: { $gt: window.occupiedStartAt } }).session(s)) throw new ConflictException('Técnico ou recurso já ocupado nesse intervalo, incluindo preparação.');
  }
  async list(u: AuthUser, q: D.ServiceQuery, kind: 'appointments' | 'orders') {
    const a = await this.store.access.require(u, ['servicos.visualizar']), filter: any = this.scope(a);
    if (q.assignedId) { if (!a.permissions?.includes('servicos.equipe') && q.assignedId !== a.sub) throw new ForbiddenException('Consulta restrita às suas atribuições.'); filter.assignedId = this.store.id(q.assignedId); }
    if (q.status) filter.status = q.status;
    if (!!q.from !== !!q.to) throw new BadRequestException('Informe início e fim do período.');
    if (q.from && q.to) { const from = new Date(q.from), to = new Date(q.to); if (from >= to || to.getTime() - from.getTime() > 366 * 86400000) throw new BadRequestException('Período inválido ou superior a 366 dias.'); filter[kind === 'appointments' ? 'startsAt' : 'dueAt'] = { $gte: from, $lt: to }; }
    if (q.search) filter.$or = ['partyName', 'serviceName', 'title', 'equipment'].map(key => ({ [key]: { $regex: q.search!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }));
    const result = await this.store.page(kind === 'appointments' ? 'ServiceAppointment' : 'ServiceOrder', filter, q, kind === 'appointments' ? { startsAt: 1, _id: 1 } : { dueAt: 1, _id: 1 }); return { ...result, items: result.items.map(r => this.present(a, r)) };
  }
  book(u: AuthUser, d: D.AppointmentDto) {
    return this.write(u, 'servicos.agendar', 'services.appointment.created', async (a, s) => {
      const old = await this.store.replay('ServiceAppointment', a, d, s); if (old) return this.present(a, old);
      const { party, service, assigned } = await this.references(a, d, s), window = appointmentWindow(d.startsAt, service.durationMinutes, service.preparationMinutes);
      const resource = d.resourceId ? await this.store.model('ServiceResource').findOne({ _id: d.resourceId, tenantId: a.tenantId, active: true }).session(s) : null;
      if (d.resourceId && !resource) throw new NotFoundException('Recurso não encontrado.');
      await this.noConflict(a, s, d.assignedId, d.resourceId, window);
      const [row] = await this.store.model('ServiceAppointment').create([{ ...d, ...this.store.fields(a, d), ...window, durationMinutes: service.durationMinutes, preparationMinutes: service.preparationMinutes, partyName: party.name, serviceName: service.name, assignedName: assigned.name, resourceName: resource?.name, history: [{ status: 'BOOKED', reason: 'Agendamento criado', actorId: a.sub, at: new Date() }] }], { session: s }); return this.present(a, row);
    });
  }
  reschedule(u: AuthUser, id: string, d: D.RescheduleDto) {
    return this.write(u, 'servicos.agendar', 'services.appointment.rescheduled', async (a, s) => {
      const row = await this.row('ServiceAppointment', a, id, s); if (row.version !== d.version || !['BOOKED', 'CONFIRMED'].includes(row.status)) throw new ConflictException('Agendamento alterado ou já iniciado.');
      const window = appointmentWindow(d.startsAt, row.durationMinutes, row.preparationMinutes); await this.noConflict(a, s, String(row.assignedId), row.resourceId?.toString(), window, id);
      Object.assign(row, window); row.status = 'BOOKED'; row.version++; row.history.push({ status: 'BOOKED', reason: d.reason, actorId: a.sub, at: new Date() }); await row.save({ session: s }); return this.present(a, row);
    });
  }
  appointmentState(u: AuthUser, id: string, d: D.AppointmentStatusDto) {
    return this.write(u, d.status === 'CANCELED' ? 'servicos.cancelar' : 'servicos.agendar', 'services.appointment.status', async (a, s) => {
      const row = await this.row('ServiceAppointment', a, id, s); if (row.version !== d.version || !appointmentTransitions[row.status]?.includes(d.status)) throw new ConflictException('Transição indisponível ou registro alterado.');
      row.status = d.status; row.version++; row.history.push({ status: d.status, reason: d.reason, actorId: a.sub, at: new Date() }); await row.save({ session: s }); return this.present(a, row);
    });
  }
  private async materials(a: AuthUser, rows: D.MaterialDto[], s: ClientSession) {
    const ids = rows.filter(r => r.productId).map(r => r.productId); if (new Set(ids).size !== ids.length) throw new BadRequestException('Consolide cada produto em uma única linha.');
    for (const line of rows) if (line.productId && !await this.store.model('Product').exists({ _id: line.productId, tenantId: a.tenantId, active: true }).session(s)) throw new NotFoundException('Material não pertence ao catálogo desta empresa.');
    try { return rows.length ? proposalTotal(rows, 0).totalCents : 0; } catch (e) { throw new BadRequestException((e as Error).message); }
  }
  createOrder(u: AuthUser, d: D.OrderDto) {
    return this.write(u, 'servicos.criar', 'services.order.created', async (a, s) => {
      if (!a.permissions?.includes('servicos.valores')) throw new ForbiddenException('Definir orçamento exige acesso aos valores.');
      const old = await this.store.replay('ServiceOrder', a, d, s); if (old) return this.present(a, old);
      const { party, service, assigned } = await this.references(a, d, s);
      if (d.appointmentId) {
        const booking = await this.row('ServiceAppointment', a, d.appointmentId, s);
        if (String(booking.partyId) !== d.partyId || String(booking.serviceId) !== d.serviceId || String(booking.assignedId) !== d.assignedId || ['CANCELED', 'NO_SHOW'].includes(booking.status)) throw new BadRequestException('Agendamento incompatível com esta ordem.');
        if (await this.store.model('ServiceOrder').exists({ tenantId: a.tenantId, appointmentId: d.appointmentId }).session(s)) throw new ConflictException('Já existe uma ordem para este agendamento.');
      }
      const budgetCents = service.priceCents + await this.materials(a, d.materials, s); if (!Number.isSafeInteger(budgetCents) || budgetCents > 1e12) throw new BadRequestException('Orçamento fora do limite.');
      const [row] = await this.store.model('ServiceOrder').create([{ ...d, ...this.store.fields(a, d), laborCents: service.priceCents, budgetCents, partyName: party.name, serviceName: service.name, assignedName: assigned.name, history: [{ status: 'OPEN', reason: 'Ordem criada', actorId: a.sub, at: new Date() }] }], { session: s }); return this.present(a, row);
    });
  }
  async detail(u: AuthUser, id: string) { const a = await this.store.access.require(u, ['servicos.visualizar']); return this.present(a, await this.row('ServiceOrder', a, id)); }
  orderState(u: AuthUser, id: string, d: D.OrderStatusDto) {
    const permission = d.status === 'APPROVED' ? 'servicos.aprovar' : d.status === 'CANCELED' ? 'servicos.cancelar' : 'servicos.executar';
    return this.write(u, permission, 'services.order.status', async (a, s) => {
      const row = await this.row('ServiceOrder', a, id, s); if (row.version !== d.version || !transitions[row.status]?.includes(d.status)) throw new ConflictException('Transição indisponível ou ordem alterada.');
      if (d.status === 'APPROVED') { if (!a.permissions?.includes('servicos.valores')) throw new ForbiddenException('Aprovar exige acesso ao orçamento.'); row.approvedBudgetCents = row.budgetCents; row.approvedById = a.sub; row.approvedAt = new Date(); }
      row.status = d.status; row.version++; row.history.push({ status: d.status, reason: d.reason, actorId: a.sub, at: new Date() }); await row.save({ session: s }); return this.present(a, row);
    });
  }
  complete(u: AuthUser, id: string, d: D.CompletionDto) {
    return this.write(u, 'servicos.executar', 'services.order.completed', async (a, s) => {
      const row = await this.row('ServiceOrder', a, id, s); if (row.version !== d.version || row.status !== 'IN_PROGRESS') throw new ConflictException('Ordem não está em execução ou foi alterada.');
      if (d.checks.some(check => !check.passed)) throw new BadRequestException('Resolva as não conformidades antes de concluir.');
      // A technician submits quantities without seeing prices; the server applies approved values.
      const actualMaterials = d.materials.map(material => {
        const approved = row.materials.find((line: any) => material.productId ? String(line.productId) === material.productId : !line.productId && line.description === material.description);
        if (!approved || material.quantity > approved.quantity || (material.unitCents !== undefined && material.unitCents !== approved.unitCents)) throw new BadRequestException('Use somente materiais, quantidades e preços aprovados.');
        return { ...material, unitCents: approved.unitCents };
      });
      const actualCents = row.laborCents + await this.materials(a, actualMaterials, s);
      if (!Number.isSafeInteger(actualCents) || actualCents > row.approvedBudgetCents) throw new BadRequestException('Consumo ultrapassa o orçamento aprovado.');
      const stockApplied = await this.entitlements.has(a.tenantId!, 'INVENTORY', s);
      if (stockApplied) for (const material of d.materials) if (material.productId) {
        const product = await this.store.model('Product').findOneAndUpdate({ _id: material.productId, tenantId: a.tenantId, active: true, availableStock: { $gte: material.quantity } }, { $inc: { availableStock: -material.quantity, version: 1 } }, { session: s, returnDocument: 'after' });
        if (!product) throw new ConflictException('Saldo insuficiente para o consumo de material.');
        await this.store.model('StockMovement').create([{ tenantId: a.tenantId, productId: material.productId, productName: product.name, quantityChange: -material.quantity, type: StockMovementType.SERVICE_CONSUMPTION, referenceId: id, userId: a.sub, userName: a.name }], { session: s });
      }
      Object.assign(row, { status: 'COMPLETED', report: d.report, checks: d.checks, actualMaterials, actualCents, stockApplied }); row.version++; row.history.push({ status: 'COMPLETED', reason: d.reason, actorId: a.sub, at: new Date() }); await row.save({ session: s }); return this.present(a, row);
    });
  }
}
