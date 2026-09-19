import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../common/auth-user.js';
import { OrderStatus } from '../common/enums.js';
import { Order } from '../orders/order.schema.js';
import { Production } from '../productions/production.schema.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly access: TenantAccessService,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(Production.name) private readonly productions: Model<Production>,
    private readonly config: ConfigService,
  ) {}

  async daily(date: string | undefined, user: AuthUser) {
    const tenantId = await this.access.scope(user, OWNERS);
    const day = date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());
    const offset = this.config.get<string>('BUSINESS_UTC_OFFSET', '-03:00');
    const start = new Date(`${day}T00:00:00${offset}`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const [orders, productions] = await Promise.all([
      this.orders.find({ tenantId, status: OrderStatus.FINALIZED, finalizedAt: { $gte: start, $lt: end } }).sort({ finalizedAt: -1 }),
      this.productions.find({ tenantId, createdAt: { $gte: start, $lt: end } }).sort({ createdAt: -1 }),
    ]);

    const payments = new Map<string, number>();
    const sold = new Map<string, { name: string; quantity: number; totalCents: number }>();
    for (const order of orders) {
      for (const payment of order.payments) payments.set(payment.method, (payments.get(payment.method) ?? 0) + payment.amountCents);
      for (const item of order.items) {
        const key = item.productId.toString();
        const current = sold.get(key) ?? { name: item.name, quantity: 0, totalCents: 0 };
        current.quantity += item.quantity;
        current.totalCents += item.quantity * item.unitPriceCents;
        sold.set(key, current);
      }
    }

    return {
      date: day,
      orderCount: orders.length,
      revenueCents: orders.reduce((sum, order) => sum + order.totalCents, 0),
      averageTicketCents: orders.length ? Math.round(orders.reduce((sum, order) => sum + order.totalCents, 0) / orders.length) : 0,
      payments: Object.fromEntries(payments),
      soldProducts: [...sold.values()].sort((a, b) => b.quantity - a.quantity),
      productionQuantity: productions.reduce((sum, production) => sum + production.quantity, 0),
      productionEntries: productions,
      orders,
    };
  }
}
