import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../products/product.schema.js';
import { StockMovement, StockMovementSchema } from '../productions/stock-movement.schema.js';
import { Counter, CounterSchema } from './counter.schema.js';
import { Order, OrderSchema } from './order.schema.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { ModularOrdersService } from './modular-orders.service.js';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Order.name, schema: OrderSchema },
    { name: Counter.name, schema: CounterSchema },
    { name: Product.name, schema: ProductSchema },
    { name: StockMovement.name, schema: StockMovementSchema },
  ])],
  controllers: [OrdersController],
  providers: [OrdersService, ModularOrdersService],
  exports: [MongooseModule],
})
export class OrdersModule {}
