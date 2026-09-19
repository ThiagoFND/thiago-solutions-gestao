import { EmailField } from '../../common/business-validation.js';
import { IsByteLength, IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class PlatformLoginDto {
  @EmailField()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72) @IsByteLength(1, 72)
  password!: string;
}

export class LoginDto extends PlatformLoginDto { @IsString() @MaxLength(18) cnpj!: string; }
