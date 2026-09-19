import { Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { FinancialType } from '../finance.enums.js';

@Schema({ collection: 'categorias_financeiras_v2', autoIndex: false, autoCreate: false, strict: 'throw', timestamps: true })
export class FinancialCategory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 100 }) name!: string;
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 100 }) normalizedName!: string;
  @Prop({ type: String, trim: true, maxlength: 160 }) seedKey?: string;
  @Prop({ type: String, required: true, enum: FinancialType }) type!: FinancialType;
  @Prop({ type: Boolean, required: true, default: true }) active!: boolean;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) createdById?: Types.ObjectId;
  @Prop({ type: String }) createdByName?: string;
  createdAt!: Date;
  updatedAt!: Date;
}
export type FinancialCategoryDocument = HydratedDocument<FinancialCategory>;
export const FinancialCategorySchema = SchemaFactory.createForClass(FinancialCategory);
FinancialCategorySchema.index({ tenantId: 1, type: 1, normalizedName: 1 }, { unique: true });
FinancialCategorySchema.index({ tenantId: 1, type: 1, active: 1 });
FinancialCategorySchema.index({ tenantId: 1, seedKey: 1 }, { unique: true, partialFilterExpression: { seedKey: { $type: 'string' } } });
