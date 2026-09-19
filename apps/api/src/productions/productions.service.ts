import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service.js';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import { Model, Types } from 'mongoose';
import { AuthUser } from '../common/auth-user.js';
import { StockMovementType, ProductOrigin, UserRole } from '../common/enums.js';
import { EventsGateway } from '../events/events.gateway.js';
import { ProductsService } from '../products/products.service.js';
import { CreateProductionDto } from './dto/create-production.dto.js';
import { Production } from './production.schema.js';
import { StockMovement } from './stock-movement.schema.js';
import { EntitlementsService } from '../commerce/entitlements.service.js';

@Injectable()
export class ProductionsService {
  constructor(
    private readonly access: TenantAccessService,
    @InjectModel(Production.name) private readonly productionModel: Model<Production>,
    @InjectModel(StockMovement.name) private readonly movementModel: Model<StockMovement>,
    private readonly products: ProductsService,
    private readonly events: EventsGateway,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementsService,
    private readonly inventory?: InventoryService,
  ) {}

  async create(dto: CreateProductionDto, user: AuthUser) {
    if (!await this.entitlements.has(user.tenantId!, 'INVENTORY')) {
      const production = await this.access.transaction(async session => {
        await this.access.require(user, ['producao.registrar'], session);
        if (dto.idempotencyKey) { const previous = await this.productionModel.findOne({ tenantId: user.tenantId, idempotencyKey: dto.idempotencyKey }).session(session); if (previous) { if (String(previous.productId) !== dto.productId || previous.quantity !== dto.quantity) throw new ConflictException('Chave já utilizada com outra produção.'); return previous; } }
        const product = await this.products.modelRef().findOne({ tenantId: user.tenantId, _id: dto.productId, active: true, origin: ProductOrigin.PRODUCED }).session(session);
        if (!product) throw new BadRequestException('Produto produzido inválido ou inativo.');
        return (await this.productionModel.create([{ tenantId: user.tenantId!, productId: product._id, productName: product.name, quantity: dto.quantity, idempotencyKey: dto.idempotencyKey, createdById: new Types.ObjectId(user.sub), createdByName: user.name }], { session }))[0];
      });
      this.events.emitProduction(production);
      return { _id: production._id, productId: production.productId, productName: production.productName, quantity: production.quantity, createdAt: (production as any).createdAt };
    }
    const withRecipe = await this.inventory?.produceIfRecipe(dto,user);
    if(withRecipe){if(!withRecipe.replayed){this.events.emitProduction(withRecipe.production);this.events.emitStock(withRecipe.product);}const p=withRecipe.production;return {_id:p._id,productId:p.productId,productName:p.productName,quantity:p.quantity,createdAt:p.createdAt,ingredientCostCents:p.ingredientCostCents,ingredientCostPerUnitCents:p.ingredientCostPerUnitCents,recipeVersion:p.recipeVersion,replayed:withRecipe.replayed};}
    const tenantId = await this.access.scope(user, [...OWNERS, UserRole.KITCHEN]);
    const product = await this.products.get(dto.productId, user);
    if(product.origin!==ProductOrigin.PRODUCED)throw new BadRequestException('Somente produtos classificados como produzidos podem entrar pela cozinha.');
    if (!product.active) throw new BadRequestException('Produto inativo');
    const updated = await this.products.modelRef().findOneAndUpdate(
      { tenantId, _id: product._id, active: true, origin:ProductOrigin.PRODUCED, availableStock: { $lte: 1000000 - dto.quantity } },
      { $inc: { availableStock: dto.quantity } },
      { new: true },
    );
    if (!updated) throw new ConflictException('Limite de estoque ou produto indisponivel');
    let production;
    try { production = await this.productionModel.create({
      tenantId, productId: product._id,
      productName: product.name,
      quantity: dto.quantity,
      createdById: new Types.ObjectId(user.sub),
      createdByName: user.name,
    }); } catch (error) {
      await this.products.modelRef().updateOne({ tenantId, _id: product._id }, { $inc: { availableStock: -dto.quantity } });
      throw error;
    }
    await this.movementModel.create({
      tenantId, productId: product._id,
      productName: product.name,
      quantityChange: dto.quantity,
      type: StockMovementType.PRODUCTION,
      referenceId: production.id,
      userId: new Types.ObjectId(user.sub),
      userName: user.name,
    });
    this.events.emitProduction(production);
    this.events.emitStock(updated);
    return { _id: production._id, productId: production.productId, productName: production.productName, quantity: production.quantity, createdAt: (production as any).createdAt };
  }

  async listToday(page = 1, limit = 100, user: AuthUser) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
    const offset = this.config.get<string>('BUSINESS_UTC_OFFSET', '-03:00');
    const start = new Date(`${day}T00:00:00${offset}`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return this.productionModel.find({ tenantId: await this.access.scope(user, [...OWNERS, UserRole.KITCHEN]), createdAt: { $gte: start, $lt: end } }).select('_id productId productName quantity createdAt ingredientCostCents ingredientCostPerUnitCents recipeVersion').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
  }
}
