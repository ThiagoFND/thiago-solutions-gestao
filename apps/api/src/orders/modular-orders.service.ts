import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types, type Connection, type ClientSession } from 'mongoose';
import { TenantAccessService } from '../tenants/tenant-access.service.js';
import { EntitlementsService } from '../commerce/entitlements.service.js';
import { OrderStatus, PaymentMethod, SalesGroup, StockMovementType, SupplyMode } from '../common/enums.js';
import type { AuthUser } from '../common/auth-user.js';
import type { Order, OrderItem } from './order.schema.js';
import type { Product } from '../products/product.schema.js';
import type { Category } from '../catalog/category.schema.js';
import type { Counter } from './counter.schema.js';
import type { StockMovement } from '../productions/stock-movement.schema.js';
import type { CancelOrderDto, CreateOrderDto, FinalizeOrderDto } from './dto/order.dto.js';
import { supplyOf } from '../catalog/availability.js';
/** New commercial orders debit inventory only at finalization, in the same transaction. */
@Injectable()
export class ModularOrdersService {
  constructor(@InjectConnection() private readonly connection: Connection, private readonly access: TenantAccessService, private readonly entitlements: EntitlementsService) {}
  get enabled() { return this.entitlements.enabled; }
  private get orders() { return this.connection.model<Order>('Order'); }
  private get products() { return this.connection.model<Product>('Product'); }
  private async items(d: CreateOrderDto, u: AuthUser, session: ClientSession, previous: OrderItem[] = []) {
    const counts = new Map<string, number>();
    for (const i of d.items) { const quantity = (counts.get(i.productId) ?? 0) + i.quantity; if (quantity > 1000000) throw new BadRequestException('Quantidade excedida.'); counts.set(i.productId, quantity); }
    const products = await this.products.find({ tenantId: u.tenantId, _id: { $in: [...counts.keys()] }, active: true }).session(session);
    if (products.length !== counts.size) throw new BadRequestException('Produto inválido ou inativo.');
    const categories = await this.connection.model<Category>('Category').find({ tenantId: u.tenantId, _id: { $in: products.map(p => p.categoryId).filter(Boolean) } }).select('name').session(session).lean();
    const categoryNames = new Map(categories.map(c => [String(c._id), c.name]));
    return products.map(p => {
      const old = previous.find(i => String(i.productId) === p.id);
      return { productId: p._id, name: old?.name ?? p.name, category: old?.category ?? categoryNames.get(String(p.categoryId)) ?? p.category, supplyMode: old?.supplyMode ?? supplyOf(p), origin: old?.origin ?? p.origin, salesGroup: old?.salesGroup ?? p.salesGroup ?? SalesGroup.OTHER, unitPriceCents: old?.unitPriceCents ?? p.priceCents, quantity: counts.get(p.id)!, stockControlled: false };
    });
  }
  private total(items: OrderItem[]) { const total = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0); if (!Number.isSafeInteger(total) || total > 1e12) throw new BadRequestException('Total excedido.'); return total; }
  private async open(id: string, u: AuthUser, permission: string, session: ClientSession) {
    await this.access.require(u, [permission], session);
    const order = await this.orders.findOne({ _id: id, tenantId: u.tenantId, stockPolicy: 'AT_FINALIZATION' }).session(session);
    if (!order) throw new NotFoundException('Venda não encontrada.');
    if (order.status !== OrderStatus.OPEN) throw new ConflictException('Venda já encerrada.');
    return order;
  }
  async create(d: CreateOrderDto, u: AuthUser) {
    return this.access.transaction(async session => {
      await this.access.require(u, ['vendas.criar'], session);
      const items = await this.items(d, u, session);
      const counter = await this.connection.model<Counter>('Counter').findOneAndUpdate({ tenantId: u.tenantId, key: 'orders' }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after', session });
      return (await this.orders.create([{ tenantId: u.tenantId!, number: counter.value, type: d.type, identifier: d.identifier, notes: d.notes, items, totalCents: this.total(items), status: OrderStatus.OPEN, stockPolicy: 'AT_FINALIZATION', openedById: new Types.ObjectId(u.sub), openedByName: u.name }], { session }))[0];
    });
  }
  async update(id: string, d: CreateOrderDto, u: AuthUser) {
    return this.access.transaction(async session => { const order = await this.open(id, u, 'vendas.editar', session); const items = await this.items(d, u, session, order.items); order.set({ type: d.type, identifier: d.identifier, notes: d.notes, items, totalCents: this.total(items) }); return order.save({ session }); });
  }
  async finalize(id: string, d: FinalizeOrderDto, u: AuthUser) {
    return this.access.transaction(async session => {
      const order = await this.open(id, u, 'vendas.finalizar', session);
      const total = d.payments.reduce((sum, p) => sum + p.amountCents, 0);
      if (!Number.isSafeInteger(total) || total !== order.totalCents) throw new BadRequestException('Pagamentos devem corresponder ao total.');
      const payments = d.payments.map(p => { const received = p.receivedCents ?? p.amountCents; if (received < p.amountCents || p.method !== PaymentMethod.CASH && received !== p.amountCents) throw new BadRequestException('Troco inválido.'); return { ...p, receivedCents: received, changeCents: received - p.amountCents }; });
      if (await this.entitlements.has(u.tenantId!, 'INVENTORY', session)) {
        for (const item of order.items) {
          if (item.supplyMode !== SupplyMode.CONTROLADO_POR_ESTOQUE) continue;
          const result = await this.products.updateOne({ _id: item.productId, tenantId: u.tenantId, active: true, availableStock: { $gte: item.quantity } }, { $inc: { availableStock: -item.quantity } }, { session });
          if (result.modifiedCount !== 1) throw new ConflictException(`Estoque insuficiente para ${item.name}.`);
          item.stockControlled = true;
          await this.connection.model<StockMovement>('StockMovement').create([{ tenantId: u.tenantId!, productId: item.productId, productName: item.name, quantityChange: -item.quantity, type: StockMovementType.SALE, referenceId: order.id, userId: new Types.ObjectId(u.sub), userName: u.name }], { session });
        }
      }
      order.set({ payments, status: OrderStatus.FINALIZED, finalizedById: new Types.ObjectId(u.sub), finalizedByName: u.name, finalizedAt: new Date() });
      return order.save({ session });
    });
  }
  async cancel(id: string, d: CancelOrderDto, u: AuthUser) {
    return this.access.transaction(async session => { const order = await this.open(id, u, 'vendas.cancelar', session); order.set({ status: OrderStatus.CANCELED, cancelReason: d.reason, canceledAt: new Date() }); return order.save({ session }); });
  }
}
