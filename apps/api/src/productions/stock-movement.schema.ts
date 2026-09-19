import { Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { StockMovementType } from '../common/enums.js';

@Schema({ collection: 'stock_movements_v2', autoIndex: false, autoCreate: false, strict: 'throw', timestamps: true })
export class StockMovement {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true }) productId!: Types.ObjectId;
  @Prop({ required: true, maxlength: 120 }) productName!: string;
  @Prop({ required: true, min: -1_000_000, max: 1_000_000, validate: Number.isSafeInteger }) quantityChange!: number;
  @Prop({ type: String, required: true, enum: StockMovementType }) type!: StockMovementType;
  @Prop() referenceId?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) userId?: Types.ObjectId;
  @Prop() userName?: string;
}

export type StockMovementDocument = HydratedDocument<StockMovement>;
export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);

StockMovementSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
