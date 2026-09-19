import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { SERVICE_MODELS } from './service-orders.schemas.js';
import { ServiceOrdersService } from './service-orders.service.js';
import * as D from './service-orders.dto.js';
@Controller('service-orders')
class ServiceOrdersController {
  constructor(private service: ServiceOrdersService) {}
  @Get('services') @Permissions('servicos.visualizar') services(@CurrentUser() u: AuthUser, @Query() q: D.ServiceQuery) { return this.service.catalog(u, q, 'services'); }
  @Post('services') @Permissions('servicos.configurar') serviceDefinition(@CurrentUser() u: AuthUser, @Body() d: D.ServiceDefinitionDto) { return this.service.createService(u, d); }
  @Get('resources') @Permissions('servicos.visualizar') resources(@CurrentUser() u: AuthUser, @Query() q: D.ServiceQuery) { return this.service.catalog(u, q, 'resources'); }
  @Post('resources') @Permissions('servicos.configurar') resource(@CurrentUser() u: AuthUser, @Body() d: D.ResourceDto) { return this.service.createResource(u, d); }
  @Get('people') @Permissions('servicos.visualizar') people(@CurrentUser() u: AuthUser, @Query() q: D.ServiceQuery) { return this.service.catalog(u, q, 'people'); }
  @Get('parties') @Permissions('servicos.visualizar') parties(@CurrentUser() u: AuthUser, @Query() q: D.ServiceQuery) { return this.service.catalog(u, q, 'parties'); }
  @Get('products') @Permissions('servicos.visualizar') products(@CurrentUser() u: AuthUser, @Query() q: D.ServiceQuery) { return this.service.catalog(u, q, 'products'); }
  @Get('appointments') @Permissions('servicos.visualizar') appointments(@CurrentUser() u: AuthUser, @Query() q: D.ServiceQuery) { return this.service.list(u, q, 'appointments'); }
  @Post('appointments') @Permissions('servicos.agendar') book(@CurrentUser() u: AuthUser, @Body() d: D.AppointmentDto) { return this.service.book(u, d); }
  @Post('appointments/:id/reschedule') @Permissions('servicos.agendar') reschedule(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.RescheduleDto) { return this.service.reschedule(u, id, d); }
  @Post('appointments/:id/status') @Permissions('servicos.visualizar') appointmentState(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.AppointmentStatusDto) { return this.service.appointmentState(u, id, d); }
  @Get('orders') @Permissions('servicos.visualizar') orders(@CurrentUser() u: AuthUser, @Query() q: D.ServiceQuery) { return this.service.list(u, q, 'orders'); }
  @Post('orders') @Permissions('servicos.criar') create(@CurrentUser() u: AuthUser, @Body() d: D.OrderDto) { return this.service.createOrder(u, d); }
  @Get('orders/:id') @Permissions('servicos.visualizar') detail(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.detail(u, id); }
  @Post('orders/:id/status') @Permissions('servicos.visualizar') state(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.OrderStatusDto) { return this.service.orderState(u, id, d); }
  @Post('orders/:id/complete') @Permissions('servicos.executar') complete(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.CompletionDto) { return this.service.complete(u, id, d); }
}
@Module({ imports: [MongooseModule.forFeature(SERVICE_MODELS)], controllers: [ServiceOrdersController], providers: [ServiceOrdersService, OperationalStore] })
export class ServiceOrdersModule {}
