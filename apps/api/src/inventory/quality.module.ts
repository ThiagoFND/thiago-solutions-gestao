import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, Post, Query, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Schema, Types, type Connection } from 'mongoose';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsMongoId, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { PageQueryDto } from '../common/query.dto.js';
import { TenantAccessService } from '../tenants/tenant-access.service.js';
import { EntitlementsService } from '../commerce/entitlements.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StockMovementType } from '../common/enums.js';
import { civilDate } from '../finance/finance.helpers.js';

class ReasonDto { @IsString() @MinLength(3) @MaxLength(100) name!:string; @IsString() @MaxLength(1000) instructions!:string; }
class ReasonStateDto { @IsInt() @Min(0) version!:number; @IsBoolean() active!:boolean; }
class ReturnDto {
 @IsUUID('4') requestId!:string;
 @IsMongoId() productId!:string;
 @IsMongoId() reasonId!:string;
 @IsOptional() @IsMongoId() partyId?:string;
 @IsInt() @Min(1) @Max(1000000) quantity!:number;
 @IsString() @MinLength(3) @MaxLength(120) originReference!:string;
 @IsString() @MinLength(2) @MaxLength(100) quarantineLocation!:string;
 @IsString() @MaxLength(100) lot!:string;
 @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) expiresAt?:string;
 @IsString() @MinLength(5) @MaxLength(2000) notes!:string;
}
const CHECKS=['IDENTITY','PACKAGING','CONDITION','VALIDITY'] as const;
class AssessmentDto { @IsIn(CHECKS) code!:string; @IsIn(['PASS','FAIL','NOT_APPLICABLE']) result!:string; @IsString() @MinLength(3) @MaxLength(500) observation!:string; }
class InspectDto {
 @IsInt() @Min(0) version!:number;
 @IsIn(['APPROVED','REJECTED']) decision!:string;
 @IsString() @MinLength(10) @MaxLength(1000) conclusion!:string;
 @IsString() @MinLength(2) @MaxLength(100) destination!:string;
 @IsArray() @ArrayMinSize(4) @ArrayMaxSize(4) @ValidateNested({each:true}) @Type(()=>AssessmentDto) assessments!:AssessmentDto[];
}
class QualityQuery extends PageQueryDto { @IsOptional() @IsIn(['QUARANTINE','APPROVED','REJECTED']) status?:string; @IsOptional() @IsMongoId() productId?:string; }
export function validateAssessment(d:{decision:string;assessments:{code:string;result:string}[]},expiresAt?:string,now=new Date()){
 if(new Set(d.assessments.map(a=>a.code)).size!==4||CHECKS.some(c=>!d.assessments.some(a=>a.code===c)))throw new BadRequestException('Preencha cada uma das quatro avaliações uma vez.');
 if(d.decision==='APPROVED'&&(d.assessments.some(a=>a.result==='FAIL')||d.assessments.find(a=>a.code==='IDENTITY')?.result!=='PASS'||d.assessments.find(a=>a.code==='CONDITION')?.result!=='PASS'))throw new BadRequestException('Identidade e condição devem ser aprovadas; nenhuma avaliação pode falhar.');
 if(d.decision==='APPROVED'&&expiresAt){civilDate(expiresAt);if(expiresAt<now.toISOString().slice(0,10)||d.assessments.find(a=>a.code==='VALIDITY')?.result!=='PASS')throw new BadRequestException('Produto vencido ou validade não aprovada.');}
}
const options={timestamps:true,strict:'throw' as const,autoCreate:false,autoIndex:false};
const reasonSchema=new Schema({tenantId:{type:Schema.Types.ObjectId,required:true},name:{type:String,required:true,maxlength:100},normalized:{type:String,required:true},instructions:{type:String,maxlength:1000},active:{type:Boolean,default:true},version:{type:Number,default:0},actorId:Schema.Types.ObjectId},{...options,collection:'quality_reasons_v2'});reasonSchema.index({tenantId:1,normalized:1},{unique:true});
const returnSchema=new Schema({tenantId:{type:Schema.Types.ObjectId,required:true},productId:{type:Schema.Types.ObjectId,required:true},productName:String,reasonId:Schema.Types.ObjectId,reasonName:String,reasonInstructions:String,partyId:Schema.Types.ObjectId,quantity:{type:Number,required:true,min:1,max:1000000},originReference:String,quarantineLocation:String,lot:String,expiresAt:String,notes:String,requestId:{type:String,required:true},status:{type:String,enum:['QUARANTINE','APPROVED','REJECTED'],default:'QUARANTINE'},version:{type:Number,default:0},actorId:Schema.Types.ObjectId,inspectorId:Schema.Types.ObjectId,inspectorName:String,inspectedAt:Date,conclusion:String,destination:String,assessments:[{_id:false,code:{type:String,enum:CHECKS},result:{type:String,enum:['PASS','FAIL','NOT_APPLICABLE']},observation:String}],stockApplied:{type:Boolean,default:false},movementId:Schema.Types.ObjectId},{...options,collection:'quality_returns_v2'});returnSchema.index({tenantId:1,requestId:1},{unique:true});returnSchema.index({tenantId:1,status:1,createdAt:-1});returnSchema.index({tenantId:1,productId:1,lot:1});
export const definitions=[{name:'QualityReason',schema:reasonSchema},{name:'QualityReturn',schema:returnSchema}];
@Injectable()
export class QualityService {
 constructor(@InjectConnection() private db:Connection,private access:TenantAccessService,private entitlements:EntitlementsService,private audit:AuditService){}
 private model(name:string){return this.db.model<any>(name);}
 private async ready(){for(const d of definitions){let indexes:any[];try{indexes=await this.model(d.name).collection.indexes();}catch{throw new ServiceUnavailableException('Qualidade ainda não provisionada.');}if(d.schema.indexes().filter(([,o])=>o.unique).some(([key])=>!indexes.some(i=>i.unique&&JSON.stringify(i.key)===JSON.stringify(key))))throw new ServiceUnavailableException('Índices de qualidade ausentes.');}}
 async products(u:AuthUser,q:PageQueryDto){const a=await this.access.require(u,['qualidade.visualizar']);const filter={tenantId:a.tenantId,active:true};return {items:await this.model('Product').find(filter).select('_id name unit').sort({name:1,_id:1}).skip((q.page-1)*q.limit).limit(q.limit).lean(),total:await this.model('Product').countDocuments(filter)};}
 async reasons(u:AuthUser,q:PageQueryDto){const a=await this.access.require(u,['qualidade.visualizar']);const filter={tenantId:a.tenantId};return {items:await this.model('QualityReason').find(filter).sort({name:1,_id:1}).skip((q.page-1)*q.limit).limit(q.limit).lean(),total:await this.model('QualityReason').countDocuments(filter)};}
 async reason(u:AuthUser,d:ReasonDto){await this.ready();return this.access.transaction(async session=>{const a=await this.access.require(u,['qualidade.configurar'],session),normalized=d.name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();await this.access.tenants.updateOne({_id:a.tenantId},{$inc:{membershipVersion:1}},{session});if(await this.model('QualityReason').exists({tenantId:a.tenantId,normalized}).session(session))throw new ConflictException('Já existe um motivo com esse nome.');const [row]=await this.model('QualityReason').create([{tenantId:a.tenantId,name:d.name.trim(),normalized,instructions:d.instructions,actorId:a.sub}],{session});await this.audit.record('quality.reason.created','success',a,'quality',String(row._id),undefined,session);return row;});}
 async reasonState(u:AuthUser,id:string,d:ReasonStateDto){return this.access.transaction(async session=>{const a=await this.access.require(u,['qualidade.configurar'],session);const row=await this.model('QualityReason').findOneAndUpdate({_id:id,tenantId:a.tenantId,version:d.version},{$set:{active:d.active,actorId:a.sub},$inc:{version:1}},{session,returnDocument:'after'});if(!row)throw new ConflictException('Motivo ausente ou alterado.');await this.audit.record('quality.reason.updated','success',a,'quality',id,undefined,session);return row;});}
 async list(u:AuthUser,q:QualityQuery){const a=await this.access.require(u,['qualidade.visualizar']);const filter={tenantId:a.tenantId,...(q.status?{status:q.status}:{}),...(q.productId?{productId:q.productId}:{})};return {items:await this.model('QualityReturn').find(filter).sort({createdAt:-1,_id:-1}).skip((q.page-1)*q.limit).limit(q.limit).lean(),total:await this.model('QualityReturn').countDocuments(filter),inventoryIntegration:await this.entitlements.has(a.tenantId!,'INVENTORY')};}
 async receive(u:AuthUser,d:ReturnDto){if(d.expiresAt)civilDate(d.expiresAt);await this.ready();return this.access.transaction(async session=>{const a=await this.access.require(u,['qualidade.receber'],session);const filter={tenantId:a.tenantId,requestId:d.requestId};await this.access.tenants.updateOne({_id:a.tenantId},{$inc:{membershipVersion:1}},{session});const previous=await this.model('QualityReturn').findOne(filter).session(session);if(previous){if(Object.entries(d).some(([k,v])=>String(previous.get(k)??'')!==String(v??'')))throw new ConflictException('Referência já usada com outros dados.');return previous;}
 const product=await this.model('Product').findOne({_id:d.productId,tenantId:a.tenantId,active:true}).session(session);if(!product)throw new NotFoundException('Produto não encontrado.');const reason=await this.model('QualityReason').findOne({_id:d.reasonId,tenantId:a.tenantId,active:true}).session(session);if(!reason)throw new NotFoundException('Motivo não encontrado ou inativo.');if(d.partyId&&!await this.model('BusinessParty').exists({_id:d.partyId,tenantId:a.tenantId,active:true}).session(session))throw new NotFoundException('Cliente ou fornecedor não encontrado.');const [row]=await this.model('QualityReturn').create([{...d,tenantId:a.tenantId,productName:product.name,reasonName:reason.name,reasonInstructions:reason.instructions,actorId:a.sub}],{session});await this.audit.record('quality.return.received','success',a,'quality',String(row._id),undefined,session);return row;
 });}
 async inspect(u:AuthUser,id:string,d:InspectDto){await this.ready();return this.access.transaction(async session=>{const a=await this.access.require(u,['qualidade.inspecionar'],session);await this.access.tenants.updateOne({_id:a.tenantId},{$inc:{membershipVersion:1}},{session});const row=await this.model('QualityReturn').findOne({_id:id,tenantId:a.tenantId}).session(session);if(!row)throw new NotFoundException('Devolução não encontrada.');if(row.status!=='QUARANTINE'||row.version!==d.version)throw new ConflictException('Devolução já avaliada ou alterada.');validateAssessment(d,row.expiresAt);let movementId:Types.ObjectId|undefined,stockApplied=false;
 if(d.decision==='APPROVED'&&await this.entitlements.has(a.tenantId!,'INVENTORY',session)){
  const product=await this.model('Product').findOneAndUpdate({_id:row.productId,tenantId:a.tenantId,active:true,availableStock:{$lte:1000000-row.quantity}},{$inc:{availableStock:row.quantity}},{session,returnDocument:'after'});if(!product)throw new ConflictException('Produto inativo ou limite de estoque excedido.');const [movement]=await this.model('StockMovement').create([{tenantId:a.tenantId,productId:row.productId,productName:row.productName,quantityChange:row.quantity,type:StockMovementType.ADMIN_ADJUSTMENT,referenceId:'quality-return:'+id,userId:a.sub,userName:a.name}],{session});movementId=movement._id;stockApplied=true;
 }
 row.set({status:d.decision,conclusion:d.conclusion,destination:d.destination,assessments:d.assessments,inspectorId:a.sub,inspectorName:a.name,inspectedAt:new Date(),stockApplied,movementId,version:row.version+1});await row.save({session});await this.audit.record('quality.return.inspected','success',a,'quality',id,undefined,session);return row;
 });}
}
@Controller('quality')
class QualityController {
 constructor(private service:QualityService){}
 @Get('products') @Permissions('qualidade.visualizar') products(@CurrentUser() u:AuthUser,@Query() q:PageQueryDto){return this.service.products(u,q);}
 @Get('reasons') @Permissions('qualidade.visualizar') reasons(@CurrentUser() u:AuthUser,@Query() q:PageQueryDto){return this.service.reasons(u,q);}
 @Post('reasons') @Permissions('qualidade.configurar') reason(@CurrentUser() u:AuthUser,@Body() d:ReasonDto){return this.service.reason(u,d);}
 @Post('reasons/:id/status') @Permissions('qualidade.configurar') reasonState(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:ReasonStateDto){return this.service.reasonState(u,id,d);}
 @Get('returns') @Permissions('qualidade.visualizar') list(@CurrentUser() u:AuthUser,@Query() q:QualityQuery){return this.service.list(u,q);}
 @Post('returns') @Permissions('qualidade.receber') receive(@CurrentUser() u:AuthUser,@Body() d:ReturnDto){return this.service.receive(u,d);}
 @Post('returns/:id/inspect') @Permissions('qualidade.inspecionar') inspect(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:InspectDto){return this.service.inspect(u,id,d);}
}
@Module({imports:[MongooseModule.forFeature(definitions)],controllers:[QualityController],providers:[QualityService]})
export class QualityModule {}
