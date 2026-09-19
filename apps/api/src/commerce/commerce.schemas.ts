import { Schema, Types } from 'mongoose';
import { MODULE_CODES, SUBSCRIPTION_STATUSES, type Offer, type Promotion, type Quote, type SubscriptionStatus } from './commerce.domain.js';
const options = { timestamps: true, strict: 'throw' as const, autoIndex: false, autoCreate: false };
const money = { type: Number, min: 0, max: 1_000_000_000_000, validate: Number.isSafeInteger, required: true };
const oid = { type: Schema.Types.ObjectId, required: true };
export interface CommercialOffer extends Offer { actorId: Types.ObjectId; reason: string }
export const CommercialOfferSchema = new Schema<CommercialOffer>({
  testOnly: { type: Boolean, required: false },
  code: { type: String, required: true, maxlength: 60, immutable: true }, kind: { type: String, enum: ['BASE', 'MODULE', 'PLAN'], required: true, immutable: true },
  name: { type: String, required: true, maxlength: 100 }, description: { type: String, maxlength: 2000 }, version: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  monthlyCents: money, annualCents: { ...money, required: false }, currency: { type: String, enum: ['BRL'], required: true },
  modules: [{ type: String, enum: MODULE_CODES }], active: { type: Boolean, required: true }, available: { type: Boolean, required: true }, order: { type: Number, min: 0, required: true }, featured: Boolean,
  limits: { activeUsers: money, products: money, categories: money, storageBytes: money, landingPages: money }, actorId: oid, reason: { type: String, required: true, maxlength: 500 },
}, { ...options, collection: 'commercial_offer_versions_v2' });
CommercialOfferSchema.index({ code: 1, version: 1 }, { unique: true });
CommercialOfferSchema.index({ kind: 1, code: 1, version: -1 });

export interface CommercialDiscount extends Promotion { version: number; actorId: Types.ObjectId; reason: string }
export const CommercialDiscountSchema = new Schema<CommercialDiscount>({
  code: { type: String, required: true, maxlength: 60 }, name: { type: String, required: true, maxlength: 100 }, kind: { type: String, enum: ['PERCENT', 'FIXED', 'FREE'], required: true }, value: money,
  scope: { type: String, enum: ['SUBTOTAL', 'MODULE'], required: true }, modules: [{ type: String, enum: MODULE_CODES }], plans: [{ type: String, maxlength: 60 }],
  startsAt: { type: String, required: true }, endsAt: String, maxCycles: { type: Number, min: 1, max: 1200 }, cycle: { type: String, enum: ['MONTHLY', 'ANNUAL'] },
  combinable: { type: Boolean, required: true }, active: { type: Boolean, required: true }, tenantId: { type: String, match: /^[a-f0-9]{24}$/ }, version: { type: Number, min: 1, required: true }, actorId: oid, reason: { type: String, required: true, maxlength: 500 },
}, { ...options, collection: 'commercial_discount_versions_v2' });
CommercialDiscountSchema.index({ code: 1, version: 1 }, { unique: true });

export interface CommercialSubscription {
  quotaVersion?: number;
  tenantId: Types.ObjectId; version: number; status: SubscriptionStatus; startsAt: Date; endsAt: Date; nextDueAt: Date; graceUntil?: Date;
  snapshot: Quote; promotions: Promotion[]; installment: number; actorId: Types.ObjectId;
  scheduled?: { effectiveAt: Date; startsAt: Date; endsAt: Date; nextDueAt: Date; status: SubscriptionStatus; graceUntil?: Date; snapshot: Quote; promotions: Promotion[]; reason: string };
}
export const CommercialSubscriptionSchema: Schema<CommercialSubscription> = new Schema<CommercialSubscription>({
  quotaVersion: { type: Number, default: 0, min: 0 },
  tenantId: { ...oid, immutable: true }, version: { type: Number, min: 0, required: true }, status: { type: String, enum: SUBSCRIPTION_STATUSES, required: true },
  startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true }, nextDueAt: { type: Date, required: true }, graceUntil: Date,
  // Only validated server-calculated snapshots enter these paths; never bind a request body here.
  snapshot: { type: Schema.Types.Mixed, required: true }, promotions: { type: Schema.Types.Mixed, default: [] }, installment: { type: Number, min: 1, required: true }, actorId: oid,
  scheduled: { type: new Schema({ effectiveAt: { type: Date, required: true }, startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true }, nextDueAt: { type: Date, required: true }, status: { type: String, enum: SUBSCRIPTION_STATUSES, required: true }, graceUntil: Date, snapshot: { type: Schema.Types.Mixed, required: true }, promotions: [Schema.Types.Mixed], reason: { type: String, required: true, maxlength: 500 } }, { _id: false, strict: 'throw' }) },
}, { ...options, collection: 'commercial_subscriptions_v2' });
CommercialSubscriptionSchema.index({ tenantId: 1 }, { unique: true });
CommercialSubscriptionSchema.index({ status: 1, nextDueAt: 1 });
export function effectiveCommercialState<T extends CommercialSubscription>(subscription: T, now: Date): T {
  const schedule = subscription.scheduled;
  return schedule && schedule.effectiveAt.getTime() <= now.getTime() ? { ...subscription, snapshot: schedule.snapshot, promotions: schedule.promotions, startsAt: schedule.startsAt, endsAt: schedule.endsAt, nextDueAt: schedule.nextDueAt, status: schedule.status, graceUntil: schedule.graceUntil, installment: 1 } : subscription;
}

