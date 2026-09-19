import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PageQueryDto } from '../common/query.dto.js';
export class CrmQuery extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @IsOptional() @IsIn(['OPEN', 'WON', 'LOST']) status?: string;
  @IsOptional() @IsMongoId() assignedId?: string;
  @IsOptional() @IsMongoId() pipelineId?: string;
}
export class StageDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{1,29}$/) code!: string;
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsInt() @Min(0) @Max(100) probability!: number;
}
export class PipelineDto {
  @IsUUID('4') requestId!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => StageDto) stages!: StageDto[];
}
export class OpportunityDto {
  @IsUUID('4') requestId!: string;
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsMongoId() partyId!: string;
  @IsMongoId() pipelineId!: string;
  @IsMongoId() assignedId!: string;
  @IsInt() @Min(0) @Max(1_000_000_000_000) amountCents!: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) expectedDate!: string;
  @IsString() @MaxLength(100) source!: string;
  @IsString() @MaxLength(2000) notes!: string;
}
export class VersionReasonDto {
  @IsInt() @Min(0) version!: number;
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}
export class MoveDto extends VersionReasonDto { @IsString() @MaxLength(30) stage!: string; }
export class ResultDto extends VersionReasonDto { @IsIn(['WON', 'LOST']) status!: string; }
export class ActivityDto {
  @IsUUID('4') requestId!: string;
  @IsIn(['CALL', 'MEETING', 'EMAIL', 'TASK', 'NOTE']) kind!: string;
  @IsString() @MinLength(3) @MaxLength(1000) description!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate!: string;
}
export class ProposalLineDto {
  @IsOptional() @IsMongoId() productId?: string;
  @IsString() @MinLength(2) @MaxLength(200) description!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
  @IsInt() @Min(0) @Max(1_000_000_000_000) unitCents!: number;
}
export class ProposalDto {
  @IsUUID('4') requestId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) validUntil!: string;
  @IsString() @MinLength(5) @MaxLength(4000) conditions!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ProposalLineDto) lines!: ProposalLineDto[];
  @IsInt() @Min(0) @Max(1_000_000_000_000) discountCents!: number;
}
