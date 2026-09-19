import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsMongoId, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { TextField } from '../common/business-validation.js';
export class CatalogQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 24;
  @ValidateIf((_, v) => v !== undefined) @TextField(0, 80) search?: string;
  @ValidateIf((_, v) => v !== undefined) @IsMongoId() category?: string;
}
export class CategoryDto {
  @TextField(2, 80) name!: string;
  @ValidateIf((_, v) => v !== undefined) @TextField(0, 1000) description?: string;
  @ValidateIf((_, v) => v !== undefined) @IsString() @MaxLength(2048) @Matches(/^(?:https:\/\/[^\s]+|\/api\/public\/images\/[a-f0-9]{24}|)$/) imageUrl?: string;
  @ValidateIf((_, v) => v !== undefined) @TextField(0, 40) icon?: string;
  @ValidateIf((_, v) => v !== undefined) @IsIn(['violet', 'blue', 'green', 'rose', 'slate']) color?: string;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() active?: boolean;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() published?: boolean;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() archived?: boolean;
  @ValidateIf((_, v) => v !== undefined) @IsInt() @Min(0) @Max(1000000) publicOrder?: number;
  @ValidateIf((_, v) => v !== undefined) @IsInt() @Min(0) @Max(1000000) internalOrder?: number;
  @ValidateIf((_, v) => v !== undefined) @IsInt() @Min(0) version?: number;
}
export class MoveProductsDto { @IsMongoId() destinationId!: string; @IsInt() @Min(0) version!: number; }
export class CategoryOrderDto { @IsIn(['publicOrder','internalOrder']) scope!: 'publicOrder'|'internalOrder'; @IsIn(['UP','DOWN']) direction!: 'UP'|'DOWN'; @IsInt() @Min(0) version!:number; }
export const normalized = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export const literalSearch = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
