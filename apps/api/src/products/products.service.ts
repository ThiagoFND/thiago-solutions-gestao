import { StockMovement } from '../productions/stock-movement.schema.js';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import { Model, Types } from 'mongoose';
import { AuthUser } from '../common/auth-user.js';
import { UserRole, ProductOrigin, StockMovementType, AvailabilityMode, SupplyMode } from '../common/enums.js';
import { Category } from '../catalog/category.schema.js';
import { supplyOf } from '../catalog/availability.js';
import { validateImageReferences } from '../catalog/image-references.js';
import { Product } from './product.schema.js';
import { CreateProductDto, UpdateProductDto, ProductPurchaseDto } from './dto/product.dto.js';

@Injectable()
export class ProductsService {
  constructor(@InjectModel(Product.name) private readonly model: Model<Product>, private readonly access: TenantAccessService, @InjectModel(StockMovement.name) private readonly movements:Model<StockMovement>) {}

  async list(activeOnly = false, user?: AuthUser, page = 1, limit = 100) {
    const tenantId = await this.access.scope(user!, [...OWNERS, UserRole.CASHIER, UserRole.KITCHEN]);
    const role = user!.role;
    const owner = OWNERS.includes(role!) || !!user!.permissions?.some(p => ['produtos.criar', 'produtos.editar'].includes(p));
    const filter: Record<string, unknown> = activeOnly || !owner ? { active: true } : {};
    const kitchen = !owner && !user!.permissions?.includes('vendas.visualizar') && role === UserRole.KITCHEN;
    if(kitchen) filter.origin=ProductOrigin.PRODUCED;
    const projection = owner ? '' : !kitchen ? '_id name category categoryId priceCents availableStock availabilityMode supplyMode active imageUrl origin internalOrder' : '_id name category categoryId availableStock minimumStock availabilityMode supplyMode active origin internalOrder';
    const rows = await this.model.find({ ...filter, tenantId }).select(projection).sort({ internalOrder: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean();
    const categories = await this.access.connection.model<Category>(Category.name).find({ tenantId, _id: { $in: rows.map(p => p.categoryId).filter(Boolean) } }).select('_id name internalOrder').lean();
    const map = new Map(categories.map(c => [String(c._id), c]));
    return rows.map(p => ({ ...p, category: map.get(String(p.categoryId))?.name ?? p.category, categoryOrder: map.get(String(p.categoryId))?.internalOrder ?? 1000000, supplyMode: supplyOf(p) }));
  }

  async get(id: string, user: AuthUser) {
    const product = await this.model.findOne({ _id: id, tenantId: await this.access.scope(user, [...OWNERS, UserRole.KITCHEN]) });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  private async fields(dto: CreateProductDto | UpdateProductDto, tenantId: Types.ObjectId, previous?: Product) {
    await validateImageReferences(this.access.connection,tenantId,[dto.imageUrl,...dto.additionalImages??[]]);
    const { category: ignored, version, ...fields } = dto;
    const categoryId = dto.categoryId ?? previous?.categoryId;
    if (!categoryId) throw new BadRequestException('Selecione uma categoria cadastrada.');
    const category = await this.access.connection.model<Category>(Category.name).findOne({ _id: categoryId, tenantId, active: true, archived: false });
    if (!category) throw new BadRequestException('Categoria inválida ou inativa.');
    const supplyMode = dto.supplyMode ?? (previous ? supplyOf(previous) : undefined);
    if (!supplyMode) throw new BadRequestException('Selecione a forma de fornecimento.');
    const demand = supplyMode !== SupplyMode.CONTROLADO_POR_ESTOQUE;
    const origin = demand ? supplyMode === SupplyMode.PRODUZIDO_SOB_DEMANDA ? ProductOrigin.PRODUCED : ProductOrigin.PURCHASED_FOR_RESALE : dto.origin ?? previous?.origin;
    if (demand && dto.origin !== undefined && dto.origin !== origin) throw new BadRequestException('Origem incompatível com a forma de fornecimento.');
    const availabilityMode = demand ? AvailabilityMode.MADE_TO_ORDER : AvailabilityMode.PRODUCTION_CONTROLLED;
    if (dto.availabilityMode && dto.availabilityMode !== availabilityMode) throw new BadRequestException('Disponibilidade incompatível com o fornecimento.');
    return { ...fields, imageUrl:dto.imageUrl===''?undefined:dto.imageUrl, categoryId: category._id, category: category.name, supplyMode, origin, availabilityMode,
      ...(demand && (!previous || supplyOf(previous) !== supplyMode) ? { published: true } : {}) };
  }
  async create(dto: CreateProductDto, user: AuthUser) {
    const tenantId = await this.access.scope(user, OWNERS);
    const fields = { ...await this.fields(dto, tenantId), tenantId, updatedById: user.sub };
    return this.access.limitedCreation(String(tenantId), 'products', async session => (await this.model.create([fields], { session }))[0]);
  }

  async update(id: string, dto: UpdateProductDto, user: AuthUser) {
    const tenantId = await this.access.scope(user, OWNERS);
    const current = await this.model.findOne({ _id: id, tenantId });
    if (!current) throw new NotFoundException('Produto não encontrado');
    if (dto.version !== current.version) throw new ConflictException('Produto alterado. Atualize a tela.');
    const versionFilter=current.version===0?{$or:[{version:0},{version:{$exists:false}}]}:{version:current.version};
    const product = await this.model.findOneAndUpdate({ _id: id, tenantId, ...versionFilter }, { $set: { ...await this.fields(dto, tenantId, current), updatedById: user.sub }, ...(dto.imageUrl===''?{$unset:{imageUrl:1}}:{}), $inc: { version: 1 } }, { new: true, runValidators: true });
    if (!product) throw new ConflictException('Produto alterado. Atualize a tela.');
    return product;
  }

  async purchase(id:string,dto:ProductPurchaseDto,user:AuthUser){
    const tenantId=await this.access.scope(user,OWNERS);
    return this.access.transaction(async session=>{
      await this.access.check(user,OWNERS,false,session);
      const product=await this.model.findOne({_id:id,tenantId}).session(session);
      if(!product)throw new NotFoundException('Produto não encontrado.');
      if(product.origin!==ProductOrigin.PURCHASED_FOR_RESALE)throw new BadRequestException('Entrada por compra é exclusiva de produtos de revenda.');
      const updated=await this.model.findOneAndUpdate({_id:id,tenantId,active:true,origin:ProductOrigin.PURCHASED_FOR_RESALE,availableStock:{$lte:1000000-dto.quantity}},{$inc:{availableStock:dto.quantity}},{session,new:true});
      if(!updated)throw new ConflictException('Produto indispon?vel ou limite de estoque atingido.');
      await this.movements.create([{tenantId,productId:product._id,productName:product.name,quantityChange:dto.quantity,type:StockMovementType.PURCHASE,referenceId:new Types.ObjectId().toString(),userId:user.sub,userName:user.name}],{session});
      return updated;
    });
  }
  modelRef() { return this.model; }
}
