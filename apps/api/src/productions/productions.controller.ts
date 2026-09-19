import { Permissions } from '../auth/permissions.js';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { UserRole } from '../common/enums.js';
import { CreateProductionDto } from './dto/create-production.dto.js';
import { PageQueryDto } from '../common/query.dto.js';
import { ProductionsService } from './productions.service.js';

@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.KITCHEN)
@Controller('productions')
export class ProductionsController {
  constructor(private readonly productions: ProductionsService) {}
  @Get('today') @Permissions('producao.visualizar') listToday(@Query() q: PageQueryDto, @CurrentUser() u: AuthUser) { return this.productions.listToday(q.page, q.limit, u); }
  @Post() @Permissions('producao.registrar') create(@Body() dto: CreateProductionDto, @CurrentUser() user: AuthUser) {
    return this.productions.create(dto, user);
  }
}
