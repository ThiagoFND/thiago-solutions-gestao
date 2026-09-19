import { Equals, IsBoolean, IsInt, IsMongoId, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PageQueryDto } from '../common/query.dto.js';
export class LoyaltyQuery extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @IsOptional() @IsMongoId() programId?: string;
  @IsOptional() @IsMongoId() memberId?: string;
}
export class ProgramDto {
  @IsUUID('4') requestId!: string;
  @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @IsString() @MinLength(10) @MaxLength(4000) terms!: string;
  @IsInt() @Min(1) @Max(100000000) spendCentsPerPoint!: number;
  @IsInt() @Min(1) @Max(3650) validityDays!: number;
  @IsInt() @Min(1) @Max(100000000) maxPointsPerOperation!: number;
}
export class LoyaltyChange {
  @IsInt() @Min(0) version!: number;
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}
export class ProgramStateDto extends LoyaltyChange { @IsBoolean() active!: boolean; }
export class MemberDto {
  @IsUUID('4') requestId!: string;
  @IsMongoId() programId!: string;
  @IsMongoId() partyId!: string;
  @Equals(true) acceptedTerms!: boolean;
  @IsBoolean() marketingConsent!: boolean;
}
export class LoyaltyOperationDto {
  @IsUUID('4') requestId!: string;
  @IsString() @MinLength(3) @MaxLength(100) externalReference!: string;
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}
export class EarnDto extends LoyaltyOperationDto {
  @IsInt() @Min(1) @Max(1e12) eligibleCents!: number;
  @Equals(true) paymentConfirmed!: boolean;
}
export class RedeemDto extends LoyaltyOperationDto {
  @IsInt() @Min(1) @Max(100000000) points!: number;
  @IsString() @MinLength(3) @MaxLength(160) benefit!: string;
}
export class ReverseDto extends LoyaltyOperationDto { @IsInt() @Min(1) @Max(100000000) points!: number; }
