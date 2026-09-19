import { Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AvailabilityMode, ProductOrigin, SalesGroup, SupplyMode } from '../common/enums.js';

@Schema({ collection: 'products_v2', autoIndex: false, autoCreate: false, strict: 'throw', timestamps: true })
export class Product {
  // Optional only for persisted legacy rows; required by the new create DTO.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category' }) categoryId?: Types.ObjectId;
  @Prop({ type: String, enum: SupplyMode }) supplyMode?: SupplyMode;
  @Prop({ maxlength: 240, default: '' }) shortDescription!: string;
  @Prop({ maxlength: 4000, default: '' }) description!: string;
  @Prop({ maxlength: 20, default: 'un' }) unit!: string;
  @Prop({ type: [String], default: [], validate: (v: string[]) => v.length <= 6 && v.every(s => /^(?:https:\/\/[^\s]+|\/api\/public\/images\/[a-f0-9]{24})$/.test(s) && s.length <= 2048) }) additionalImages!: string[];
  @Prop({ default: false }) published!: boolean;
  @Prop({ default: false }) manuallyHidden!: boolean;
  @Prop({ default: false }) featured!: boolean;
  @Prop({ default: 0, min: 0, max: 1000000, validate: Number.isSafeInteger }) publicOrder!: number;
  @Prop({ default: 0, min: 0, max: 1000000, validate: Number.isSafeInteger }) internalOrder!: number;
  @Prop({ default: 0, min: 0, validate: Number.isSafeInteger }) version!: number;
  @Prop({ type: MongooseSchema.Types.ObjectId }) updatedById?: Types.ObjectId;
  @Prop({type:String,enum:ProductOrigin}) origin?: ProductOrigin;
  @Prop({type:String,enum:SalesGroup}) salesGroup?: SalesGroup;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 }) name!: string;
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 80 }) category!: string;
  @Prop({ required: true, min: 0, max: 1_000_000_000_000, validate: Number.isSafeInteger }) priceCents!: number;
  // Saldo operacional: produção menos itens reservados/vendidos.
  // Produtos sob demanda podem ficar negativos sem bloquear a venda.
  @Prop({ default: 0, min: -1_000_000_000, max: 1_000_000_000, validate: Number.isSafeInteger }) availableStock!: number;
  @Prop({ default: 10, min: 0, max: 1_000_000, validate: Number.isSafeInteger }) minimumStock!: number;
  @Prop({ type: String, required: true, enum: AvailabilityMode, default: AvailabilityMode.PRODUCTION_CONTROLLED })
  availabilityMode!: AvailabilityMode;
  @Prop({ default: true }) active!: boolean;
  @Prop({ maxlength: 2048, match: /^(?:https?:\/\/|\/(?!\/))/ }) imageUrl?: string;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ tenantId: 1, active: 1, category: 1, _id: 1 });
ProductSchema.index({ tenantId: 1, categoryId: 1, internalOrder: 1, _id: 1 });
ProductSchema.index({ tenantId: 1, active: 1, published: 1, publicOrder: 1, _id: 1 });
