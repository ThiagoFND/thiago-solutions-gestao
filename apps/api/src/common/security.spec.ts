import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Reflector } from '@nestjs/core';
import { checkInput } from './security-http.js';
import { cookieOptions, readCookie, securityConfig } from './security.config.js';
import { WindowLimiter, SecurityGuard } from '../auth/security.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole, UserStatus, TenantStatus } from './enums.js';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { ProductsQueryDto } from './query.dto.js';
import { OrdersService } from '../orders/orders.service.js';

const actor = { sub: '507f1f77bcf86cd799439011', name: 'Test', email: 'test@example.invalid', role: UserRole.CASHIER, status: UserStatus.ACTIVE, tenantId: '507f1f77bcf86cd799439020', tenantStatus: TenantStatus.ACTIVE };
function context(req: any, klass: any = class {}, handler = () => {}) { return { getClass: () => klass, getHandler: () => handler, switchToHttp: () => ({ getRequest: () => req }) } as any; }
describe('security invariants without database', () => {
  beforeEach(() => { vi.stubEnv('JWT_SECRET', randomBytes(48).toString('hex')); vi.stubEnv('FRONTEND_URL', 'http://localhost:4200'); });
  afterEach(() => vi.unstubAllEnvs());
  it.each([{ $where: 'x' }, { a: { $ne: null } }, { 'x.y': 1 }, JSON.parse('{"__proto__":{"admin":true}}')])('rejects operators and prototype fields', value => expect(() => checkInput(value)).toThrow());
  it('rejects deep objects and abusive arrays', () => {
    let value: any = 1; for (let i = 0; i < 10; i++) value = { nested: value };
    expect(() => checkInput(value)).toThrow(); expect(() => checkInput(Array(101).fill(1))).toThrow();
    expect(() => checkInput({ items: [{ productId: actor.sub, quantity: 1 }] })).not.toThrow();
  });
  it('requires secrets and explicit origins', () => {
    expect(securityConfig().origins).toEqual(['http://localhost:4200']);
    vi.stubEnv('JWT_SECRET', ''); expect(() => securityConfig()).toThrow('JWT_SECRET');
  });
  it('refuses wildcard origin', () => { vi.stubEnv('FRONTEND_URL', '*'); expect(() => securityConfig()).toThrow('FRONTEND_URL'); });
  it('requires HTTPS in production and configures secure cookies', () => {
    vi.stubEnv('NODE_ENV', 'production'); expect(() => securityConfig()).toThrow('HTTPS');
    expect(cookieOptions()).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/api', maxAge: 900000 });
    expect(cookieOptions()).not.toHaveProperty('domain');
  });
  it('rejects ambiguous or malformed cookies', () => {
    expect(readCookie('x=one; x=two', 'x')).toBeUndefined(); expect(readCookie('x=%broken', 'x')).toBeUndefined(); expect(readCookie('x=ok', 'x')).toBe('ok');
  });
  it('limits by key and resets only after window expiry', () => {
    const limiter = new WindowLimiter(); limiter.hit('a', 1, 0);
    expect(() => limiter.hit('a', 1, 1)).toThrow(expect.objectContaining({ status: 429 }));
    expect(() => limiter.hit('b', 1, 1)).not.toThrow(); expect(() => limiter.hit('a', 1, 60000)).not.toThrow();
  });
  it('denies missing role policies, even for ADMIN', async () => {
    const audit = { record: vi.fn() }; const guard = new RolesGuard(new Reflector(), audit as any, {} as any);
    await expect(guard.canActivate(context({ path: '/api/users', user: { ...actor, role: UserRole.ADMIN } }))).rejects.toMatchObject({ status: 403 });
    expect(audit.record).toHaveBeenCalledWith('authorization.role', 'denied', expect.anything(), 'users');
  });
  it('denies CASHIER kitchen and permits ADMIN explicit policies', async () => {
    @Roles(UserRole.ADMIN, UserRole.KITCHEN) class Kitchen {}
    const guard = new RolesGuard(new Reflector(), { record: vi.fn() } as any);
    await expect(guard.canActivate(context({ path: '/api/productions', user: actor }, Kitchen))).rejects.toMatchObject({ status: 403 });
    await expect(guard.canActivate(context({ path: '/api/productions', user: { ...actor, role: UserRole.ADMIN } }, Kitchen))).resolves.toBe(true);
  });
  it('rejects missing sessions and revoked claims', async () => {
    const users = { identity: vi.fn().mockResolvedValue({ ...actor, id: actor.sub, active: true, sessionVersion: 2 }) };
    const guard = new JwtAuthGuard({ verifyAsync: vi.fn().mockResolvedValue({ sub: actor.sub, version: 1, exp: 9999999999 }) } as any, new Reflector(), users as any);
    const req = { ip: 'local', route: { path: '/api/auth/me' }, method: 'GET', headers: {} };
    await expect(guard.canActivate(context(req))).rejects.toMatchObject({ status: 401 });
    await expect(guard.canActivate(context({ ...req, headers: { cookie: 'salgados_session=opaque' } }))).rejects.toMatchObject({ status: 401 });
  });
  it('requires origin and matching CSRF on mutations', () => {
    const guard = new SecurityGuard(); const csrf = randomBytes(32).toString('hex');
    const req = { method: 'POST', route: { path: '/api/orders' }, path: '/api/orders', ip: 'local', params: {}, query: {}, user: actor, body: {}, headers: {} };
    expect(() => guard.canActivate(context(req))).toThrow(expect.objectContaining({ status: 403 }));
    req.headers = { origin: 'http://localhost:4200', cookie: `salgados_csrf=${csrf}`, 'x-csrf-token': csrf };
    expect(guard.canActivate(context(req))).toBe(true);
  });
  it('rejects extra body properties and short passwords', async () => {
    const errors = await validate(plainToInstance(CreateUserDto, { name: 'Test', email: 'a@example.invalid', password: 'short', role: 'ADMIN', admin: true }), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map(e => e.property)).toEqual(expect.arrayContaining(['password', 'admin']));
  });
  it('rejects unsafe pagination and boolean coercion', async () => {
    expect((await validate(plainToInstance(ProductsQueryDto, { limit: '101', activeOnly: 'yes' }))).map(e => e.property)).toEqual(expect.arrayContaining(['limit', 'activeOnly']));
  });
  it('rejects another cashiers order before any mutation', async () => {
    const model = { findOne: vi.fn().mockResolvedValue({ openedById: '507f1f77bcf86cd799439012' }), updateOne: vi.fn() };
    const audit = { record: vi.fn() }; const service = new OrdersService({scope: async () => actor.tenantId} as any, model as any, {} as any, {} as any, {} as any, {} as any, audit as any, {} as any);
    await expect(service.update('507f1f77bcf86cd799439013', {} as any, actor)).rejects.toMatchObject({ status: 403 });
    expect(model.updateOne).not.toHaveBeenCalled(); expect(audit.record).toHaveBeenCalled();
  });
});
