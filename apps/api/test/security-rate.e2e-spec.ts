import { randomBytes } from 'node:crypto';
import { boot, fixture, login } from './security-harness.js';

const withMongo = process.env.TEST_MONGODB_URI ? describe : describe.skip;
withMongo('HTTP rate boundaries with fresh application counters', () => {
  for (const group of ['LOGIN', 'GENERAL', 'ADMIN', 'LOGOUT', 'ORDER_CREATE', 'PAYMENT']) {
    it(`${group}: first request allowed, second returns 429 with limit 1`, async () => {
      const app = await boot();
      try {
        const user = await fixture(app, group === 'GENERAL' ? 'CASHIER' : 'ADMIN');
        if (group === 'LOGIN') {
          process.env.RATE_LIMIT_LOGIN = '1';
          const session = await login(app, user);
          await session.api('post', '/auth/login').send({ email: user.email, password: user.password }).expect(429);
          return;
        }
        const session = await login(app, user);
        if (group === 'GENERAL' || group === 'ADMIN') {
          process.env[`RATE_LIMIT_${group}`] = '1';
          const path = group === 'GENERAL' ? '/auth/me' : '/users';
          await session.api('get', path).expect(200);
          await session.api('get', path).expect(429);
        } else if (group === 'LOGOUT') {
          const second = await login(app, await fixture(app, 'CASHIER'));
          process.env.RATE_LIMIT_LOGOUT = '1';
          await session.api('post', '/auth/logout').send({}).expect(201);
          await second.api('post', '/auth/logout').send({}).expect(429);
        } else {
          const product = (await session.api('post', '/products').send({
            name: `QA rate ${randomBytes(8).toString('hex')}`, category: 'QA',
            priceCents: 100, availabilityMode: 'MADE_TO_ORDER',
          }).expect(201)).body;
          const body = { type: 'TAKEAWAY', items: [{ productId: product._id, quantity: 1 }] };
          if (group === 'ORDER_CREATE') {
            process.env.RATE_LIMIT_ORDER_CREATE = '1';
            await session.api('post', '/orders').send(body).expect(201);
            await session.api('post', '/orders').send(body).expect(429);
          } else {
            const first = (await session.api('post', '/orders').send(body).expect(201)).body;
            const second = (await session.api('post', '/orders').send(body).expect(201)).body;
            process.env.RATE_LIMIT_PAYMENT = '1';
            const payment = { payments: [{ method: 'PIX', amountCents: 100 }] };
            await session.api('post', `/orders/${first._id}/finalize`).send(payment).expect(201);
            await session.api('post', `/orders/${second._id}/finalize`).send(payment).expect(429);
            expect((await session.api('get', `/orders/${second._id}`).expect(200)).body.status).toBe('OPEN');
          }
        }
      } finally {
        process.env[`RATE_LIMIT_${group}`] = '10000';
        await app.close();
      }
    }, 120000);
  }
});
