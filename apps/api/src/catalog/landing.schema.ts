import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as M, Types } from 'mongoose';
@Schema({ collection: 'landing_configs_v2', timestamps: true, strict: 'throw', autoIndex: false, autoCreate: false })
export class LandingConfig {
  @Prop({ type: M.Types.ObjectId, required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ required: true, minlength: 3, maxlength: 70, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ }) slug!: string;
  @Prop({ required: true, minlength: 2, maxlength: 160 }) publicName!: string;
  @Prop({ maxlength: 2048, default: '' }) logoUrl!: string;
  @Prop({ maxlength: 2048, default: '' }) coverUrl!: string;
  @Prop({ maxlength: 180, default: '' }) slogan!: string;
  @Prop({ maxlength: 1000, default: '' }) description!: string;
  @Prop({ maxlength: 4000, default: '' }) presentation!: string;
  @Prop({ enum: ['violet', 'blue', 'green', 'rose', 'slate'], default: 'violet' }) theme!: string;
  @Prop({ maxlength: 20, default: '' }) phone!: string;
  @Prop({ maxlength: 15, default: '' }) whatsapp!: string;
  @Prop({ maxlength: 254, default: '' }) publicEmail!: string;
  @Prop({ maxlength: 500, default: '' }) address!: string;
  @Prop({ maxlength: 1000, default: '' }) hours!: string;
  @Prop({ type: [String], default: [] }) socialLinks!: string[];
  @Prop({ type: [String], default: ['featured', 'products', 'about', 'contact'], enum: ['featured', 'products', 'about', 'contact'] }) sections!: string[];
  @Prop({ maxlength: 2000, default: '' }) additionalInfo!: string;
  @Prop({ maxlength: 2048, default: '' }) contactUrl!: string;
  @Prop({ maxlength: 60, default: 'Fale conosco' }) contactLabel!: string;
  @Prop({ maxlength: 240, default: '' }) operatingNotice!: string;
  @Prop({ maxlength: 100, default: '' }) shareTitle!: string;
  @Prop({ maxlength: 240, default: '' }) shareDescription!: string;
  @Prop({ default: false }) hideUnavailable!: boolean;
  @Prop({ default: true }) showDemandLabel!: boolean;
  @Prop({ default: true }) showPrices!: boolean;
  @Prop({ default: false }) published!: boolean;
  @Prop({ default: 0, min: 0, validate: Number.isSafeInteger }) version!: number;
  @Prop({ type: M.Types.ObjectId, required: true }) updatedById!: Types.ObjectId;
}
export const LandingConfigSchema = SchemaFactory.createForClass(LandingConfig);
LandingConfigSchema.index({ tenantId: 1 }, { unique: true });
LandingConfigSchema.index({ slug: 1 }, { unique: true });
LandingConfigSchema.index({ tenantId: 1, published: 1 });
