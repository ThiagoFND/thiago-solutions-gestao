import { BadRequestException, ConflictException, Injectable, Inject, Scope, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../common/auth-user.js';
import { Product } from '../products/product.schema.js';
import * as D from './finance.dto.js';
import { EntryKind, FinancialAction as Action, FinancialFrequency as Frequency, FinancialStatus as Status, FinancialType as Kind } from './finance.enums.js';
import { civilDate, competence, effectiveStatus, normalizedName, occurrences, safeSum, todayRecife } from './finance.helpers.js';
import { FinancialCategory } from './schemas/financial-category.schema.js';
import { FinancialEntry } from './schemas/financial-entry.schema.js';
import { FinancialRecurrence } from './schemas/financial-recurrence.schema.js';

import { REQUEST } from '@nestjs/core';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import { UserRole } from '../common/enums.js';

type Row = Record<string, any>;
const fields = ['description', 'categoryId', 'type', 'nature', 'expectedAmountCents', 'notes', 'supplier', 'production'];
const pick = (source: Row, keys: string[]) => Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
const clean = (source: Row) => Object.fromEntries(Object.entries(source).filter(([, value]) => value !== null && value !== undefined));
const duplicate = (error: unknown) => (error as { code?: number }).code === 11000;

@Injectable({ scope: Scope.REQUEST })
export class FinanceService implements OnModuleInit {
  constructor(
    @Inject(REQUEST) private readonly request: { user: AuthUser },
    private readonly access: TenantAccessService,
    @InjectModel(FinancialCategory.name) private readonly categories: Model<FinancialCategory>,
    @InjectModel(FinancialEntry.name) private readonly entries: Model<FinancialEntry>,
    @InjectModel(FinancialRecurrence.name) private readonly recurrences: Model<FinancialRecurrence>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
  ) {}

  async onModuleInit() {
    // No bootstrap database writes. Categories are created explicitly by ADMIN.
  }

  private tenant() { return this.access.scope(this.request.user, [...OWNERS, UserRole.ACCOUNTANT]); }
  async productsCatalog(query: D.PageDto) {
    const filter = { tenantId: await this.tenant() }, page = query.page ?? 1, limit = query.limit ?? 20;
    const items = await this.products.find(filter).select('_id name active').sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean();
    const total = await this.products.countDocuments(filter);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  private id(value: string) {
    if (!/^[a-f\d]{24}$/i.test(value)) throw new BadRequestException('Identificador inválido.');
    return new Types.ObjectId(value);
  }
  private async find(model: Model<any>, id: string): Promise<Row> {
    const row = await model.findOne({ _id: this.id(id), tenantId: await this.tenant() }).lean().exec();
    if (!row) throw new NotFoundException('Registro financeiro não encontrado.');
    return row as Row;
  }
  private author(user: AuthUser) { return { tenantId: this.id(this.request.user.tenantId!), createdById: this.id(user.sub), createdByName: user.name }; }
  private snapshot(row: Row) { return pick(row, [...fields, 'entryKind', 'purchaseDate', 'competenceDate', 'quantity', 'unit', 'dueDate', 'competence', 'status', 'payment', 'version', 'recurring', 'recurrenceId', 'occurrenceKey', 'installmentNumber']); }
  private event(action: Action, user: AuthUser, before?: Row, after?: Row, reason?: string) {
    return { _id: new Types.ObjectId(), action, occurredAt: new Date(), userId: this.id(user.sub), userName: user.name, before: before ? this.snapshot(before) : undefined, after: after ? this.snapshot(after) : undefined, reason };
  }
  serialize(row: Row) {
    const { history, ...result } = row;
    return { ...result, status: effectiveStatus(row as any), differenceCents: row.payment ? row.payment.paidAmountCents - row.expectedAmountCents : null };
  }
  private checkVersion(row: Row, version?: number) {
    if (version !== undefined && row.version !== version) throw new ConflictException('O registro foi alterado. Atualize a tela e tente novamente.');
  }
  private async template(dto: Row, previous?: Row) {
    const value = clean({ ...pick(previous ?? {}, fields), ...pick(dto, fields) });
    if (dto.production && previous?.production) value.production = clean({ ...previous.production, ...pick(dto.production, Object.keys(dto.production)) });
    else if (value.production) value.production = clean(value.production);
    if (value.type !== Kind.CUSTO_PRODUCAO) {
      if (dto.production) throw new BadRequestException('Dados de produção são exclusivos de custos de produção.');
      delete value.production;
    }
    if (!Number.isSafeInteger(value.expectedAmountCents) || value.expectedAmountCents < 1 || value.expectedAmountCents > 1e12) throw new BadRequestException('Valor inválido em centavos.');
    const category = await this.find(this.categories, String(value.categoryId));
    if (category.type !== value.type) throw new BadRequestException('A categoria deve pertencer ao tipo do lançamento.');
    if (!category.active && String(previous?.categoryId) !== String(category._id)) throw new BadRequestException('Selecione uma categoria ativa.');
    value.categoryId = category._id;
    if ((value.production?.quantity != null) !== (value.production?.unit != null)) throw new BadRequestException('Informe quantidade e unidade juntas.');
    if (value.production?.totalAmountCents !== undefined && value.production.totalAmountCents !== value.expectedAmountCents) throw new BadRequestException('O total de produção deve coincidir com o valor previsto.');
    if (value.production?.productId) {
      const productId = this.id(String(value.production.productId));
      if (!await this.products.exists({ tenantId: await this.tenant(), _id: productId })) throw new BadRequestException('Produto não encontrado.');
      value.production.productId = productId;
    }
    return value;
  }
  private async page(model: Model<any>, filter: Row, query: D.PageDto, sort: Row, excludeHistory = false) {
    filter = { ...filter, tenantId: await this.tenant() };
    const page = query.page ?? 1, limit = query.limit ?? 20;
    const [items, total] = await Promise.all([model.find(filter).select(excludeHistory ? '-history' : '').sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(), model.countDocuments(filter)]);
    return { items: excludeHistory ? items.map(row => this.serialize(row)) : items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  private purchaseFields(dto: Row, previous: Row = {}) {
    const value={...pick(previous,['entryKind','purchaseDate','competenceDate','quantity','unit']),...pick(dto,['entryKind','purchaseDate','competenceDate','quantity','unit'])};
    if(value.purchaseDate && civilDate(value.purchaseDate)>todayRecife()) throw new BadRequestException('A data da compra não pode ser futura.');
    if(value.competenceDate && civilDate(value.competenceDate).slice(0,7)!==(dto.competence??previous.competence)) throw new BadRequestException('A data de competência deve pertencer ao m?s informado.');
    if((value.quantity!==undefined)!==(value.unit!==undefined)) throw new BadRequestException('Informe quantidade e unidade juntas.');
    if(value.entryKind===EntryKind.INPUT_PURCHASE && !value.purchaseDate) throw new BadRequestException('Informe a data da compra de insumos.');
    const type=dto.type??previous.type;
    if(value.entryKind===EntryKind.OPERATING_EXPENSE && type!==Kind.DESPESA_OPERACIONAL || value.entryKind===EntryKind.PRODUCTION_COST && type!==Kind.CUSTO_PRODUCAO || value.entryKind===EntryKind.PERSONAL_EXPENSE && type!==Kind.DESPESA_PESSOAL || value.entryKind===EntryKind.INPUT_PURCHASE && type===Kind.DESPESA_PESSOAL) throw new BadRequestException('Classificação incompatível com o tipo financeiro.');
    return value;
  }
  async createEntry(dto: D.CreateEntryDto, user: AuthUser) {
    if (!dto.dueDate && !dto.purchaseDate) throw new BadRequestException('Informe a data da compra ou o vencimento.');
    const data: Row = { ...await this.template(dto), ...this.purchaseFields(dto), dueDate: civilDate(dto.dueDate ?? dto.purchaseDate!), competence: competence(dto.competence), status: Status.PENDENTE, version: 0, recurring: false, ...this.author(user) };
    if (dto.entryKind === EntryKind.RECURRING) throw new BadRequestException('Cadastre contas recorrentes na ?rea Recorr?ncias.');
    if (dto.initialPayment) {
      const p=dto.initialPayment;
      if(civilDate(p.paidOn)>todayRecife() || (dto.purchaseDate && p.paidOn<dto.purchaseDate)) throw new BadRequestException('A data de pagamento deve ser igual ou posterior ? compra e não pode ser futura.');
      if(p.paidAmountCents !== data.expectedAmountCents) throw new BadRequestException('O pagamento inicial deve corresponder ao valor da compra.');
      data.payment={...p,registeredAt:new Date(),registeredById:this.id(user.sub),registeredByName:user.name}; data.status=Status.PAGO;
    }
    const entry = await this.entries.create({ ...data, history: [this.event(Action.CRIACAO, user, undefined, data)] });
    return this.serialize(entry.toObject());
  }
  async getEntry(id: string) { return this.serialize(await this.find(this.entries, id)); }
  listEntries(query: D.EntriesQueryDto) {
    const filter: Row = pick(query, ['type', 'nature', 'entryKind']);
    if (query.competence) filter.competence = competence(query.competence);
    if (query.categoryId) filter.categoryId = this.id(query.categoryId);
    for (const field of ['origin', 'method'] as const) if (query[field]) filter[`payment.${field}`] = query[field];
    const dates: Row = {};
    if (query.dateFrom) dates.$gte = civilDate(query.dateFrom);
    if (query.dateTo) dates.$lte = civilDate(query.dateTo);
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) throw new BadRequestException('Data inicial deve ser anterior ou igual à final.');
    if (query.dueDate) dates.$eq = civilDate(query.dueDate);
    if (query.status === Status.VENCIDO) { filter.status = Status.PENDENTE; dates.$lt = todayRecife(); }
    else if (query.status === Status.PENDENTE) { filter.status = Status.PENDENTE; dates.$gte = dates.$gte && dates.$gte > todayRecife() ? dates.$gte : todayRecife(); }
    else if (query.status) filter.status = query.status;
    if (Object.keys(dates).length) filter.dueDate = dates;
    if (query.description) filter.description = { $regex: query.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    return this.page(this.entries, filter, query, { dueDate: 1, _id: 1 }, true);
  }
  private async mutate(row: Row, changes: Row, user: AuthUser, action: Action, reason?: string) {
    const after: Row = { ...row, ...changes, version: row.version + 1 };
    const unset = Object.fromEntries(Object.keys(changes).filter(key => changes[key] === null).map(key => [key, 1]));
    for (const key of Object.keys(unset)) delete after[key];
    const updated = await this.entries.findOneAndUpdate({ tenantId: await this.tenant(), _id: row._id, version: row.version, status: row.status }, {
      $set: clean(changes), ...(Object.keys(unset).length ? { $unset: unset } : {}), $inc: { version: 1 }, $push: { history: this.event(action, user, row, after, reason) },
    }, { new: true, runValidators: true }).lean().exec();
    if (!updated) throw new ConflictException('O registro foi alterado simultaneamente. Atualize a tela.');
    return this.serialize(updated);
  }
  async updateEntry(id: string, dto: D.UpdateEntryDto, user: AuthUser) {
    const row = await this.find(this.entries, id); this.checkVersion(row, dto.version);
    if (row.status !== Status.PENDENTE) throw new ConflictException('Somente contas pendentes ou vencidas podem ser editadas.');
    const template = await this.template(dto, row);
    const changes: Row = { ...template, ...this.purchaseFields(dto, row) };
    for (const key of ['notes', 'supplier', 'production']) if (row[key] !== undefined && template[key] === undefined) changes[key] = null;
    if (dto.dueDate !== undefined) changes.dueDate = civilDate(dto.dueDate);
    if (dto.competence !== undefined) changes.competence = competence(dto.competence);
    return this.mutate(row, changes, user, Action.EDICAO);
  }
  async payment(id: string, dto: D.PaymentDto | D.CorrectPaymentDto, user: AuthUser, correction = false) {
    const row = await this.find(this.entries, id); this.checkVersion(row, dto.version);
    if (row.status !== (correction ? Status.PAGO : Status.PENDENTE)) throw new ConflictException(correction ? 'Somente pagamentos concluídos podem ser corrigidos.' : 'Esta conta não está disponível para pagamento.');
    const correct = dto as D.CorrectPaymentDto;
    if (correction && (correct.confirmed !== true || !correct.reason?.trim())) throw new BadRequestException('Confirme a correção e informe a justificativa.');
    if (civilDate(dto.paidOn) > todayRecife()) throw new BadRequestException('A data do pagamento não pode ser futura.');
    if (!Number.isSafeInteger(dto.paidAmountCents) || dto.paidAmountCents < 1 || dto.paidAmountCents > 1e12) throw new BadRequestException('Valor pago inválido em centavos.');
    const payment = clean({ ...(correction ? row.payment : { registeredAt: new Date(), registeredById: this.id(user.sub), registeredByName: user.name }), ...pick(dto, ['paidAmountCents', 'paidOn', 'origin', 'method', 'notes']), ...(correction ? { correctedAt: new Date(), correctedById: this.id(user.sub), correctedByName: user.name } : {}) });
    return this.mutate(row, { payment, status: Status.PAGO }, user, correction ? Action.CORRECAO_PAGAMENTO : Action.PAGAMENTO, correction ? correct.reason : undefined);
  }
  async cancel(id: string, dto: D.CancelDto, user: AuthUser) {
    const row = await this.find(this.entries, id); this.checkVersion(row, dto.version);
    if (row.status !== Status.PENDENTE) throw new ConflictException('Somente contas pendentes ou vencidas podem ser canceladas.');
    return this.mutate(row, { status: Status.CANCELADO }, user, Action.CANCELAMENTO, dto.reason);
  }
  async history(id: string, query: D.PageDto) {
    const row = await this.find(this.entries, id), page = query.page ?? 1, limit = query.limit ?? 20;
    const history = [...row.history].reverse();
    return { items: history.slice((page - 1) * limit, page * limit), total: history.length, page, limit, totalPages: Math.ceil(history.length / limit) };
  }
  listCategories(query: D.CatalogQueryDto) { return this.page(this.categories, pick(query, ['active', 'type']), query, { name: 1, _id: 1 }); }
  async createCategory(dto: D.CategoryDto, user: AuthUser) {
    await this.tenant();
    try { return await this.categories.create({ name: dto.name, normalizedName: normalizedName(dto.name), type: dto.type, ...this.author(user) }); }
    catch (error) { if (duplicate(error)) throw new ConflictException('Já existe uma categoria com este nome e tipo.'); throw error; }
  }
  async updateCategory(id: string, dto: D.UpdateCategoryDto) {
    const row = await this.find(this.categories, id);
    if (dto.type && dto.type !== row.type && (await this.entries.exists({ tenantId: await this.tenant(), categoryId: row._id }) || await this.recurrences.exists({ tenantId: await this.tenant(), categoryId: row._id }))) throw new ConflictException('O tipo de uma categoria utilizada não pode ser alterado.');
    const changes = pick(dto, ['name', 'type', 'active']);
    if (dto.name !== undefined) changes.normalizedName = normalizedName(dto.name);
    try { return await this.categories.findOneAndUpdate({ _id: row._id, tenantId: await this.tenant() }, { $set: changes }, { new: true, runValidators: true }).lean(); }
    catch (error) { if (duplicate(error)) throw new ConflictException('Já existe uma categoria com este nome e tipo.'); throw error; }
  }
  listRecurrences(query: D.CatalogQueryDto) { return this.page(this.recurrences, pick(query, ['active', 'type']), query, { startDate: 1, _id: 1 }); }
  getRecurrence(id: string) { return this.find(this.recurrences, id); }
  async createRecurrence(dto: D.CreateRecurrenceDto, user: AuthUser) {
    civilDate(dto.startDate);
    if (dto.frequency === Frequency.MENSAL) {
      if (!dto.billingDay) throw new BadRequestException('Informe o dia habitual da cobrança mensal.');
      const [year, month, day] = dto.startDate.split('-').map(Number);
      if (day !== Math.min(dto.billingDay, new Date(Date.UTC(year, month, 0)).getUTCDate())) throw new BadRequestException('A primeira data deve corresponder ao dia habitual de cobrança, limitado ao fim do mês.');
    }
    const row = await this.recurrences.create({ ...await this.template(dto), ...pick(dto, ['frequency', 'startDate', 'billingDay', 'installments']), ...this.author(user) });
    await this.generate(String(row._id), dto.startDate.slice(0, 7), user);
    return row;
  }
  async updateRecurrence(id: string, dto: D.UpdateRecurrenceDto) {
    const row = await this.find(this.recurrences, id); this.checkVersion(row, dto.version);
    const changes = { ...await this.template(dto, row), ...pick(dto, ['active']) };
    const unset = Object.fromEntries(['notes', 'supplier', 'production'].filter(key => row[key] !== undefined && changes[key] === undefined).map(key => [key, 1]));
    const updated = await this.recurrences.findOneAndUpdate({ tenantId: await this.tenant(), _id: row._id, version: row.version }, { $set: changes, ...(Object.keys(unset).length ? { $unset: unset } : {}), $inc: { version: 1 } }, { new: true, runValidators: true }).lean();
    if (!updated) throw new ConflictException('A recorrência foi alterada simultaneamente. Atualize a tela.');
    return updated;
  }
  async generate(id: string, month: string, user: AuthUser) {
    const row = await this.find(this.recurrences, id); competence(month);
    if (!row.active) throw new ConflictException('A recorrência está desativada.');
    let template: Row | undefined;
    const result: Row[] = []; let created = 0, existing = 0;
    for (const occurrence of occurrences(row as any, month)) {
      const key = { tenantId: await this.tenant(), recurrenceId: row._id, occurrenceKey: occurrence.occurrenceKey };
      const prior = await this.entries.findOne(key).lean();
      if (prior) { existing++; result.push(this.serialize(prior)); continue; }
      // Existing occurrences remain readable after category deactivation; only new associations require activity.
      template ??= await this.template(row);
      const data = { ...template, ...key, ...occurrence, competence: month, entryKind: EntryKind.RECURRING, recurring: true, status: Status.PENDENTE, version: 0, ...this.author(user) };
      try {
        const write = await this.entries.updateOne(key, { $setOnInsert: { ...data, history: [this.event(Action.CRIACAO, user, undefined, data)] } }, { upsert: true, runValidators: true });
        if (write.upsertedCount) created++; else existing++;
      } catch (error) { if (duplicate(error)) existing++; else throw error; }
      const entry = await this.entries.findOne(key).lean();
      if (entry) result.push(this.serialize(entry));
    }
    return { competence: month, created, existing, entries: result, ...(result.length ? {} : { message: 'Nenhuma ocorrência prevista nesta competência.' }) };
  }
  async summary(query: D.MonthDto) {
    const month = competence(`${query.year}-${String(query.month).padStart(2, '0')}`);
    const rows = await this.entries.find({ tenantId: await this.tenant(), competence: month }).select('-history').lean();
    const categories = await this.categories.find({ tenantId: await this.tenant(), _id: { $in: rows.map(row => row.categoryId) } }).lean();
    const names = new Map(categories.map(row => [String(row._id), row.name]));
    const result: Row = { competence: month, count: 0, canceledCount: 0, expectedCents: 0, paidCents: 0, pendingCents: 0, overdueCents: 0, productionCostsCents: 0, operationalExpensesCents: 0, personalExpensesCents: 0, paidPfCents: 0, paidPjCents: 0 };
    const groups = new Map<string, Row>();
    const add = (target: Row, key: string, amount: number) => target[key] = safeSum(target[key], amount);
    for (const row of rows) {
      if (row.status === Status.CANCELADO) { result.canceledCount++; continue; }
      const id = String(row.categoryId);
      if (!groups.has(id)) groups.set(id, { categoryId: id, categoryName: names.get(id) ?? 'Categoria indisponível', type: row.type, count: 0, expectedCents: 0, paidCents: 0, pendingCents: 0, overdueCents: 0 });
      const group = groups.get(id)!; result.count++; group.count++;
      for (const target of [result, group]) {
        add(target, 'expectedCents', row.expectedAmountCents);
        const status = effectiveStatus(row);
        if (status === Status.PAGO) add(target, 'paidCents', row.payment!.paidAmountCents);
        else add(target, status === Status.VENCIDO ? 'overdueCents' : 'pendingCents', row.expectedAmountCents);
      }
      add(result, row.type === Kind.CUSTO_PRODUCAO ? 'productionCostsCents' : row.type === Kind.DESPESA_PESSOAL ? 'personalExpensesCents' : 'operationalExpensesCents', row.expectedAmountCents);
      if (row.payment && row.status === Status.PAGO) add(result, row.payment.origin === 'PF' ? 'paidPfCents' : 'paidPjCents', row.payment.paidAmountCents);
    }
    return { ...result, byCategory: [...groups.values()].sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'pt-BR')) };
  }
}
