import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema } from 'mongoose';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsMongoId, IsOptional, IsString, IsUUID, IsInt, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { PageQueryDto } from '../common/query.dto.js';
import { normalizeCnpj } from '../common/brazil-documents.js';
const oid={type:Schema.Types.ObjectId,required:true},text=(maxlength:number)=>({type:String,trim:true,maxlength});
export const branchSchema=new Schema({tenantId:{...oid,immutable:true},actorId:oid,requestId:{...text(36),required:true},inputHash:text(64),code:{...text(30),required:true},name:text(160),cnpj:text(14),address:text(500),phone:text(15),managerId:oid,memberIds:[Schema.Types.ObjectId],hours:text(1000),policy:text(4000),active:{type:Boolean,default:true},version:{type:Number,default:0},history:[{_id:false,active:Boolean,actorId:oid,at:Date,reason:text(1000)}]},{timestamps:true,autoCreate:false,autoIndex:false,strict:'throw',collection:'company_branches_v2'});
branchSchema.index({tenantId:1,code:1},{unique:true});branchSchema.index({tenantId:1,requestId:1},{unique:true});branchSchema.index({tenantId:1,memberIds:1,active:1,_id:1});branchSchema.index({tenantId:1,cnpj:1},{unique:true,partialFilterExpression:{cnpj:{$type:'string'}}});
export const BRANCH_MODELS=[{name:'CompanyBranch',schema:branchSchema}];
class BranchQuery extends PageQueryDto {@IsOptional() @IsString() @MaxLength(160) search?:string;}
class BranchDto {
 @IsUUID('4') requestId!:string;
 @Matches(/^[A-Z0-9_-]{2,30}$/) code!:string;
 @IsString() @MinLength(2) @MaxLength(160) name!:string;
 @IsOptional() @Matches(/^\d{14}$/) cnpj?:string;
 @IsString() @MinLength(10) @MaxLength(500) address!:string;
 @Matches(/^\d{10,15}$/) phone!:string;
 @IsMongoId() managerId!:string;
 @IsArray() @ArrayUnique() @ArrayMaxSize(100) @IsMongoId({each:true}) memberIds!:string[];
 @IsString() @MaxLength(1000) hours!:string;
 @IsString() @MaxLength(4000) policy!:string;
}
class BranchChangeDto {
 @IsInt() @Min(0) version!:number;
 @IsString() @MinLength(5) @MaxLength(1000) reason!:string;
 @IsBoolean() active!:boolean;
 @IsMongoId() managerId!:string;
 @IsArray() @ArrayUnique() @ArrayMaxSize(100) @IsMongoId({each:true}) memberIds!:string[];
 @IsString() @MaxLength(1000) hours!:string;
 @IsString() @MaxLength(4000) policy!:string;
}
@Injectable()
class BranchesService {
 constructor(private store:OperationalStore){}
 private scope(a:AuthUser){return {tenantId:a.tenantId,...(a.permissions?.includes('filiais.gerenciar')?{}:{memberIds:a.sub})};}
 private clean(row:any){const {inputHash,requestId,...r}=row.toObject?row.toObject():row;return r;}
 async people(u:AuthUser,q:BranchQuery){const a=await this.store.access.require(u,['filiais.gerenciar']);return this.store.page('User',{tenantId:a.tenantId,status:'ACTIVE',active:true},q,{name:1,_id:1},'_id name');}
 async list(u:AuthUser,q:BranchQuery){const a=await this.store.access.require(u,['filiais.visualizar']);return this.store.page('CompanyBranch',{...this.scope(a),...(q.search?{name:new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i')}:{})},q,{name:1,_id:1});}
 async detail(u:AuthUser,id:string){const a=await this.store.access.require(u,['filiais.visualizar']),r=await this.store.model('CompanyBranch').findOne({_id:this.store.id(id),...this.scope(a)});if(!r)throw new NotFoundException('Unidade não encontrada.');return this.clean(r);}
 async create(u:AuthUser,d:BranchDto){if(d.cnpj)try{normalizeCnpj(d.cnpj);}catch{throw new BadRequestException('CNPJ inválido.');}return this.store.write(u,'filiais.gerenciar','branches.created',BRANCH_MODELS,async(a,s)=>{const previous=await this.store.replay('CompanyBranch',a,d,s);if(previous)return this.clean(previous);const model=this.store.model('CompanyBranch');if(await model.exists({tenantId:a.tenantId,$or:[{code:d.code},...(d.cnpj?[{cnpj:d.cnpj}]:[])]}).session(s))throw new ConflictException('Código ou CNPJ já cadastrado nesta empresa.');const memberIds=[...new Set([...d.memberIds,d.managerId])];if(await this.store.model('User').countDocuments({tenantId:a.tenantId,_id:{$in:memberIds},status:'ACTIVE',active:true}).session(s)!==memberIds.length)throw new BadRequestException('Responsável ou equipe indisponível.');const [r]=await model.create([{...d,...this.store.fields(a,d),memberIds,history:[{active:true,actorId:a.sub,at:new Date(),reason:'Unidade cadastrada'}]}],{session:s});return this.clean(r);});}
 async update(u:AuthUser,id:string,d:BranchChangeDto){return this.store.write(u,'filiais.gerenciar','branches.updated',BRANCH_MODELS,async(a,s)=>{const row=await this.store.model('CompanyBranch').findOne({_id:this.store.id(id),tenantId:a.tenantId}).session(s);if(!row)throw new NotFoundException('Unidade não encontrada.');if(row.version!==d.version)throw new ConflictException('Unidade atualizada.');const memberIds=[...new Set([...d.memberIds,d.managerId])];if(await this.store.model('User').countDocuments({tenantId:a.tenantId,_id:{$in:memberIds},status:'ACTIVE',active:true}).session(s)!==memberIds.length)throw new BadRequestException('Responsável ou equipe indisponível.');Object.assign(row,{active:d.active,managerId:d.managerId,memberIds,hours:d.hours,policy:d.policy});row.version++;row.history.push({active:d.active,actorId:a.sub,at:new Date(),reason:d.reason});await row.save({session:s});return this.clean(row);});}
}
@Controller('branches')
class BranchesController {
 constructor(private service:BranchesService){}
 @Get('people') @Permissions('filiais.gerenciar') people(@CurrentUser() u:AuthUser,@Query() q:BranchQuery){return this.service.people(u,q);}
 @Get() @Permissions('filiais.visualizar') list(@CurrentUser() u:AuthUser,@Query() q:BranchQuery){return this.service.list(u,q);}
 @Post() @Permissions('filiais.gerenciar') create(@CurrentUser() u:AuthUser,@Body() d:BranchDto){return this.service.create(u,d);}
 @Get(':id') @Permissions('filiais.visualizar') detail(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.service.detail(u,id);}
 @Post(':id/settings') @Permissions('filiais.gerenciar') update(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:BranchChangeDto){return this.service.update(u,id,d);}
}
@Module({imports:[MongooseModule.forFeature(BRANCH_MODELS)],controllers:[BranchesController],providers:[BranchesService,OperationalStore]})
export class BranchesModule {}
