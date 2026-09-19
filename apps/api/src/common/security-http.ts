import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException, INestApplication, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { securityConfig } from './security.config.js';
import { AuditService } from '../audit/audit.service.js';
import { createHash } from 'node:crypto';

export function checkInput(value: unknown, depth = 0): void {
  if (depth > 8) throw new HttpException('Payload muito profundo', 400);
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value) && value.length > 100) throw new HttpException('Array excede o limite', 400);
  for (const [key, item] of Object.entries(value)) {
    if (key.includes('$') || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new HttpException('Campo proibido', 400);
    checkInput(item, depth + 1);
  }
}
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  constructor(private readonly audit?: AuditService) {}
  async catch(error: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    const status = error instanceof HttpException ? error.getStatus() : error?.type === 'entity.too.large' ? 413 : error?.type === 'entity.parse.failed' ? 400 : error?.code === 11000 || error?.name === 'VersionError' ? 409 : ['ValidationError', 'CastError', 'StrictModeError'].includes(error?.name) ? 400 : 500;
    const payload = error instanceof HttpException && (status < 500 || (status === 503 && (error.getResponse() as any)?.code === 'TRANSACTIONS_REQUIRED')) ? error.getResponse() : { message: status === 500 ? 'Erro interno' : status === 409 ? 'Conflito de registro' : 'Requisição inválida' };
    if ([401, 403, 429].includes(status) || status===404 && req.user) {
      const login = req.path === '/api/auth/login';
      const subject = login && typeof req.body?.email === 'string' ? createHash('sha256').update(req.body.email.trim().toLowerCase()).digest('hex') : undefined;
      try { await this.audit?.record(login && status === 429 ? 'auth.login_limited' : 'http.access_denied', 'denied', req.user, 'http', undefined, subject); }
      catch { /* Preserve denial status; never log the failed event or request payload. */ }
    }
    res.status(status).json({ statusCode: status, ...(typeof payload === 'string' ? { message: payload } : payload) });
  }
}
/** Call with NestFactory/Test.createNestApplication({ bodyParser:false }). */
export function configureSecurityHttp(app: INestApplication) {
  const config = securityConfig();
  app.setGlobalPrefix('api');
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.getHttpAdapter().getInstance().set('query parser', 'simple');
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'https:'], connectSrc: ["'self'", ...config.origins], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"], upgradeInsecureRequests: config.production ? [] : null } }, referrerPolicy: { policy: 'no-referrer' }, hsts: config.production ? { maxAge: 31536000, includeSubDomains: true } : false }));
  app.use((req: any, res: any, next: any) => {
    if (req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store');
      if (req.headers.origin && !config.origins.includes(req.headers.origin)) return res.status(403).json({ statusCode: 403, message: 'Origem não permitida' });
    }
    next();
  });
  app.enableCors({ origin: config.origins, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'], maxAge: 600 });
  app.use(json({ limit: '64kb', strict: true }));
  app.use(urlencoded({ extended: false, limit: '64kb', parameterLimit: 100 }));
  app.use((req: any, res: any, next: any) => {
    try { checkInput(req.body); checkInput(req.query); next(); } catch { res.status(400).json({ statusCode: 400, message: 'Entrada inválida' }); }
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true, transform: true, transformOptions: { enableImplicitConversion: false }, validationError: { target: false, value: false }, exceptionFactory: errors => { const messages: string[] = []; const walk = (rows: any[], prefix = '') => rows.forEach(e => { const field = prefix + e.property; for (const [rule, message] of Object.entries(e.constraints ?? {})) messages.push(['phone','safePassword','confirmation','text'].includes(rule) || String(message).includes('Informe') ? String(message) : `${field}: valor inválido ou fora dos limites permitidos (${rule === 'whitelistValidation' ? 'campo não permitido' : rule === 'isDefined' ? 'campo obrigat?rio' : 'confira o formato e os limites'}).`); walk(e.children ?? [], field + '.'); }); walk(errors); return new BadRequestException(messages); } }));
  app.useGlobalFilters(new SafeExceptionFilter(app.get(AuditService)));
}
