import { IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PageQueryDto } from '../common/query.dto.js';
export class ContractQuery extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @IsOptional() @IsIn(['DRAFT','APPROVED','ACTIVE','SUSPENDED','ENDED','CANCELED']) status?: string;
  @IsOptional() @IsMongoId() contractId?: string;
}
export class ContractDto {
  @IsUUID('4') requestId!: string;
  @IsMongoId() partyId!: string;
  @IsMongoId() accountId!: string;
  @IsString() @MinLength(2) @MaxLength(60) number!: string;
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsString() @MinLength(10) @MaxLength(12000) terms!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) startsOn!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) endsOn!: string;
  @IsInt() @Min(1) @Max(1e12) amountCents!: number;
  @IsIn([1,3,12]) intervalMonths!: number;
  @IsInt() @Min(1) @Max(31) billingDay!: number;
}
export class ContractChange {
  @IsInt() @Min(0) version!: number;
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}
export class ContractStatusDto extends ContractChange {
  @IsIn(['APPROVED','ACTIVE','SUSPENDED','ENDED','CANCELED']) status!: string;
}
export class ContractAmendmentDto extends ContractChange {
  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) effectiveMonth!: string;
  @IsString() @MinLength(10) @MaxLength(12000) terms!: string;
  @IsInt() @Min(1) @Max(1e12) amountCents!: number;
}
export class GenerateCycleDto {
  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) competence!: string;
}
export class ContractSettlementDto extends ContractChange {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) settledDate!: string;
}
export class ContractAccountDto {
  @IsUUID('4') requestId!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsIn(['BANK','CASH','WALLET']) kind!: string;
}
