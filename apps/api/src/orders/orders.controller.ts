import { Permissions } from '../auth/permissions.js';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { OrderStatus, UserRole } from '../common/enums.js';
import { CancelOrderDto, CreateOrderDto, FinalizeOrderDto, UpdateOrderDto } from './dto/order.dto.js';
import { OrdersQueryDto } from '../common/query.dto.js';
import { OrdersService } from './orders.service.js';

@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.CASHIER)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Get() @Permissions('vendas.visualizar') list(@Query() q: OrdersQueryDto, @CurrentUser() user: AuthUser) { return this.orders.list(q.status, user, q.page, q.limit); }
  @Get(':id') @Permissions('vendas.visualizar') get(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.orders.get(id, user); }
  @Post() @Permissions('vendas.criar') create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) { return this.orders.create(dto, user); }
  @Patch(':id') @Permissions('vendas.editar') update(@Param('id') id: string, @Body() dto: UpdateOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.update(id, dto, user);
  }
  @Post(':id/finalize') @Permissions('vendas.finalizar') finalize(@Param('id') id: string, @Body() dto: FinalizeOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.finalize(id, dto, user);
  }
  @Post(':id/cancel') @Permissions('vendas.cancelar') cancel(@Param('id') id: string, @Body() dto: CancelOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.cancel(id, dto, user);
  }
}
