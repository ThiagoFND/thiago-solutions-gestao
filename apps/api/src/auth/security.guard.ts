import { CanActivate, ExecutionContext, ForbiddenException, HttpException, Injectable, BadRequestException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { CSRF_COOKIE, readCookie, securityConfig } from '../common/security.config.js';

export class WindowLimiter {
  private readonly buckets = new Map<string, { count: number; until: number }>();
  hit(key: string, max: number, now = Date.now()) {
    if (this.buckets.size > 10000) for (const [k, v] of this.buckets) if (v.until <= now) this.buckets.delete(k);
    const old = this.buckets.get(key);
    if (!old || old.until <= now) {
      if (this.buckets.size >= 50000) throw new HttpException('Limite temporário de requisições', 429);
      this.buckets.set(key, { count: 1, until: now + 60000 }); return;
    }
    if (++old.count > max) throw new HttpException('Muitas requisições. Aguarde um minuto.', 429);
  }
}
@Injectable()
export class SecurityGuard implements CanActivate {
  private readonly limiter = new WindowLimiter();
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const route = `${req.method}:${req.route.path}`;
    const login = /\/auth\/(platform-login|login)$/.test(req.path);
    const group = req.path.endsWith('/auth/platform-login') ? 'PLATFORM_LOGIN' : req.path.startsWith('/api/platform/') ? 'PLATFORM' : req.path.endsWith('/auth/onboarding') ? 'ONBOARDING' : req.path.endsWith('/auth/company-lookup') ? 'LOOKUP' : req.path.endsWith('/auth/access-requests') ? 'ACCESS_REQUEST' : login ? 'LOGIN' : req.path.endsWith('/auth/logout') ? 'LOGOUT' : /\/(finalize|payment)$/.test(req.path) ? 'PAYMENT' : req.method === 'POST' && req.path === '/api/orders' ? 'ORDER_CREATE' : req.user?.role === 'ADMIN' ? 'ADMIN' : 'GENERAL';
    const defaults: Record<string, number> = { PLATFORM_LOGIN: 3, PLATFORM: 30, ONBOARDING: 3, LOOKUP: 10, ACCESS_REQUEST: 5, LOGIN: 5, LOGOUT: 10, PAYMENT: 15, ORDER_CREATE: 30, ADMIN: 60, GENERAL: 120 };
    const limit = Number(process.env[`RATE_LIMIT_${group}`] ?? defaults[group]);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000) throw new Error('Invalid rate limit configuration');
    this.limiter.hit(`ip:${req.ip}:${route}`, limit);
    if (req.user) this.limiter.hit(`user:${req.user.sub}:${route}`, limit);
    if (login && typeof req.body?.email === 'string') {
      const hash = createHash('sha256').update(`${req.path}:${typeof req.body.cnpj === 'string' ? req.body.cnpj.replace(/\D/g, '') : 'platform'}:${req.body.email.trim().toLowerCase()}`).digest('hex');
      this.limiter.hit(`account:${hash}`, limit);
    }
    for (const [key, id] of Object.entries(req.params ?? {})) {
      if (key === 'slug' && req.route.path === '/api/public/companies/:slug') {
        if (typeof id !== 'string' || id.length < 3 || id.length > 70 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new BadRequestException('Endereço público inválido');
      } else if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw new BadRequestException('Identificador inválido');
    }
    // DTOs validate accepted fields; no-body handlers explicitly reject unexpected input.
    // CRM detail contains independently paginated activities/proposals, validated by CrmQuery.
    const pagedDetail = req.route.path === '/api/crm/opportunities/:id';
    const noQuery = !['GET'].includes(req.method) || /\/auth\//.test(req.path) || (!pagedDetail && !req.path.startsWith('/api/public/') && /\/[^/]+\/[a-f\d]{24}$/i.test(req.path));
    if (noQuery && Object.keys(req.query ?? {}).length) throw new BadRequestException('Query não permitida');
    if (['GET', 'HEAD'].includes(req.method) && Object.keys(req.body ?? {}).length) throw new BadRequestException('Corpo não permitido');
    if ((req.path.endsWith('/auth/logout') || /\/platform\/tenants\/[^/]+\/approve$/.test(req.path) || /\/categories\/[^/]+\/deactivate$/.test(req.path)) && Object.keys(req.body ?? {}).length) throw new BadRequestException('Corpo não permitido');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (!origin || !securityConfig().origins.includes(origin)) throw new ForbiddenException('Origem obrigatória e permitida');
      const cookie = readCookie(req.headers.cookie, CSRF_COOKIE);
      const header = req.headers['x-csrf-token'];
      if (!cookie || typeof header !== 'string' || !/^[a-f\d]{64}$/.test(cookie) || !/^[a-f\d]{64}$/.test(header) || !timingSafeEqual(Buffer.from(header), Buffer.from(cookie))) throw new ForbiddenException('CSRF inválido');
    }
    return true;
  }
}
