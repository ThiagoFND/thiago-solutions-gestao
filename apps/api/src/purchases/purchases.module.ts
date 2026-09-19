import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { PURCHASE_MODELS } from './purchases.schemas.js';
import { PurchasesService } from './purchases.service.js';
import * as D from './purchases.dto.js';
@Controller('purchases')
class PurchasesController {
 constructor(private service:PurchasesService){}
 @Get('products') @Permissions('compras.visualizar') products(@CurrentUser() u:AuthUser,@Query() q:D.PurchaseQuery){return this.service.catalog(u,q,'products');}
 @Get('suppliers') @Permissions('compras.visualizar') suppliers(@CurrentUser() u:AuthUser,@Query() q:D.PurchaseQuery){return this.service.catalog(u,q,'suppliers');}
 @Get('receipts') @Permissions('compras.visualizar') receipts(@CurrentUser() u:AuthUser,@Query() q:D.PurchaseQuery){return this.service.receipts(u,q);}
 @Get() @Permissions('compras.visualizar') list(@CurrentUser() u:AuthUser,@Query() q:D.PurchaseQuery){return this.service.list(u,q);}
 @Post() @Permissions('compras.criar') create(@CurrentUser() u:AuthUser,@Body() d:D.PurchaseDto){return this.service.create(u,d);}
 @Get(':id') @Permissions('compras.visualizar') detail(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.service.detail(u,id);}
 @Post(':id/status') @Permissions('compras.visualizar') state(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.PurchaseStateDto){return this.service.state(u,id,d);}
 @Post(':id/receipts') @Permissions('compras.receber') receive(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.PurchaseReceiptDto){return this.service.receive(u,id,d);}
}
@Module({imports:[MongooseModule.forFeature(PURCHASE_MODELS)],controllers:[PurchasesController],providers:[PurchasesService,OperationalStore]})
export class PurchasesModule {}
