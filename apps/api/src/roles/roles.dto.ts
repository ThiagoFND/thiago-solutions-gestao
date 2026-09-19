import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, Min, ValidateIf } from 'class-validator';
import { TextField } from '../common/business-validation.js';
import { ALL_PERMISSIONS } from '../auth/permissions.js';
export class RoleDto {
  @TextField(2, 80) name!: string;
  @TextField(0, 500) description!: string;
  @IsArray() @ArrayUnique() @ArrayMaxSize(100) @IsIn(ALL_PERMISSIONS, { each: true }) permissions!: string[];
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() active?: boolean;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() archived?: boolean;
  @ValidateIf((_, v) => v !== undefined) @IsInt() @Min(0) version?: number;
}
export class DuplicateRoleDto { @TextField(2, 80) name!: string; }
