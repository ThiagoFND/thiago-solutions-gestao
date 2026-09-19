import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { CategoriesService } from './categories.service.js';
import { CatalogQuery, CategoryDto, MoveProductsDto, CategoryOrderDto } from './catalog.dto.js';
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}
  @Get() @Permissions('categorias.visualizar') list(@Query() q: CatalogQuery, @CurrentUser() u: AuthUser) { return this.service.list(q, u); }
  @Post() @Permissions('categorias.criar') create(@Body() dto: CategoryDto, @CurrentUser() u: AuthUser) { return this.service.create(dto, u); }
  @Patch(':id') @Permissions('categorias.editar') update(@Param('id') id: string, @Body() dto: CategoryDto, @CurrentUser() u: AuthUser) { return this.service.update(id, dto, u); }
  @Get(':id/products') @Permissions('categorias.visualizar', 'produtos.visualizar') linked(@Param('id') id: string, @Query() q: CatalogQuery, @CurrentUser() u: AuthUser) { return this.service.linked(id, q, u); }
  @Post(':id/move-products') @Permissions('categorias.editar', 'produtos.editar') move(@Param('id') id: string, @Body() dto: MoveProductsDto, @CurrentUser() u: AuthUser) { return this.service.move(id, dto, u); }
  @Post(':id/order') @Permissions('categorias.ordenar') order(@Param('id') id:string,@Body() dto:CategoryOrderDto,@CurrentUser() u:AuthUser){return this.service.order(id,dto,u);}
}
