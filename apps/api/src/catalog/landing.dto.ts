import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';
import { TextField } from '../common/business-validation.js';
export class LandingDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @TextField(3,70) slug!: string;
  @TextField(2,160) publicName!: string;
  @TextField(0,180) slogan!: string;
  @TextField(0,1000) description!: string;
  @TextField(0,4000) presentation!: string;
  @IsIn(['violet','blue','green','rose','slate']) theme!: string;
  @IsString() @MaxLength(2048) @Matches(/^(?:https:\/\/[^\s]+|\/api\/public\/images\/[a-f0-9]{24}|)$/) logoUrl!: string;
  @IsString() @MaxLength(2048) @Matches(/^(?:https:\/\/[^\s]+|\/api\/public\/images\/[a-f0-9]{24}|)$/) coverUrl!: string;
  @IsString() @Matches(/^(?:\d{10,15}|)$/) phone!: string;
  @IsString() @Matches(/^(?:\d{10,15}|)$/) whatsapp!: string;
  @IsString() @MaxLength(254) @Matches(/^(?:[^\s@]+@[^\s@]+\.[^\s@]+|)$/) publicEmail!: string;
  @TextField(0,500) address!: string;
  @TextField(0,1000) hours!: string;
  @IsArray() @ArrayMaxSize(8) @IsString({each:true}) @MaxLength(2048,{each:true}) @Matches(/^https:\/\/[^\s]+$/, {each:true}) socialLinks!: string[];
  @IsArray() @ArrayMaxSize(4) @ArrayUnique() @IsIn(['featured','products','about','contact'],{each:true}) sections!: string[];
  @TextField(0,2000) additionalInfo!: string;
  @IsString() @MaxLength(2048) @Matches(/^(?:https:\/\/[^\s]+|\/api\/public\/images\/[a-f0-9]{24}|)$/) contactUrl!: string;
  @TextField(1,60) contactLabel!: string;
  @TextField(0,240) operatingNotice!: string;
  @TextField(0,100) shareTitle!: string;
  @TextField(0,240) shareDescription!: string;
  @IsBoolean() hideUnavailable!: boolean;
  @IsBoolean() showDemandLabel!: boolean;
  @IsBoolean() showPrices!: boolean;
  @ValidateIf((_,v)=>v!==undefined) @IsInt() @Min(0) version?: number;
}
export class PublishDto { @IsInt() @Min(0) version!: number; }
