import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { PageQueryDto } from '../common/query.dto.js';
export class DocumentQuery extends PageQueryDto {@IsOptional() @IsString() @MaxLength(160) search?:string;@IsOptional() @IsIn(['ACTIVE','ARCHIVED']) status?:string;}
export class DocumentDto {
 @IsUUID('4') requestId!:string;
 @IsString() @MinLength(3) @MaxLength(160) title!:string;
 @IsString() @MinLength(2) @MaxLength(100) category!:string;
 @IsString() @MaxLength(2000) description!:string;
 @IsString() @MaxLength(160) originReference!:string;
 @IsArray() @ArrayUnique() @ArrayMaxSize(100) @IsMongoId({each:true}) allowedUserIds!:string[];
}
export class DocumentChange {@IsInt() @Min(0) version!:number;@IsString() @MinLength(5) @MaxLength(1000) reason!:string;}
export class DocumentStateDto extends DocumentChange {@IsIn(['ACTIVE','ARCHIVED']) status!:string;}
export class DocumentShareDto extends DocumentChange {@IsArray() @ArrayUnique() @ArrayMaxSize(100) @IsMongoId({each:true}) allowedUserIds!:string[];}
export class DocumentUploadDto {@IsUUID('4') requestId!:string;@Type(()=>Number) @IsInt() @Min(0) version!:number;@IsString() @MinLength(5) @MaxLength(1000) reason!:string;}
