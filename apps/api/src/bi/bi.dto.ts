import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PageQueryDto } from '../common/query.dto.js';
export class BiQuery extends PageQueryDto {
 @IsOptional() @IsString() @MaxLength(120) search?:string;
 @IsOptional() @IsMongoId() datasetId?:string;
 @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?:string;
 @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?:string;
 @IsOptional() @IsString() @MaxLength(100) category?:string;
 @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month?:string;
}
export class DatasetDto {
 @IsUUID('4') requestId!:string;
 @IsString() @MinLength(3) @MaxLength(120) name!:string;
 @IsString() @MinLength(10) @MaxLength(2000) definition!:string;
 @IsString() @MinLength(3) @MaxLength(200) sourceName!:string;
 @IsIn(['BRL_CENTS','UNITS','MINUTES']) unit!:string;
 @IsArray() @ArrayUnique() @ArrayMaxSize(100) @IsMongoId({each:true}) allowedUserIds!:string[];
}
export class BiRowDto {
 @Matches(/^[A-Za-z0-9_.:-]{1,100}$/) key!:string;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) date!:string;
 @IsInt() @Min(-1e12) @Max(1e12) value!:number;
 @IsString() @MaxLength(100) category!:string;
}
export class BiImportDto {
 @IsUUID('4') requestId!:string;
 @IsString() @MinLength(3) @MaxLength(160) sourceFile!:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({each:true}) @Type(()=>BiRowDto) rows!:BiRowDto[];
}
export class BiShareDto {
 @IsInt() @Min(0) version!:number;
 @IsString() @MinLength(5) @MaxLength(1000) reason!:string;
 @IsArray() @ArrayUnique() @ArrayMaxSize(100) @IsMongoId({each:true}) allowedUserIds!:string[];
}
export class BiGoalDto {
 @IsUUID('4') requestId!:string;
 @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!:string;
 @IsInt() @Min(-1e12) @Max(1e12) target!:number;
 @IsIn(['AT_LEAST','AT_MOST']) direction!:string;
 @IsString() @MinLength(5) @MaxLength(1000) reason!:string;
}
