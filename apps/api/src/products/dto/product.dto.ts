import { TextField } from '../../common/business-validation.js';
import { ArrayMaxSize, IsArray, IsMongoId, Max, MaxLength, Matches, ValidateIf, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { AvailabilityMode, ProductOrigin, SalesGroup, SupplyMode } from '../../common/enums.js';

export class CreateProductDto {
  @IsMongoId() categoryId!: string;
  @IsEnum(SupplyMode) supplyMode!: SupplyMode;
  @ValidateIf((_,v)=>v!==undefined) @TextField(0,240) shortDescription?: string;
  @ValidateIf((_,v)=>v!==undefined) @TextField(0,4000) description?: string;
  @ValidateIf((_,v)=>v!==undefined) @TextField(1,20) unit?: string;
  @ValidateIf((_,v)=>v!==undefined) @IsArray() @ArrayMaxSize(6) @IsString({each:true}) @MaxLength(2048,{each:true}) @Matches(/^(?:https:\/\/[^\s]+|\/api\/public\/images\/[a-f0-9]{24})$/, {each:true}) additionalImages?: string[];
  @ValidateIf((_,v)=>v!==undefined) @IsBoolean() published?: boolean;
  @ValidateIf((_,v)=>v!==undefined) @IsBoolean() manuallyHidden?: boolean;
  @ValidateIf((_,v)=>v!==undefined) @IsBoolean() featured?: boolean;
  @ValidateIf((_,v)=>v!==undefined) @IsInt() @Min(0) @Max(1000000) publicOrder?: number;
  @ValidateIf((_,v)=>v!==undefined) @IsInt() @Min(0) @Max(1000000) internalOrder?: number;
  @ValidateIf((_,v)=>v!==undefined) @IsInt() @Min(0) version?: number;

  @IsEnum(ProductOrigin) origin!: ProductOrigin;
  @ValidateIf((_,v)=>v!==undefined) @IsEnum(SalesGroup) salesGroup?: SalesGroup;
  @TextField(2,120) name!: string;
  @ValidateIf((_,v)=>v!==undefined) @TextField(2,80) category?: string;
  @IsInt() @Min(0) @Max(1000000000000) priceCents!: number;
  @ValidateIf((_o, v) => v !== undefined) @IsInt() @Min(0) @Max(1000000) minimumStock?: number;
  @ValidateIf((_o, v) => v !== undefined) @IsEnum(AvailabilityMode) availabilityMode?: AvailabilityMode;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() active?: boolean;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MaxLength(2048) @Matches(/^(?:https:\/\/[^\s]+|\/api\/public\/images\/[a-f0-9]{24}|)$/) imageUrl?: string;
}

export class UpdateProductDto {
  @ValidateIf((_,v)=>v!==undefined) @IsMongoId() categoryId?: string;
  @ValidateIf((_,v)=>v!==undefined) @IsEnum(SupplyMode) supplyMode?: SupplyMode;
  @ValidateIf((_,v)=>v!==undefined) @TextField(0,240) shortDescription?: string;
  @ValidateIf((_,v)=>v!==undefined) @TextField(0,4000) description?: string;
  @ValidateIf((_,v)=>v!==undefined) @TextField(1,20) unit?: string;
  @ValidateIf((_,v)=>v!==undefined) @IsArray() @ArrayMaxSize(6) @IsString({each:true}) @MaxLength(2048,{each:true}) @Matches(/^(?:https:\/\/[^\s]+|\/api\/public\/images\/[a-f0-9]{24})$/, {each:true}) additionalImages?: string[];
  @ValidateIf((_,v)=>v!==undefined) @IsBoolean() published?: boolean;
  @ValidateIf((_,v)=>v!==undefined) @IsBoolean() manuallyHidden?: boolean;
  @ValidateIf((_,v)=>v!==undefined) @IsBoolean() featured?: boolean;
  @ValidateIf((_,v)=>v!==undefined) @IsInt() @Min(0) @Max(1000000) publicOrder?: number;
  @ValidateIf((_,v)=>v!==undefined) @IsInt() @Min(0) @Max(1000000) internalOrder?: number;
  @ValidateIf((_,v)=>v!==undefined) @IsInt() @Min(0) version?: number;

  @ValidateIf((_,v)=>v!==undefined) @IsEnum(ProductOrigin) origin?:ProductOrigin;
  @ValidateIf((_,v)=>v!==undefined) @IsEnum(SalesGroup) salesGroup?:SalesGroup;
  @ValidateIf((_o, v) => v !== undefined) @TextField(2,120) name?: string;
  @ValidateIf((_o, v) => v !== undefined) @TextField(2,80) category?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsInt() @Min(0) @Max(1000000000000) priceCents?: number;
  @ValidateIf((_o, v) => v !== undefined) @IsInt() @Min(0) @Max(1000000) minimumStock?: number;
  @ValidateIf((_o, v) => v !== undefined) @IsEnum(AvailabilityMode) availabilityMode?: AvailabilityMode;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() active?: boolean;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MaxLength(2048) @Matches(/^(?:https:\/\/[^\s]+|\/api\/public\/images\/[a-f0-9]{24}|)$/) imageUrl?: string;
}

export class ProductPurchaseDto { @IsInt() @Min(1) @Max(1000000) quantity!:number; }
