import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PageQueryDto } from '../common/query.dto.js';
export class PurchaseQuery extends PageQueryDto {@IsOptional() @IsString() @MaxLength(160) search?:string;@IsOptional() @IsIn(['DRAFT','APPROVED','PARTIAL','RECEIVED','CLOSED','CANCELED']) status?:string;@IsOptional() @IsMongoId() orderId?:string;}
export class PurchaseLineDto {@IsMongoId() productId!:string;@IsInt() @Min(1) @Max(1000000) quantity!:number;@IsInt() @Min(0) @Max(1e12) unitCents!:number;}
export class PurchaseDto {
 @IsUUID('4') requestId!:string;
 @IsMongoId() supplierId!:string;
 @IsString() @MinLength(3) @MaxLength(100) reference!:string;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) expectedOn!:string;
 @IsString() @MaxLength(4000) notes!:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>PurchaseLineDto) lines!:PurchaseLineDto[];
}
export class PurchaseStateDto {@IsInt() @Min(0) version!:number;@IsString() @MinLength(5) @MaxLength(1000) reason!:string;@IsIn(['APPROVED','CLOSED','CANCELED']) status!:string;}
export class ReceiptLineDto {@IsMongoId() productId!:string;@IsInt() @Min(1) @Max(1000000) quantity!:number;}
export class PurchaseReceiptDto {
 @IsUUID('4') requestId!:string;
 @IsString() @MinLength(3) @MaxLength(100) reference!:string;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) receivedOn!:string;
 @IsString() @MinLength(5) @MaxLength(2000) assessment!:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>ReceiptLineDto) lines!:ReceiptLineDto[];
 @IsOptional() @IsMongoId() accountId?:string;
 @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate?:string;
}
