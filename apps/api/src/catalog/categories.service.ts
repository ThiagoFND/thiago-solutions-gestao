import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category } from './category.schema.js';
import { Product } from '../products/product.schema.js';
import { TenantAccessService } from '../tenants/tenant-access.service.js';
import { AuthUser } from '../common/auth-user.js';
import { CategoryDto, CatalogQuery, MoveProductsDto, CategoryOrderDto, normalized, literalSearch } from './catalog.dto.js';
import { validateImageReferences } from './image-references.js';
@Injectable()
export class CategoriesService {
  constructor(@InjectModel(Category.name) private readonly model: Model<Category>, @InjectModel(Product.name) private readonly products: Model<Product>, private readonly access: TenantAccessService) {}
  async list(q: CatalogQuery, u: AuthUser) {
    const actor = await this.access.require(u, ['categorias.visualizar']);
    const filter = { tenantId: actor.tenantId, ...(q.search ? { name: { $regex: literalSearch(q.search), $options: 'i' } } : {}) };
    const items = await this.model.find(filter).sort({ internalOrder: 1, _id: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean();
    const total = await this.model.countDocuments(filter); return { items, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) };
  }
  async create(dto: CategoryDto, u: AuthUser) {
    const actor = await this.access.require(u, ['categorias.criar']);
    await validateImageReferences(this.access.connection,actor.tenantId!,[dto.imageUrl]);
    if (await this.model.countDocuments({ tenantId: actor.tenantId }) >= 100) throw new BadRequestException('Limite de 100 categorias por empresa.');
    const { version, ...fields } = dto;
    return this.access.limitedCreation(actor.tenantId!, 'categories', async session => (await this.model.create([{ ...fields, normalizedName: normalized(dto.name), tenantId: actor.tenantId!, updatedById: actor.sub }], { session }))[0]);
  }
  async update(id: string, dto: CategoryDto, u: AuthUser) {
    const actor = await this.access.require(u, ['categorias.editar']);
    await validateImageReferences(this.access.connection,actor.tenantId!,[dto.imageUrl]);
    const current = await this.model.findOne({ _id: id, tenantId: actor.tenantId });
    if (!current) throw new NotFoundException('Categoria não encontrada.');
    if (dto.version !== current.version) throw new ConflictException('Categoria alterada. Atualize a tela.');
    const { version, ...fields } = dto;
    const updated = await this.model.findOneAndUpdate({ _id: id, tenantId: actor.tenantId, version }, { $set: { ...fields, normalizedName: normalized(dto.name), updatedById: actor.sub }, $inc: { version: 1 } }, { new: true, runValidators: true });
    if (!updated) throw new ConflictException('Categoria alterada. Atualize a tela.'); return updated;
  }
  async linked(id: string, q: CatalogQuery, u: AuthUser) {
    const actor = await this.access.require(u, ['categorias.visualizar', 'produtos.visualizar']);
    if (!await this.model.exists({ _id: id, tenantId: actor.tenantId })) throw new NotFoundException('Categoria não encontrada.');
    const filter = { tenantId: actor.tenantId, categoryId: new Types.ObjectId(id) };
    const items = await this.products.find(filter).select('_id name active').sort({ internalOrder: 1, _id: 1 }).skip((q.page - 1) * q.limit).limit(q.limit);
    const total = await this.products.countDocuments(filter); return { items, total, page: q.page, limit: q.limit, totalPages: Math.ceil(total / q.limit) };
  }
  async move(id: string, dto: MoveProductsDto, u: AuthUser) {
    if (id === dto.destinationId) throw new BadRequestException('Selecione outra categoria.');
    return this.access.transaction(async session => {
      const actor = await this.access.require(u, ['categorias.editar', 'produtos.editar'], session);
      const source = await this.model.findOneAndUpdate({ _id: id, tenantId: actor.tenantId, version: dto.version }, { $inc: { version: 1 }, $set: { updatedById: actor.sub } }, { session });
      const destination = await this.model.findOneAndUpdate({ _id: dto.destinationId, tenantId: actor.tenantId, active: true, archived: false }, { $inc: { version: 1 } }, { session });
      if (!source || !destination) throw new ConflictException('Categorias indisponíveis ou alteradas.');
      const result = await this.products.updateMany({ tenantId: actor.tenantId, categoryId: source._id }, { $set: { categoryId: destination._id, category: destination.name, updatedById: actor.sub }, $inc: { version: 1 } }, { session, runValidators: true });
      return { moved: result.modifiedCount };
    });
  }
  async order(id:string,dto:CategoryOrderDto,u:AuthUser){
    return this.access.transaction(async session=>{
      const actor=await this.access.require(u,['categorias.ordenar'],session);
      const rows=await this.model.find({tenantId:actor.tenantId}).sort({[dto.scope]:1,_id:1}).session(session);
      const index=rows.findIndex(c=>String(c._id)===id);if(index<0)throw new NotFoundException('Categoria não encontrada.');
      if(rows[index].version!==dto.version)throw new ConflictException('Categoria alterada. Atualize a tela.');
      const destination=index+(dto.direction==='UP'?-1:1);if(destination<0||destination>=rows.length)return {moved:false};
      [rows[index],rows[destination]]=[rows[destination],rows[index]];
      for(let order=0;order<rows.length;order++){
        const row=rows[order];const result=await this.model.updateOne({_id:row._id,tenantId:actor.tenantId,version:row.version},{$set:{[dto.scope]:order,updatedById:actor.sub},$inc:{version:1}},{session,runValidators:true});
        if(result.modifiedCount!==1)throw new ConflictException('Ordem alterada. Atualize a tela.');
      }
      return {moved:true};
    });
  }
}
