import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import { Model, ClientSession } from 'mongoose';
import { AuditEvent, AccessSnapshot } from './audit-event.schema.js';
import type { AuthUser } from '../common/auth-user.js';

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditEvent.name) private readonly model: Model<AuditEvent>, private readonly access: TenantAccessService) {}
  async record(action: string, outcome: 'success' | 'failure' | 'denied', user?: AuthUser, resourceType?: string, resourceId?: string, subjectHash?: string, session?: ClientSession, targetTenantId?: string, changes?: {before?:AccessSnapshot;after?:AccessSnapshot}) {
    await this.model.create([{ tenantId: user?.tenantId ?? null, targetTenantId, action, outcome, actorId: user?.sub, actorRole: user?.role ?? undefined, resourceType, resourceId: resourceId && /^[a-f\d]{24}$/i.test(resourceId) ? resourceId : undefined, subjectHash, before:changes?.before,after:changes?.after }], { session });
  }
  async list(page: number, limit: number, user: AuthUser) {
    // Retired records remain stored; operational audit must not expose their private details.
    const filter = { tenantId: await this.access.scope(user, OWNERS), action: { $not: /^time\./ }, resourceType: { $ne: 'time-clock' } };
    const [items, total] = await Promise.all([this.model.find(filter).sort({ occurredAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), this.model.countDocuments(filter)]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
