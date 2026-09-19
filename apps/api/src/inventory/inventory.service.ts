import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { ProductOrigin, StockMovementType, UserRole } from '../common/enums.js';
import { Product } from '../products/product.schema.js';
import { Production } from '../productions/production.schema.js';
import { StockMovement } from '../productions/stock-movement.schema.js';
import { FinancialEntry } from '../finance/schemas/financial-entry.schema.js';
import { EntryKind, FinancialStatus, FinancialType } from '../finance/finance.enums.js';
import { normalizedName, safeSum } from '../finance/finance.helpers.js';
import { Ingredient, IngredientMovement, IngredientReceipt, Recipe } from './inventory.schema.js';
import { IngredientDto, ReceiptDto, RecipeDto } from './inventory.dto.js';
import type { CreateProductionDto } from '../productions/dto/create-production.dto.js';
const READ = [...OWNERS, UserRole.KITCHEN];
const SCALE = 1_000_000;
export function toMicros(value: number) {
  const scaled = Math.round(value * SCALE);
  if (!Number.isFinite(value) || !Number.isSafeInteger(scaled) || scaled < 0 || scaled > 1e12 || value !== scaled / SCALE) throw new BadRequestException('Quantidade inválida; use até seis casas decimais.');
  return scaled;
}
function proportional(value: number, part: number, total: number) {
  return Number((BigInt(value) * BigInt(part) + BigInt(total) / 2n) / BigInt(total));
}
@Injectable()
export class InventoryService {
  constructor(private readonly access: TenantAccessService,
    @InjectModel(Ingredient.name) private readonly ingredients: Model<Ingredient>,
    @InjectModel(Recipe.name) private readonly recipes: Model<Recipe>,
    @InjectModel(IngredientReceipt.name) private readonly receipts: Model<IngredientReceipt>,
    @InjectModel(IngredientMovement.name) private readonly movements: Model<IngredientMovement>,
    @InjectModel(FinancialEntry.name) private readonly entries: Model<FinancialEntry>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Production.name) private readonly productions: Model<Production>,
    @InjectModel(StockMovement.name) private readonly stockMovements: Model<StockMovement>) {}
  private id(value: string) { if (!/^[a-f\d]{24}$/i.test(value)) throw new BadRequestException('Identificador inválido.'); return new Types.ObjectId(value); }
  private ingredient(row: any) { return { _id: row._id, name: row.name, unit: row.unit, stock: row.stockMicros / SCALE, minimumStock: row.minimumMicros / SCALE, stockValueCents: row.stockValueCents, averageUnitCostCents: row.stockMicros ? row.stockValueCents * SCALE / row.stockMicros : null, version: row.version }; }
  async list(user: AuthUser, page = 1, limit = 100) {
    const tenantId = await this.access.scope(user, READ);
    const [rows,total] = await Promise.all([this.ingredients.find({tenantId}).sort({name:1,_id:1}).skip((page-1)*limit).limit(limit).lean(),this.ingredients.countDocuments({tenantId})]);
    return {items:rows.map(row=>this.ingredient(row)),total,page,limit,totalPages:Math.ceil(total/limit)};
  }
  async create(dto: IngredientDto, user: AuthUser) {
    const tenantId = await this.access.scope(user, OWNERS);
    try { return this.ingredient((await this.ingredients.create({tenantId,name:dto.name,normalizedName:normalizedName(dto.name),unit:dto.unit,minimumMicros:toMicros(dto.minimumStock??0)})).toObject()); }
    catch(e) { if((e as any).code===11000)throw new ConflictException('Já existe um insumo com esse nome.');throw e; }
  }
  async purchases(user: AuthUser, page=1, limit=100) {
    const tenantId=await this.access.scope(user,OWNERS);
    const filter={tenantId,entryKind:EntryKind.INPUT_PURCHASE,status:{$ne:FinancialStatus.CANCELADO},type:FinancialType.CUSTO_PRODUCAO,quantity:{$gt:0}};
    const [items,total]=await Promise.all([this.entries.find(filter).select('_id description quantity unit expectedAmountCents purchaseDate status').sort({_id:-1}).skip((page-1)*limit).limit(limit).lean(),this.entries.countDocuments(filter)]);
    const linked=await this.receipts.find({tenantId,financialEntryId:{$in:items.map(x=>x._id)}}).select('financialEntryId').lean();
    const ids=new Set(linked.map(x=>String(x.financialEntryId)));
    return {items:items.map(x=>({...x,received:ids.has(String(x._id))})),total,page,limit,totalPages:Math.ceil(total/limit)};
  }
  async receive(dto:ReceiptDto,user:AuthUser) {
    const tenantId=await this.access.scope(user,OWNERS),financialEntryId=this.id(dto.financialEntryId),ingredientId=this.id(dto.ingredientId);
    const existing=async()=>this.receipts.findOne({tenantId,financialEntryId}).lean();
    const validateExisting=(row:any)=>{if(String(row.ingredientId)!==String(ingredientId))throw new ConflictException('Compra já recebida em outro insumo.');return row;};
    const previous=await existing();if(previous)return validateExisting(previous);
    try { return await this.access.transaction(async session=>{
      await this.access.check(user,OWNERS,false,session);
      const previous=await this.receipts.findOne({tenantId,financialEntryId}).session(session);if(previous)return validateExisting(previous.toObject());
      const entry=await this.entries.findOne({tenantId,_id:financialEntryId}).session(session);
      const ingredient=await this.ingredients.findOne({tenantId,_id:ingredientId}).session(session);
      if(!entry||!ingredient)throw new NotFoundException('Compra ou insumo não encontrado.');
      if(entry.entryKind!==EntryKind.INPUT_PURCHASE||entry.status===FinancialStatus.CANCELADO||entry.type!==FinancialType.CUSTO_PRODUCAO||!entry.quantity||!entry.unit||!entry.purchaseDate)throw new BadRequestException('Selecione uma compra de insumo do tipo custo de produção, não cancelada, com quantidade, unidade e data.');
      if(entry.unit!==ingredient.unit)throw new BadRequestException('A unidade da compra deve ser igual à unidade do insumo.');
      const quantityMicros=toMicros(entry.quantity),costCents=entry.expectedAmountCents;
      if(ingredient.stockMicros+quantityMicros>1e12||ingredient.stockValueCents+costCents>1e12)throw new ConflictException('Limite de estoque ou valor do insumo excedido.');
      await this.ingredients.updateOne({tenantId,_id:ingredientId},{$inc:{stockMicros:quantityMicros,stockValueCents:costCents,version:1}},{session,runValidators:true});
      const [receipt]=await this.receipts.create([{tenantId,ingredientId,financialEntryId,quantityMicros,costCents,unit:entry.unit,purchaseDate:entry.purchaseDate,description:entry.description,financialVersion:entry.version,createdById:this.id(user.sub)}],{session});
      await this.movements.create([{tenantId,ingredientId,referenceId:receipt._id,type:'RECEIPT',quantityChangeMicros:quantityMicros,valueChangeCents:costCents,createdById:this.id(user.sub)}],{session});
      return receipt.toObject();
    }); } catch(e){if((e as any).code===11000){const row=await existing();if(row)return validateExisting(row);}throw e;}
  }
  async recipe(product:string,user:AuthUser) {
    const tenantId=await this.access.scope(user,READ),productId=this.id(product);
    if(!await this.products.exists({tenantId,_id:productId}))throw new NotFoundException('Produto não encontrado.');
    const row=await this.recipes.findOne({tenantId,productId}).lean();
    return row?{_id:row._id,productId:row.productId,yieldQuantity:row.yieldQuantity,version:row.version,components:row.components.map(c=>({ingredientId:c.ingredientId,quantity:c.quantityMicros/SCALE}))}:null;
  }
  async saveRecipe(product:string,dto:RecipeDto,user:AuthUser) {
    const tenantId=await this.access.scope(user,OWNERS),productId=this.id(product);
    const ids=dto.components.map(c=>String(this.id(c.ingredientId)));
    if(new Set(ids).size!==ids.length)throw new BadRequestException('Não repita insumos na ficha.');
    if(!await this.products.exists({tenantId,_id:productId,origin:ProductOrigin.PRODUCED,active:true}))throw new BadRequestException('Selecione um produto ativo de fabricação própria.');
    if(await this.ingredients.countDocuments({tenantId,_id:{$in:ids.map(x=>this.id(x))}})!==ids.length)throw new NotFoundException('Insumo não encontrado.');
    const data={yieldQuantity:dto.yieldQuantity,components:dto.components.map(c=>({ingredientId:this.id(c.ingredientId),quantityMicros:toMicros(c.quantity)}))};
    const current=await this.recipes.findOne({tenantId,productId}).lean();
    if(current){if(dto.version!==current.version)throw new ConflictException('A ficha foi alterada. Recarregue antes de salvar.');const updated=await this.recipes.updateOne({tenantId,productId,version:current.version},{$set:data,$inc:{version:1}});if(!updated.modifiedCount)throw new ConflictException('A ficha foi alterada.');}
    else {if(dto.version!==undefined)throw new ConflictException('Ficha inexistente; recarregue.');try{await this.recipes.create({tenantId,productId,...data});}catch(e){if((e as any).code===11000)throw new ConflictException('Ficha criada por outra sessão. Recarregue.');throw e;}}
    return this.recipe(product,user);
  }
  async cost(product:string,user:AuthUser) {
    const tenantId=await this.access.scope(user,READ),productId=this.id(product),recipe=await this.recipes.findOne({tenantId,productId}).lean();
    if(!await this.products.exists({tenantId,_id:productId}))throw new NotFoundException('Produto não encontrado.');
    if(!recipe)return {available:false,reason:'Produto sem ficha técnica.',totalCostCents:null,unitCostCents:null,components:[]};
    let total=0,available=true;
    const components=[];
    for(const c of recipe.components){const item=await this.ingredients.findOne({tenantId,_id:c.ingredientId}).lean();const cost=item&&item.stockMicros>0?proportional(item.stockValueCents,c.quantityMicros,item.stockMicros):null;if(cost===null)available=false;else total=safeSum(total,cost);components.push({ingredientId:c.ingredientId,name:item?.name,unit:item?.unit,quantity:c.quantityMicros/SCALE,stock:(item?.stockMicros??0)/SCALE,costCents:cost});}
    return {available,reason:available?null:'Há insumos sem saldo para calcular o custo médio.',yieldQuantity:recipe.yieldQuantity,version:recipe.version,totalCostCents:available?total:null,unitCostCents:available?total/recipe.yieldQuantity:null,components};
  }
  async produceIfRecipe(dto:CreateProductionDto,user:AuthUser):Promise<any|null> {
    const tenantId=await this.access.scope(user,READ),productId=this.id(dto.productId);
    const validatePrevious=(p:any)=>{if(String(p.productId)!==String(productId)||p.quantity!==dto.quantity)throw new ConflictException('Identificador de produção já usado com outros dados.');return {production:p,product:null,replayed:true};};
    if(dto.idempotencyKey){const p=await this.productions.findOne({tenantId,idempotencyKey:dto.idempotencyKey}).lean();if(p)return validatePrevious(p);}
    if(!await this.recipes.exists({tenantId,productId}))return null;
    if(!dto.idempotencyKey)throw new BadRequestException('Informe um identificador único para confirmar a produção com ficha.');
    try{return await this.access.transaction(async session=>{
      await this.access.check(user,READ,false,session);
      const previous=await this.productions.findOne({tenantId,idempotencyKey:dto.idempotencyKey}).session(session);if(previous)return validatePrevious(previous.toObject());
      const recipe=await this.recipes.findOneAndUpdate({tenantId,productId},{$inc:{usageRevision:1}},{session,new:true});
      if(!recipe)throw new ConflictException('Ficha indisponível. Recarregue.');
      const product=await this.products.findOne({tenantId,_id:productId,active:true,origin:ProductOrigin.PRODUCED}).session(session);
      if(!product)throw new BadRequestException('Produto indisponível para produção.');
      if(product.availableStock+dto.quantity>1e6)throw new ConflictException('Limite de estoque excedido.');
      const productionId=new Types.ObjectId();let totalCost=0;
      for(const component of recipe.components){
        const numerator=BigInt(component.quantityMicros)*BigInt(dto.quantity);
        if(numerator%BigInt(recipe.yieldQuantity)!==0n)throw new BadRequestException('Quantidade produzida exige fração menor que seis casas. Ajuste a ficha ou o lote.');
        const consumed=Number(numerator/BigInt(recipe.yieldQuantity));
        const ingredient=await this.ingredients.findOne({tenantId,_id:component.ingredientId}).session(session);
        if(!ingredient||ingredient.stockMicros<consumed)throw new ConflictException(`Estoque insuficiente: ${ingredient?.name??'insumo'}.`);
        const cost=proportional(ingredient.stockValueCents,consumed,ingredient.stockMicros);totalCost=safeSum(totalCost,cost);
        await this.ingredients.updateOne({tenantId,_id:ingredient._id},{$inc:{stockMicros:-consumed,stockValueCents:-cost,version:1}},{session,runValidators:true});
        await this.movements.create([{tenantId,ingredientId:ingredient._id,referenceId:productionId,type:'PRODUCTION',quantityChangeMicros:-consumed,valueChangeCents:-cost,createdById:this.id(user.sub)}],{session});
      }
      const updated=await this.products.findOneAndUpdate({tenantId,_id:productId},{$inc:{availableStock:dto.quantity}},{session,new:true,runValidators:true});
      const [production]=await this.productions.create([{_id:productionId,tenantId,productId,productName:product.name,quantity:dto.quantity,idempotencyKey:dto.idempotencyKey,recipeVersion:recipe.version,ingredientCostCents:totalCost,ingredientCostPerUnitCents:totalCost/dto.quantity,createdById:this.id(user.sub),createdByName:user.name}],{session});
      await this.stockMovements.create([{tenantId,productId,productName:product.name,quantityChange:dto.quantity,type:StockMovementType.PRODUCTION,referenceId:String(productionId),userId:this.id(user.sub),userName:user.name}],{session});
      return {production:production.toObject(),product:updated,replayed:false};
    });}catch(e){if((e as any).code===11000){const previous=await this.productions.findOne({tenantId,idempotencyKey:dto.idempotencyKey}).lean();if(previous)return validatePrevious(previous);}throw e;}
  }
}
