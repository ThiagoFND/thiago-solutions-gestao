import { Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { FinancialFrequency, FinancialNature, FinancialType } from '../finance.enums.js';
import { civilDateOptions, integerOptions, monetaryOptions, FinancialProduction, FinancialProductionSchema } from './financial-shared.schema.js';

@Schema({ collection: 'recorrencias_financeiras_v2', autoIndex: false, autoCreate: false, strict: 'throw', timestamps: true, versionKey: false })
export class FinancialRecurrence {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ type: String, required: true, trim: true, minlength: 3, maxlength: 200 }) description!: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'FinancialCategory', required: true }) categoryId!: Types.ObjectId;
  @Prop({ type: String, required: true, enum: FinancialType }) type!: FinancialType;
  @Prop({ type: String, required: true, enum: FinancialNature }) nature!: FinancialNature;
  @Prop({ ...monetaryOptions, required: true }) expectedAmountCents!: number;
  @Prop({ type: String, trim: true, maxlength: 2000 }) notes?: string;
  @Prop({ type: String, trim: true, maxlength: 160 }) supplier?: string;
  @Prop({ type: FinancialProductionSchema }) production?: FinancialProduction;
  @Prop({ type: String, required: true, enum: FinancialFrequency }) frequency!: FinancialFrequency;
  @Prop({ ...civilDateOptions, required: true }) startDate!: string;
  @Prop({ ...integerOptions, min: 1, max: 31, required: function(this: FinancialRecurrence) { return this.frequency === FinancialFrequency.MENSAL; } }) billingDay?: number;
  @Prop({ ...integerOptions, min: 1, max: 600 }) installments?: number;
  @Prop({ type: Boolean, required: true, default: true }) active!: boolean;
  @Prop({ ...integerOptions, required: true, default: 0 }) version!: number;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) createdById!: Types.ObjectId;
  @Prop({ type: String, required: true, maxlength: 120 }) createdByName!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
export type FinancialRecurrenceDocument = HydratedDocument<FinancialRecurrence>;
export const FinancialRecurrenceSchema = SchemaFactory.createForClass(FinancialRecurrence);
FinancialRecurrenceSchema.index({ tenantId: 1, active: 1, frequency: 1 });
FinancialRecurrenceSchema.index({ tenantId: 1, categoryId: 1 });
