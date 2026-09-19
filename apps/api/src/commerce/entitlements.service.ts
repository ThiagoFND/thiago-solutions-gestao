import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types, type Connection, type ClientSession } from 'mongoose';
import { effectivePermissions, permittedSubscription, supportedModules, type ModuleCode, type UsageLimits } from './commerce.domain.js';
import { effectiveCommercialState, type CommercialSubscription } from './commerce.schemas.js';
@Injectable()
export class EntitlementsService {
  constructor(@InjectConnection() private readonly connection: Connection) {}
  /** Subscription enforcement is mandatory; environment flags cannot grant access. */
  get enabled() { return true; }
  async resolve(tenantId: string, session?: ClientSession) {
    const stored = await this.connection.model<CommercialSubscription>('CommercialSubscription').findOne({ tenantId: new Types.ObjectId(tenantId) }).session(session ?? null).lean();
    const subscription = stored ? effectiveCommercialState(stored, new Date()) : null;
    const allowed = !!subscription && permittedSubscription(subscription, new Date());
    return { allowed, subscriptionId: subscription?._id.toString(), status: subscription?.status ?? 'NOT_CONTRACTED', modules: supportedModules(allowed ? subscription!.snapshot.modules : []), limits: subscription?.snapshot.limits as UsageLimits | undefined, version: subscription?.version ?? 0 };
  }
  async filter(tenantId: string, permissions: string[], session?: ClientSession) {
    if (!this.enabled) return permissions;
    const commercial = await this.resolve(tenantId, session);
    return commercial.allowed ? effectivePermissions(permissions, commercial.modules) : [];
  }
  async has(tenantId: string, code: ModuleCode, session?: ClientSession) {
    if (!this.enabled) return true;
    return (await this.resolve(tenantId, session)).modules.includes(code);
  }
  async require(tenantId: string, code: ModuleCode, session?: ClientSession) {
    if (!await this.has(tenantId, code, session)) throw new ForbiddenException({ code: 'MODULE_NOT_CONTRACTED', message: 'Módulo não contratado ou assinatura fora da vigência.' });
  }
  async checkCapacity(tenantId: string, key: 'activeUsers' | 'products' | 'categories', session: ClientSession) {
    if (!this.enabled) return;
    const model = this.connection.model<CommercialSubscription>('CommercialSubscription');
    const subscription = await model.findOneAndUpdate({ tenantId: new Types.ObjectId(tenantId) }, { $inc: { quotaVersion: 1 } }, { session, returnDocument: 'after' });
    if (!subscription || !permittedSubscription(effectiveCommercialState(subscription.toObject(), new Date()), new Date())) throw new ForbiddenException({ code: 'SUBSCRIPTION_REQUIRED', message: 'Empresa sem assinatura válida. Solicite a contratação ao administrador da plataforma.' });
    const collections = { activeUsers: 'users_v2', products: 'products_v2', categories: 'product_categories_v2' };
    const count = await this.connection.collection(collections[key]).countDocuments({ tenantId: new Types.ObjectId(tenantId), ...(key === 'activeUsers' ? { status: 'ACTIVE' } : {}) }, { session });
    if (count >= effectiveCommercialState(subscription.toObject(), new Date()).snapshot.limits[key]) throw new ForbiddenException({ code: 'SUBSCRIPTION_LIMIT', message: 'Limite contratado atingido. Regularize o uso ou solicite uma alteração de plano.' });
  }
}
