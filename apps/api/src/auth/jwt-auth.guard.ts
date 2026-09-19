import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { WindowLimiter } from './security.guard.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { TenantAccessService } from '../tenants/tenant-access.service.js';
import { readCookie, SESSION_COOKIE } from '../common/security.config.js';
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly limiter = new WindowLimiter();
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector, private readonly access: TenantAccessService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    this.limiter.hit(`preauth:${req.ip}:${req.method}:${req.route.path}`, Number(process.env.RATE_LIMIT_GENERAL ?? 120));
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (!token) throw new UnauthorizedException('Sessao nao informada');
    try {
      const claims = await this.jwt.verifyAsync(token, { algorithms: ['HS256'], issuer: 'salgados-api', audience: 'salgados-web' });
      if (typeof claims.sub !== 'string' || !/^[a-f\d]{24}$/i.test(claims.sub) || !Number.isSafeInteger(claims.version) || !Number.isFinite(claims.exp)) throw new Error();
      const user = await this.access.identity(claims.sub);
      if (user.sessionVersion !== claims.version || user.tenantId !== claims.tenantId || user.tenantVersion !== claims.tenantVersion) throw new Error();
      request.user = user;
      return true;
    } catch { throw new UnauthorizedException('Sessao invalida ou expirada'); }
  }
}
