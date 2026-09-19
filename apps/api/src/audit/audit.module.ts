import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditEvent, AuditEventSchema } from './audit-event.schema.js';
import { AuditService } from './audit.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { PageQueryDto } from '../common/query.dto.js';
@Roles(UserRole.OWNER, UserRole.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get() @Permissions('auditoria.visualizar') list(@Query() q: PageQueryDto, @CurrentUser() u: AuthUser) { return this.audit.list(q.page, q.limit, u); }
}
@Global()
@Module({ imports: [MongooseModule.forFeature([{ name: AuditEvent.name, schema: AuditEventSchema }])], controllers: [AuditController], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
