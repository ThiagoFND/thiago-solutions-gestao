import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Types, type Connection, type ClientSession, type Schema } from 'mongoose';
import { TenantAccessService } from '../tenants/tenant-access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from './auth-user.js';
/** Shared transaction/idempotency mechanics; each module owns its business transitions. */
@Injectable()
export class OperationalStore {
  constructor(@InjectConnection() readonly db: Connection, readonly access: TenantAccessService, private audit: AuditService) {}
  model(name: string) { return this.db.model<any>(name); }
  id(value: string) { if (!/^[a-f\d]{24}$/i.test(value)) throw new BadRequestException('Identificador inválido.'); return new Types.ObjectId(value); }
  hash(value: any): string {
    const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canonical(v[k])])) : v;
    return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
  }
  async replay(name: string, a: AuthUser, d: { requestId: string }, s: ClientSession) {
    const row = await this.model(name).findOne({ tenantId: a.tenantId, requestId: d.requestId }).session(s);
    if (row && (row.inputHash !== this.hash(d) || String(row.actorId) !== a.sub)) throw new ConflictException('Referência já utilizada.');
    return row;
  }
  fields(a: AuthUser, d: { requestId: string }) { return { tenantId: this.id(a.tenantId!), actorId: this.id(a.sub), requestId: d.requestId, inputHash: this.hash(d) }; }
  async write<T>(u: AuthUser, permission: string, action: string, models: { name: string; schema: Schema }[], work: (a: AuthUser, s: ClientSession) => Promise<T>) {
    for (const definition of models) {
      let indexes: any[]; try { indexes = await this.model(definition.name).collection.indexes(); } catch { throw new ServiceUnavailableException('Estrutura do módulo ainda não provisionada.'); }
      if (definition.schema.indexes().filter(([, o]) => o.unique).some(([key]) => !indexes.some(i => i.unique && JSON.stringify(i.key) === JSON.stringify(key)))) throw new ServiceUnavailableException('Índices obrigatórios ausentes.');
    }
    return this.access.transaction(async s => {
      const a = await this.access.require(u, [permission], s);
      await this.access.tenants.updateOne({ _id: a.tenantId }, { $inc: { membershipVersion: 1 } }, { session: s });
      const result = await work(a, s); await this.audit.record(action, 'success', a, action.split('.')[0], undefined, undefined, s); return result;
    });
  }
  async page(name: string, filter: any, q: { page: number; limit: number }, sort: any = { _id: -1 }, select = '-inputHash -requestId') {
    const model = this.model(name); return { items: await model.find(filter).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).select(select).lean(), total: await model.countDocuments(filter), page: q.page, limit: q.limit };
  }
}
