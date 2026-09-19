import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { TenantAccessService } from '../tenants/tenant-access.service.js';
import { UserRole } from '../common/enums.js';
import { documentNumber } from '../tenants/tenancy.service.js';
import { LoginDto, PlatformLoginDto } from './dto/login.dto.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth-user.js';
@Injectable()
export class AuthService {
  private readonly dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);
  private readonly failures = new Map<string, { count: number; until: number }>();
  constructor(private readonly access: TenantAccessService, private readonly jwt: JwtService, private readonly audit: AuditService) {}
  async login(dto: LoginDto | PlatformLoginDto, platform = false) {
    let cnpj = '';
    if (!platform) { try { cnpj = documentNumber((dto as LoginDto).cnpj); } catch { cnpj = 'invalid'; } }
    const subjectHash = createHash('sha256').update(`${platform ? 'platform' : cnpj}:${dto.email.trim().toLowerCase()}`).digest('hex');
    const previous = this.failures.get(subjectHash);
    const tenant = platform ? null : await this.access.tenants.findOne({ cnpj });
    const user = platform || tenant ? await this.access.users.findOne({ email: dto.email.trim().toLowerCase(), tenantId: platform ? null : tenant!._id, ...(platform ? { role: UserRole.PLATFORM_ADMIN } : {}) }).select('+passwordHash +sessionVersion') : null;
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? await this.dummyHash);
    let current: AuthUser | undefined;
    if (user && valid) { try { current = await this.access.identity(user.id); } catch {} }
    if (!current || !user || !valid || (previous && previous.until > Date.now())) {
      const count = Math.min((previous?.count ?? 0) + 1, 8);
      if (this.failures.size > 10000) for (const [key, value] of this.failures) if (value.until < Date.now()) this.failures.delete(key);
      if (this.failures.size < 20000) this.failures.set(subjectHash, { count, until: Date.now() + Math.min(60000, 250 * 2 ** count) });
      await this.audit.record('auth.login', 'failure', undefined, 'auth', undefined, subjectHash);
      throw new UnauthorizedException('E-mail ou senha invalidos');
    }
    this.failures.delete(subjectHash);
    await this.audit.record('auth.login', 'success', current, 'auth');
    return { token: await this.jwt.signAsync({ sub: user.id, version: current.sessionVersion, tenantId: current.tenantId, tenantVersion: current.tenantVersion }), user: this.publicIdentity(current) };
  }
  publicIdentity(user: AuthUser) { return { sub: user.sub, name: user.name, email: user.email, role: user.role, status: user.status, tenantId: user.tenantId, tenantStatus: user.tenantStatus, permissions: user.permissions ?? [], contractedModules: user.contractedModules, subscriptionAllowed: user.subscriptionAllowed, customRoleId: user.customRoleId, customRoleName: user.customRoleName }; }
  async logout(user: AuthUser) {
    await this.access.users.updateOne({ _id: user.sub, tenantId: user.tenantId }, { $inc: { sessionVersion: 1 } });
    await this.audit.record('auth.logout', 'success', user, 'auth');
  }
}
