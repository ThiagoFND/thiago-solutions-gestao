import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { OrderStatus } from './enums.js';
export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 100;
}
export class ProductsQueryDto extends PageQueryDto {
  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean() activeOnly?: boolean;
}
export class OrdersQueryDto extends PageQueryDto { @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus; }
export class ReportQueryDto { @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string; }
