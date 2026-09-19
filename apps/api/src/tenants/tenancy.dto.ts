import { TextField, EmailField, PhoneField, PasswordField, ConfirmationField } from '../common/business-validation.js';
import { Transform, Type } from 'class-transformer';
import { IsByteLength, IsEmail, IsEnum, IsIn, IsString, IsMongoId, MaxLength, MinLength, Matches, ValidateNested, IsDefined, ValidateIf } from 'class-validator';
import { PageQueryDto } from '../common/query.dto.js';
import { TenantStatus, UserRole, UserStatus } from '../common/enums.js';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const email = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
export class CompanyLookupDto { @IsString() @MaxLength(18) cnpj!: string; }
export class CompanyDto extends CompanyLookupDto {
  @TextField(2,200) legalName!: string;
  @TextField(2,160) tradeName!: string;
  @EmailField() corporateEmail!: string;
  @PhoneField() phone!: string;
}
export class OwnerDto {
  @TextField(2,120) name!: string;
  @EmailField() email!: string;
  @PasswordField() password!: string;
  @ConfirmationField() passwordConfirmation!: string;
}
export class OnboardingDto {
  @IsDefined() @ValidateNested() @Type(() => CompanyDto) company!: CompanyDto;
  @IsDefined() @ValidateNested() @Type(() => OwnerDto) owner!: OwnerDto;
}
export class AccessRequestDto extends OwnerDto {
  @IsString() @MaxLength(18) cnpj!: string;
  @IsString() @MaxLength(14) cpf!: string;
  @PhoneField() phone!: string;
  @TextField(2,500) jobDescription!: string;
}
export class MemberRoleDto {
  @IsMongoId() customRoleId!: string;
}
export class MemberStatusDto { @IsIn([UserStatus.ACTIVE, UserStatus.INACTIVE]) status!: UserStatus; }
export class OptionalReasonDto { @ValidateIf((_,v) => v !== undefined) @Transform(trim) @IsString() @MaxLength(500) reason?: string; }
export class RequiredReasonDto { @TextField(3,500) reason!: string; }
export class EmptyDto { @ValidateIf(() => false) private readonly _empty?: never; }
export class UsersQueryDto extends PageQueryDto { @ValidateIf((_,v) => v !== undefined) @IsEnum(UserStatus) status?: UserStatus; }
export class TenantsQueryDto extends PageQueryDto {
 @ValidateIf((_,v)=>v!==undefined) @IsIn([...Object.values(TenantStatus),'ALL']) status?: string;
 @ValidateIf((_,v)=>v!==undefined) @Transform(trim) @IsString() @MaxLength(120) search?:string;
 @ValidateIf((_,v)=>v!==undefined) @Matches(/^[A-Z][A-Z0-9_]{1,59}$/) plan?:string;
 @ValidateIf((_,v)=>v!==undefined) @IsIn(['NOT_CONTRACTED','TRIAL','ACTIVE','PENDING_PAYMENT','PAST_DUE','SUSPENDED','CANCELED','EXPIRED']) subscriptionStatus?:string;
 @ValidateIf((_,v)=>v!==undefined) @IsIn(['NONE','DRAFT','OPEN','PAID','OVERDUE','CANCELED','WAIVED']) paymentStatus?:string;
}
