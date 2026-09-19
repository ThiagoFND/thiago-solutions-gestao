import { Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'counters_v2', autoIndex: false, autoCreate: false, strict: 'throw' })
export class Counter {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ required: true }) key!: string;
  @Prop({ required: true, default: 0, min: 0, validate: Number.isSafeInteger }) value!: number;
}
export type CounterDocument = HydratedDocument<Counter>;
export const CounterSchema = SchemaFactory.createForClass(Counter);

CounterSchema.index({ tenantId: 1, key: 1 }, { unique: true });
