import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { boot, fixture, login, ORIGIN } from './security-harness.js';

const describeWithMongo = process.env.TEST_MONGODB_URI ? describe : describe.skip;

describeWithMongo('Fluxo produção -> estoque -> pedido -> venda (e2e)', () => {
  let app: INestApplication<App>;
  let kitchenToken: string;
  let cashierToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await boot();
    const actors = await Promise.all(['KITCHEN','CASHIER','ADMIN'].map(async role => login(app, await fixture(app,role))));
    [kitchenToken, cashierToken, adminToken] = actors.map(x => `${x.cookie}; salgados_csrf=${x.csrf}`);
  }, 120_000);

  afterAll(async () => { if (app) await app.close(); });

  it('preserva a produção diária enquanto a venda diminui apenas o saldo', async () => {
    const runId = new Types.ObjectId().toString();
    const product = (await request(app.getHttpServer()).post('/api/products')
      .set('Cookie', adminToken).set('Origin', ORIGIN).set('X-CSRF-Token', adminToken.split('salgados_csrf=')[1])
      .send({ name: `QA ${runId} Produto`, category: 'QA', priceCents: 300, availabilityMode: 'PRODUCTION_CONTROLLED' }).expect(201)).body;
    const baseline = (await request(app.getHttpServer()).get('/api/reports/daily')
      .set('Cookie', adminToken).set('Origin', ORIGIN).set('X-CSRF-Token', adminToken.split('salgados_csrf=')[1]).expect(200)).body;

    await request(app.getHttpServer()).post('/api/productions')
      .set('Cookie', kitchenToken).set('Origin', ORIGIN).set('X-CSRF-Token', kitchenToken.split('salgados_csrf=')[1]).send({ productId: product._id, quantity: 10 }).expect(201);

    const order = (await request(app.getHttpServer()).post('/api/orders')
      .set('Cookie', cashierToken).set('Origin', ORIGIN).set('X-CSRF-Token', cashierToken.split('salgados_csrf=')[1])
      .send({ type: 'TAKEAWAY', items: [{ productId: product._id, quantity: 4 }] }).expect(201)).body;

    const afterReservation = (await request(app.getHttpServer()).get('/api/products?activeOnly=true')
      .set('Cookie', cashierToken).set('Origin', ORIGIN).set('X-CSRF-Token', cashierToken.split('salgados_csrf=')[1]).expect(200)).body
      .find((item: { _id: string }) => item._id === product._id);
    expect(afterReservation.availableStock).toBe(6);

    await request(app.getHttpServer()).post(`/api/orders/${order._id}/finalize`)
      .set('Cookie', cashierToken).set('Origin', ORIGIN).set('X-CSRF-Token', cashierToken.split('salgados_csrf=')[1])
      .send({ payments: [{ method: 'PIX', amountCents: order.totalCents }] }).expect(201);

    const report = (await request(app.getHttpServer()).get('/api/reports/daily')
      .set('Cookie', adminToken).set('Origin', ORIGIN).set('X-CSRF-Token', adminToken.split('salgados_csrf=')[1]).expect(200)).body;
    expect(report.productionQuantity - baseline.productionQuantity).toBe(10);
    expect(report.soldProducts.find((item: { name: string }) => item.name === product.name).quantity).toBe(4);
  });

  it('impede a cozinha de acessar pedidos', () => request(app.getHttpServer()).get('/api/orders')
    .set('Cookie', kitchenToken).set('Origin', ORIGIN).set('X-CSRF-Token', kitchenToken.split('salgados_csrf=')[1]).expect(403));
});
