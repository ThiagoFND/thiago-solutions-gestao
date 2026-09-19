import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsMongoId, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PageQueryDto } from '../common/query.dto.js';
export class BusinessQuery extends PageQueryDto {
 @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month?:string;
 @IsOptional() @IsString() @MaxLength(120) search?:string;
 @IsOptional() @IsMongoId() accountId?:string;
}
export class VersionReason { @IsInt() @Min(0) version!:number; @IsString() @MinLength(5) @MaxLength(500) reason!:string; }
export class PartyDto {
 @IsString() @MinLength(2) @MaxLength(160) name!:string;
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2) @ArrayUnique() @IsIn(['CUSTOMER','SUPPLIER'],{each:true}) roles!:string[];
 @IsOptional() @IsEmail() @MaxLength(254) email?:string;
 @IsOptional() @Matches(/^\d{10,15}$/) phone?:string;
 @IsOptional() @IsString() @MaxLength(2000) notes?:string;
}
export class CashAccountDto {
 @IsString() @MinLength(2) @MaxLength(100) name!:string;
 @IsIn(['BANK','CASH','WALLET']) kind!:string;
 @IsInt() @Min(-1_000_000_000_000) @Max(1_000_000_000_000) openingCents!:number;
}
export class CashEntryDto {
 @IsMongoId() accountId!:string; @IsOptional() @IsMongoId() partyId?:string;
 @IsString() @MinLength(3) @MaxLength(200) description!:string;
 @IsIn(['IN','OUT']) direction!:'IN'|'OUT';
 @IsInt() @Min(1) @Max(1_000_000_000_000) amountCents!:number;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate!:string;
 @Matches(/^[a-zA-Z0-9_-]{8,100}$/) reference!:string;
}
export class SettlementDto extends VersionReason { @Matches(/^\d{4}-\d{2}-\d{2}$/) date!:string; }
export class TransferDto {
 @IsMongoId() fromAccountId!:string; @IsMongoId() toAccountId!:string;
 @IsInt() @Min(1) @Max(1_000_000_000_000) amountCents!:number;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) date!:string;
 @Matches(/^[a-zA-Z0-9_-]{8,80}$/) reference!:string;
 @IsString() @MinLength(5) @MaxLength(500) reason!:string;
}
export class LedgerAccountDto {
 @Matches(/^[0-9][0-9.]{0,29}$/) code!:string;
 @IsString() @MinLength(2) @MaxLength(160) name!:string;
 @IsIn(['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE']) kind!:'ASSET'|'LIABILITY'|'EQUITY'|'REVENUE'|'EXPENSE';
}
export class LineDto {
 @IsMongoId() accountId!:string;
 @IsInt() @Min(0) @Max(1_000_000_000_000) debitCents!:number;
 @IsInt() @Min(0) @Max(1_000_000_000_000) creditCents!:number;
}
export class JournalDto {
 @Matches(/^\d{4}-\d{2}-\d{2}$/) date!:string;
 @IsString() @MinLength(5) @MaxLength(500) description!:string;
 @Matches(/^[a-zA-Z0-9_-]{8,100}$/) reference!:string;
 @IsArray() @ArrayMinSize(2) @ArrayMaxSize(50) @ValidateNested({each:true}) @Type(()=>LineDto) lines!:LineDto[];
}
export class ImportJournalDto {
 @IsIn(['SALE','EXPENSE','TREASURY']) source!:'SALE'|'EXPENSE'|'TREASURY';
 @IsMongoId() sourceId!:string; @IsMongoId() debitAccountId!:string; @IsMongoId() creditAccountId!:string;
}
export class ClosingDto extends VersionReason { @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!:string; @IsBoolean() closed!:boolean; }
export class ObligationDto {
 @IsString() @MinLength(3) @MaxLength(160) name!:string;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate!:string;
 @IsOptional() @IsString() @MaxLength(2000) notes?:string;
}
export class ObligationStateDto extends VersionReason { @IsIn(['PENDING','DONE','NOT_APPLICABLE']) status!:string; }
