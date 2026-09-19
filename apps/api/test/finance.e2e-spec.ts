import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { boot as secureBoot, fixture, login as secureLogin, ORIGIN } from './security-harness.js';

const withMongo = process.env.TEST_MONGODB_URI ? describe : describe.skip;
const OPER = 'DESPESA_OPERACIONAL';
const COST = 'CUSTO_PRODUCAO';

withMongo('Financeiro completo (MongoDB real)', () => {
  let app: INestApplication<App>;
  let admin: string;
  let kitchen: string;
  let cashier: string;
  let category: string;
  let costCategory: string;
  let persistedId: string;
  let product: any;
  const runId = new Types.ObjectId().toString();
  const listCategories = async () => {
    const items: any[] = [];
    for (let page = 1; ; page++) {
      const result = (await api('get', `/finance/categories?limit=100&page=${page}`).expect(200)).body;
      items.push(...result.items);
      if (page >= result.totalPages) return items;
    }
  };
  const api = (method: 'get' | 'post' | 'patch' | 'delete', path: string, token = admin) =>
    request(app.getHttpServer())[method](`/api${path}`).set('Cookie', token).set('Origin', ORIGIN).set('X-CSRF-Token', token.split('salgados_csrf=')[1] ?? '');
  const entry = (extra: Record<string, unknown> = {}) => ({
    description: `QA ${runId} Conta de integracao`, categoryId: category, type: OPER, nature: 'FIXA',
    expectedAmountCents: 10000, dueDate: '2026-01-10', competence: '2026-01', ...extra,
  });
  const payment = (extra: Record<string, unknown> = {}) => ({ paidAmountCents: 11000, paidOn: '2026-01-09', origin: 'PF', method: 'PIX', ...extra });
  const create = async (extra: Record<string, unknown> = {}) => (await api('post', '/finance/entries').send(entry(extra)).expect(201)).body;
  const boot = async () => { app = await secureBoot(); };
  beforeAll(async () => {
    await boot();
    [admin,kitchen,cashier] = await Promise.all(['ADMIN','KITCHEN','CASHIER'].map(async role => {
      const session = await secureLogin(app, await fixture(app,role));
      return `${session.cookie}; salgados_csrf=${session.csrf}`;
    }));
    category = (await api('post', '/finance/categories').send({ name: `QA ${runId} Operacional`, type: OPER }).expect(201)).body._id;
    costCategory = (await api('post', '/finance/categories').send({ name: `QA ${runId} Custo`, type: COST }).expect(201)).body._id;
    product = (await api('post', '/products').send({ name: `QA ${runId} Produto`, category: 'QA', priceCents: 300, availabilityMode: 'PRODUCTION_CONTROLLED' }).expect(201)).body;
  }, 120000);
  afterAll(async () => { if (app) await app.close(); });

  it('exige autenticação e ADMIN em todas as áreas', async () => {
    for (const path of ['/finance/entries', '/finance/categories', '/finance/recurrences', '/finance/summary?month=1&year=2026', '/finance/reports/monthly?month=1&year=2026']) {
      await request(app.getHttpServer()).get(`/api${path}`).expect(401);
      await api('get', path, kitchen).expect(403);
      await api('get', path, cashier).expect(403);
    }
    await api('post', '/finance/entries', cashier).send(entry()).expect(403);
  });

  it('rejeita dinheiro, datas, IDs, null obrigatório e campos controlados pelo servidor', async () => {
    for (const change of [{ expectedAmountCents: 1.5 }, { expectedAmountCents: 0 }, { expectedAmountCents: 1e12 + 1 }, { dueDate: '2026-02-30' }, { categoryId: 'x' }, { description: null }, { status: 'PAGO' }, { createdByName: 'Invasor' }, { recurring: true }, { production: { quantity: 2 } }]) {
      await api('post', '/finance/entries').send(entry(change)).expect(400);
    }
    await api('get', '/finance/entries/not-an-id').expect(400);
    await api('get', `/finance/entries/${new Types.ObjectId()}`).expect(404);
    await api('get', '/finance/entries?page=0').expect(400);
    await api('get', '/finance/entries?dateFrom=2026-02-01&dateTo=2026-01-01').expect(400);
    await api('get', '/finance/categories?active=invalid').expect(400);
    const created = await create();
    await api('patch', `/finance/entries/${created._id}`).send({ description: null }).expect(400);
  });

  it('cadastra custo com produto sem movimentar estoque e permite limpar opcionais', async () => {
    product = (await api('get', '/products').expect(200)).body.find((p: any) => p._id === product._id);
    const cost = { type: COST, categoryId: costCategory, supplier: 'Fornecedor QA', production: { productId: product._id, inputName: 'Farinha', quantity: 1.123456, unit: 'KG', unitAmountCents: 100, totalAmountCents: 10000 } };
    const created = await create(cost);
    expect(created.production.quantity).toBe(1.123456);
    const after = (await api('get', '/products').expect(200)).body.find((p: any) => p._id === product._id);
    expect(after).toEqual(product);
    await api('post', '/finance/entries').send(entry({ ...cost, production: { totalAmountCents: 999 } })).expect(400);
    await api('post', '/finance/entries').send(entry({ ...cost, production: { productId: new Types.ObjectId().toString() } })).expect(400);
    await api('post', '/finance/entries').send(entry({ ...cost, production: { quantity: 0.1234567 } })).expect(400);
    const partial = (await api('patch', `/finance/entries/${created._id}`).send({ production: { inputName: null }, version: created.version }).expect(200)).body;
    expect(partial.production.inputName ?? null).toBeNull();
    expect(partial.production.productId).toBe(product._id);
    expect(partial.production.quantity).toBe(1.123456);
    const cleared = (await api('patch', `/finance/entries/${created._id}`).send({ supplier: null, production: null, notes: null, version: partial.version }).expect(200)).body;
    expect(cleared.supplier ?? null).toBeNull();
    expect(cleared.production ?? null).toBeNull();
    await api('patch', `/finance/entries/${created._id}`).send({ description: 'Edição obsoleta', version: created.version }).expect(409);
  });

  it('paga uma única vez sob concorrência, corrige com confirmação e mantém auditoria', async () => {
    const created = await create({ notes: 'Original' });
    persistedId = created._id;
    expect(created.status).toBe('VENCIDO');
    const results = await Promise.all([0, 1].map(() => api('post', `/finance/entries/${created._id}/payment`).send(payment({ version: created.version, notes: 'Comprovante original' }))));
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const paid = results.find(r => r.status === 201)!.body;
    expect(paid.status).toBe('PAGO');
    expect(paid.differenceCents).toBe(1000);
    expect(paid.payment.paidOn).toBe('2026-01-09');
    expect(new Date(paid.payment.registeredAt).getTime()).toBeGreaterThan(Date.parse('2026-01-09T23:59:59Z'));
    await api('patch', `/finance/entries/${created._id}`).send({ description: 'Indevida' }).expect(409);
    await api('post', `/finance/entries/${created._id}/cancel`).send({ reason: 'Indevido' }).expect(409);
    await api('patch', `/finance/entries/${created._id}/payment`).send(payment({ reason: 'Correção' })).expect(400);
    await api('patch', `/finance/entries/${created._id}/payment`).send(payment({ confirmed: true, reason: ' ' })).expect(400);
    const corrected = (await api('patch', `/finance/entries/${created._id}/payment`).send(payment({ paidAmountCents: 9000, origin: 'PJ', method: 'BOLETO', confirmed: true, reason: 'Comprovante corrigido', version: paid.version, notes: null })).expect(200)).body;
    expect(corrected.payment.notes ?? null).toBeNull();
    expect(corrected.differenceCents).toBe(-1000);
    expect(corrected.payment.registeredAt).toBe(paid.payment.registeredAt);
    expect(corrected.payment.correctedByName).toBeTruthy();
    const history = (await api('get', `/finance/entries/${created._id}/history?limit=100`).expect(200)).body;
    expect(history.total).toBe(3);
    expect(history.items.map((h: any) => h.action)).toEqual(['CORRECAO_PAGAMENTO', 'PAGAMENTO', 'CRIACAO']);
    expect(history.items[0].before.payment.paidAmountCents).toBe(11000);
    expect(history.items[0].reason).toBe('Comprovante corrigido');
    expect(history.items.every((h: any) => h._id && h.userId && h.userName && h.occurredAt)).toBe(true);
    expect(corrected.history).toBeUndefined();
  });

  it('rejeita pagamento futuro, cancela pendente e torna cancelado imutável', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const created = await create({ dueDate: today });
    expect(created.status).toBe('PENDENTE');
    await api('post', `/finance/entries/${created._id}/payment`).send(payment({ paidOn: '2100-01-01' })).expect(400);
    await api('post', `/finance/entries/${created._id}/cancel`).send({ reason: '' }).expect(400);
    const canceled = (await api('post', `/finance/entries/${created._id}/cancel`).send({ reason: 'Conta duplicada' }).expect(201)).body;
    expect(canceled.status).toBe('CANCELADO');
    await api('patch', `/finance/entries/${created._id}`).send({ description: 'Indevida' }).expect(409);
    await api('post', `/finance/entries/${created._id}/payment`).send(payment()).expect(409);
    await api('delete', `/finance/entries/${created._id}`).expect(404);
  });

  it('filtra, pagina e agrega toda a competência com previsto e pago PF/PJ separados', async () => {
    const baseline = (await api('get', '/finance/summary?month=5&year=2030').expect(200)).body;
    const a = await create({ description: `QA ${runId} Relatorio [literal]`, competence: '2030-05', expectedAmountCents: 100, dueDate: '2026-01-01' });
    const b = await create({ competence: '2030-05', expectedAmountCents: 200, dueDate: '2030-05-20' });
    const c = await create({ competence: '2030-05', expectedAmountCents: 300, type: COST, categoryId: costCategory });
    const d = await create({ competence: '2030-05', expectedAmountCents: 400 });
    const e = await create({ competence: '2030-05', expectedAmountCents: 500 });
    await api('post', `/finance/entries/${c._id}/payment`).send(payment({ paidAmountCents: 330 })).expect(201);
    await api('post', `/finance/entries/${d._id}/payment`).send(payment({ paidAmountCents: 380, origin: 'PJ', method: 'BOLETO' })).expect(201);
    await api('post', `/finance/entries/${e._id}/cancel`).send({ reason: 'Cancelado QA' }).expect(201);
    const list = (await api('get', `/finance/entries?competence=2030-05&description=${runId}&limit=2&page=1`).expect(200)).body;
    expect(list.total).toBe(5); expect(list.items).toHaveLength(2); expect(list.totalPages).toBe(3);
    const literal = (await api('get', `/finance/entries?description=${encodeURIComponent(`QA ${runId} Relatorio [literal]`)}`).expect(200)).body;
    expect(literal.items.map((x: any) => x._id)).toEqual([a._id]);
    for (const [query, id] of [['status=VENCIDO', a._id], ['status=PENDENTE', b._id], ['origin=PJ&method=BOLETO', d._id], [`type=${COST}&categoryId=${costCategory}`, c._id], ['dueDate=2030-05-20&nature=FIXA', b._id]]) {
      const filtered = (await api('get', `/finance/entries?competence=2030-05&description=${runId}&${query}`).expect(200)).body;
      expect(filtered.items.map((x: any) => x._id)).toEqual([id]);
    }
    const summary = (await api('get', '/finance/summary?month=5&year=2030').expect(200)).body;
    const deltas = { count: 4, canceledCount: 1, expectedCents: 1000, paidCents: 710, pendingCents: 200, overdueCents: 100, paidPfCents: 330, paidPjCents: 380, productionCostsCents: 300, operationalExpensesCents: 700 };
    for (const [key, delta] of Object.entries(deltas)) expect(summary[key] - baseline[key], key).toBe(delta);
    expect(summary.byCategory.reduce((sum: number, c: any) => sum + c.expectedCents, 0)).toBe(summary.expectedCents);
    const report = (await api('get', '/finance/reports/monthly?month=5&year=2030').expect(200)).body;
    expect(report).toEqual(summary);
  });

  it('mantém categoria inativa em contas existentes, bloqueia nova associação e duplicidade', async () => {
    const cat = (await api('post', '/finance/categories').send({ name: `Categoria Unica QA ${runId}`, type: OPER }).expect(201)).body;
    await api('post', '/finance/categories').send({ name: ` categoria unica qa ${runId} `, type: OPER }).expect(409);
    const created = await create({ categoryId: cat._id });
    await api('patch', `/finance/categories/${cat._id}`).send({ type: COST }).expect(409);
    await api('post', `/finance/categories/${cat._id}/deactivate`).send({}).expect(201);
    await api('patch', `/finance/entries/${created._id}`).send({ description: 'Mesmo vínculo inativo' }).expect(200);
    await api('post', '/finance/entries').send(entry({ categoryId: cat._id })).expect(400);
    const inactive = await listCategories();
    expect(inactive.some((c: any) => c._id === cat._id)).toBe(true);
  });

  it('gera mensal dia 31 com idempotência concorrente, parcelas e edição só futura', async () => {
    const template = entry();
    const { dueDate, competence, ...base } = template;
    const recurrence = (await api('post', '/finance/recurrences').send({ ...base, frequency: 'MENSAL', startDate: '2028-01-31', billingDay: 31, installments: 3 }).expect(201)).body;
    await api('get', `/finance/recurrences/${recurrence._id}`).expect(200);
    const generates = await Promise.all([0, 1].map(() => api('post', `/finance/recurrences/${recurrence._id}/generate`).send({ competence: '2028-02' }).expect(201)));
    expect(generates.reduce((s, r) => s + r.body.created, 0)).toBe(1);
    expect(generates[0].body.entries[0].dueDate).toBe('2028-02-29');
    expect(generates[0].body.entries[0].installmentNumber).toBe(2);
    const generatedId = generates[0].body.entries[0]._id;
    const history = (await api('get', `/finance/entries/${generatedId}/history`).expect(200)).body;
    expect(history.total).toBe(1);
    await api('patch', `/finance/recurrences/${recurrence._id}`).send({ expectedAmountCents: 5000, version: recurrence.version }).expect(200);
    const march = (await api('post', `/finance/recurrences/${recurrence._id}/generate`).send({ competence: '2028-03' }).expect(201)).body;
    expect(march.entries[0]).toMatchObject({ dueDate: '2028-03-31', expectedAmountCents: 5000, installmentNumber: 3 });
    expect((await api('get', `/finance/entries/${generatedId}`).expect(200)).body.expectedAmountCents).toBe(10000);
    for (const month of ['2027-12', '2028-04']) expect((await api('post', `/finance/recurrences/${recurrence._id}/generate`).send({ competence: month }).expect(201)).body.created).toBe(0);
    await api('patch', `/finance/recurrences/${recurrence._id}`).send({ frequency: 'ANUAL' }).expect(400);
    await api('post', `/finance/recurrences/${recurrence._id}/deactivate`).send({}).expect(201);
    await api('post', `/finance/recurrences/${recurrence._id}/generate`).send({ competence: '2028-05' }).expect(409);
  });

  it('gera todas as semanas do mês e anual bissexta sem duplicar', async () => {
    const { dueDate, competence, ...base } = entry();
    const weekly = (await api('post', '/finance/recurrences').send({ ...base, frequency: 'SEMANAL', startDate: '2028-01-03' }).expect(201)).body;
    const jan = (await api('post', `/finance/recurrences/${weekly._id}/generate`).send({ competence: '2028-01' }).expect(201)).body;
    expect(jan.created).toBe(0); expect(jan.existing).toBe(5);
    expect(jan.entries.map((e: any) => e.dueDate).sort()).toEqual(['2028-01-03', '2028-01-10', '2028-01-17', '2028-01-24', '2028-01-31']);
    const annual = (await api('post', '/finance/recurrences').send({ ...base, frequency: 'ANUAL', startDate: '2028-02-29', installments: 2 }).expect(201)).body;
    const feb = (await api('post', `/finance/recurrences/${annual._id}/generate`).send({ competence: '2029-02' }).expect(201)).body;
    expect(feb.entries[0]).toMatchObject({ dueDate: '2029-02-28', installmentNumber: 2 });
    expect((await api('post', `/finance/recurrences/${annual._id}/generate`).send({ competence: '2029-03' }).expect(201)).body.created).toBe(0);
  });

  it('preserva contas, auditoria e seeds modificadas após reiniciar a aplicação', async () => {
    const before = (await api('get', `/finance/entries/${persistedId}`).expect(200)).body;
    const seedsBefore = (await listCategories()).filter((c: any) => c.seedKey); 
    await api('patch', `/finance/categories/${category}`).send({ name: `QA ${runId} Renomeada`, active: false }).expect(200);
    await app.close();
    await boot();
    const after = (await api('get', `/finance/entries/${persistedId}`).expect(200)).body;
    expect(after).toEqual(before);
    expect((await api('get', `/finance/entries/${persistedId}/history`).expect(200)).body.total).toBe(3);
    const categories = await listCategories();
    expect(categories.filter((c: any) => c.seedKey)).toEqual(seedsBefore);
    expect(categories.find((c: any) => c._id === category)).toMatchObject({ name: `QA ${runId} Renomeada`, active: false });
  }, 120000);
});
