import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { LOGISTICS_MODELS } from './logistics.schemas.js';
import { LogisticsService } from './logistics.service.js';
import * as D from './logistics.dto.js';
@Controller('logistics')
class LogisticsController {
 constructor(private service:LogisticsService){}
 @Get('people') @Permissions('logistica.planejar') people(@CurrentUser() u:AuthUser,@Query() q:D.LogisticsQuery){return this.service.people(u,q);}
 @Get('orders') @Permissions('logistica.planejar') orders(@CurrentUser() u:AuthUser,@Query() q:D.LogisticsQuery){return this.service.orders(u,q);}
 @Post('orders') @Permissions('logistica.planejar') order(@CurrentUser() u:AuthUser,@Body() d:D.DeliveryOrderDto){return this.service.createOrder(u,d);}
 @Get('shipments') @Permissions('logistica.visualizar') shipments(@CurrentUser() u:AuthUser,@Query() q:D.LogisticsQuery){return this.service.shipments(u,q);}
 @Post('shipments') @Permissions('logistica.planejar') shipment(@CurrentUser() u:AuthUser,@Body() d:D.ShipmentDto){return this.service.createShipment(u,d);}
 @Get('shipments/:id') @Permissions('logistica.visualizar') detail(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.service.detail(u,id);}
 @Post('shipments/:id/status') @Permissions('logistica.visualizar') state(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.ShipmentStateDto){return this.service.state(u,id,d);}
 @Post('shipments/:id/assign') @Permissions('logistica.planejar') assign(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.ShipmentAssignDto){return this.service.assign(u,id,d);}
}
@Module({imports:[MongooseModule.forFeature(LOGISTICS_MODELS)],controllers:[LogisticsController],providers:[LogisticsService,OperationalStore]})
export class LogisticsModule {}
