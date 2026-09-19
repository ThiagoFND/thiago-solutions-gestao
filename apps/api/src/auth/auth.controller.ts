import { TenancyService } from '../tenants/tenancy.service.js';
import * as D from '../tenants/tenancy.dto.js';
import { ForbiddenException, SetMetadata, HttpCode, Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { AuthService } from './auth.service.js';
import { LoginDto, PlatformLoginDto } from './dto/login.dto.js';
import { Public } from './public.decorator.js';
import { CurrentUser } from './current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { Roles } from './roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { cookieOptions, CSRF_COOKIE, SESSION_COOKIE, readCookie } from '../common/security.config.js';
@SetMetadata('sessionOnly', true)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly tenancy: TenancyService) {}
  @Public() @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const existing = readCookie(req.headers.cookie, CSRF_COOKIE);
    const csrfToken = existing && /^[a-f\d]{64}$/.test(existing) ? existing : randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, csrfToken, cookieOptions());
    return { csrfToken };
  }
  @Public() @HttpCode(200) @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    res.cookie(SESSION_COOKIE, result.token, cookieOptions());
    return { user: result.user };
  }
  @Public() @Post('onboarding') onboarding(@Body() d: D.OnboardingDto) { return this.tenancy.onboarding(d); }
  @Public() @Post('company-lookup') lookup(@Body() d: D.CompanyLookupDto) { return this.tenancy.lookup(d.cnpj); }
  @Public() @Post('access-requests') request(@Body() d: D.AccessRequestDto) { return this.tenancy.request(d); }
  @Public() @HttpCode(200) @Post('platform-login')
  async platformLogin(@Body() d: PlatformLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(d, true); res.cookie(SESSION_COOKIE, result.token, cookieOptions()); return { user: result.user };
  }
  @Get('me') me(@CurrentUser() user: AuthUser) { return this.auth.publicIdentity(user); }
  @Get('request-status') requestStatus(@CurrentUser() user: AuthUser) { if (!user.tenantId) throw new ForbiddenException('Sessão empresarial obrigatória'); return { status: user.status, tenantStatus: user.tenantStatus, message: user.status === 'PENDING' ? 'Sua solicita??o est? aguardando aprova??o.' : 'Acesso aprovado.' }; }
  @HttpCode(200) @Post('logout')
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user);
    const { maxAge, ...options } = cookieOptions();
    res.clearCookie(SESSION_COOKIE, options); res.clearCookie(CSRF_COOKIE, options);
    return { success: true };
  }
}
