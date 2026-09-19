import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as M, Types } from 'mongoose';
@Schema({ collection: 'product_categories_v2', timestamps: true, strict: 'throw', autoIndex: false, autoCreate: false })
export class Category {
  @Prop({ type: M.Types.ObjectId, required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 80 }) name!: string;
  @Prop({ required: true, maxlength: 80 }) normalizedName!: string;
  @Prop({ maxlength: 1000, default: '' }) description!: string;
  @Prop({ maxlength: 2048 }) imageUrl?: string;
  @Prop({ maxlength: 40 }) icon?: string;
  @Prop({ enum: ['violet', 'blue', 'green', 'rose', 'slate'], default: 'violet' }) color!: string;
  @Prop({ default: true }) active!: boolean;
  @Prop({ default: false }) published!: boolean;
  @Prop({ default: false }) archived!: boolean;
  @Prop({ default: 0, min: 0, max: 1000000, validate: Number.isSafeInteger }) publicOrder!: number;
  @Prop({ default: 0, min: 0, max: 1000000, validate: Number.isSafeInteger }) internalOrder!: number;
  @Prop({ default: 0, min: 0, validate: Number.isSafeInteger }) version!: number;
  @Prop({ type: M.Types.ObjectId, required: true }) updatedById!: Types.ObjectId;
}
export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index({ tenantId: 1, normalizedName: 1 }, { unique: true });
CategorySchema.index({ tenantId: 1, active: 1, published: 1, publicOrder: 1, _id: 1 });
CategorySchema.index({ tenantId: 1, internalOrder: 1, _id: 1 });
