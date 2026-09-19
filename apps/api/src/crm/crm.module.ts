import { Body, Controller, Get, Module, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MongooseModule } from '@nestjs/mongoose';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Permissions } from '../auth/permissions.js';
import type { AuthUser } from '../common/auth-user.js';
import { CrmService } from './crm.service.js';
import { CRM_MODELS } from './crm.schemas.js';
import * as D from './crm.dto.js';
@Controller('crm')
class CrmController {
  constructor(private service: CrmService) {}
  @Get('pipelines') @Permissions('crm.visualizar') pipelines(@CurrentUser() u: AuthUser, @Query() q: D.CrmQuery) { return this.service.pipelines(u, q); }
  @Post('pipelines') @Permissions('crm.configurar') pipeline(@CurrentUser() u: AuthUser, @Body() d: D.PipelineDto) { return this.service.createPipeline(u, d); }
  @Get('people') @Permissions('crm.visualizar') people(@CurrentUser() u: AuthUser, @Query() q: D.CrmQuery) { return this.service.lookups(u, q, 'people'); }
  @Get('parties') @Permissions('crm.visualizar') parties(@CurrentUser() u: AuthUser, @Query() q: D.CrmQuery) { return this.service.lookups(u, q, 'parties'); }
  @Get('products') @Permissions('crm.visualizar') products(@CurrentUser() u: AuthUser, @Query() q: D.CrmQuery) { return this.service.lookups(u, q, 'products'); }
  @Get('summary') @Permissions('crm.visualizar') summary(@CurrentUser() u: AuthUser) { return this.service.summary(u); }
  @Get('opportunities') @Permissions('crm.visualizar') list(@CurrentUser() u: AuthUser, @Query() q: D.CrmQuery) { return this.service.list(u, q); }
  @Get('export') @Permissions('crm.exportar','crm.visualizar') async export(@CurrentUser() u:AuthUser,@Query() q:D.CrmQuery,@Res() res:Response){res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="crm-pagina.csv"');res.setHeader('Cache-Control','private, no-store');res.send(await this.service.export(u,q));}
  @Post('opportunities') @Permissions('crm.criar') create(@CurrentUser() u: AuthUser, @Body() d: D.OpportunityDto) { return this.service.create(u, d); }
  @Get('opportunities/:id') @Permissions('crm.visualizar') detail(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query() q: D.CrmQuery) { return this.service.detail(u, id, q); }
  @Post('opportunities/:id/stage') @Permissions('crm.editar') move(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.MoveDto) { return this.service.move(u, id, d); }
  @Post('opportunities/:id/result') @Permissions('crm.editar') result(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.ResultDto) { return this.service.result(u, id, d); }
  @Post('opportunities/:id/activities') @Permissions('crm.editar') activity(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.ActivityDto) { return this.service.activity(u, id, d); }
  @Post('opportunities/:id/activities/:activityId/complete') @Permissions('crm.editar') complete(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('activityId') activityId: string, @Body() d: D.VersionReasonDto) { return this.service.completeActivity(u, id, activityId, d); }
  @Post('opportunities/:id/proposals') @Permissions('crm.propor') proposal(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: D.ProposalDto) { return this.service.proposal(u, id, d); }
  @Post('opportunities/:id/proposals/:proposalId/approve') @Permissions('crm.aprovar') approve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('proposalId') proposalId: string, @Body() d: D.VersionReasonDto) { return this.service.approveProposal(u, id, proposalId, d); }
}
@Module({ imports: [MongooseModule.forFeature(CRM_MODELS)], controllers: [CrmController], providers: [CrmService] })
export class CrmModule {}
