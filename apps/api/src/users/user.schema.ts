import { normalizePhone, normalizeEmail, validPhone } from '../common/business-validation.js';
import { Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole, UserStatus } from '../common/enums.js';

@Schema({ _id: false, strict: 'throw' })
export class EncryptedCpf {
  @Prop({ type: String, required: true, enum: ['1'] }) keyVersion!: string;
  @Prop({ type: String, required: true, match: /^[A-Za-z0-9+/]{16}$/ }) iv!: string;
  @Prop({ type: String, required: true, match: /^[A-Za-z0-9+/]{22}==$/ }) tag!: string;
  @Prop({ type: String, required: true, match: /^[A-Za-z0-9+/]{15}=$/ }) ciphertext!: string;
}
export const EncryptedCpfSchema = SchemaFactory.createForClass(EncryptedCpf);

@Schema({ collection: 'users_v2', autoIndex: false, autoCreate: false, timestamps: true, strict: 'throw', optimisticConcurrency: true })
export class User {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'CustomRole' }) customRoleId?: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', default: null, immutable: true, required: function(this: User) { return this.role !== UserRole.PLATFORM_ADMIN; }, validate: { validator: function(this: User, value: Types.ObjectId | null) { return this.role !== UserRole.PLATFORM_ADMIN || value == null; }, message: 'Platform identity cannot belong to tenant' } }) tenantId!: Types.ObjectId | null;
  @Prop({ type: String, enum: UserStatus, required: true, default: UserStatus.PENDING }) status!: UserStatus;
  @Prop({ type: Date, default: Date.now }) requestedAt!: Date;
  @Prop({ type: String, set: normalizePhone, validate: validPhone }) phone?: string;
  @Prop({ type: String, trim: true, minlength: 2, maxlength: 500 }) jobDescription?: string;
  @Prop({ type: EncryptedCpfSchema, select: false }) cpfEncrypted?: EncryptedCpf;
  @Prop({ type: String, match: /^[a-f0-9]{64}$/, select: false }) cpfHash?: string;
  @Prop({ type: String, match: /^\d{2}$/, select: false }) cpfLastDigits?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) reviewedById?: Types.ObjectId;
  @Prop({ type: Date }) reviewedAt?: Date;
  @Prop({ type: String, maxlength: 500 }) rejectionReason?: string;
  createdAt!: Date;
  updatedAt!: Date;
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 }) name!: string;
  @Prop({ required: true, lowercase: true, set: normalizeEmail, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }) email!: string;
  @Prop({ required: true, select: false, maxlength: 255, match: /^(?:\$2[aby]\$(?:1[2-9]|2\d|3[01])\$[./A-Za-z0-9]{53}|\$argon2id\$.+)$/ }) passwordHash!: string;
  @Prop({ type: String, enum: [...Object.values(UserRole), null], default: null, required: function(this: User) { return ![UserStatus.PENDING, UserStatus.REJECTED].includes(this.status); } }) role!: UserRole | null;
  @Prop({ default: false }) active!: boolean;
  @Prop({ type: Number, default: 0, min: 0, select: false, validate: Number.isSafeInteger }) sessionVersion!: number;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, cpfHash: 1 }, { unique: true, partialFilterExpression: { cpfHash: { $type: 'string' } } });
UserSchema.index({ tenantId: 1, status: 1, requestedAt: 1, _id: 1 });
UserSchema.index({ tenantId: 1, role: 1, status: 1 });
UserSchema.index({ tenantId: 1, customRoleId: 1, status: 1 });
UserSchema.pre('validate', function() {
  if (this.role === UserRole.PLATFORM_ADMIN && this.tenantId != null) this.invalidate('tenantId', 'Platform identity cannot belong to tenant');
  const cpfFields = [this.cpfEncrypted, this.cpfHash, this.cpfLastDigits];
  if (cpfFields.some(Boolean) && !cpfFields.every(Boolean)) this.invalidate('cpfEncrypted', 'CPF protection fields must be supplied together');
  this.active = this.status === UserStatus.ACTIVE;
});
UserSchema.set('toJSON', { transform: (_doc, ret: any) => {
  for (const key of ['passwordHash', 'cpfEncrypted', 'cpfHash', 'cpfLastDigits', 'sessionVersion', '__v']) delete ret[key];
  return ret;
} });
