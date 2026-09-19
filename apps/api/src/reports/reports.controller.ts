import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../common/enums.js';
import { ReportQueryDto } from '../common/query.dto.js';
import { civilDate } from '../finance/finance.helpers.js';
import { ReportsService } from './reports.service.js';
import { OverviewService, OverviewQueryDto } from './overview.service.js';

@Roles(UserRole.OWNER, UserRole.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService,private readonly overviewService:OverviewService) {}
  @Get('overview') @Permissions('relatorios.visualizar', 'financeiro.visualizar') overview(@Query() q:OverviewQueryDto,@CurrentUser() u:AuthUser){return this.overviewService.overview(q.month,u);}
  @Get('daily') @Permissions('relatorios.visualizar') daily(@Query() q: ReportQueryDto, @CurrentUser() u: AuthUser) { if (q.date) civilDate(q.date); return this.reports.daily(q.date, u); }
}
