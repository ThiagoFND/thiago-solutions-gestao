import { Transform, Type } from 'class-transformer';
import { Equals, IsBoolean, IsEnum, IsInt, IsMongoId, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { EntryKind, FinancialFrequency, FinancialNature, FinancialOrigin, FinancialPaymentMethod, FinancialStatus, FinancialType, FinancialUnit } from './finance.enums.js';
const present = (_: unknown, value: unknown) => value !== undefined;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const bool = ({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value;
export class ProductionDto {
  @IsOptional() @IsMongoId() productId?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) inputName?: string | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 6, allowInfinity: false, allowNaN: false }) @Min(0.000001) @Max(1000000) quantity?: number | null;
  @IsOptional() @IsEnum(FinancialUnit) unit?: FinancialUnit | null;
  @IsOptional() @IsInt() @Min(1) @Max(1e12) unitAmountCents?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(1e12) totalAmountCents?: number | null;
}
export class TemplateDto {
  @Transform(trim) @IsString() @Length(3, 200) description!: string;
  @IsMongoId() categoryId!: string;
  @IsEnum(FinancialType) type!: FinancialType;
  @IsEnum(FinancialNature) nature!: FinancialNature;
  @IsInt() @Min(1) @Max(1e12) expectedAmountCents!: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) supplier?: string | null;
  @IsOptional() @ValidateNested() @Type(() => ProductionDto) production?: ProductionDto | null;
}
export class InitialPaymentDto {
  @IsInt() @Min(1) @Max(1e12) paidAmountCents!: number;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) paidOn!: string;
  @IsEnum(FinancialOrigin) origin!: FinancialOrigin;
  @IsEnum(FinancialPaymentMethod) method!: FinancialPaymentMethod;
}
export class CreateEntryDto extends TemplateDto {
  @ValidateIf(present) @IsEnum(EntryKind) entryKind?: EntryKind;
  @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) purchaseDate?: string;
  @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) competenceDate?: string;
  @ValidateIf(present) @IsNumber({maxDecimalPlaces:6}) @Min(0.000001) @Max(1000000) quantity?: number;
  @ValidateIf(present) @IsEnum(FinancialUnit) unit?: FinancialUnit;
  @ValidateIf(present) @ValidateNested() @Type(()=>InitialPaymentDto) initialPayment?: InitialPaymentDto;

  @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?: string;
  @IsString() @Matches(/^\d{4}-\d{2}$/) competence!: string;
}
export class VersionDto { @ValidateIf(present) @IsInt() @Min(0) @Max(Number.MAX_SAFE_INTEGER) version?: number; }
export class UpdateTemplateDto extends VersionDto {
  @ValidateIf(present) @Transform(trim) @IsString() @Length(3, 200) description?: string;
  @ValidateIf(present) @IsMongoId() categoryId?: string;
  @ValidateIf(present) @IsEnum(FinancialType) type?: FinancialType;
  @ValidateIf(present) @IsEnum(FinancialNature) nature?: FinancialNature;
  @ValidateIf(present) @IsInt() @Min(1) @Max(1e12) expectedAmountCents?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(160) supplier?: string | null;
  @IsOptional() @ValidateNested() @Type(() => ProductionDto) production?: ProductionDto | null;
}
export class UpdateEntryDto extends UpdateTemplateDto {
  @ValidateIf(present) @IsEnum(EntryKind) entryKind?: EntryKind;
  @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) purchaseDate?: string;
  @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) competenceDate?: string;
  @ValidateIf(present) @IsNumber({maxDecimalPlaces:6}) @Min(0.000001) @Max(1000000) quantity?: number;
  @ValidateIf(present) @IsEnum(FinancialUnit) unit?: FinancialUnit;

  @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?: string;
  @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}$/) competence?: string;
}
export class PaymentDto extends VersionDto {
  @IsInt() @Min(1) @Max(1e12) paidAmountCents!: number;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) paidOn!: string;
  @IsEnum(FinancialOrigin) origin!: FinancialOrigin;
  @IsEnum(FinancialPaymentMethod) method!: FinancialPaymentMethod;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) notes?: string | null;
}
export class CorrectPaymentDto extends PaymentDto {
  @Equals(true, { message: 'Confirme explicitamente a correção do pagamento.' }) confirmed!: boolean;
  @Transform(trim) @IsString() @Length(3, 500) reason!: string;
}
export class CancelDto extends VersionDto { @Transform(trim) @IsString() @Length(3, 500) reason!: string; }
export class CategoryDto { @Transform(trim) @IsString() @Length(2, 100) name!: string; @IsEnum(FinancialType) type!: FinancialType; }
export class UpdateCategoryDto {
  @ValidateIf(present) @Transform(trim) @IsString() @Length(2, 100) name?: string;
  @ValidateIf(present) @IsEnum(FinancialType) type?: FinancialType;
  @ValidateIf(present) @IsBoolean() active?: boolean;
}
export class CreateRecurrenceDto extends TemplateDto {
  @IsEnum(FinancialFrequency) frequency!: FinancialFrequency;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string;
  @ValidateIf(present) @IsInt() @Min(1) @Max(31) billingDay?: number;
  @ValidateIf(present) @IsInt() @Min(1) @Max(600) installments?: number;
}
export class UpdateRecurrenceDto extends UpdateTemplateDto { @ValidateIf(present) @IsBoolean() active?: boolean; }
export class GenerateDto { @IsString() @Matches(/^\d{4}-\d{2}$/) competence!: string; }
export class PageDto {
  @ValidateIf(present) @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
  @ValidateIf(present) @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
export class CatalogQueryDto extends PageDto {
  @ValidateIf(present) @Transform(bool) @IsBoolean() active?: boolean;
  @ValidateIf(present) @IsEnum(FinancialType) type?: FinancialType;
}
export class EntriesQueryDto extends PageDto {
  @ValidateIf(present) @IsEnum(EntryKind) entryKind?: EntryKind;
  @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}$/) competence?: string;
  @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateFrom?: string;
  @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateTo?: string;
  @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?: string;
  @ValidateIf(present) @IsEnum(FinancialStatus) status?: FinancialStatus;
  @ValidateIf(present) @IsMongoId() categoryId?: string;
  @ValidateIf(present) @IsEnum(FinancialType) type?: FinancialType;
  @ValidateIf(present) @IsEnum(FinancialNature) nature?: FinancialNature;
  @ValidateIf(present) @IsEnum(FinancialOrigin) origin?: FinancialOrigin;
  @ValidateIf(present) @IsEnum(FinancialPaymentMethod) method?: FinancialPaymentMethod;
  @ValidateIf(present) @IsString() @MaxLength(200) description?: string;
}
export class MonthDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
}
