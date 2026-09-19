import { IsByteLength, IsBoolean, IsEmail, IsEnum, IsString, MinLength, MaxLength, ValidateIf } from 'class-validator';
import { UserRole } from '../../common/enums.js';
export class CreateUserDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(12) @MaxLength(72) @IsByteLength(1, 72) password!: string;
  @IsEnum(UserRole) role!: UserRole;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() active?: boolean;
}
export class UpdateUserDto {
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsEmail() @MaxLength(254) email?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MinLength(12) @MaxLength(72) @IsByteLength(1, 72) password?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsEnum(UserRole) role?: UserRole;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() active?: boolean;
}
