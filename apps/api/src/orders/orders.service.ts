import { ForbiddenException, BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import { Model, Types } from 'mongoose';
import { AuthUser } from '../common/auth-user.js';
import { SalesGroup, UserRole, PaymentMethod, AvailabilityMode, OrderStatus, StockMovementType } from '../common/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { EventsGateway } from '../events/events.gateway.js';
import { Product } from '../products/product.schema.js';
import { StockMovement } from '../productions/stock-movement.schema.js';
import { Counter } from './counter.schema.js';
import { CancelOrderDto, CreateOrderDto, FinalizeOrderDto, RequestedOrderItemDto, UpdateOrderDto } from './dto/order.dto.js';
import { Order, OrderItem, Payment } from './order.schema.js';
import { supplyOf } from '../catalog/availability.js';
import { ModularOrdersService } from './modular-orders.service.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly access: TenantAccessService,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(StockMovement.name) private readonly movementModel: Model<StockMovement>,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
    private readonly modular: ModularOrdersService,
  ) {}

  async list(status?: OrderStatus, user?: AuthUser, page = 1, limit = 100) {
    if (!user) throw new ForbiddenException('Identidade obrigatoria');
    const filter = { tenantId: await this.access.scope(user, [...OWNERS, UserRole.CASHIER]), ...(status ? { status } : {}), ...(OWNERS.includes(user.role!) ? {} : { openedById: new Types.ObjectId(user.sub) }) };
    return this.orderModel.find(filter).select('-__v -mutationLocked').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
  }
  async get(id: string, user?: AuthUser) {
    if (!user) throw new ForbiddenException('Identidade obrigatoria');
    const order = await this.orderModel.findOne({ _id: id, tenantId: await this.access.scope(user, [...OWNERS, UserRole.CASHIER]) });
    if (!order) throw new NotFoundException('Pedido nao encontrado');
    if (!OWNERS.includes(user.role!) && String(order.openedById) !== user.sub) {
      await this.audit.record('authorization.order', 'denied', user, 'orders', id);
      throw new ForbiddenException('Pedido fora do seu escopo');
    }
    return order;
  }
  private async locked<T>(id: string, user: AuthUser, work: () => Promise<T>): Promise<T> {
    await this.get(id, user);
    const lock = await this.orderModel.updateOne({ tenantId: user.tenantId, _id: id, mutationLocked: { $ne: true }, status: OrderStatus.OPEN }, { $set: { mutationLocked: true } });
    if (lock.modifiedCount !== 1) throw new ConflictException('Pedido fechado ou em alteracao. Atualize a tela.');
    try { return await work(); }
    finally { await this.orderModel.updateOne({ tenantId: user.tenantId, _id: id }, { $set: { mutationLocked: false } }); }
  }

  async create(dto: CreateOrderDto, user: AuthUser) {
    if (this.modular.enabled) { const order = await this.modular.create(dto, user); this.events.emitOrder(order); return order; }
    const tenantId = await this.access.scope(user, [...OWNERS, UserRole.CASHIER]);
    const ids = [...this.normalize(dto.items).keys()];
    if (await this.productModel.countDocuments({ tenantId, _id: { $in: ids }, active: true }) !== ids.length) throw new BadRequestException('Existe produto inválido ou inativo no pedido');
    const number = await this.nextNumber(tenantId);
    const items = await this.applyItems([], dto.items, `order:${number}`, user);
    try {
      const order = await this.orderModel.create({
        tenantId, number,
        type: dto.type,
        identifier: dto.identifier,
        notes: dto.notes,
        items,
        totalCents: this.total(items),
        status: OrderStatus.OPEN,
        openedById: new Types.ObjectId(user.sub),
        openedByName: user.name,
      });
      this.events.emitOrder(order);
      return order;
    } catch (error) {
      await this.releaseItems(items, `rollback:${number}`, user);
      throw error;
    }
  }

  async update(id: string, dto: UpdateOrderDto, user: AuthUser) {
    if ((await this.get(id, user)).stockPolicy === 'AT_FINALIZATION') { const order = await this.modular.update(id, dto, user); this.events.emitOrder(order); return order; }
    return this.locked(id, user, () => this.updateLocked(id, dto, user));
  }
  private async updateLocked(id: string, dto: UpdateOrderDto, user: AuthUser) {
    const order = await this.get(id, user);
    if (order.status !== OrderStatus.OPEN) throw new ConflictException('Somente pedidos abertos podem ser alterados');
    const oldItems = order.items.map(item => ({ ...((item as any).toObject?.() ?? item) }));
    const items = await this.applyItems(order.items, dto.items, order.id, user);
    order.type = dto.type;
    order.identifier = dto.identifier;
    order.notes = dto.notes;
    order.items = items;
    order.totalCents = this.total(items);
    try { await order.save(); } catch (error) {
      await this.applyItems(items, oldItems.map(item => ({ productId: String(item.productId), quantity: item.quantity })), `compensate:${order.id}`, user);
      throw error;
    }
    this.events.emitOrder(order);
    return order;
  }

  async finalize(id: string, dto: FinalizeOrderDto, user: AuthUser) {
    if ((await this.get(id, user)).stockPolicy === 'AT_FINALIZATION') { const order = await this.modular.finalize(id, dto, user); this.events.emitOrder(order); return order; }
    return this.locked(id, user, () => this.finalizeLocked(id, dto, user));
  }
  private async finalizeLocked(id: string, dto: FinalizeOrderDto, user: AuthUser) {
    const order = await this.get(id, user);
    if (order.status !== OrderStatus.OPEN) throw new ConflictException('Pedido não está aberto');
    const paid = dto.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    if (!Number.isSafeInteger(paid) || paid > 1e12 || paid !== order.totalCents) throw new BadRequestException('A soma dos pagamentos deve ser igual ao total');
    const payments: Payment[] = dto.payments.map((payment) => {
      const received = payment.receivedCents ?? payment.amountCents;
      if (payment.method !== PaymentMethod.CASH && received !== payment.amountCents) throw new BadRequestException('Troco somente para dinheiro');
      if (received < payment.amountCents) throw new BadRequestException('Valor recebido é menor que o pagamento');
      return {
        method: payment.method,
        amountCents: payment.amountCents,
        receivedCents: received,
        changeCents: received - payment.amountCents,
      };
    });
    order.payments = payments;
    order.status = OrderStatus.FINALIZED;
    order.finalizedById = new Types.ObjectId(user.sub);
    order.finalizedByName = user.name;
    order.finalizedAt = new Date();
    await order.save();
    this.events.emitOrder(order);
    return order;
  }

  async cancel(id: string, dto: CancelOrderDto, user: AuthUser) {
    if ((await this.get(id, user)).stockPolicy === 'AT_FINALIZATION') { const order = await this.modular.cancel(id, dto, user); this.events.emitOrder(order); return order; }
    return this.locked(id, user, () => this.cancelLocked(id, dto, user));
  }
  private async cancelLocked(id: string, dto: CancelOrderDto, user: AuthUser) {
    const order = await this.get(id, user);
    if (order.status !== OrderStatus.OPEN) throw new ConflictException('Somente pedidos abertos podem ser cancelados');
    order.status = OrderStatus.CANCELED;
    order.cancelReason = dto.reason;
    order.canceledAt = new Date();
    await order.save();
    await this.releaseItems(order.items, order.id, user);
    this.events.emitOrder(order);
    return order;
  }

  private async nextNumber(tenantId: Types.ObjectId) {
    const counter = await this.counterModel.findOneAndUpdate(
      { tenantId, key: 'orders' },
      { $inc: { value: 1 } },
      { upsert: true, new: true },
    );
    return counter.value;
  }

  private normalize(requested: RequestedOrderItemDto[]) {
    const map = new Map<string, number>();
    for (const item of requested) {
      const quantity = (map.get(item.productId) ?? 0) + item.quantity;
      if (!Number.isSafeInteger(quantity) || quantity > 1000000) throw new BadRequestException('Quantidade excede o limite');
      map.set(item.productId, quantity);
    }
    return map;
  }

  private async applyItems(oldItems: OrderItem[], requested: RequestedOrderItemDto[], referenceId: string, user: AuthUser) {
    const next = this.normalize(requested);
    const previous = new Map(oldItems.map((item) => [item.productId.toString(), item.quantity]));
    const ids = [...new Set([...next.keys(), ...previous.keys()])];
    const products = await this.productModel.find({ tenantId: user.tenantId, _id: { $in: ids }, active: true });
    if (products.length !== ids.length) throw new BadRequestException('Existe produto inválido ou inativo no pedido');
    const productById = new Map(products.map((p) => [p.id, p]));
    const estimate = [...next.entries()].reduce((sum, [id, quantity]) => sum + quantity * (oldItems.find(i => String(i.productId) === id)?.unitPriceCents ?? productById.get(id)!.priceCents), 0);
    if (!Number.isSafeInteger(estimate) || estimate > 1e12) throw new BadRequestException('Total excede o limite');
    const applied: Array<{ product: Product & { _id: Types.ObjectId; id: string }; delta: number }> = [];

    try {
      for (const id of ids) {
        const product = productById.get(id)! as Product & { _id: Types.ObjectId; id: string };
        const delta = (next.get(id) ?? 0) - (previous.get(id) ?? 0);
        if (!delta) continue;
        if (delta > 0) {
          const filter = product.availabilityMode === AvailabilityMode.PRODUCTION_CONTROLLED
            ? { tenantId: user.tenantId, _id: product._id, active: true, availableStock: { $gte: delta } }
            : { tenantId: user.tenantId, _id: product._id, active: true, availableStock: { $gte: -1000000000 + delta } };
          const updated = await this.productModel.findOneAndUpdate(filter, { $inc: { availableStock: -delta } }, { new: true, runValidators: true });
          if (!updated) throw new BadRequestException(`Estoque insuficiente para ${product.name}`);
          this.events.emitStock(updated);
        } else {
          const updated = await this.productModel.findOneAndUpdate({ _id: id, tenantId: user.tenantId }, { $inc: { availableStock: -delta } }, { new: true, runValidators: true });
          this.events.emitStock(updated);
        }
        applied.push({ product, delta });
      }
    } catch (error) {
      for (const appliedItem of applied.reverse()) {
        await this.productModel.findOneAndUpdate({ _id: appliedItem.product.id, tenantId: user.tenantId }, { $inc: { availableStock: appliedItem.delta } });
      }
      throw error;
    }

    if (applied.length) {
      try { await this.movementModel.insertMany(applied.map(({ product, delta }) => ({
        tenantId: user.tenantId, productId: product._id,
        productName: product.name,
        quantityChange: -delta,
        type: delta > 0 ? StockMovementType.ORDER_RESERVATION : StockMovementType.ORDER_RELEASE,
        referenceId,
        userId: new Types.ObjectId(user.sub),
        userName: user.name,
      }))); } catch (error) {
        for (const entry of applied.reverse()) await this.productModel.updateOne({ tenantId: user.tenantId, _id: entry.product._id }, { $inc: { availableStock: entry.delta } });
        throw error;
      }
    }

    return [...next.entries()].map(([id, quantity]) => {
      const product = productById.get(id)!;
      const old = oldItems.find((item) => item.productId.toString() === id);
      return {
        productId: product._id,
        name: old?.name ?? product.name,
        category: old?.category ?? product.category,
        supplyMode: old?.supplyMode ?? supplyOf(product),
        quantity,
        origin: old ? old.origin : product.origin, salesGroup: old ? old.salesGroup : product.salesGroup ?? SalesGroup.OTHER,
        unitPriceCents: old?.unitPriceCents ?? product.priceCents,
        stockControlled: true,
      };
    });
  }

  private async releaseItems(items: OrderItem[], referenceId: string, user: AuthUser) {
    const controlled = items.filter((item) => item.stockControlled);
    for (const item of controlled) {
      const updated = await this.productModel.findOneAndUpdate(
        { _id: item.productId, tenantId: user.tenantId },
        { $inc: { availableStock: item.quantity } },
        { new: true, runValidators: true },
      );
      this.events.emitStock(updated);
    }
    if (controlled.length) await this.movementModel.insertMany(controlled.map((item) => ({
      tenantId: user.tenantId, productId: item.productId,
      productName: item.name,
      quantityChange: item.quantity,
      type: StockMovementType.ORDER_RELEASE,
      referenceId,
      userId: new Types.ObjectId(user.sub),
      userName: user.name,
    })));
  }

  private total(items: OrderItem[]) {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  }
}
