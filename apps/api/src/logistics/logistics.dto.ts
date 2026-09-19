import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsISO8601, IsMongoId, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PageQueryDto } from '../common/query.dto.js';
export class LogisticsQuery extends PageQueryDto {@IsOptional() @IsString() @MaxLength(160) search?:string;@IsOptional() @IsMongoId() orderId?:string;@IsOptional() @IsIn(['PENDING','CHECKED','DISPATCHED','IN_TRANSIT','DELIVERED','FAILED','RETURN_RECEIVED','CANCELED']) status?:string;}
export class DeliveryLineDto {@IsString() @MinLength(1) @MaxLength(40) code!:string;@IsOptional() @IsMongoId() productId?:string;@IsString() @MinLength(2) @MaxLength(160) description!:string;@IsInt() @Min(1) @Max(1000000) quantity!:number;}
export class DeliveryOrderDto {
 @IsUUID('4') requestId!:string;
 @IsString() @MinLength(3) @MaxLength(100) reference!:string;
 @IsOptional() @IsMongoId() partyId?:string;
 @IsString() @MinLength(2) @MaxLength(160) recipient!:string;
 @Matches(/^\d{10,15}$/) phone!:string;
 @IsString() @MinLength(10) @MaxLength(500) address!:string;
 @IsISO8601() windowStart!:string;
 @IsISO8601() windowEnd!:string;
 @IsString() @MaxLength(2000) notes!:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>DeliveryLineDto) lines!:DeliveryLineDto[];
}
export class ShipmentLineDto {@IsString() @MinLength(1) @MaxLength(40) code!:string;@IsInt() @Min(1) @Max(1000000) quantity!:number;}
export class ShipmentDto {
 @IsUUID('4') requestId!:string;
 @IsMongoId() orderId!:string;
 @IsMongoId() assignedId!:string;
 @IsString() @MinLength(2) @MaxLength(120) routeName!:string;
 @IsInt() @Min(1) @Max(1000) stopNumber!:number;
 @IsInt() @Min(1) @Max(10000) volumes!:number;
 @IsInt() @Min(0) @Max(1000000000) weightGrams!:number;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>ShipmentLineDto) lines!:ShipmentLineDto[];
}
export class ShipmentStateDto {
 @IsInt() @Min(0) version!:number;
 @IsString() @MinLength(5) @MaxLength(2000) reason!:string;
 @IsIn(['CHECKED','DISPATCHED','IN_TRANSIT','DELIVERED','FAILED','RETURN_RECEIVED','CANCELED']) status!:string;
 @IsOptional() @IsString() @MinLength(2) @MaxLength(160) receivedBy?:string;
}
export class ShipmentAssignDto {
 @IsInt() @Min(0) version!:number;
 @IsString() @MinLength(5) @MaxLength(2000) reason!:string;
 @IsMongoId() assignedId!:string;
 @IsString() @MinLength(2) @MaxLength(120) routeName!:string;
 @IsInt() @Min(1) @Max(1000) stopNumber!:number;
}
