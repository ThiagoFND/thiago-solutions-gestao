import { Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from '../common/enums.js';
@Schema({ _id: false, strict: 'throw' })
export class AccessSnapshot {
  @Prop({ type: String, enum: [...Object.values(UserRole), null] }) role?: string | null;
  @Prop({ type: String, enum: ['PENDING','ACTIVE','REJECTED','INACTIVE'] }) status?: string;
  @Prop({ type: String, match: /^[a-f0-9]{24}$/ }) customRoleId?: string;
  // Preserve retired capabilities as evidence without granting them to current identities.
  @Prop({ type: [String], default: undefined, validate: (permissions?: string[]) => !permissions || permissions.length <= 1000 && permissions.every(permission => /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(permission) && permission.length <= 100) }) permissions?: string[];
}
const AccessSnapshotSchema=SchemaFactory.createForClass(AccessSnapshot);

/** No arbitrary request body, headers, token or secret metadata is persisted. */
@Schema({ collection: 'security_audit_events_v2', autoIndex: false, autoCreate: false, strict: 'throw', versionKey: false })
export class AuditEvent {
  @Prop({type:AccessSnapshotSchema,immutable:true}) before?:AccessSnapshot;
  @Prop({type:AccessSnapshotSchema,immutable:true}) after?:AccessSnapshot;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', default: null, immutable: true }) tenantId!: Types.ObjectId | null;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', immutable: true }) targetTenantId?: Types.ObjectId;
  @Prop({ type: Date, required: true, default: Date.now, immutable: true }) occurredAt!: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', immutable: true }) actorId?: Types.ObjectId;
  @Prop({ type: String, enum: Object.values(UserRole), immutable: true }) actorRole?: string;
  @Prop({ type: String, required: true, maxlength: 80, match: /^[a-z][a-z0-9_.-]*$/, immutable: true }) action!: string;
  @Prop({ type: String, required: true, enum: ['success', 'failure', 'denied'], immutable: true }) outcome!: string;
  @Prop({ type: String, maxlength: 80, match: /^[a-z][a-z0-9_.-]*$/, immutable: true }) resourceType?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, immutable: true }) resourceId?: Types.ObjectId;
  @Prop({ type: String, maxlength: 80, match: /^[a-zA-Z0-9_.:-]+$/, immutable: true }) reasonCode?: string;
  @Prop({ type: String, maxlength: 64, match: /^[a-f0-9]{64}$/, immutable: true }) subjectHash?: string;
}
export type AuditEventDocument = HydratedDocument<AuditEvent>;
export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);
AuditEventSchema.index({ tenantId: 1, occurredAt: -1, _id: -1 });
AuditEventSchema.index({ tenantId: 1, actorId: 1, occurredAt: -1 });
AuditEventSchema.index({ tenantId: 1, action: 1, occurredAt: -1 });
// No TTL: audit evidence and previous test runs must be retained.
