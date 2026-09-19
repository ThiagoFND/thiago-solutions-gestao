import { Body, Controller, Get, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { PageQueryDto } from '../common/query.dto.js';
import { RolesService } from './roles.service.js';
import { DuplicateRoleDto, RoleDto } from './roles.dto.js';
@Controller('roles')
export class CustomRolesController {
  constructor(private readonly service: RolesService) {}
  @Get('permissions') @Permissions('cargos.visualizar') catalog(@CurrentUser() u: AuthUser) { return this.service.catalog(u); }
  @Get() @Permissions('cargos.visualizar') list(@CurrentUser() u: AuthUser, @Query() q: PageQueryDto) { return this.service.list(u, q.page, q.limit); }
  @Post() @Permissions('cargos.criar') create(@CurrentUser() u: AuthUser, @Body() dto: RoleDto) { return this.service.create(dto, u); }
  @Patch(':id') @Permissions('cargos.editar') update(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: RoleDto) { return this.service.update(id, dto, u); }
  @Post(':id/duplicate') @Permissions('cargos.criar') duplicate(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: DuplicateRoleDto) { return this.service.duplicate(id, dto.name, u); }
  @Post(':id/assign/:userId') @Permissions('cargos.atribuir', 'usuarios.alterar_cargo') assign(@Param('id') id: string, @Param('userId') userId: string, @CurrentUser() u: AuthUser) { return this.service.assign(id, userId, u); }
  @Get(':id/users') @Permissions('cargos.visualizar', 'usuarios.visualizar') members(@Param('id') id: string, @CurrentUser() u: AuthUser, @Query() q: PageQueryDto) { return this.service.members(id, u, q.page, q.limit); }
  @Get(':id/history') @Permissions('cargos.visualizar') history(@Param('id') id: string, @CurrentUser() u: AuthUser, @Query() q: PageQueryDto) { return this.service.history(id, u, q.page, q.limit); }
}
@Module({ controllers: [CustomRolesController], providers: [RolesService] })
export class CustomRolesModule {}
