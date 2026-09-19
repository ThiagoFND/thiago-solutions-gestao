import { Body, Controller, Get, Module, Param, Post, Query, SetMetadata } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UserRole } from '../common/enums.js';
import type { AuthUser } from '../common/auth-user.js';
import { PageQueryDto } from '../common/query.dto.js';
import { COMMERCIAL_MODELS } from './commerce.schemas.js';
import { CommerceService } from './commerce.service.js';
import * as D from './commerce.dto.js';
@Controller('platform/commerce')
@Roles(UserRole.PLATFORM_ADMIN)
export class PlatformCommerceController {
  constructor(private readonly service: CommerceService) {}
  @Get('dashboard') dashboard(@CurrentUser() u: AuthUser) { return this.service.dashboard(u); }
  @Get('catalog') catalog(@CurrentUser() u: AuthUser) { return this.service.catalog(u, true); }
  @Post('catalog/initialize') initialize(@CurrentUser() u: AuthUser, @Body() d: D.ReasonDto) { return this.service.initialize(u, d.reason); }
  @Post('catalog/versions') offer(@CurrentUser() u: AuthUser, @Body() d: D.OfferDto) { return this.service.saveOffer(u, d); }
  @Get('discounts') discounts(@CurrentUser() u: AuthUser) { return this.service.discountCatalog(u); }
  @Post('discounts/versions') discount(@CurrentUser() u: AuthUser, @Body() d: D.DiscountDto) { return this.service.saveDiscount(u, d); }
  @Get('coupons') coupons(@CurrentUser() u: AuthUser, @Query() q: PageQueryDto) { return this.service.listCoupons(u, q.page, q.limit); }
  @Post('coupons') coupon(@CurrentUser() u: AuthUser, @Body() d: D.CouponDto) { return this.service.saveCoupon(u, d); }
  @Get('tenants/:tenant/subscription') detail(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string) { return this.service.detail(u, tenant); }
  @Post('tenants/:tenant/quote') quote(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string, @Body() d: D.AdminQuoteDto) { return this.service.quote(u, d, tenant); }
  @Post('tenants/:tenant/subscription') assign(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string, @Body() d: D.AssignDto) { return this.service.assign(u, tenant, d); }
  @Post('tenants/:tenant/schedule') schedule(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string, @Body() d: D.AssignDto) { return this.service.schedule(u, tenant, d); }
  @Post('tenants/:tenant/status') status(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string, @Body() d: D.StatusDto) { return this.service.status(u, tenant, d); }
  @Get('tenants/:tenant/invoices') invoices(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string, @Query() q: PageQueryDto) { return this.service.listInvoices(u, q.page, q.limit, tenant); }
  @Post('tenants/:tenant/invoices') invoice(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string, @Body() d: D.InvoiceDto) { return this.service.createInvoice(u, tenant, d); }
  @Post('tenants/:tenant/invoices/:id/status') invoiceAction(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string, @Param('id') id: string, @Body() d: D.InvoiceActionDto) { return this.service.invoiceAction(u, tenant, id, d); }
  @Post('tenants/:tenant/invoices/:id/edit') editInvoice(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string, @Param('id') id: string, @Body() d: D.EditInvoiceDto) { return this.service.editInvoice(u, tenant, id, d); }
  @Get('tenants/:tenant/requests') requests(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string, @Query() q: PageQueryDto) { return this.service.listRequests(u, q.page, q.limit, tenant); }
  @Post('tenants/:tenant/requests/:id/decision') decision(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string, @Param('id') id: string, @Body() d: D.RequestDecisionDto) { return this.service.decideRequest(u, tenant, id, d); }
  @Get('tenants/:tenant/history') history(@CurrentUser() u: AuthUser, @Param('tenant') tenant: string, @Query() q: PageQueryDto) { return this.service.history(u, tenant, q.page, q.limit); }
}
@Controller('subscription')
@SetMetadata('subscriptionRecovery', true)
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class SubscriptionController {
  constructor(private readonly service: CommerceService) {}
  @Get() detail(@CurrentUser() u: AuthUser) { return this.service.detail(u); }
  @Get('catalog') catalog(@CurrentUser() u: AuthUser) { return this.service.catalog(u); }
  @Post('quote') quote(@CurrentUser() u: AuthUser, @Body() d: D.QuoteDto) { return this.service.quote(u, d); }
  @Get('invoices') invoices(@CurrentUser() u: AuthUser, @Query() q: PageQueryDto) { return this.service.listInvoices(u, q.page, q.limit); }
  @Post('requests') request(@CurrentUser() u: AuthUser, @Body() d: D.SubscriptionRequestDto) { return this.service.request(u, d); }
  @Get('requests') requests(@CurrentUser() u: AuthUser, @Query() q: PageQueryDto) { return this.service.listRequests(u, q.page, q.limit); }
}
@Module({ imports: [MongooseModule.forFeature(COMMERCIAL_MODELS)], controllers: [PlatformCommerceController, SubscriptionController], providers: [CommerceService] })
export class CommerceModule {}
