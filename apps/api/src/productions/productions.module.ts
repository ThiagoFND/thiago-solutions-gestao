import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from '../products/products.module.js';
import { Production, ProductionSchema } from './production.schema.js';
import { StockMovement, StockMovementSchema } from './stock-movement.schema.js';
import { ProductionsController } from './productions.controller.js';
import { ProductionsService } from './productions.service.js';

@Module({
  imports: [
    InventoryModule,
    ProductsModule,
    MongooseModule.forFeature([
      { name: Production.name, schema: ProductionSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
  ],
  controllers: [ProductionsController],
  providers: [ProductionsService],
  exports: [MongooseModule],
})
export class ProductionsModule {}
