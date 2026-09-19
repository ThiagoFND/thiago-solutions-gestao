import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types, type Connection, type ClientSession } from 'mongoose';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import { UserRole, UserStatus } from '../common/enums.js';
import type { AuthUser } from '../common/auth-user.js';
import { calculateQuote, contractableOffers, isContractableOffer, isTestOffer, MODULE_CODES, permittedSubscription, supportedModules, type Offer, type Promotion } from './commerce.domain.js';
import { suggestedOffers } from './commerce.defaults.js';
import type { CommercialCoupon, CouponRedemption, CommercialDiscount, CommercialEvent, CommercialInvoice, CommercialOffer, CommercialRequest, CommercialSubscription } from './commerce.schemas.js';
import { effectiveCommercialState } from './commerce.schemas.js';
import * as D from './commerce.dto.js';
import { legacyPermissions } from '../auth/permissions.js';
import { permissionPreview } from './permission-preview.js';

@Injectable()
export class CommerceService {
  constructor(@InjectConnection() private readonly connection: Connection, private readonly access: TenantAccessService) {}
  private get offers() { return this.connection.model<CommercialOffer>('CommercialOffer'); }
  private get discounts() { return this.connection.model<CommercialDiscount>('CommercialDiscount'); }
  private get subscriptions() { return this.connection.model<CommercialSubscription>('CommercialSubscription'); }
  private get invoices() { return this.connection.model<CommercialInvoice>('CommercialInvoice'); }
  private get events() { return this.connection.model<CommercialEvent>('CommercialEvent'); }
  private get requests() { return this.connection.model<CommercialRequest>('CommercialRequest'); }
  private get coupons() { return this.connection.model<CommercialCoupon>('CommercialCoupon'); }
  private get redemptions() { return this.connection.model<CouponRedemption>('CouponRedemption'); }
  private id(id: string) { if (!/^[a-f\d]{24}$/i.test(id)) throw new BadRequestException('Identificador inválido.'); return new Types.ObjectId(id); }
  private platform(u: AuthUser) { return this.access.check(u, [UserRole.PLATFORM_ADMIN], true); }
  private async owner(u: AuthUser) { const fresh = await this.access.check(u, OWNERS); return this.id(fresh.tenantId!); }
  private async tenant(id: string, session?: ClientSession) { const tenantId = this.id(id); if (!await this.access.tenants.exists({ _id: tenantId }).session(session ?? null)) throw new NotFoundException('Empresa não encontrada.'); return tenantId; }
  private async transaction<T>(fn: (session: ClientSession) => Promise<T>) {
    // Unique indexes are part of the concurrency contract, never optional startup side effects.
    for (const model of [this.offers, this.discounts, this.subscriptions, this.invoices, this.coupons, this.redemptions]) {
      let indexes: { key: Record<string, number>; unique?: boolean }[];
      try { indexes = await model.collection.indexes() as typeof indexes; } catch { throw new ServiceUnavailableException('Estrutura comercial ainda não provisionada. Consulte o procedimento de implantação.'); }
      for (const [key, options] of model.schema.indexes()) if (options?.unique && !indexes.some(i => i.unique && JSON.stringify(i.key) === JSON.stringify(key))) throw new ServiceUnavailableException('Índices comerciais obrigatórios ainda não provisionados.');
    }
    try { return await this.access.transaction(fn); } catch (e) { if ((e as { code?: number }).code === 11000) throw new ConflictException('Registro já criado ou alterado por outra operação. Atualize a tela.'); throw e; }
  }
  private async event(session: ClientSession, u: AuthUser, action: string, resourceId: string, reason: string, tenantId?: Types.ObjectId, before?: unknown, after?: unknown) {
    await this.events.create([{ actorId: this.id(u.sub), tenantId, action, resourceId, reason, before, after }], { session });
  }
  private async latestOffers(session?: ClientSession): Promise<CommercialOffer[]> {
    return this.offers.aggregate<CommercialOffer>([{ $sort: { code: 1, version: -1 } }, { $group: { _id: '$code', offer: { $first: '$$ROOT' } } }, { $replaceRoot: { newRoot: '$offer' } }, { $sort: { kind: 1, order: 1, code: 1 } }]).session(session ?? null);
  }
  private offerView(o: Offer): Offer { return { code: o.code, kind: o.kind, name: o.name, description: o.description, version: o.version, monthlyCents: o.monthlyCents, annualCents: o.annualCents, currency: o.currency, modules: o.modules, active: o.active, available: o.available, testOnly: isTestOffer(o), featured: o.featured, order: o.order, limits: o.limits }; }
  async catalog(u: AuthUser, global = false) {
    if (global) await this.platform(u); else await this.owner(u);
    const offers = (await this.latestOffers()).filter(offer => offer.kind !== 'MODULE' || MODULE_CODES.includes(offer.code as never));
    return (global ? offers : contractableOffers(offers)).map(o => this.offerView(o));
  }
  async initialize(u: AuthUser, reason: string) {
    await this.platform(u);
    return this.transaction(async session => {
      await this.platform(u); const created: string[] = [];
      for (const offer of suggestedOffers()) {
        if (await this.offers.exists({ code: offer.code }).session(session)) continue;
        await this.offers.create([{ ...offer, actorId: this.id(u.sub), reason }], { session }); created.push(offer.code);
      }
      if (created.length) await this.event(session, u, 'catalog.initialized', 'catalog', reason, undefined, undefined, { codes: created });
      return { created };
    });
  }
  async saveOffer(u: AuthUser, d: D.OfferDto) {
    await this.platform(u);
    if ((d.kind === 'BASE' && d.code !== 'BASE') || (d.kind === 'MODULE' && !MODULE_CODES.includes(d.code as never)) || (d.kind === 'PLAN' && ['BASE', 'CUSTOM', ...MODULE_CODES].includes(d.code))) throw new BadRequestException('Código incompatível com o tipo de oferta.');
    if (d.kind === 'BASE' && d.modules.length || d.kind === 'MODULE' && (d.modules.length !== 1 || d.modules[0] !== d.code)) throw new BadRequestException('Módulos comerciais são independentes.');
    return this.transaction(async session => {
      const previous = await this.offers.findOne({ code: d.code }).sort({ version: -1 }).session(session);
      if ((previous?.version ?? 0) !== d.version) throw new ConflictException('Versão desatualizada.');
      if (previous && previous.kind !== d.kind) throw new BadRequestException('Tipo da oferta é imutável.');
      const testOnly = d.testOnly ?? isTestOffer(previous ?? d);
      const [next] = await this.offers.create([{ ...d, testOnly, version: d.version + 1, actorId: this.id(u.sub) }], { session });
      await this.event(session, u, 'offer.version.created', next.id, d.reason, undefined, previous ? this.offerView(previous) : undefined, this.offerView(next));
      return this.offerView(next);
    });
  }
  async discountCatalog(u: AuthUser) {
    await this.platform(u);
    return this.discounts.aggregate([{ $sort: { code: 1, version: -1 } }, { $group: { _id: '$code', value: { $first: '$$ROOT' } } }, { $replaceRoot: { newRoot: '$value' } }, { $project: { actorId: 0, __v: 0 } }]);
  }
  async saveDiscount(u: AuthUser, d: D.DiscountDto) {
    await this.platform(u);
    if (d.kind === 'PERCENT' && d.value > 10000 || d.kind === 'FREE' && d.value !== 0 || d.scope === 'MODULE' && !d.modules.length || d.endsAt && Date.parse(d.endsAt) <= Date.parse(d.startsAt)) throw new BadRequestException('Regras de desconto inválidas.');
    if (d.tenantId) await this.tenant(d.tenantId);
    return this.transaction(async session => {
      const previous = await this.discounts.findOne({ code: d.code }).sort({ version: -1 }).session(session);
      if ((previous?.version ?? 0) !== d.version) throw new ConflictException('Versão desatualizada.');
      const [next] = await this.discounts.create([{ ...d, version: d.version + 1, actorId: this.id(u.sub) }], { session });
      await this.event(session, u, 'discount.version.created', next.id, d.reason, d.tenantId ? this.id(d.tenantId) : undefined, previous?.toObject(), next.toObject());
      return next;
    });
  }
  private async calculate(d: D.AdminQuoteDto, tenantId: string, at: string, session?: ClientSession) {
    const promotions: Promotion[] = [];
    const couponRows = await this.eligibleCoupons(d.coupons ?? [], tenantId, at, session);
    const codes = [...(d.discounts ?? []), ...couponRows.map(c => c.discountCode)];
    if (new Set(codes).size !== codes.length) throw new BadRequestException('Não repita o mesmo desconto por cupom e concessão direta.');
    for (const code of codes) {
      const discount = await this.discounts.findOne({ code }).sort({ version: -1 }).session(session ?? null).lean();
      if (!discount) throw new BadRequestException('Desconto não encontrado.');
      const { code: promotionCode, name, kind, value, scope, modules, plans, startsAt, endsAt, maxCycles, cycle, combinable, active, tenantId: eligibleTenant } = discount;
      promotions.push({ code: promotionCode, name, kind, value, scope, modules, plans, startsAt, endsAt, maxCycles, cycle, combinable, active, tenantId: eligibleTenant });
    }
    const offers = (await this.latestOffers(session)).filter(isContractableOffer);
    try { return { snapshot: calculateQuote({ offers, modules: d.modules, cycle: d.cycle, planCode: d.planCode, promotions, installment: 1, at, tenantId }), promotions }; }
    catch (e) { throw new BadRequestException((e as Error).message); }
  }
  async quote(u: AuthUser, d: D.AdminQuoteDto, tenant?: string) {
    const tenantId = tenant ? (await this.platform(u), await this.tenant(tenant)) : await this.owner(u);
    const snapshot = (await this.calculate(d, String(tenantId), new Date().toISOString())).snapshot;
    if (tenant) return snapshot;
    const actor = await this.access.check(u, OWNERS);
    return { ...snapshot, accessComparison: permissionPreview(legacyPermissions(actor.role), actor.permissions ?? [], snapshot.modules) };
  }
  async assign(u: AuthUser, tenant: string, d: D.AssignDto) {
    await this.platform(u); const tenantId = await this.tenant(tenant);
    if (Date.parse(d.endsAt) <= Date.parse(d.startsAt) || d.graceUntil && Date.parse(d.graceUntil) < Date.parse(d.startsAt)) throw new BadRequestException('Vigência inválida.');
    return this.transaction(async session => {
      const previous = await this.subscriptions.findOne({ tenantId }).session(session);
      if ((previous?.version ?? 0) !== d.version) throw new ConflictException('Assinatura alterada. Atualize a tela.');
      const { snapshot, promotions } = await this.calculate(d, tenant, d.startsAt, session);
      if (snapshot.rejected.length) throw new BadRequestException({ message: 'Há descontos não elegíveis na contratação.', rejected: snapshot.rejected });
      for (const coupon of await this.eligibleCoupons(d.coupons ?? [], tenant, d.startsAt, session)) {
        const changed = await this.coupons.updateOne({ _id: coupon._id, version: coupon.version, active: true, uses: { $lt: coupon.maxUses } }, { $inc: { uses: 1 } }, { session });
        if (changed.modifiedCount !== 1) throw new ConflictException('Cupom alterado ou limite atingido.');
        await this.redemptions.create([{ tenantId, couponId: coupon._id, subscriptionVersion: d.version + 1, actorId: this.id(u.sub) }], { session });
        await this.event(session, u, 'coupon.redeemed', coupon.id, d.reason, tenantId, undefined, { code: coupon.code, subscriptionVersion: d.version + 1 });
      }
      const values = { tenantId, snapshot, promotions, version: d.version + 1, status: d.status, startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt), nextDueAt: new Date(d.nextDueAt), ...(d.graceUntil ? { graceUntil: new Date(d.graceUntil) } : {}), installment: 1, actorId: this.id(u.sub) };
      const next = previous ? await this.subscriptions.findOneAndUpdate({ _id: previous._id, version: d.version }, { $set: values, $unset: { scheduled: 1, ...(!d.graceUntil ? { graceUntil: 1 } : {}) } }, { new: true, session, runValidators: true }) : (await this.subscriptions.create([values], { session }))[0];
      if (!next) throw new ConflictException('Assinatura alterada.');
      await this.event(session, u, previous ? 'subscription.changed' : 'subscription.created', next.id, d.reason, tenantId, previous?.toObject(), next.toObject());
      return next;
    });
  }
  async status(u: AuthUser, tenant: string, d: D.StatusDto) {
    await this.platform(u); const tenantId = await this.tenant(tenant);
    return this.transaction(async session => {
      const previous = await this.subscriptions.findOne({ tenantId, version: d.version }).session(session);
      if (!previous) throw new ConflictException('Assinatura ausente ou versão desatualizada.');
      const effective = effectiveCommercialState(previous.toObject(), new Date());
      const next = await this.subscriptions.findOneAndUpdate({ _id: previous._id, version: d.version }, { $set: { snapshot: effective.snapshot, promotions: effective.promotions, startsAt: effective.startsAt, endsAt: effective.endsAt, nextDueAt: effective.nextDueAt, installment: effective.installment, status: d.status, actorId: this.id(u.sub) }, $unset: { scheduled: 1 }, $inc: { version: 1 } }, { new: true, session });
      if (!next) throw new ConflictException('Assinatura alterada.');
      await this.event(session, u, `subscription.${d.status.toLowerCase()}`, next.id, d.reason, tenantId, { status: previous.status, version: previous.version }, { status: next.status, version: next.version });
      return next;
    });
  }
  async detail(u: AuthUser, tenant?: string) {
    const tenantId = tenant ? (await this.platform(u), await this.tenant(tenant)) : await this.owner(u);
    const stored = await this.subscriptions.findOne({ tenantId }).select('-actorId -__v').lean();
    const subscription = stored ? effectiveCommercialState(stored, new Date()) : null;
    const usage = { activeUsers: await this.access.users.countDocuments({ tenantId, status: UserStatus.ACTIVE }), products: await this.connection.collection('products_v2').countDocuments({ tenantId }), categories: await this.connection.collection('product_categories_v2').countDocuments({ tenantId }) };
    return { subscription, currentPrice: subscription ? this.contractPrice(subscription, new Date()) : null, usage, modules: subscription && permittedSubscription(subscription, new Date()) ? supportedModules(subscription.snapshot.modules) : [], availableModules: MODULE_CODES };
  }
  async listInvoices(u: AuthUser, page: number, limit: number, tenant?: string) {
    const tenantId = tenant ? (await this.platform(u), await this.tenant(tenant)) : await this.owner(u);
    const items = await this.invoices.find({ tenantId }).sort({ dueAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).select('-actorId -__v').lean();
    return { items: items.map(i => ({ ...i, status: i.status === 'OPEN' && i.dueAt < new Date() ? 'OVERDUE' : i.status })), total: await this.invoices.countDocuments({ tenantId }), page, limit };
  }
  async createInvoice(u: AuthUser, tenant: string, d: D.InvoiceDto) {
    await this.platform(u); const tenantId = await this.tenant(tenant);
    return this.transaction(async session => {
      const subscription = await this.subscriptions.findOne({ tenantId }).session(session);
      if (subscription?.scheduled && subscription.scheduled.effectiveAt <= new Date()) {
        const effective = effectiveCommercialState(subscription.toObject(), new Date());
        const reason = subscription.scheduled.reason;
        subscription.set({ snapshot: effective.snapshot, promotions: effective.promotions, startsAt: effective.startsAt, endsAt: effective.endsAt, nextDueAt: effective.nextDueAt, status: effective.status, graceUntil: effective.graceUntil, installment: 1, scheduled: undefined });
        await subscription.save({ session });
        await this.event(session, u, 'subscription.schedule.materialized', subscription.id, reason, tenantId, undefined, { effectiveAt: effective.startsAt, planCode: effective.snapshot.planCode });
      }
      if (!subscription || ['TRIAL', 'EXPIRED', 'SUSPENDED'].includes(subscription.status)) throw new BadRequestException('Assinatura não permite gerar cobrança.');
      const snapshot = this.contractPrice(subscription, new Date(d.dueAt));
      const [invoice] = await this.invoices.create([{ tenantId, subscriptionId: subscription._id, competence: d.competence, snapshot, dueAt: new Date(d.dueAt), status: 'DRAFT', version: 0, note: d.reason, actorId: this.id(u.sub) }], { session });
      await this.subscriptions.updateOne({ _id: subscription._id, version: subscription.version }, { $inc: { installment: 1, version: 1 } }, { session });
      await this.event(session, u, 'invoice.created', invoice.id, d.reason, tenantId, undefined, { competence: d.competence, totalCents: snapshot.totalCents, status: invoice.status });
      return invoice;
    });
  }
  async invoiceAction(u: AuthUser, tenant: string, id: string, d: D.InvoiceActionDto) {
    await this.platform(u); const tenantId = await this.tenant(tenant), _id = this.id(id);
    return this.transaction(async session => {
      const previous = await this.invoices.findOne({ _id, tenantId }).session(session);
      if (!previous) throw new NotFoundException('Cobrança não encontrada.');
      if (previous.version !== d.version || ['PAID', 'CANCELED', 'WAIVED'].includes(previous.status)) throw new ConflictException('Cobrança encerrada ou alterada.');
      if (d.status === 'OPEN' && previous.status !== 'DRAFT' || d.status === 'PAID' && !['OPEN', 'OVERDUE'].includes(previous.status)) throw new BadRequestException('Transição não permitida.');
      if (d.status === 'PAID' && !d.method?.trim()) throw new BadRequestException('Informe a forma do pagamento confirmado.');
      const next = await this.invoices.findOneAndUpdate({ _id, tenantId, version: d.version }, { $set: { status: d.status, note: d.reason, actorId: this.id(u.sub), ...(d.status === 'PAID' ? { paidAt: new Date(), method: d.method, reference: d.reference } : {}) }, $inc: { version: 1 } }, { new: true, runValidators: true, session });
      if (!next) throw new ConflictException('Cobrança alterada.');
      await this.event(session, u, `invoice.${d.status.toLowerCase()}`, id, d.reason, tenantId, { status: previous.status, version: previous.version }, { status: next.status, version: next.version, totalCents: next.snapshot.totalCents });
      return next;
    });
  }
  async request(u: AuthUser, d: D.SubscriptionRequestDto) {
    const tenantId = await this.owner(u);
    return this.transaction(async session => {
      await this.access.tenants.updateOne({ _id: tenantId }, { $inc: { membershipVersion: 1 } }, { session });
      if (await this.requests.countDocuments({ tenantId, status: 'PENDING' }).session(session) >= 10) throw new ConflictException('Há solicitações pendentes. Aguarde a análise.');
      const snapshot = d.kind === 'CHANGE' ? (await this.calculate(d, String(tenantId), new Date().toISOString(), session)).snapshot : undefined;
      const [request] = await this.requests.create([{ tenantId, actorId: this.id(u.sub), kind: d.kind, note: d.note, status: 'PENDING', version: 0, snapshot }], { session });
      await this.event(session, u, 'subscription.requested', request.id, d.note, tenantId, undefined, { kind: d.kind, status: 'PENDING' });
      return request;
    });
  }
  async listRequests(u: AuthUser, page: number, limit: number, tenant?: string) {
    const tenantId = tenant ? (await this.platform(u), await this.tenant(tenant)) : await this.owner(u);
    return { items: await this.requests.find({ tenantId }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).select('-actorId -__v').lean(), total: await this.requests.countDocuments({ tenantId }), page, limit };
  }
  async decideRequest(u: AuthUser, tenant: string, id: string, d: D.RequestDecisionDto) {
    await this.platform(u); const tenantId = await this.tenant(tenant);
    return this.transaction(async session => {
      const request = await this.requests.findOne({ _id: this.id(id), tenantId, status: 'PENDING', version: d.version }).session(session);
      if (!request) throw new ConflictException('Solicitação ausente ou já decidida.');
      if (d.status === 'APPROVED') {
        const stored = await this.subscriptions.findOne({ tenantId }).session(session).lean();
        const subscription = stored ? effectiveCommercialState(stored, new Date()) : null;
        const matches = request.kind === 'CANCEL' ? subscription?.status === 'CANCELED' : subscription && request.snapshot && subscription.snapshot.planCode === request.snapshot.planCode && subscription.snapshot.cycle === request.snapshot.cycle && JSON.stringify([...subscription.snapshot.modules].sort()) === JSON.stringify([...request.snapshot.modules].sort());
        if (!matches) throw new ConflictException('Aplique a alteração contratual correspondente antes de aprovar a solicitação.');
      }
      request.status = d.status; request.version += 1; await request.save({ session });
      await this.event(session, u, `subscription.request.${d.status.toLowerCase()}`, request.id, d.reason, tenantId, { status: 'PENDING' }, { status: d.status }); return request;
    });
  }
  async editInvoice(u: AuthUser, tenant: string, id: string, d: D.EditInvoiceDto) {
    await this.platform(u); const tenantId = await this.tenant(tenant);
    return this.transaction(async session => {
      const previous = await this.invoices.findOne({ _id: this.id(id), tenantId, version: d.version, status: 'DRAFT' }).session(session);
      if (!previous) throw new ConflictException('Somente rascunhos na versão atual podem ser corrigidos.');
      const next = await this.invoices.findOneAndUpdate({ _id: previous._id, tenantId, version: d.version, status: 'DRAFT' }, { $set: { dueAt: new Date(d.dueAt), competence: d.competence, note: d.reason, actorId: this.id(u.sub) }, $inc: { version: 1 } }, { session, returnDocument: 'after', runValidators: true });
      if (!next) throw new ConflictException('Cobrança alterada.');
      await this.event(session, u, 'invoice.draft.corrected', id, d.reason, tenantId, { dueAt: previous.dueAt, competence: previous.competence }, { dueAt: next.dueAt, competence: next.competence }); return next;
    });
  }
  async history(u: AuthUser, tenant: string, page: number, limit: number) { await this.platform(u); const tenantId = await this.tenant(tenant); return { items: await this.events.find({ tenantId }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), total: await this.events.countDocuments({ tenantId }), page, limit }; }
  async schedule(u: AuthUser, tenant: string, d: D.AssignDto) {
    await this.platform(u); const tenantId = await this.tenant(tenant);
    if (Date.parse(d.startsAt) <= Date.now() || Date.parse(d.endsAt) <= Date.parse(d.startsAt)) throw new BadRequestException('Informe uma vigência futura válida.');
    if (d.coupons?.length) throw new BadRequestException('Cupons devem ser confirmados em contratação imediata. Para agendar, utilize um desconto negociado.');
    return this.transaction(async session => {
      const previous = await this.subscriptions.findOne({ tenantId, version: d.version }).session(session);
      if (!previous) throw new ConflictException('Assinatura ausente ou alterada.');
      const { snapshot, promotions } = await this.calculate(d, tenant, d.startsAt, session);
      if (snapshot.rejected.length) throw new BadRequestException('Desconto não elegível na data agendada.');
      const scheduled = { effectiveAt: new Date(d.startsAt), startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt), nextDueAt: new Date(d.nextDueAt), graceUntil: d.graceUntil ? new Date(d.graceUntil) : undefined, status: d.status, snapshot, promotions, reason: d.reason };
      const next = await this.subscriptions.findOneAndUpdate({ _id: previous._id, version: d.version }, { $set: { scheduled }, $inc: { version: 1 } }, { session, returnDocument: 'after', runValidators: true });
      if (!next) throw new ConflictException('Assinatura alterada.');
      await this.event(session, u, 'subscription.change.scheduled', next.id, d.reason, tenantId, { totalCents: previous.snapshot.totalCents, modules: previous.snapshot.modules }, scheduled); return next;
    });
  }
  private async eligibleCoupons(codes: string[], tenantId: string, at: string, session?: ClientSession) {
    const rows = [] as Awaited<ReturnType<typeof this.coupons.find>>;
    for (const code of codes) {
      const row = await this.coupons.findOne({ code, active: true, startsAt: { $lte: new Date(at) }, endsAt: { $gt: new Date(at) } }).session(session ?? null);
      if (!row || row.uses >= row.maxUses || await this.redemptions.countDocuments({ couponId: row._id, tenantId: this.id(tenantId) }).session(session ?? null) >= row.perTenant) throw new BadRequestException('Cupom indisponível para esta contratação.');
      rows.push(row);
    }
    return rows;
  }
  async listCoupons(u: AuthUser, page: number, limit: number) { await this.platform(u); return { items: await this.coupons.find().sort({ code: 1 }).skip((page - 1) * limit).limit(limit).select('-actorId -__v').lean(), total: await this.coupons.countDocuments(), page, limit }; }
  async saveCoupon(u: AuthUser, d: D.CouponDto) {
    await this.platform(u);
    if (Date.parse(d.endsAt) <= Date.parse(d.startsAt) || d.perTenant > d.maxUses) throw new BadRequestException('Validade ou limites do cupom inválidos.');
    return this.transaction(async session => {
      if (!await this.discounts.exists({ code: d.discountCode }).session(session)) throw new BadRequestException('Desconto não encontrado.');
      const previous = await this.coupons.findOne({ code: d.code }).session(session);
      if ((previous?.version ?? 0) !== d.version) throw new ConflictException('Cupom alterado.');
      if (previous && (d.maxUses < previous.uses || previous.uses > 0 && (d.discountCode !== previous.discountCode || d.perTenant !== previous.perTenant))) throw new ConflictException('Preserve as regras do cupom já utilizado; crie outro código.');
      const values = { ...d, startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt), version: d.version + 1, actorId: this.id(u.sub) };
      const next = previous ? await this.coupons.findOneAndUpdate({ _id: previous._id, version: d.version }, { $set: values }, { session, returnDocument: 'after', runValidators: true }) : (await this.coupons.create([{ ...values, uses: 0 }], { session }))[0];
      if (!next) throw new ConflictException('Cupom alterado.');
      await this.event(session, u, 'coupon.updated', next.id, d.reason, undefined, previous?.toObject(), next.toObject()); return next;
    });
  }
  async dashboard(u: AuthUser) {
    await this.platform(u); const now = new Date();
    const subscriptions = (await this.subscriptions.find().lean()).map(s => effectiveCommercialState(s, now));
    const permitted = subscriptions.filter(s => permittedSubscription(s, now));
    const mrrCents = permitted.filter(s => s.status !== 'TRIAL').reduce((sum, s) => { const quote = this.contractPrice(s, now); return sum + (quote.cycle === 'ANNUAL' ? Math.round(quote.totalCents / 12) : quote.totalCents); }, 0);
    const paid = await this.invoices.aggregate([{ $match: { status: 'PAID' } }, { $group: { _id: '$snapshot.currency', cents: { $sum: '$snapshot.totalCents' }, count: { $sum: 1 } } }]);
    return { companies: await this.access.tenants.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]), subscriptions: SUBSCRIPTION_COUNTS(subscriptions), projectedMrrCents: mrrCents, projectedArrCents: mrrCents * 12, received: paid, nextInvoices: await this.invoices.find({ status: { $in: ['OPEN', 'OVERDUE'] } }).sort({ dueAt: 1 }).limit(20).select('tenantId dueAt status snapshot.totalCents snapshot.currency').lean(), pendingRequests: await this.requests.find({ status: 'PENDING' }).sort({ createdAt: 1 }).limit(50).lean() };
  }
  private contractPrice(subscription: CommercialSubscription, at: Date) {
    const old = subscription.snapshot;
    const offers: Offer[] = old.items.map(i => ({ code: i.code, kind: old.planCode !== 'CUSTOM' ? 'PLAN' : i.code === 'BASE' ? 'BASE' : 'MODULE', name: i.name, description: '', version: i.version, monthlyCents: old.cycle === 'MONTHLY' ? i.unitCents : 0, annualCents: old.cycle === 'ANNUAL' ? i.unitCents : undefined, currency: 'BRL', modules: old.modules, active: true, available: true, order: 0, featured: false, limits: old.limits }));
    for (const code of old.modules) if (!offers.some(o => o.code === code)) offers.push({ ...offers[0], code, kind: 'MODULE', monthlyCents: 0, annualCents: 0 });
    return calculateQuote({ offers, modules: old.planCode === 'CUSTOM' ? old.modules : [], planCode: old.planCode, cycle: old.cycle, promotions: subscription.promotions, installment: subscription.installment, at: at.toISOString(), tenantId: String(subscription.tenantId), preserveSnapshotModules: true });
  }
}
function SUBSCRIPTION_COUNTS(subscriptions: { status: string }[]) { const counts: Record<string, number> = {}; for (const s of subscriptions) counts[s.status] = (counts[s.status] ?? 0) + 1; return counts; }
