import { normalizePhone, normalizeEmail, validPhone } from '../common/business-validation.js';
import { Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TenantStatus } from '../common/enums.js';
import { isValidCnpj, normalizeCnpj } from '../common/brazil-documents.js';

@Schema({ _id: true, strict: 'throw' })
export class TenantDecision {
  @Prop({ type: String, required: true, enum: ['approved', 'rejected', 'suspended', 'reactivated', 'migrated'] }) action!: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) actorId!: Types.ObjectId;
  @Prop({ type: Date, required: true, default: Date.now }) occurredAt!: Date;
  @Prop({ type: String, trim: true, minlength: 3, maxlength: 500, required: function(this: TenantDecision) { return ['rejected', 'suspended', 'reactivated'].includes(this.action); } }) reason?: string;
}
export const TenantDecisionSchema = SchemaFactory.createForClass(TenantDecision);

@Schema({ collection: 'tenants_v2', timestamps: true, strict: 'throw', autoIndex: false, autoCreate: false, optimisticConcurrency: true })
export class Tenant {
  @Prop({ type: String, required: true, set: normalizeCnpj, validate: isValidCnpj, immutable: true }) cnpj!: string;
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 200 }) legalName!: string;
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 160 }) tradeName!: string;
  @Prop({ type: String, required: true, trim: true, lowercase: true, set: normalizeEmail, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }) corporateEmail!: string;
  @Prop({ type: String, required: true, set: normalizePhone, validate: validPhone }) phone!: string;
  @Prop({ type: String, required: true, enum: TenantStatus, default: TenantStatus.PENDING }) status!: TenantStatus;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, immutable: true }) ownerId!: Types.ObjectId;
  @Prop({ type: Number, required: true, min: 0, default: 0, validate: Number.isSafeInteger, select: false }) sessionVersion!: number;
  @Prop({ type: Number, required: true, min: 0, default: 0, validate: Number.isSafeInteger, select: false }) membershipVersion!: number;
  @Prop({ type: [TenantDecisionSchema], default: [] }) decisionHistory!: TenantDecision[];
  createdAt!: Date;
  updatedAt!: Date;
}
export type TenantDocument = HydratedDocument<Tenant>;
export const TenantSchema = SchemaFactory.createForClass(Tenant);
TenantSchema.index({ cnpj: 1 }, { unique: true });
TenantSchema.index({ status: 1, createdAt: 1, _id: 1 });
