import { Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EntryKind, FinancialUnit, FinancialNature, FinancialStatus, FinancialType } from '../finance.enums.js';
import { civilDateOptions, integerOptions, monetaryOptions, FinancialProduction, FinancialProductionSchema, FinancialPayment, FinancialPaymentSchema, FinancialHistoryEvent, FinancialHistoryEventSchema } from './financial-shared.schema.js';

@Schema({ collection: 'lancamentos_financeiros_v2', autoIndex: false, autoCreate: false, strict: 'throw', timestamps: true, versionKey: false })
export class FinancialEntry {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({type:String,enum:EntryKind}) entryKind?: EntryKind;
  @Prop(civilDateOptions) purchaseDate?: string;
  @Prop(civilDateOptions) competenceDate?: string;
  @Prop({type:Number,min:0.000001,max:1000000,validate:(v:number)=>Number.isFinite(v) && /^\d+(?:\.\d{1,6})?$/.test(String(v))}) quantity?: number;
  @Prop({type:String,enum:FinancialUnit}) unit?: FinancialUnit;
  @Prop({type:Number,default:0,min:0,validate:Number.isSafeInteger}) attachmentCount!: number;
  @Prop({ type: String, required: true, trim: true, minlength: 3, maxlength: 200 }) description!: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'FinancialCategory', required: true }) categoryId!: Types.ObjectId;
  @Prop({ type: String, required: true, enum: FinancialType }) type!: FinancialType;
  @Prop({ type: String, required: true, enum: FinancialNature }) nature!: FinancialNature;
  @Prop({ ...monetaryOptions, required: true }) expectedAmountCents!: number;
  @Prop({ ...civilDateOptions, required: true }) dueDate!: string;
  @Prop({ type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }) competence!: string;
  @Prop({ type: String, trim: true, maxlength: 2000 }) notes?: string;
  @Prop({ type: String, trim: true, maxlength: 160 }) supplier?: string;
  @Prop({ type: Boolean, required: true, default: false }) recurring!: boolean;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'FinancialRecurrence' }) recurrenceId?: Types.ObjectId;
  @Prop({ type: String, match: /^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/ }) occurrenceKey?: string;
  @Prop({ ...integerOptions, min: 1 }) installmentNumber?: number;
  @Prop({ type: String, required: true, enum: [FinancialStatus.PENDENTE, FinancialStatus.PAGO, FinancialStatus.CANCELADO], default: FinancialStatus.PENDENTE }) status!: FinancialStatus;
  @Prop({ ...integerOptions, required: true, default: 0 }) version!: number;
  @Prop({ type: FinancialProductionSchema }) production?: FinancialProduction;
  @Prop({ type: FinancialPaymentSchema }) payment?: FinancialPayment;
  @Prop({ type: [FinancialHistoryEventSchema], default: [] }) history!: FinancialHistoryEvent[];
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) createdById!: Types.ObjectId;
  @Prop({ type: String, required: true, maxlength: 120 }) createdByName!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
export type FinancialEntryDocument = HydratedDocument<FinancialEntry>;
export const FinancialEntrySchema = SchemaFactory.createForClass(FinancialEntry);
FinancialEntrySchema.index({ tenantId: 1, competence: 1, dueDate: 1 });
FinancialEntrySchema.index({ tenantId: 1, dueDate: 1, _id: 1 });
FinancialEntrySchema.index({ tenantId: 1, status: 1, dueDate: 1 });
FinancialEntrySchema.index({ tenantId: 1, categoryId: 1, competence: 1 });
FinancialEntrySchema.index({ tenantId: 1, type: 1, competence: 1 });
FinancialEntrySchema.index({ tenantId: 1, 'payment.origin': 1, competence: 1 });
FinancialEntrySchema.index({ tenantId: 1, 'payment.method': 1, competence: 1 });
FinancialEntrySchema.index({ tenantId: 1, recurrenceId: 1, occurrenceKey: 1 }, {
  unique: true,
  partialFilterExpression: { recurrenceId: { $type: 'objectId' }, occurrenceKey: { $type: 'string' } },
});
