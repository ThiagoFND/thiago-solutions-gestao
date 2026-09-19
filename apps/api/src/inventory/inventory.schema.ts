import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as M, Types } from 'mongoose';
const ref = { type: M.Types.ObjectId, required: true };
const integer = { type: Number, min: 0, max: 1e12, validate: Number.isSafeInteger };
const options = { autoCreate: false, autoIndex: false, strict: 'throw' as const, timestamps: true, versionKey: false as const };
@Schema({ ...options, collection: 'ingredients_v2' })
export class Ingredient {
  @Prop({ ...ref, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 }) name!: string;
  @Prop({ required: true, maxlength: 120 }) normalizedName!: string;
  @Prop({ required: true, enum: ['KG', 'G', 'L', 'ML', 'UNIDADE', 'CAIXA', 'PACOTE'], immutable: true }) unit!: string;
  @Prop({ ...integer, default: 0 }) stockMicros!: number;
  @Prop({ ...integer, default: 0 }) stockValueCents!: number;
  @Prop({ ...integer, default: 0 }) minimumMicros!: number;
  @Prop({ ...integer, default: 0 }) version!: number;
}
export const IngredientSchema = SchemaFactory.createForClass(Ingredient);
IngredientSchema.index({ tenantId: 1, normalizedName: 1 }, { unique: true });
@Schema({ _id: false, strict: 'throw' })
export class RecipeComponent {
  @Prop(ref) ingredientId!: Types.ObjectId;
  @Prop({ ...integer, required: true, min: 1 }) quantityMicros!: number;
}
const RecipeComponentSchema = SchemaFactory.createForClass(RecipeComponent);
@Schema({ ...options, collection: 'recipes_v2' })
export class Recipe {
  @Prop({ ...ref, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ ...ref, immutable: true }) productId!: Types.ObjectId;
  @Prop({ ...integer, required: true, min: 1, max: 1e6 }) yieldQuantity!: number;
  @Prop({ type: [RecipeComponentSchema], required: true, validate: (v: unknown[]) => v.length > 0 && v.length <= 50 }) components!: RecipeComponent[];
  @Prop({ ...integer, default: 0 }) version!: number;
  @Prop({ ...integer, default: 0 }) usageRevision!: number;
}
export const RecipeSchema = SchemaFactory.createForClass(Recipe);
RecipeSchema.index({ tenantId: 1, productId: 1 }, { unique: true });
@Schema({ ...options, collection: 'ingredient_receipts_v2' })
export class IngredientReceipt {
  @Prop({ ...ref, immutable: true }) tenantId!: Types.ObjectId;
  @Prop(ref) ingredientId!: Types.ObjectId;
  @Prop(ref) financialEntryId!: Types.ObjectId;
  @Prop({ ...integer, required: true, min: 1 }) quantityMicros!: number;
  @Prop({ ...integer, required: true, min: 1 }) costCents!: number;
  @Prop({ required: true }) unit!: string;
  @Prop({ required: true }) purchaseDate!: string;
  @Prop({ required: true, maxlength: 200 }) description!: string;
  @Prop({ ...integer, required: true }) financialVersion!: number;
  @Prop(ref) createdById!: Types.ObjectId;
}
export const IngredientReceiptSchema = SchemaFactory.createForClass(IngredientReceipt);
IngredientReceiptSchema.index({ tenantId: 1, financialEntryId: 1 }, { unique: true });
@Schema({ ...options, collection: 'ingredient_movements_v2' })
export class IngredientMovement {
  @Prop({ ...ref, immutable: true }) tenantId!: Types.ObjectId;
  @Prop(ref) ingredientId!: Types.ObjectId;
  @Prop(ref) referenceId!: Types.ObjectId;
  @Prop({ required: true, enum: ['RECEIPT', 'PRODUCTION', 'MANUAL'] }) type!: string;
  @Prop({ ...integer, min: -1e12, required: true }) quantityChangeMicros!: number;
  @Prop({ ...integer, min: -1e12, required: true }) valueChangeCents!: number;
  @Prop(ref) createdById!: Types.ObjectId;
}
export const IngredientMovementSchema = SchemaFactory.createForClass(IngredientMovement);
IngredientMovementSchema.index({ tenantId: 1, ingredientId: 1, createdAt: -1 });
