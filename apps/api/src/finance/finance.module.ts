import { Order, OrderSchema } from '../orders/order.schema.js';
import { FiscalSalesController } from './fiscal-sales.controller.js';
import { FiscalSalesService } from './fiscal-sales.service.js';
import { Attachment, AttachmentSchema } from './attachments/attachment.schema.js';
import { AttachmentStorage, LocalAttachmentStorage } from './attachments/attachment-storage.js';
import { AttachmentsService } from './attachments/attachments.service.js';
import { AttachmentsController } from './attachments/attachments.controller.js';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from '../products/products.module.js';
import { FinancialCategory, FinancialCategorySchema } from './schemas/financial-category.schema.js';
import { FinancialEntry, FinancialEntrySchema } from './schemas/financial-entry.schema.js';
import { FinancialRecurrence, FinancialRecurrenceSchema } from './schemas/financial-recurrence.schema.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';

@Module({
  imports: [ProductsModule, MongooseModule.forFeature([
    {name:Order.name,schema:OrderSchema},
    {name:Attachment.name,schema:AttachmentSchema},
    { name: FinancialCategory.name, schema: FinancialCategorySchema },
    { name: FinancialEntry.name, schema: FinancialEntrySchema },
    { name: FinancialRecurrence.name, schema: FinancialRecurrenceSchema },
  ])],
  controllers: [FinanceController,AttachmentsController,FiscalSalesController], providers: [FinanceService,AttachmentsService,FiscalSalesService,{provide:AttachmentStorage,useClass:LocalAttachmentStorage}], exports: [FinanceService],
})
export class FinanceModule {}
