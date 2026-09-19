import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as M, Types } from 'mongoose';
import { ALL_PERMISSIONS } from '../auth/permissions.js';
@Schema({ _id: false, strict: 'throw' })
export class RoleSnapshot {
  @Prop({ required: true, maxlength: 80 }) name!: string;
  @Prop({ maxlength: 500 }) description?: string;
  // Historical snapshots can contain capabilities retired from the current catalog.
  @Prop({ type: [String], validate: (permissions: string[]) => permissions.length <= 1000 && permissions.every(permission => /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(permission) && permission.length <= 100) }) permissions!: string[];
  @Prop() active!: boolean;
  @Prop() archived!: boolean;
}
const SnapshotSchema = SchemaFactory.createForClass(RoleSnapshot);
@Schema({ _id: false, strict: 'throw' })
class RoleEvent {
  @Prop({ required: true }) action!: string;
  @Prop({ type: M.Types.ObjectId, required: true }) actorId!: Types.ObjectId;
  @Prop({ default: Date.now }) occurredAt!: Date;
  @Prop({ type: SnapshotSchema }) before?: RoleSnapshot;
  @Prop({ type: SnapshotSchema }) after?: RoleSnapshot;
  @Prop({ type: M.Types.ObjectId }) userId?: Types.ObjectId;
}
@Schema({ collection: 'custom_roles_v2', timestamps: true, strict: 'throw', autoIndex: false, autoCreate: false })
export class CustomRole {
  @Prop({ type: M.Types.ObjectId, required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ required: true, minlength: 2, maxlength: 80 }) name!: string;
  @Prop({ required: true, maxlength: 80 }) normalizedName!: string;
  @Prop({ maxlength: 500, default: '' }) description!: string;
  @Prop({ type: [String], enum: ALL_PERMISSIONS, required: true, validate: (p: string[]) => p.length <= ALL_PERMISSIONS.length && new Set(p).size === p.length }) permissions!: string[];
  @Prop({ default: true }) active!: boolean;
  @Prop({ default: false }) archived!: boolean;
  @Prop({ default: 0, min: 0, validate: Number.isSafeInteger }) version!: number;
  @Prop({ type: [SchemaFactory.createForClass(RoleEvent)], default: [], select: false }) history!: RoleEvent[];
}
export const CustomRoleSchema = SchemaFactory.createForClass(CustomRole);
CustomRoleSchema.index({ tenantId: 1, normalizedName: 1 }, { unique: true });
CustomRoleSchema.index({ tenantId: 1, active: 1, archived: 1, _id: 1 });
