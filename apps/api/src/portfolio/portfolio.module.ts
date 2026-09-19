import { Body, Controller, Get, Inject, Injectable, Module, OnModuleDestroy, OnModuleInit, Param, Post, Query, Req, BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { Schema, type Model } from 'mongoose';
import { createHash } from 'node:crypto';
import { IsArray, ArrayMaxSize, ArrayUnique, IsIn, IsString, MinLength, MaxLength, IsEmail, Matches, Equals, IsOptional, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { TenantAccessService } from '../tenants/tenant-access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PageQueryDto } from '../common/query.dto.js';
import { WindowLimiter } from '../auth/security.guard.js';
import { PORTFOLIO_VERSION, SERVICES, SEGMENT_PLANS, recommend } from './portfolio.catalog.js';
import { CommercialOfferSchema } from '../commerce/commerce.schemas.js';
import { contractableOffers } from '../commerce/commerce.domain.js';
const codes=SERVICES.map(s=>s.code);
const recommendationView=(value:any)=>({...value,modules:(value?.modules??[]).filter((module:any)=>codes.includes(module.code))});
const leadView=(value:any)=>{const lead=typeof value.toObject==='function'?value.toObject():value;return {...lead,needs:(lead.needs??[]).filter((code:string)=>codes.includes(code)),recommendation:recommendationView(lead.recommendation)};};
export class ProblemDto {
 @IsString() @MinLength(30) @MaxLength(4000) problem!:string;
 @IsArray() @ArrayMaxSize(codes.length) @ArrayUnique() @IsIn(codes,{each:true}) needs!:string[];
}
export class LeadDto extends ProblemDto {
 @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(2) @MaxLength(120) name!:string;
 @Transform(({value})=>typeof value==='string'?value.trim().toLowerCase():value) @IsEmail() @MaxLength(254) email!:string;
 @Matches(/^\d{10,15}$/) phone!:string;
 @Equals(true) consent!:boolean;
 @Matches(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/) requestId!:string;
 @IsOptional() @Equals('') website?:string;
}
class LeadsQuery extends PageQueryDto { @IsOptional() @IsString() @MaxLength(120) search?:string; @IsOptional() @IsIn(['NEW','CONTACTED','CLOSED']) status?:string; }
class LeadStateDto { @IsInt() @Min(0) version!:number; @IsIn(['NEW','CONTACTED','CLOSED']) status!:string; @IsString() @MinLength(5) @MaxLength(500) reason!:string; }
export const leadSchema=new Schema({name:String,email:String,phone:String,problem:String,needs:[String],recommendation:Schema.Types.Mixed,consentVersion:String,consentedAt:Date,requestId:{type:String,required:true},fingerprint:{type:String,select:false},status:{type:String,enum:['NEW','CONTACTED','CLOSED'],default:'NEW'},note:String,version:{type:Number,default:0},emailStatus:{type:String,enum:['PENDING','PROCESSING','ACCEPTED','FAILED'],default:'PENDING'},attempts:{type:Number,default:0},leaseUntil:Date,nextAttemptAt:{type:Date,default:Date.now},providerId:String,firstAttemptAt:Date},{timestamps:true,strict:'throw',autoCreate:false,autoIndex:false,collection:'platform_leads_v2'});
leadSchema.index({requestId:1},{unique:true});leadSchema.index({status:1,createdAt:-1});leadSchema.index({emailStatus:1,nextAttemptAt:1});
export const EMAIL_TRANSPORT=Symbol('lead-email-transport');
export interface LeadEmailTransport { configured():boolean;send(lead:any):Promise<string> }
@Injectable()
export class ResendLeadTransport implements LeadEmailTransport {
 configured(){return process.env.LEAD_EMAIL_ENABLED==='true'&&process.env.NODE_ENV!=='test'&&!!process.env.RESEND_API_KEY&&!!process.env.LEAD_EMAIL_FROM;}
 async send(lead:any){
  const text=`Solicitação de solução — Thiago Solutions Digitais\n\nNome: ${lead.name}\nTelefone: ${lead.phone}\nE-mail: ${lead.email}\n\nProblema informado:\n${lead.problem}\n\nSugestão: ${lead.recommendation.plan?.name??'Módulos personalizados / análise'}\n${lead.recommendation.modules.map((m:any)=>`${m.name}: ${m.reason}`).join('\n')}\n\nReferência: ${lead.requestId}`;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`lead-${lead.requestId}`},body:JSON.stringify({from:process.env.LEAD_EMAIL_FROM,to:['thiagofernandess158@gmail.com'],reply_to:lead.email,subject:'Nova solicitação de solução — Thiago Solutions Digitais',text}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Email provider did not accept delivery');const data=await response.json() as {id?:string};if(!data.id)throw new Error('Missing provider receipt');return data.id;
 }
}
@Injectable()
export class PortfolioService implements OnModuleInit,OnModuleDestroy {
 private timer?:ReturnType<typeof setInterval>;private processing=false;
 constructor(@InjectModel('PlatformLead') private leads:Model<any>,private access:TenantAccessService,private audit:AuditService,@Inject(EMAIL_TRANSPORT) private email:LeadEmailTransport){}
 onModuleInit(){if(this.email.configured()){this.timer=setInterval(()=>void this.deliver().catch(()=>{}),15000);this.timer.unref();}}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async submit(d:LeadDto){
  let indexes:any[];try{indexes=await this.leads.collection.indexes();}catch{throw new ServiceUnavailableException('Captação ainda não provisionada.');}
  if(!indexes.some(i=>i.unique&&i.key.requestId===1&&Object.keys(i.key).length===1))throw new ServiceUnavailableException('Captação ainda não provisionada.');
  const fingerprint=createHash('sha256').update(JSON.stringify({name:d.name,email:d.email,phone:d.phone,problem:d.problem,needs:[...d.needs].sort()})).digest('hex');
  let existing=await this.leads.findOne({requestId:d.requestId}).select('+fingerprint');
  if(!existing){try{existing=await this.leads.create({name:d.name,email:d.email,phone:d.phone,problem:d.problem,needs:d.needs,requestId:d.requestId,fingerprint,recommendation:recommend(d.problem,d.needs),consentVersion:PORTFOLIO_VERSION,consentedAt:new Date()});}catch(e){if((e as any).code!==11000)throw e;existing=await this.leads.findOne({requestId:d.requestId}).select('+fingerprint');}}
  if(!existing||existing.fingerprint!==fingerprint)throw new ConflictException('Solicitação já registrada com outros dados. Atualize o formulário.');
  return {received:true,reference:d.requestId,recommendation:recommendationView(existing.recommendation),message:'Solicitação registrada. Nossa equipe poderá entrar em contato pelos dados informados.'};
 }
 async list(u:AuthUser,q:LeadsQuery){await this.access.check(u,[UserRole.PLATFORM_ADMIN],true);const filter:any={...(q.status?{status:q.status}:{})};if(q.search){const term=q.search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.$or=['name','email','phone'].map(k=>({[k]:{$regex:term,$options:'i'}}));}return {items:(await this.leads.find(filter).select('-fingerprint -__v -leaseUntil').sort({createdAt:-1,_id:-1}).skip((q.page-1)*q.limit).limit(q.limit).lean()).map(leadView),total:await this.leads.countDocuments(filter),page:q.page,limit:q.limit,emailConfigured:this.email.configured()};}
 async state(u:AuthUser,id:string,d:LeadStateDto){await this.access.check(u,[UserRole.PLATFORM_ADMIN],true);if(!/^[a-f\d]{24}$/i.test(id))throw new BadRequestException('Identificador inválido.');return this.access.transaction(async session=>{const row=await this.leads.findOneAndUpdate({_id:id,version:d.version},{$set:{status:d.status,note:d.reason},$inc:{version:1}},{returnDocument:'after',session}).select('-fingerprint');if(!row)throw new ConflictException('Solicitação ausente ou alterada. Atualize a lista.');await this.audit.record('lead.status.changed','success',u,'leads',id,undefined,session);return leadView(row);});}
 async deliver(){
  if(this.processing||!this.email.configured())return;this.processing=true;
  try{const now=new Date();const lead=await this.leads.findOneAndUpdate({$or:[{emailStatus:'PENDING',attempts:{$lt:5},nextAttemptAt:{$lte:now}},{emailStatus:'PROCESSING',leaseUntil:{$lte:now}}]},{$set:{emailStatus:'PROCESSING',leaseUntil:new Date(Date.now()+120000)},$inc:{attempts:1}},{sort:{createdAt:1},returnDocument:'after'});
   if(!lead)return;if(lead.attempts>5||(lead.firstAttemptAt&&Date.now()-lead.firstAttemptAt.getTime()>20*3600000)){await this.leads.updateOne({_id:lead._id},{$set:{emailStatus:'FAILED'},$unset:{leaseUntil:1}});return;}if(!lead.firstAttemptAt)await this.leads.updateOne({_id:lead._id},{$set:{firstAttemptAt:now}});try{const providerId=await this.email.send(leadView(lead));await this.leads.updateOne({_id:lead._id,emailStatus:'PROCESSING',attempts:lead.attempts},{$set:{emailStatus:'ACCEPTED',providerId},$unset:{leaseUntil:1}});}catch{await this.leads.updateOne({_id:lead._id,emailStatus:'PROCESSING',attempts:lead.attempts},{$set:{emailStatus:lead.attempts>=5?'FAILED':'PENDING',nextAttemptAt:new Date(Date.now()+Math.pow(2,lead.attempts)*60000)},$unset:{leaseUntil:1}});}
  }finally{this.processing=false;}
 }
}
@Controller('public/solutions')
class PublicSolutionsController {
 private limiter=new WindowLimiter();
 constructor(private service:PortfolioService,@InjectModel('CommercialOffer') private offers:Model<any>){}
 @Public() @Get() async catalog(){
  const latest=await this.offers.aggregate([{$sort:{code:1,version:-1}},{$group:{_id:'$code',offer:{$first:'$$ROOT'}}},{$replaceRoot:{newRoot:'$offer'}},{$sort:{order:1,code:1}}]);
  const benefits:Record<string,string>={BASIC:'Para começar a organizar o catálogo e as vendas do dia, com uma rotina simples para a equipe.',OPERATIONAL:'Para acompanhar abastecimento, estoque e produção junto das vendas, reduzindo controles separados.',MANAGEMENT:'Para quem precisa acompanhar despesas, caixa e informações contábeis além da operação.',COMPLETE:'Para ampliar os controles de gestão, documentos e acessos dentro da composição apresentada abaixo.'};
  const commercialPlans=contractableOffers(latest).filter(o=>o.kind==='PLAN').map(o=>({code:o.code,name:o.name,modules:o.modules,benefit:benefits[o.code]??'Uma combinação de módulos para organizar os processos abaixo. Confira se todos fazem sentido para sua rotina.',activeUsers:o.limits.activeUsers}));
  return {version:PORTFOLIO_VERSION,services:SERVICES.map(({keywords,...s})=>s),plans:SEGMENT_PLANS,commercialPlans};
 }
 @Public() @Post('recommend') recommend(@Body() d:ProblemDto,@Req() req:any){this.limiter.hit(`recommend:${req.ip}`,10);return recommend(d.problem,d.needs);}
 @Public() @Post('contact') submit(@Body() d:LeadDto,@Req() req:any){this.limiter.hit(`contact:${req.ip}`,5);return this.service.submit(d);}
}
@Controller('platform/leads') @Roles(UserRole.PLATFORM_ADMIN)
class LeadsController {
 constructor(private service:PortfolioService){}
 @Get() list(@CurrentUser() u:AuthUser,@Query() q:LeadsQuery){return this.service.list(u,q);}
 @Post(':id/status') state(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:LeadStateDto){return this.service.state(u,id,d);}
}
@Module({imports:[MongooseModule.forFeature([{name:'PlatformLead',schema:leadSchema},{name:'CommercialOffer',schema:CommercialOfferSchema}])],controllers:[PublicSolutionsController,LeadsController],providers:[PortfolioService,{provide:EMAIL_TRANSPORT,useClass:ResendLeadTransport}]})
export class PortfolioModule {}
