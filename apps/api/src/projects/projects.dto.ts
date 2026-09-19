import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsMongoId, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PageQueryDto } from '../common/query.dto.js';
export class ProjectQuery extends PageQueryDto {
 @IsOptional() @IsString() @MaxLength(160) search?:string;
 @IsOptional() @IsMongoId() projectId?:string;
 @IsOptional() @IsIn(['PLANNED','ACTIVE','SUSPENDED','COMPLETED','CANCELED']) status?:string;
}
export class ProjectDto {
 @IsUUID('4') requestId!:string;
 @IsString() @MinLength(3) @MaxLength(160) name!:string;
 @IsString() @MinLength(10) @MaxLength(6000) scope!:string;
 @IsOptional() @IsMongoId() partyId?:string;
 @IsMongoId() managerId!:string;
 @IsArray() @ArrayUnique() @ArrayMaxSize(100) @IsMongoId({each:true}) memberIds!:string[];
 @Matches(/^\d{4}-\d{2}-\d{2}$/) startsOn!:string;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) endsOn!:string;
 @IsInt() @Min(0) @Max(1e12) budgetCents!:number;
}
export class ProjectChange {
 @IsInt() @Min(0) version!:number;
 @IsString() @MinLength(5) @MaxLength(1000) reason!:string;
}
export class ProjectStateDto extends ProjectChange { @IsIn(['ACTIVE','SUSPENDED','COMPLETED','CANCELED']) status!:string; }
export class ProjectRevisionDto extends ProjectChange {
 @IsString() @MinLength(10) @MaxLength(6000) scope!:string;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) endsOn!:string;
 @IsInt() @Min(0) @Max(1e12) budgetCents!:number;
}
export class ProjectTaskDto {
 @IsUUID('4') requestId!:string;
 @IsMongoId() projectId!:string;
 @IsString() @MinLength(3) @MaxLength(160) title!:string;
 @IsString() @MaxLength(4000) description!:string;
 @IsMongoId() assignedId!:string;
 @Matches(/^\d{4}-\d{2}-\d{2}$/) dueOn!:string;
 @IsIn(['LOW','NORMAL','HIGH','URGENT']) priority!:string;
 @IsInt() @Min(0) @Max(1000000) estimatedMinutes!:number;
 @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsMongoId({each:true}) dependencies!:string[];
}
export class TaskStateDto extends ProjectChange { @IsIn(['TODO','IN_PROGRESS','REVIEW','DONE','CANCELED']) status!:string; }
export class TaskDependenciesDto extends ProjectChange { @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsMongoId({each:true}) dependencies!:string[]; }
export class TaskCommentDto { @IsUUID('4') requestId!:string; @IsString() @MinLength(2) @MaxLength(4000) text!:string; }
export class ProjectTimeDto {
 @IsUUID('4') requestId!:string;
 @IsMongoId() taskId!:string;
 @IsISO8601() startsAt!:string;
 @IsISO8601() endsAt!:string;
 @IsBoolean() billable!:boolean;
 @IsString() @MinLength(5) @MaxLength(1000) description!:string;
}
export class TimeApprovalDto extends ProjectChange { @IsIn(['APPROVED','REJECTED']) status!:string; }
