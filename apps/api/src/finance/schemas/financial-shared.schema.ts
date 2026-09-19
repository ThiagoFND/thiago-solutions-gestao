import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema } from 'mongoose';
import { FinancialAction, FinancialOrigin, FinancialPaymentMethod, FinancialUnit } from '../finance.enums.js';

export const MAX_FINANCIAL_AMOUNT_CENTS = 1_000_000_000_000;
export const monetaryOptions = {
  type: Number, min: 1, max: MAX_FINANCIAL_AMOUNT_CENTS,
  validate: { validator: Number.isSafeInteger, message: 'O valor deve ser um inteiro seguro em centavos.' },
};
export const integerOptions = {
  type: Number, min: 0,
  validate: { validator: Number.isSafeInteger, message: 'O valor deve ser um inteiro seguro.' },
};
export function isFinancialCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const civilDateOptions = {
  type: String,
  validate: { validator: isFinancialCivilDate, message: 'Informe uma data real no formato AAAA-MM-DD.' },
};

@Schema({ strict: 'throw', _id: false })
export class FinancialProduction {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product' }) productId?: Types.ObjectId;
  @Prop({ type: String, trim: true, maxlength: 160 }) inputName?: string;
  @Prop({ type: Number, validate: {
    validator: (value: number) => Number.isFinite(value) && value > 0 && /^\d+(?:\.\d{1,6})?$/.test(String(value)),
    message: 'A quantidade deve ser positiva e ter até seis casas decimais.',
  } }) quantity?: number;
  @Prop({ type: String, enum: FinancialUnit }) unit?: FinancialUnit;
  @Prop(monetaryOptions) unitAmountCents?: number;
  @Prop(monetaryOptions) totalAmountCents?: number;
}
export const FinancialProductionSchema = SchemaFactory.createForClass(FinancialProduction);

@Schema({ strict: 'throw', _id: false })
export class FinancialPayment {
  @Prop({ ...monetaryOptions, required: true }) paidAmountCents!: number;
  @Prop({ ...civilDateOptions, required: true }) paidOn!: string;
  @Prop({ type: String, enum: FinancialOrigin, required: true }) origin!: FinancialOrigin;
  @Prop({ type: String, enum: FinancialPaymentMethod, required: true }) method!: FinancialPaymentMethod;
  @Prop({ type: String, trim: true, maxlength: 2000 }) notes?: string;
  @Prop({ type: Date, required: true }) registeredAt!: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) registeredById!: Types.ObjectId;
  @Prop({ type: String, required: true }) registeredByName!: string;
  @Prop({ type: Date }) correctedAt?: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) correctedById?: Types.ObjectId;
  @Prop({ type: String }) correctedByName?: string;
}
export const FinancialPaymentSchema = SchemaFactory.createForClass(FinancialPayment);

@Schema({ strict: 'throw' })
export class FinancialHistoryEvent {
  _id!: Types.ObjectId;
  @Prop({ type: String, enum: FinancialAction, required: true }) action!: FinancialAction;
  @Prop({ type: Date, required: true }) occurredAt!: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) userId!: Types.ObjectId;
  @Prop({ type: String, required: true }) userName!: string;
  @Prop({ type: MongooseSchema.Types.Mixed }) before?: Record<string, unknown>;
  @Prop({ type: MongooseSchema.Types.Mixed }) after?: Record<string, unknown>;
  @Prop({ type: String, trim: true, maxlength: 500 }) reason?: string;
}
export const FinancialHistoryEventSchema = SchemaFactory.createForClass(FinancialHistoryEvent);
