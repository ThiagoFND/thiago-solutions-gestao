import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LandingConfig } from './landing.schema.js';
import { Category } from './category.schema.js';
import { Product } from '../products/product.schema.js';
import { TenantAccessService } from '../tenants/tenant-access.service.js';
import { AuthUser } from '../common/auth-user.js';
import { TenantStatus, SupplyMode, AvailabilityMode } from '../common/enums.js';
import { LandingDto } from './landing.dto.js';
import { CatalogQuery, literalSearch } from './catalog.dto.js';
import { publicAvailability } from './availability.js';
import { validateImageReferences } from './image-references.js';
import { EntitlementsService } from '../commerce/entitlements.service.js';
const publicFields = ['slug','publicName','logoUrl','coverUrl','slogan','description','presentation','theme','phone','whatsapp','publicEmail','address','hours','socialLinks','sections','additionalInfo','contactUrl','contactLabel','operatingNotice','shareTitle','shareDescription','showDemandLabel','showPrices'] as const;
@Injectable()
export class LandingService {
  constructor(@InjectModel(LandingConfig.name) private readonly pages: Model<LandingConfig>, @InjectModel(Category.name) private readonly categories: Model<Category>, @InjectModel(Product.name) private readonly products: Model<Product>, private readonly access: TenantAccessService, private readonly entitlements: EntitlementsService) {}
  async config(u: AuthUser) { const actor = await this.access.require(u, ['landing_page.visualizar']); return this.pages.findOne({ tenantId: actor.tenantId }).lean(); }
  async save(dto: LandingDto, u: AuthUser) {
    const actor = await this.access.require(u, ['landing_page.configurar']);
    await validateImageReferences(this.access.connection,actor.tenantId!,[dto.logoUrl,dto.coverUrl]);
    if (['api','admin','login','plataforma','empresa'].includes(dto.slug)) throw new BadRequestException('Este endereço é reservado.');
    const current = await this.pages.findOne({ tenantId: actor.tenantId });
    const { version, ...fields } = dto;
    if (!current) return this.pages.create({ ...fields, tenantId: actor.tenantId!, updatedById: actor.sub });
    if (version !== current.version) throw new ConflictException('Configuração alterada. Atualize a tela.');
    const result = await this.pages.findOneAndUpdate({ _id: current._id, tenantId: actor.tenantId, version }, { $set: { ...fields, updatedById: actor.sub }, $inc: { version: 1 } }, { new: true, runValidators: true });
    if (!result) throw new ConflictException('Configuração alterada. Atualize a tela.'); return result;
  }
  async publish(published: boolean, version: number, u: AuthUser) {
    const actor = await this.access.require(u, [published ? 'landing_page.publicar' : 'landing_page.despublicar']);
    const result = await this.pages.findOneAndUpdate({ tenantId: actor.tenantId, version }, { $set: { published, updatedById: actor.sub }, $inc: { version: 1 } }, { new: true, runValidators: true });
    if (!result) throw new ConflictException('Salve a configuração ou atualize a tela.'); return result;
  }
  async preview(q: CatalogQuery, u: AuthUser) {
    const actor = await this.access.require(u, ['landing_page.visualizar']);
    const config = await this.pages.findOne({ tenantId: actor.tenantId }).lean();
    if (!config) throw new NotFoundException('Salve a configuração antes de visualizar.');
    return this.project(config, q, true);
  }
  async publicPage(slug: string, q: CatalogQuery) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 70) throw new NotFoundException('Página não encontrada.');
    const config = await this.pages.findOne({ slug, published: true }).lean();
    if (!config) throw new NotFoundException('Página não encontrada.');
    return this.project(config, q, false);
  }
  private async project(config: LandingConfig, q: CatalogQuery, preview: boolean) {
    const company = await this.access.tenants.exists({ _id: config.tenantId, status: TenantStatus.ACTIVE });
    if (!company) throw new NotFoundException('Página não encontrada.');
    if (!await this.entitlements.has(String(config.tenantId), 'LANDING_PAGE')) throw new NotFoundException('Página não encontrada.');
    const inventory = await this.entitlements.has(String(config.tenantId), 'INVENTORY');
    const categories = await this.categories.find({ tenantId: config.tenantId, active: true, published: true, archived: false }).sort({ publicOrder: 1, _id: 1 }).limit(100).lean();
    const categoryIds = categories.filter(c => !q.category || String(c._id) === q.category).map(c => c._id);
    const filter: any = { tenantId: config.tenantId, categoryId: { $in: categoryIds }, active: true, published: true, manuallyHidden: { $ne: true } };
    if (q.search) filter.name = { $regex: literalSearch(q.search), $options: 'i' };
    if (inventory && config.hideUnavailable) filter.$or = [{ supplyMode: { $in: [SupplyMode.PRODUZIDO_SOB_DEMANDA, SupplyMode.COMPRADO_SOB_DEMANDA] } }, { supplyMode: { $exists: false }, availabilityMode: AvailabilityMode.MADE_TO_ORDER }, { availableStock: { $gt: 0 } }];
    const rows = await this.products.find(filter).select('name shortDescription description categoryId imageUrl additionalImages priceCents unit featured publicOrder active published manuallyHidden availableStock supplyMode availabilityMode origin').sort({ publicOrder: 1, _id: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean();
    const total = await this.products.countDocuments(filter);
    const map = new Map(categories.map(c => [String(c._id), c]));
    // IDs are opaque public filter keys only; no tenant or internal operational fields escape.
    const cards = (products: typeof rows) => products.map(p => {
      const cat = map.get(String(p.categoryId)); const state = publicAvailability(true, preview || config.published, cat, p, inventory && config.hideUnavailable);
      if (!inventory) state.available = true;
      return { visible: state.visible, card: { key: String(p._id), name: p.name, shortDescription: p.shortDescription, description: p.description, categoryKey: String(p.categoryId), categoryName: cat?.name, imageUrl: p.imageUrl, additionalImages: p.additionalImages, priceCents: config.showPrices ? p.priceCents : undefined, unit: p.unit, featured: p.featured, available: state.available, onDemand: config.showDemandLabel ? state.onDemand : undefined } };
    }).filter(p => p.visible).map(p => p.card);
    const featured = q.page === 1 && !q.search && !q.category ? await this.products.find({ ...filter, featured: true }).sort({ publicOrder: 1, _id: 1 }).limit(8).lean() : [];
    return { company: Object.fromEntries(publicFields.map(key => [key, config[key]])), categories: categories.map(c => ({ key: String(c._id), name: c.name, description: c.description, imageUrl: c.imageUrl, icon: c.icon, color: c.color })), products: cards(rows), featured: cards(featured), page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) };
  }
}
