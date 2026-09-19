import { PlatformCommerceController, SubscriptionController } from '../commerce/commerce.module.js';
import { CatalogImagesController, PublicImagesController } from '../catalog/images.module.js';
import { AttachmentsController } from '../finance/attachments/attachments.controller.js';
import { FiscalSalesController } from '../finance/fiscal-sales.controller.js';
import { PlatformController } from '../tenants/platform.controller.js';
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../auth/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { AuthController } from '../auth/auth.controller.js';
import { UsersController } from '../users/users.controller.js';
import { ProductsController } from '../products/products.controller.js';
import { ProductionsController } from '../productions/productions.controller.js';
import { OrdersController } from '../orders/orders.controller.js';
import { ReportsController } from '../reports/reports.controller.js';
import { FinanceController } from '../finance/finance.controller.js';
import { AuditController } from '../audit/audit.module.js';
import { InventoryController } from '../inventory/inventory.controller.js';
import { CustomRolesController } from '../roles/roles.module.js';
import { CategoriesController } from '../catalog/categories.controller.js';
import { LandingController, PublicCatalogController } from '../catalog/catalog.module.js';
import { PERMISSIONS_KEY } from '../auth/permissions.js';
describe('complete HTTP policy inventory', () => {
  it('all registered handlers declare a policy; only explicit auth endpoints are public', () => {
    let total = 0; const publicPaths: string[] = [];
    for (const controller of [PlatformCommerceController,SubscriptionController,CatalogImagesController,PublicImagesController,CustomRolesController,CategoriesController,LandingController,PublicCatalogController,InventoryController,AttachmentsController,FiscalSalesController,PlatformController, AuthController, UsersController, ProductsController, ProductionsController, OrdersController, ReportsController, FinanceController, AuditController]) {
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name];
        if (typeof handler !== 'function' || Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
        total++;
        const path = `${Reflect.getMetadata(PATH_METADATA, controller)}/${Reflect.getMetadata(PATH_METADATA, handler)}`;
        if (Reflect.getMetadata(IS_PUBLIC_KEY, handler)) publicPaths.push(path);
        else if (!Reflect.getMetadata('sessionOnly', controller) && !Reflect.getMetadata('sessionOnly', handler)) expect(Reflect.getMetadata(PERMISSIONS_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, controller), path).toEqual(expect.arrayContaining([expect.any(String)]));
      }
    }
    expect(total).toBe(125); expect(publicPaths.sort()).toEqual(['auth/access-requests', 'auth/company-lookup', 'auth/csrf', 'auth/login', 'auth/onboarding', 'auth/platform-login', 'public/companies/:slug', 'public/images/:id']);
  });
});
