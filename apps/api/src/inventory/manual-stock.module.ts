import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema } from 'mongoose';
import { IsIn, IsInt, IsMongoId, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { PageQueryDto } from '../common/query.dto.js';
import { toMicros } from './inventory.service.js';
const oid={type:Schema.Types.ObjectId,required:true};
const schema=new Schema({tenantId:{...oid,immutable:true},actorId:oid,requestId:{type:String,required:true},inputHash:String,kind:{type:String,enum:['PRODUCT','INGREDIENT'],required:true},targetId:oid,name:String,unit:String,direction:{type:String,enum:['IN','OUT'],required:true},quantity:Number,costCents:Number,reference:{type:String,required:true,maxlength:100},reason:{type:String,required:true,maxlength:1000},balanceAfter:Number},{timestamps:true,strict:'throw',autoCreate:false,autoIndex:false,collection:'manual_stock_records_v2'});
schema.index({tenantId:1,requestId:1},{unique:true});schema.index({tenantId:1,reference:1},{unique:true});schema.index({tenantId:1,kind:1,targetId:1,createdAt:-1});
export const MANUAL_STOCK_MODELS=[{name:'ManualStockRecord',schema}];
class StockQuery extends PageQueryDto {@IsIn(['PRODUCT','INGREDIENT']) kind:string='PRODUCT';@IsOptional() @IsString() @MaxLength(120) search?:string;@IsOptional() @IsMongoId() targetId?:string;}
class ManualDto {
 @IsUUID('4') requestId!:string;
 @IsIn(['PRODUCT','INGREDIENT']) kind!:string;
 @IsMongoId() targetId!:string;
 @IsIn(['IN','OUT']) direction!:string;
 @IsNumber({allowNaN:false,allowInfinity:false}) @Min(0.000001) @Max(1000000) quantity!:number;
 @IsOptional() @IsInt() @Min(0) @Max(1000000000000) costCents?:number;
 @IsString() @MinLength(3) @MaxLength(100) reference!:string;
 @IsString() @MinLength(5) @MaxLength(1000) reason!:string;
}
@Injectable()
class ManualStockService {
 constructor(private store:OperationalStore){}
 async items(u:AuthUser,q:StockQuery){const a=await this.store.access.require(u,['estoque.visualizar']),r=await this.store.page(q.kind==='PRODUCT'?'Product':'Ingredient',{tenantId:a.tenantId,...(q.kind==='PRODUCT'?{active:true}:{}),...(q.search?{name:new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i')}:{})},q,{name:1,_id:1},q.kind==='PRODUCT'?'_id name availableStock':'_id name unit stockMicros stockValueCents minimumMicros');return {...r,items:r.items.map((v:any)=>({_id:v._id,name:v.name,unit:q.kind==='PRODUCT'?'UNIDADE':v.unit,stock:q.kind==='PRODUCT'?v.availableStock:v.stockMicros/1000000,minimum:q.kind==='PRODUCT'?null:v.minimumMicros/1000000}))};}
 async history(u:AuthUser,q:StockQuery){const a=await this.store.access.require(u,['estoque.visualizar']);return this.store.page('ManualStockRecord',{tenantId:a.tenantId,kind:q.kind,...(q.targetId?{targetId:q.targetId}:{})},q);}
 async move(u:AuthUser,d:ManualDto){const micros=toMicros(d.quantity);if(d.kind==='PRODUCT'&&!Number.isInteger(d.quantity))throw new BadRequestException('Produtos são movimentados em unidades inteiras.');if(d.kind==='INGREDIENT'&&d.direction==='IN'&&d.costCents===undefined)throw new BadRequestException('Informe o custo total recebido, inclusive zero quando não houver custo.');if((d.kind==='PRODUCT'||d.direction==='OUT')&&d.costCents!==undefined)throw new BadRequestException('Custo informado somente na entrada de insumos.');return this.store.write(u,'estoque.movimentar','inventory.manual.moved',MANUAL_STOCK_MODELS,async(a,s)=>{
  if(d.direction==='OUT')await this.store.access.require(a,['estoque.ajustar'],s);
  const previous=await this.store.replay('ManualStockRecord',a,d,s);if(previous)return previous;
  if(await this.store.model('ManualStockRecord').exists({tenantId:a.tenantId,reference:d.reference}).session(s))throw new ConflictException('Referência já movimentada. Consulte o histórico.');
  const model=this.store.model(d.kind==='PRODUCT'?'Product':'Ingredient'),row=await model.findOne({_id:this.store.id(d.targetId),tenantId:a.tenantId,...(d.kind==='PRODUCT'?{active:true}:{})}).session(s);if(!row)throw new NotFoundException('Item não encontrado.');
  const sign=d.direction==='IN'?1:-1,amount=d.kind==='PRODUCT'?d.quantity:micros,field=d.kind==='PRODUCT'?'availableStock':'stockMicros',before=row[field],after=before+sign*amount,max=d.kind==='PRODUCT'?1000000:1e12;
  if(!Number.isSafeInteger(after)||after<0||after>max)throw new ConflictException('Saldo insuficiente ou limite de estoque excedido.');
  let cost=d.kind==='INGREDIENT'?(d.direction==='IN'?d.costCents!:Number((BigInt(row.stockValueCents)*BigInt(micros)+BigInt(before)/2n)/BigInt(before))):0;
  if(d.kind==='INGREDIENT'&&(!Number.isSafeInteger(row.stockValueCents+sign*cost)||row.stockValueCents+sign*cost>1e12))throw new ConflictException('Limite do valor de estoque excedido.');
  row[field]=after;if(d.kind==='INGREDIENT')row.stockValueCents+=sign*cost;row.version=(row.version??0)+1;await row.save({session:s});
  const [record]=await this.store.model('ManualStockRecord').create([{...d,...this.store.fields(a,d),costCents:cost,name:row.name,unit:d.kind==='PRODUCT'?'UNIDADE':row.unit,balanceAfter:d.kind==='PRODUCT'?after:after/1000000}],{session:s});
  if(d.kind==='PRODUCT')await this.store.model('StockMovement').create([{tenantId:a.tenantId,productId:row._id,productName:row.name,quantityChange:sign*d.quantity,type:'ADMIN_ADJUSTMENT',referenceId:'manual:'+record._id,userId:a.sub,userName:a.name}],{session:s});
  else await this.store.model('IngredientMovement').create([{tenantId:a.tenantId,ingredientId:row._id,referenceId:record._id,type:'MANUAL',quantityChangeMicros:sign*micros,valueChangeCents:sign*cost,createdById:a.sub}],{session:s});
  return record;
 });}
}
@Controller('stock')
class ManualStockController {
 constructor(private service:ManualStockService){}
 @Get('items') @Permissions('estoque.visualizar') items(@CurrentUser() u:AuthUser,@Query() q:StockQuery){return this.service.items(u,q);}
 @Get('movements') @Permissions('estoque.visualizar') history(@CurrentUser() u:AuthUser,@Query() q:StockQuery){return this.service.history(u,q);}
 @Post('movements') @Permissions('estoque.movimentar') move(@CurrentUser() u:AuthUser,@Body() d:ManualDto){return this.service.move(u,d);}
}
@Module({imports:[MongooseModule.forFeature(MANUAL_STOCK_MODELS)],controllers:[ManualStockController],providers:[ManualStockService,OperationalStore]})
export class ManualStockModule {}
