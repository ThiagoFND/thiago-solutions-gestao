import { TextField } from '../../common/business-validation.js';
import { Type } from 'class-transformer';
import { ArrayMaxSize, Max, MinLength, ArrayMinSize, IsArray, IsEnum, IsInt, IsMongoId, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { OrderType, PaymentMethod } from '../../common/enums.js';

export class RequestedOrderItemDto {
  @IsMongoId() productId!: string;
  @IsInt() @Min(1) @Max(1000000) quantity!: number;
}

export class CreateOrderDto {
  @IsEnum(OrderType) type!: OrderType;
  @IsOptional() @TextField(0,80) identifier?: string;
  @IsOptional() @TextField(0,300) notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @ArrayMaxSize(100) @Type(() => RequestedOrderItemDto)
  items!: RequestedOrderItemDto[];
}

export class UpdateOrderDto extends CreateOrderDto {}

export class PaymentDto {
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsInt() @Min(1) @Max(1000000000000) amountCents!: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000000000000) receivedCents?: number;
}

export class FinalizeOrderDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @ArrayMaxSize(10) @Type(() => PaymentDto)
  payments!: PaymentDto[];
}

export class CancelOrderDto {
  @TextField(3,200) reason!: string;
}
