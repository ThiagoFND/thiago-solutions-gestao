import { Schema as MongooseSchema } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrderStatus, OrderType, PaymentMethod, ProductOrigin, SalesGroup, SupplyMode } from '../common/enums.js';

@Schema({ strict: 'throw', _id: false })
export class OrderItem {
  @Prop({ maxlength: 80 }) category?: string;
  @Prop({ type: String, enum: SupplyMode }) supplyMode?: SupplyMode;
  @Prop({type:String,enum:ProductOrigin}) origin?:ProductOrigin;
  @Prop({type:String,enum:SalesGroup}) salesGroup?:SalesGroup;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true }) productId!: Types.ObjectId;
  @Prop({ required: true, maxlength: 120 }) name!: string;
  @Prop({ required: true, min: 1, max: 1_000_000, validate: Number.isSafeInteger }) quantity!: number;
  @Prop({ required: true, min: 0, max: 1_000_000_000_000, validate: Number.isSafeInteger }) unitPriceCents!: number;
  @Prop({ required: true }) stockControlled!: boolean;
}
export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ strict: 'throw', _id: false })
export class Payment {
  @Prop({ type: String, required: true, enum: PaymentMethod }) method!: PaymentMethod;
  @Prop({ required: true, min: 1, max: 1_000_000_000_000, validate: Number.isSafeInteger }) amountCents!: number;
  @Prop({ min: 0, max: 1_000_000_000_000, validate: Number.isSafeInteger }) receivedCents?: number;
  @Prop({ min: 0, max: 1_000_000_000_000, validate: Number.isSafeInteger }) changeCents?: number;
}
export const PaymentSchema = SchemaFactory.createForClass(Payment);

@Schema({ collection: 'orders_v2', autoIndex: false, autoCreate: false, strict: 'throw', timestamps: true, optimisticConcurrency: true })
export class Order {
  @Prop({ type: String, enum: ['AT_FINALIZATION'], immutable: true }) stockPolicy?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, immutable: true }) tenantId!: Types.ObjectId;
  @Prop({ type: Boolean, default: false, select: false }) mutationLocked!: boolean;
  @Prop({ required: true,  }) number!: number;
  @Prop({ type: String, required: true, enum: OrderType }) type!: OrderType;
  @Prop({ trim: true, maxlength: 80 }) identifier?: string;
  @Prop({ trim: true, maxlength: 300 }) notes?: string;
  @Prop({ type: [OrderItemSchema], default: [], validate: { validator: (items: unknown[]) => items.length <= 100, message: 'Maximum 100 items.' } }) items!: OrderItem[];
  @Prop({ required: true, default: 0, min: 0, max: 1_000_000_000_000, validate: Number.isSafeInteger }) totalCents!: number;
  @Prop({ type: String, required: true, enum: OrderStatus, default: OrderStatus.OPEN }) status!: OrderStatus;
  @Prop({ type: [PaymentSchema], default: [], validate: { validator: (payments: unknown[]) => payments.length <= 10, message: 'Maximum 10 payments.' } }) payments!: Payment[];
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) openedById!: Types.ObjectId;
  @Prop({ required: true, maxlength: 120 }) openedByName!: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) finalizedById?: Types.ObjectId;
  @Prop() finalizedByName?: string;
  @Prop() finalizedAt?: Date;
  @Prop() canceledAt?: Date;
  @Prop({ maxlength: 500 }) cancelReason?: string;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ tenantId: 1, openedById: 1, status: 1, createdAt: -1, _id: -1 });
OrderSchema.index({ tenantId: 1, createdAt: -1, _id: -1 });

OrderSchema.set('toJSON', { transform: (_doc, ret: any) => { delete ret.mutationLocked; delete ret.__v; return ret; } });

OrderSchema.index({ tenantId: 1, number: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
