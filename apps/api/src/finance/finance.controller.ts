import { Permissions } from '../auth/permissions.js';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { UserRole } from '../common/enums.js';
import * as D from './finance.dto.js';
import { FinanceService } from './finance.service.js';

@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Get('products') @Permissions('financeiro.visualizar') products(@Query() q: D.PageDto) { return this.finance.productsCatalog(q); }
  @Get('entries') @Permissions('financeiro.visualizar') entries(@Query() query: D.EntriesQueryDto) { return this.finance.listEntries(query); }
  @Get('entries/:id') @Permissions('financeiro.visualizar') entry(@Param('id') id: string) { return this.finance.getEntry(id); }
  @Post('entries') @Permissions('financeiro.criar') create(@Body() dto: D.CreateEntryDto, @CurrentUser() user: AuthUser) { return this.finance.createEntry(dto, user); }
  @Patch('entries/:id') @Permissions('financeiro.editar') update(@Param('id') id: string, @Body() dto: D.UpdateEntryDto, @CurrentUser() user: AuthUser) { return this.finance.updateEntry(id, dto, user); }
  @Post('entries/:id/payment') @Permissions('financeiro.pagar') payment(@Param('id') id: string, @Body() dto: D.PaymentDto, @CurrentUser() user: AuthUser) { return this.finance.payment(id, dto, user); }
  @Patch('entries/:id/payment') @Permissions('financeiro.pagar', 'financeiro.editar') correction(@Param('id') id: string, @Body() dto: D.CorrectPaymentDto, @CurrentUser() user: AuthUser) { return this.finance.payment(id, dto, user, true); }
  @Post('entries/:id/cancel') @Permissions('financeiro.cancelar') cancel(@Param('id') id: string, @Body() dto: D.CancelDto, @CurrentUser() user: AuthUser) { return this.finance.cancel(id, dto, user); }
  @Get('entries/:id/history') @Permissions('financeiro.visualizar') history(@Param('id') id: string, @Query() query: D.PageDto) { return this.finance.history(id, query); }
  @Get('summary') @Permissions('financeiro.visualizar') summary(@Query() query: D.MonthDto) { return this.finance.summary(query); }
  @Get('reports/monthly') @Permissions('financeiro.visualizar') monthly(@Query() query: D.MonthDto) { return this.finance.summary(query); }
  @Get('categories') @Permissions('financeiro.visualizar') categories(@Query() query: D.CatalogQueryDto) { return this.finance.listCategories(query); }
  @Post('categories') @Permissions('financeiro.criar') category(@Body() dto: D.CategoryDto, @CurrentUser() user: AuthUser) { return this.finance.createCategory(dto, user); }
  @Patch('categories/:id') @Permissions('financeiro.editar') updateCategory(@Param('id') id: string, @Body() dto: D.UpdateCategoryDto) { return this.finance.updateCategory(id, dto); }
  @Post('categories/:id/deactivate') @Permissions('financeiro.editar') deactivateCategory(@Param('id') id: string) { return this.finance.updateCategory(id, { active: false }); }
  @Get('recurrences') @Permissions('financeiro.visualizar') recurrences(@Query() query: D.CatalogQueryDto) { return this.finance.listRecurrences(query); }
  @Get('recurrences/:id') @Permissions('financeiro.visualizar') recurrence(@Param('id') id: string) { return this.finance.getRecurrence(id); }
  @Post('recurrences') @Permissions('financeiro.criar') createRecurrence(@Body() dto: D.CreateRecurrenceDto, @CurrentUser() user: AuthUser) { return this.finance.createRecurrence(dto, user); }
  @Patch('recurrences/:id') @Permissions('financeiro.editar') updateRecurrence(@Param('id') id: string, @Body() dto: D.UpdateRecurrenceDto) { return this.finance.updateRecurrence(id, dto); }
  @Post('recurrences/:id/generate') @Permissions('financeiro.criar') generate(@Param('id') id: string, @Body() dto: D.GenerateDto, @CurrentUser() user: AuthUser) { return this.finance.generate(id, dto.competence, user); }
  @Post('recurrences/:id/deactivate') @Permissions('financeiro.editar') deactivateRecurrence(@Param('id') id: string, @Body() dto: D.VersionDto) { return this.finance.updateRecurrence(id, { version: dto.version, active: false }); }
}
