import { Type, Transform } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsNumber, IsOptional, IsString, Length, Min, Max, ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
export class IngredientDto {
  @Transform(({value}) => typeof value === 'string' ? value.trim() : value) @IsString() @Length(2,120) name!: string;
  @IsIn(['KG','G','L','ML','UNIDADE','CAIXA','PACOTE']) unit!: string;
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(1e6) minimumStock?: number;
}
export class ReceiptDto { @IsMongoId() financialEntryId!: string; @IsMongoId() ingredientId!: string; }
export class ComponentDto { @IsMongoId() ingredientId!: string; @IsNumber({allowNaN:false,allowInfinity:false}) @Min(0.000001) @Max(1e6) quantity!: number; }
export class RecipeDto {
  @IsInt() @Min(1) @Max(1e6) yieldQuantity!: number;
  @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({each:true}) @Type(() => ComponentDto) components!: ComponentDto[];
  @IsOptional() @IsInt() @Min(0) @Max(1e12) version?: number;
}
