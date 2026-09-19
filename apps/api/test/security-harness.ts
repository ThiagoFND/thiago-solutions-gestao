import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import bcrypt from 'bcrypt';
import request from 'supertest';
export const TEST_URI = 'mongodb://127.0.0.1:27017/salgados_financeiro_test';
export const ORIGIN = 'http://127.0.0.1:4317';
const testJwtSecret = randomBytes(48).toString('hex');
export function testEnvironment() {
  if (process.env.TEST_MONGODB_URI !== TEST_URI) throw new Error('Exact isolated test database required');
  process.env.MONGODB_URI = TEST_URI;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = testJwtSecret;
  process.env.FRONTEND_URL = ORIGIN;
  Object.assign(process.env, { MONGODB_USER: '', MONGODB_PASSWORD: '', MONGODB_TLS: 'false', MONGODB_TLS_CA_FILE: '' });
  for (const name of ['GENERAL','ADMIN','LOGIN','LOGOUT','ORDER_CREATE','PAYMENT']) process.env[`RATE_LIMIT_${name}`] = '10000';
}
export async function boot() {
  testEnvironment();
  const { AppModule } = await import('../src/app.module.js');
  const { configureSecurityHttp } = await import('../src/common/security-http.js');
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication({ bodyParser: false, logger: false });
  configureSecurityHttp(app); await app.init(); await app.listen(0, "127.0.0.1");
  const connection = app.get(getConnectionToken());
  if (connection.name !== 'salgados_financeiro_test') throw new Error('Unexpected database');
  for (const model of Object.values(connection.models) as any[]) await model.createIndexes();
  return app;
}
export async function fixture(app: any, role: string) {
  const password = randomBytes(24).toString('hex');
  const email = `qa-${randomBytes(12).toString('hex')}@example.invalid`;
  const user = await app.get(getModelToken('User')).create({ name: `QA ${role}`, email, passwordHash: await bcrypt.hash(password,12), role });
  return { email, password, id: String(user._id), role };
}
export async function login(app: any, user: { email: string; password: string }) {
  const agent = request.agent(app.getHttpServer());
  const csrf = (await agent.get('/api/auth/csrf').expect(200)).body.csrfToken;
  const response = await agent.post('/api/auth/login').set('Origin',ORIGIN).set('X-CSRF-Token',csrf).send({ email: user.email, password: user.password }).expect(201);
  const cookie = response.headers['set-cookie'][0].split(';')[0];
  return { agent, csrf, cookie, response, api(method: string, path: string) { return (agent as any)[method](`/api${path}`).set('Origin',ORIGIN).set('X-CSRF-Token',csrf); } };
}
