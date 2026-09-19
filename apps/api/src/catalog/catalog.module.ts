import { Body, Controller, Get, Module, Param, Post, Put, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Permissions } from '../auth/permissions.js';
import { Public } from '../auth/public.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { Category, CategorySchema } from './category.schema.js';
import { LandingConfig, LandingConfigSchema } from './landing.schema.js';
import { Product, ProductSchema } from '../products/product.schema.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { LandingService } from './landing.service.js';
import { CatalogQuery } from './catalog.dto.js';
import { LandingDto, PublishDto } from './landing.dto.js';
@Controller('landing')
export class LandingController {
  constructor(private readonly service: LandingService) {}
  @Get() @Permissions('landing_page.visualizar') config(@CurrentUser() u: AuthUser) { return this.service.config(u); }
  @Put() @Permissions('landing_page.configurar') save(@Body() dto: LandingDto, @CurrentUser() u: AuthUser) { return this.service.save(dto, u); }
  @Post('publish') @Permissions('landing_page.publicar') publish(@Body() dto: PublishDto, @CurrentUser() u: AuthUser) { return this.service.publish(true, dto.version, u); }
  @Post('unpublish') @Permissions('landing_page.despublicar') unpublish(@Body() dto: PublishDto, @CurrentUser() u: AuthUser) { return this.service.publish(false, dto.version, u); }
  @Get('preview') @Permissions('landing_page.visualizar') preview(@Query() q: CatalogQuery, @CurrentUser() u: AuthUser) { return this.service.preview(q, u); }
}
@Controller('public/companies')
export class PublicCatalogController {
  constructor(private readonly service: LandingService) {}
  @Public() @Get(':slug') page(@Param('slug') slug: string, @Query() q: CatalogQuery) { return this.service.publicPage(slug, q); }
}
@Module({ imports: [MongooseModule.forFeature([{ name: Category.name, schema: CategorySchema }, { name: LandingConfig.name, schema: LandingConfigSchema }, { name: Product.name, schema: ProductSchema }])], controllers: [CategoriesController, LandingController, PublicCatalogController], providers: [CategoriesService, LandingService] })
export class CatalogModule {}
