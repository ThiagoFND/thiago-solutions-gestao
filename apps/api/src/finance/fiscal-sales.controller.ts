import { Permissions } from '../auth/permissions.js';
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { UserRole } from '../common/enums.js';
import { FiscalSalesQuery } from './fiscal-sales.dto.js';
import { FiscalSalesService } from './fiscal-sales.service.js';
@Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.ACCOUNTANT)
@Controller('finance')
export class FiscalSalesController {
 constructor(private service:FiscalSalesService){}
 @Get('sales') @Permissions('vendas_fiscais.visualizar') list(@CurrentUser() u:AuthUser,@Query() q:FiscalSalesQuery){return this.service.list(u,q);}
 @Get('sales/:id') @Permissions('vendas_fiscais.visualizar') detail(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.service.detail(u,id);}
 @Get('sales-export') @Permissions('vendas_fiscais.exportar') async export(@CurrentUser() u:AuthUser,@Query() q:FiscalSalesQuery,@Res() res:Response){const csv=await this.service.export(u,q);res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="vendas-fiscais.csv"');res.send(csv);}
}
