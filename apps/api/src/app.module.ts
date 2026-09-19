import { QualityModule } from './inventory/quality.module.js';
import { TenantAccessModule } from './tenants/tenant-access.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { ProductsModule } from './products/products.module.js';
import { ProductionsModule } from './productions/productions.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { EventsModule } from './events/events.module.js';
import { buildMongoOptions } from './common/mongodb.config.js';
import { AuditModule } from './audit/audit.module.js';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SecurityAuditInterceptor } from './common/security.interceptor.js';
import { FinanceModule } from './finance/finance.module.js';
import { CustomRolesModule } from './roles/roles.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CatalogImagesModule } from './catalog/images.module.js';
import { CommerceModule } from './commerce/commerce.module.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { BusinessModule } from './business/business.module.js';
import { CrmModule } from './crm/crm.module.js';
import { ServiceOrdersModule } from './service-orders/service-orders.module.js';
import { ContractsModule } from './contracts/contracts.module.js';
import { LoyaltyModule } from './loyalty/loyalty.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { PurchasesModule } from './purchases/purchases.module.js';
import { LogisticsModule } from './logistics/logistics.module.js';
import { BiModule } from './bi/bi.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { BranchesModule } from './branches/branches.module.js';
import { ManualStockModule } from './inventory/manual-stock.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => buildMongoOptions(),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
    }),
    TenantAccessModule,
    CommerceModule,
    BusinessModule,
    CrmModule,
    ServiceOrdersModule,
    ContractsModule,
    LoyaltyModule,
    ProjectsModule,
    PurchasesModule,
    LogisticsModule,
    BiModule,
    DocumentsModule,
    BranchesModule,
    ManualStockModule,
    QualityModule,
    PortfolioModule,
    CustomRolesModule,
    CatalogModule,
    CatalogImagesModule,
    AuditModule,
    EventsModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    ProductionsModule,
    OrdersModule,
    ReportsModule,
    FinanceModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: SecurityAuditInterceptor }],
})
export class AppModule {}
