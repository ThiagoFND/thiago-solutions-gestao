import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, UserStatus, TenantStatus } from '../common/enums.js';
import { ROLES_KEY } from './roles.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { AuditService } from '../audit/audit.service.js';
import { AUTHORIZED_CAPABILITIES, legacyPermissions, PERMISSIONS_KEY } from './permissions.js';
import { permissionModules } from '../commerce/commerce.domain.js';
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly audit: AuditService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, targets);
    const req = context.switchToHttp().getRequest();
    const sessionOnly = this.reflector.getAllAndOverride<boolean>('sessionOnly', targets);
    if (sessionOnly && req.user) return true;
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets);
    // Authentication/profile and the owner's subscription area remain reachable for recovery.
    if (req.user?.subscriptionAllowed === false && req.user.role !== UserRole.PLATFORM_ADMIN && !this.reflector.getAllAndOverride<boolean>('subscriptionRecovery', targets)) {
      await this.audit.record('authorization.subscription', 'denied', req.user, req.path.split('/')[2]);
      throw new ForbiddenException({ code: 'SUBSCRIPTION_REQUIRED', message: 'Empresa sem assinatura válida. Solicite a contratação ao administrador da plataforma.' });
    }
    if (required?.length) {
      const permissions = [...required];
      const body = req.body ?? {};
      const base = req.path.split('/')[2];
      if (req.method !== 'GET' && base === 'products') {
        if (['published', 'manuallyHidden', 'featured'].some(k => k in body) || ['PRODUZIDO_SOB_DEMANDA', 'COMPRADO_SOB_DEMANDA'].includes(body.supplyMode)) permissions.push('produtos.publicar');
        if (['publicOrder', 'internalOrder'].some(k => k in body)) permissions.push('produtos.ordenar');
        if (body.active === false) permissions.push('produtos.arquivar');
      }
      if (req.method !== 'GET' && base === 'categories') {
        if ('published' in body) permissions.push('categorias.publicar');
        if (['publicOrder', 'internalOrder'].some(k => k in body)) permissions.push('categorias.ordenar');
        if (body.archived === true || body.active === false) permissions.push('categorias.arquivar');
      }
      if (base === 'users' && req.path.endsWith('/status')) permissions.push(body.status === 'ACTIVE' ? 'usuarios.ativar' : 'usuarios.inativar');
      const available = req.user?.permissions ?? legacyPermissions(req.user?.role ?? null);
      if (req.user?.contractedModules && permissions.some(p => { const modules = permissionModules(p); return modules.length && !modules.some(m => req.user.contractedModules.includes(m)); })) {
        await this.audit.record('authorization.entitlement', 'denied', req.user, base);
        throw new ForbiddenException({ code: 'MODULE_NOT_CONTRACTED', message: 'Módulo não contratado ou assinatura fora da vigência.' });
      }
      if (!req.user || req.user.role === UserRole.PLATFORM_ADMIN || req.user.status !== UserStatus.ACTIVE || !req.user.tenantId || req.user.tenantStatus !== TenantStatus.ACTIVE || permissions.some(p => !available.includes(p))) {
        await this.audit.record('authorization.permission', 'denied', req.user, base);
        throw new ForbiddenException('Você não possui permissão para esta ação.');
      }
      req.user[AUTHORIZED_CAPABILITIES] = permissions;
      return true;
    }
    if (!roles?.length || !req.user || (!roles.includes(req.user.role) || req.user.status !== UserStatus.ACTIVE || (req.user.role === UserRole.PLATFORM_ADMIN ? req.user.tenantId !== null : !req.user.tenantId || req.user.tenantStatus !== TenantStatus.ACTIVE))) {
      await this.audit.record('authorization.role', 'denied', req.user, req.path.split('/')[2]);
      throw new ForbiddenException('Voce nao possui permissao para esta acao');
    }
    return true;
  }
}
