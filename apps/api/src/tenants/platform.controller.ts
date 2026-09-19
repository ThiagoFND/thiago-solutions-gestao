import { Body, Controller, Get, Post, Param, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { UserRole } from '../common/enums.js';
import { TenancyService } from './tenancy.service.js';
import * as D from './tenancy.dto.js';
@Roles(UserRole.PLATFORM_ADMIN)
@Controller('platform/tenants')
export class PlatformController {
  constructor(private readonly service: TenancyService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: D.TenantsQueryDto) { return this.service.list(u, q); }
  @Get(':id') detail(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.detail(u, id); }
  @Get(':id/history') history(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query() q: D.TenantsQueryDto) { return this.service.history(u, id, q); }
  @Post(':id/approve') approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.EmptyDto) { return this.service.decide(u, id, 'approved'); }
  @Post(':id/reject') reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.RequiredReasonDto) { return this.service.decide(u, id, 'rejected', d.reason); }
  @Post(':id/suspend') suspend(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.RequiredReasonDto) { return this.service.decide(u, id, 'suspended', d.reason); }
  @Post(':id/reactivate') reactivate(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.RequiredReasonDto) { return this.service.decide(u, id, 'reactivated', d.reason); }
}
