import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsMongoId, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PageQueryDto } from '../common/query.dto.js';
export class ServiceQuery extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
  @IsOptional() @IsMongoId() assignedId?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}
export class ServiceDefinitionDto {
  @IsUUID('4') requestId!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MaxLength(2000) description!: string;
  @IsInt() @Min(1) @Max(1440) durationMinutes!: number;
  @IsInt() @Min(0) @Max(120) preparationMinutes!: number;
  @IsInt() @Min(0) @Max(1e12) priceCents!: number;
}
export class ResourceDto {
  @IsUUID('4') requestId!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MaxLength(200) location!: string;
}
export class AppointmentDto {
  @IsUUID('4') requestId!: string;
  @IsMongoId() partyId!: string;
  @IsMongoId() serviceId!: string;
  @IsMongoId() assignedId!: string;
  @IsOptional() @IsMongoId() resourceId?: string;
  @IsISO8601({ strict: true }) startsAt!: string;
  @IsString() @MaxLength(2000) notes!: string;
}
export class ChangeDto {
  @IsInt() @Min(0) version!: number;
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}
export class RescheduleDto extends ChangeDto { @IsISO8601({ strict: true }) startsAt!: string; }
export class AppointmentStatusDto extends ChangeDto { @IsIn(['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'DONE', 'NO_SHOW', 'CANCELED']) status!: string; }
export class MaterialDto {
  @IsOptional() @IsMongoId() productId?: string;
  @IsString() @MinLength(2) @MaxLength(160) description!: string;
  @IsInt() @Min(1) @Max(1e6) quantity!: number;
  @IsInt() @Min(0) @Max(1e12) unitCents!: number;
}
export class OrderDto {
  @IsUUID('4') requestId!: string;
  @IsMongoId() partyId!: string;
  @IsMongoId() serviceId!: string;
  @IsMongoId() assignedId!: string;
  @IsOptional() @IsMongoId() appointmentId?: string;
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsString() @MaxLength(300) equipment!: string;
  @IsString() @MaxLength(300) location!: string;
  @IsString() @MinLength(5) @MaxLength(4000) request!: string;
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']) priority!: string;
  @IsISO8601({ strict: true }) dueAt!: string;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => MaterialDto) materials!: MaterialDto[];
}
export class OrderStatusDto extends ChangeDto { @IsIn(['ANALYSIS', 'WAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'DELIVERED', 'CANCELED']) status!: string; }
export class CheckDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsBoolean() passed!: boolean;
  @IsString() @MinLength(3) @MaxLength(1000) evidence!: string;
}
export class ActualMaterialDto {
  @IsOptional() @IsMongoId() productId?: string;
  @IsString() @MinLength(2) @MaxLength(160) description!: string;
  @IsInt() @Min(1) @Max(1e6) quantity!: number;
  @IsOptional() @IsInt() @Min(0) @Max(1e12) unitCents?: number;
}
export class CompletionDto extends ChangeDto {
  @IsString() @MinLength(10) @MaxLength(4000) report!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => CheckDto) checks!: CheckDto[];
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ActualMaterialDto) materials!: ActualMaterialDto[];
}
