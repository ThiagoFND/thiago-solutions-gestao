import { IsInt, IsMongoId, Min, Max, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateProductionDto {
  @IsOptional() @IsString() @Length(8,100) @Matches(/^[a-zA-Z0-9_-]+$/) idempotencyKey?: string;
  @IsMongoId() productId!: string;
  @IsInt() @Min(1) @Max(1000000) quantity!: number;
}
