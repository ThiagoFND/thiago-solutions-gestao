import { Permissions } from '../auth/permissions.js';
import { Body, Controller, Get, Post, Patch, Param, Query, SetMetadata } from '@nestjs/common';
import { UserRole } from '../common/enums.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import * as D from '../tenants/tenancy.dto.js';
import { UsersService } from './users.service.js';
@Roles(UserRole.OWNER, UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @SetMetadata('sessionOnly', true) @Get('me/profile') profile(@CurrentUser() u: AuthUser) { return this.users.profile(u); }
  @SetMetadata('sessionOnly', true) @Patch('me/profile') deny(@CurrentUser() u: AuthUser) { return this.users.denyProfileChange(u); }
  @Get() @Permissions('usuarios.visualizar') list(@Query() q: D.UsersQueryDto, @CurrentUser() u: AuthUser) { return this.users.list(u, q); }
  @Get('requests') @Permissions('usuarios.visualizar') requests(@Query() q: D.UsersQueryDto, @CurrentUser() u: AuthUser) { return this.users.list(u, q, true); }
  @Get('pending-count') @Permissions('usuarios.visualizar') count(@CurrentUser() u: AuthUser) { return this.users.count(u); }
  @Get(':id') @Permissions('usuarios.visualizar') get(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.users.get(u, id); }
  @Post(':id/approve') @Permissions('usuarios.aprovar', 'cargos.atribuir') approve(@Param('id') id: string, @Body() d: D.MemberRoleDto, @CurrentUser() u: AuthUser) { return this.users.change(u, id, 'approve', undefined, d.customRoleId); }
  @Post(':id/reject') @Permissions('usuarios.aprovar') reject(@Param('id') id: string, @Body() d: D.OptionalReasonDto, @CurrentUser() u: AuthUser) { return this.users.change(u, id, 'reject', d.reason); }
  @Patch(':id/role') @Permissions('usuarios.alterar_cargo', 'cargos.atribuir') role(@Param('id') id: string, @Body() d: D.MemberRoleDto, @CurrentUser() u: AuthUser) { return this.users.change(u, id, 'role', undefined, d.customRoleId); }
  @Patch(':id/status') @Permissions('usuarios.visualizar') status(@Param('id') id: string, @Body() d: D.MemberStatusDto, @CurrentUser() u: AuthUser) { return this.users.change(u, id, 'status', d.status); }
}
