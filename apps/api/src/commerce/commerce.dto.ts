import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsDefined, IsIn, IsInt, IsISO8601, IsMongoId, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { MODULE_CODES, SUBSCRIPTION_STATUSES, type BillingCycle, type ModuleCode, type SubscriptionStatus } from './commerce.domain.js';
export class ReasonDto { @IsString() @MinLength(5) @MaxLength(500) reason!: string; }
export class LimitsDto {
  @IsInt() @Min(1) @Max(1000000) activeUsers!: number;
  @IsInt() @Min(0) @Max(10000000) products!: number;
  @IsInt() @Min(0) @Max(1000000) categories!: number;
  @IsInt() @Min(0) @Max(1_000_000_000_000) storageBytes!: number;
  @IsInt() @Min(0) @Max(1) landingPages!: number;
}
export class OfferDto extends ReasonDto {
  @IsOptional() @IsBoolean() testOnly?: boolean;
  @Matches(/^[A-Z][A-Z0-9_]{1,59}$/) code!: string;
  @IsIn(['BASE', 'MODULE', 'PLAN']) kind!: 'BASE' | 'MODULE' | 'PLAN';
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsString() @MaxLength(2000) description!: string;
  @IsInt() @Min(0) @Max(1_000_000_000_000) monthlyCents!: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000_000_000) annualCents?: number;
  @IsIn(['BRL']) currency!: 'BRL';
  @IsArray() @ArrayUnique() @ArrayMaxSize(MODULE_CODES.length) @IsIn(MODULE_CODES, { each: true }) modules!: ModuleCode[];
  @IsBoolean() active!: boolean;
  @IsBoolean() available!: boolean;
  @IsBoolean() featured!: boolean;
  @IsInt() @Min(0) @Max(10000) order!: number;
  @IsDefined() @ValidateNested() @Type(() => LimitsDto) limits!: LimitsDto;
  @IsInt() @Min(0) version!: number;
}
export class QuoteDto {
  @IsOptional() @Matches(/^[A-Z][A-Z0-9_]{1,59}$/) planCode?: string;
  @IsArray() @ArrayMaxSize(MODULE_CODES.length) @IsIn(MODULE_CODES, { each: true }) modules!: ModuleCode[];
  @IsIn(['MONTHLY', 'ANNUAL']) cycle!: BillingCycle;
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(10) @Matches(/^[A-Z][A-Z0-9_]{1,59}$/, { each: true }) coupons?: string[];
}
export class AdminQuoteDto extends QuoteDto {
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(10) @Matches(/^[A-Z][A-Z0-9_]{1,59}$/, { each: true }) discounts?: string[];
}
export class AssignDto extends AdminQuoteDto {
  @IsInt() @Min(0) version!: number;
  @IsIn(SUBSCRIPTION_STATUSES) status!: SubscriptionStatus;
  @IsISO8601({ strict: true }) startsAt!: string;
  @IsISO8601({ strict: true }) endsAt!: string;
  @IsISO8601({ strict: true }) nextDueAt!: string;
  @IsOptional() @IsISO8601({ strict: true }) graceUntil?: string;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}
export class StatusDto extends ReasonDto { @IsInt() @Min(0) version!: number; @IsIn(SUBSCRIPTION_STATUSES) status!: SubscriptionStatus; }
export class DiscountDto extends ReasonDto {
  @Matches(/^[A-Z][A-Z0-9_]{1,59}$/) code!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsIn(['PERCENT', 'FIXED', 'FREE']) kind!: 'PERCENT' | 'FIXED' | 'FREE';
  @IsInt() @Min(0) @Max(1_000_000_000_000) value!: number;
  @IsIn(['SUBTOTAL', 'MODULE']) scope!: 'SUBTOTAL' | 'MODULE';
  @IsArray() @ArrayUnique() @ArrayMaxSize(MODULE_CODES.length) @IsIn(MODULE_CODES, { each: true }) modules!: ModuleCode[];
  @IsArray() @ArrayUnique() @ArrayMaxSize(100) @Matches(/^[A-Z][A-Z0-9_]{1,59}$/, { each: true }) plans!: string[];
  @IsISO8601({ strict: true }) startsAt!: string;
  @IsOptional() @IsISO8601({ strict: true }) endsAt?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1200) maxCycles?: number;
  @IsOptional() @IsIn(['MONTHLY', 'ANNUAL']) cycle?: BillingCycle;
  @IsBoolean() combinable!: boolean;
  @IsBoolean() active!: boolean;
  @IsOptional() @IsMongoId() tenantId?: string;
  @IsInt() @Min(0) version!: number;
}
export class InvoiceDto extends ReasonDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) competence!: string;
  @IsISO8601({ strict: true }) dueAt!: string;
}
export class InvoiceActionDto extends ReasonDto {
  @IsInt() @Min(0) version!: number;
  @IsIn(['OPEN', 'PAID', 'CANCELED', 'WAIVED']) status!: 'OPEN' | 'PAID' | 'CANCELED' | 'WAIVED';
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) method?: string;
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
}
export class SubscriptionRequestDto extends QuoteDto {
  @IsIn(['CHANGE', 'CANCEL']) kind!: 'CHANGE' | 'CANCEL';
  @IsString() @MinLength(5) @MaxLength(500) note!: string;
}
export class CouponDto extends ReasonDto {
  @Matches(/^[A-Z][A-Z0-9_]{1,59}$/) code!: string;
  @Matches(/^[A-Z][A-Z0-9_]{1,59}$/) discountCode!: string;
  @IsISO8601({ strict: true }) startsAt!: string;
  @IsISO8601({ strict: true }) endsAt!: string;
  @IsInt() @Min(1) @Max(1000000) maxUses!: number;
  @IsInt() @Min(1) @Max(1000) perTenant!: number;
  @IsBoolean() active!: boolean;
  @IsInt() @Min(0) version!: number;
}
export class RequestDecisionDto extends ReasonDto {
  @IsInt() @Min(0) version!: number;
  @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
}
export class EditInvoiceDto extends InvoiceDto { @IsInt() @Min(0) version!: number; }
