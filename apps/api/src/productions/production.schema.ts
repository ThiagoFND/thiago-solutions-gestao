import { Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'productions_v2', autoIndex: false, autoCreate: false, strict: 'throw', timestamps: true })
export class Production {
  @Prop({ type: String, minlength: 8, maxlength: 100 }) idempotencyKey?: string;
  @Prop({ type: Number, min: 0, validate: Number.isSafeInteger }) recipeVersion?: number;
  @Prop({ type: Number, min: 0, max: 1e12, validate: Number.isSafeInteger }) ingredientCostCents?: number;
  @Prop({ type: Number, min: 0, max: 1e12 }) ingredientCostPerUnitCents?: number;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true }) productId!: Types.ObjectId;
  @Prop({ required: true, maxlength: 120 }) productName!: string;
  @Prop({ required: true, min: 1, max: 1_000_000, validate: Number.isSafeInteger }) quantity!: number;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) createdById!: Types.ObjectId;
  @Prop({ required: true, maxlength: 120 }) createdByName!: string;
}

export type ProductionDocument = HydratedDocument<Production>;
export const ProductionSchema = SchemaFactory.createForClass(Production);

ProductionSchema.index({ tenantId: 1, createdAt: -1, _id: -1 });

ProductionSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
ProductionSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
