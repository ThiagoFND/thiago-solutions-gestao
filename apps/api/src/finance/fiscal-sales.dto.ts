import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';
import { PageDto } from './finance.dto.js';
import { OrderStatus, PaymentMethod, SalesGroup } from '../common/enums.js';
const present=(_:unknown,v:unknown)=>v!==undefined;
export class FiscalSalesQuery extends PageDto {
 @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?:string;
 @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateFrom?:string;
 @ValidateIf(present) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateTo?:string;
 @ValidateIf(present) @Type(()=>Number) @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) number?:number;
 @ValidateIf(present) @IsEnum(PaymentMethod) method?:PaymentMethod;
 @ValidateIf(present) @IsEnum(OrderStatus) status?:OrderStatus;
 @ValidateIf(present) @IsMongoId() cashierId?:string;
 @ValidateIf(present) @IsMongoId() productId?:string;
 @ValidateIf(present) @IsEnum(SalesGroup) salesGroup?:SalesGroup;
 @ValidateIf(present) @IsEnum({date:'date',number:'number',total:'total'}) sort='date';
 @ValidateIf(present) @IsEnum({asc:'asc',desc:'desc'}) direction='desc';
}
