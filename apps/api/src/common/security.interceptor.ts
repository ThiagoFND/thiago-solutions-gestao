import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { concatMap } from 'rxjs';
import { AuditService } from '../audit/audit.service.js';
@Injectable()
export class SecurityAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    if (/\/attachments(?:\/|$)/.test(req.path) || ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || ['/api/auth/', '/api/users/', '/api/platform/'].some(prefix => req.path.startsWith(prefix))) return next.handle();
    return next.handle().pipe(concatMap(async result => {
      const route = String(req.route.path).replace(/^\/api\//, '').replace(/\/:\w+/g, '').replace(/\//g, '.');
      await this.audit.record(`${route}.${req.method.toLowerCase()}`, 'success', req.user, req.path.split('/')[2], req.params.id ?? result?._id?.toString() ?? result?.id);
      return result;
    }));
  }
}