export const INVOICE_STATUSES = ['DRAFT', 'OPEN', 'PAID', 'OVERDUE', 'CANCELED', 'WAIVED'] as const;
export interface CommercialInvoice {
  tenantId: Types.ObjectId; subscriptionId: Types.ObjectId; competence: string; snapshot: Quote; dueAt: Date;
  status: typeof INVOICE_STATUSES[number]; version: number; paidAt?: Date; method?: string; reference?: string; note: string; actorId: Types.ObjectId;
}
export const CommercialInvoiceSchema = new Schema<CommercialInvoice>({
  tenantId: { ...oid, immutable: true }, subscriptionId: { ...oid, immutable: true }, competence: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  snapshot: { type: Schema.Types.Mixed, required: true }, dueAt: { type: Date, required: true }, status: { type: String, enum: INVOICE_STATUSES, required: true }, version: { type: Number, min: 0, required: true },
  paidAt: Date, method: { type: String, maxlength: 80 }, reference: { type: String, maxlength: 100 }, note: { type: String, maxlength: 500 }, actorId: oid,
}, { ...options, collection: 'commercial_invoices_v2' });
CommercialInvoiceSchema.index({ subscriptionId: 1, competence: 1 }, { unique: true });
CommercialInvoiceSchema.index({ tenantId: 1, status: 1, dueAt: 1 });

export interface CommercialEvent { tenantId?: Types.ObjectId; actorId: Types.ObjectId; action: string; resourceId: string; reason: string; before?: unknown; after?: unknown; createdAt?: Date }
export const CommercialEventSchema = new Schema<CommercialEvent>({ tenantId: Schema.Types.ObjectId, actorId: oid, action: { type: String, required: true, maxlength: 80 }, resourceId: { type: String, required: true, maxlength: 100 }, reason: { type: String, required: true, maxlength: 500 }, before: Schema.Types.Mixed, after: Schema.Types.Mixed }, { ...options, collection: 'commercial_events_v2' });
CommercialEventSchema.index({ tenantId: 1, createdAt: -1, _id: -1 });
export interface CommercialRequest { tenantId: Types.ObjectId; actorId: Types.ObjectId; kind: 'CHANGE' | 'CANCEL'; snapshot?: Quote; note: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; version: number }
export const CommercialRequestSchema = new Schema<CommercialRequest>({ tenantId: { ...oid, immutable: true }, actorId: oid, kind: { type: String, enum: ['CHANGE', 'CANCEL'], required: true }, snapshot: Schema.Types.Mixed, note: { type: String, required: true, maxlength: 500 }, status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], required: true }, version: { type: Number, required: true, min: 0 } }, { ...options, collection: 'commercial_requests_v2' });
CommercialRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
export const COMMERCIAL_MODELS: { name: string; schema: Schema }[] = [
  { name: 'CommercialOffer', schema: CommercialOfferSchema }, { name: 'CommercialDiscount', schema: CommercialDiscountSchema },
  { name: 'CommercialSubscription', schema: CommercialSubscriptionSchema }, { name: 'CommercialInvoice', schema: CommercialInvoiceSchema },
  { name: 'CommercialEvent', schema: CommercialEventSchema }, { name: 'CommercialRequest', schema: CommercialRequestSchema },
];

export interface CommercialCoupon { code: string; discountCode: string; startsAt: Date; endsAt: Date; maxUses: number; perTenant: number; uses: number; active: boolean; version: number; actorId: Types.ObjectId; reason: string }
export const CommercialCouponSchema = new Schema<CommercialCoupon>({ code: { type: String, required: true, maxlength: 60, immutable: true }, discountCode: { type: String, required: true, maxlength: 60 }, startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true }, maxUses: { type: Number, required: true, min: 1, validate: Number.isSafeInteger }, perTenant: { type: Number, required: true, min: 1, validate: Number.isSafeInteger }, uses: { type: Number, default: 0, min: 0 }, active: { type: Boolean, required: true }, version: { type: Number, required: true, min: 0 }, actorId: oid, reason: { type: String, required: true, maxlength: 500 } }, { ...options, collection: 'commercial_coupons_v2' });
CommercialCouponSchema.index({ code: 1 }, { unique: true });
CommercialCouponSchema.index({ active: 1, endsAt: 1 });
export interface CouponRedemption { tenantId: Types.ObjectId; couponId: Types.ObjectId; subscriptionVersion: number; actorId: Types.ObjectId }
export const CouponRedemptionSchema = new Schema<CouponRedemption>({ tenantId: oid, couponId: oid, subscriptionVersion: { type: Number, required: true }, actorId: oid }, { ...options, collection: 'commercial_coupon_redemptions_v2' });
CouponRedemptionSchema.index({ couponId: 1, tenantId: 1, subscriptionVersion: 1 }, { unique: true });
COMMERCIAL_MODELS.push({ name: 'CommercialCoupon', schema: CommercialCouponSchema }, { name: 'CouponRedemption', schema: CouponRedemptionSchema });
