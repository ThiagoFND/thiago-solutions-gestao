import { Permissions } from '../auth/permissions.js';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { CreateProductDto, UpdateProductDto, ProductPurchaseDto } from './dto/product.dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { ProductsQueryDto } from '../common/query.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.KITCHEN, UserRole.CASHIER)
  @Get()
  @Permissions('produtos.visualizar') list(@Query() q: ProductsQueryDto, @CurrentUser() user: AuthUser) { return this.products.list(q.activeOnly, user, q.page, q.limit); }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post()
  @Permissions('produtos.criar') create(@Body() dto: CreateProductDto, @CurrentUser() u: AuthUser) { return this.products.create(dto, u); }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post(':id/purchases') @Permissions('estoque.movimentar') purchase(@Param('id') id:string,@Body() dto:ProductPurchaseDto,@CurrentUser() u:AuthUser){return this.products.purchase(id,dto,u);}

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Patch(':id')
  @Permissions('produtos.editar') update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() u: AuthUser) { return this.products.update(id, dto, u); }
}
