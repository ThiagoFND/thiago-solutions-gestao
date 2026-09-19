import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { ProductionsModule } from '../productions/productions.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../products/product.schema.js';
import { FinancialEntry, FinancialEntrySchema } from '../finance/schemas/financial-entry.schema.js';
import { OverviewService } from './overview.service.js';

@Module({ imports: [OrdersModule, ProductionsModule,MongooseModule.forFeature([{name:Product.name,schema:ProductSchema},{name:FinancialEntry.name,schema:FinancialEntrySchema}])], controllers: [ReportsController], providers: [ReportsService,OverviewService] })
export class ReportsModule {}
