import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ingredient, IngredientSchema, Recipe, RecipeSchema, IngredientReceipt, IngredientReceiptSchema, IngredientMovement, IngredientMovementSchema } from './inventory.schema.js';
import { FinancialEntry, FinancialEntrySchema } from '../finance/schemas/financial-entry.schema.js';
import { Product, ProductSchema } from '../products/product.schema.js';
import { Production, ProductionSchema } from '../productions/production.schema.js';
import { StockMovement, StockMovementSchema } from '../productions/stock-movement.schema.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
@Module({imports:[MongooseModule.forFeature([
  {name:Ingredient.name,schema:IngredientSchema},{name:Recipe.name,schema:RecipeSchema},
  {name:IngredientReceipt.name,schema:IngredientReceiptSchema},{name:IngredientMovement.name,schema:IngredientMovementSchema},
  {name:FinancialEntry.name,schema:FinancialEntrySchema},{name:Product.name,schema:ProductSchema},
  {name:Production.name,schema:ProductionSchema},{name:StockMovement.name,schema:StockMovementSchema},
])],controllers:[InventoryController],providers:[InventoryService],exports:[InventoryService]})
export class InventoryModule {}
