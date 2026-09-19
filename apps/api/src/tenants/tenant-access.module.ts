import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/user.schema.js';
import { Tenant, TenantSchema } from './tenant.schema.js';
import { TenantAccessService } from './tenant-access.service.js';
import { CustomRole, CustomRoleSchema } from '../roles/custom-role.schema.js';
import { COMMERCIAL_MODELS } from '../commerce/commerce.schemas.js';
import { EntitlementsService } from '../commerce/entitlements.service.js';
@Global()
@Module({ imports: [MongooseModule.forFeature([...COMMERCIAL_MODELS, { name: CustomRole.name, schema: CustomRoleSchema }, { name: User.name, schema: UserSchema }, { name: Tenant.name, schema: TenantSchema }])], providers: [TenantAccessService, EntitlementsService], exports: [TenantAccessService, EntitlementsService, MongooseModule] })
export class TenantAccessModule {}
