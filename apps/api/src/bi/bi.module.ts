import { Body, Controller, Get, Module, Param, Post, Query, Res } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import type { Response } from 'express';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { BI_MODELS } from './bi.schemas.js';
import { BiService } from './bi.service.js';
import * as D from './bi.dto.js';
@Controller('bi')
class BiController {
 constructor(private service:BiService){}
 @Get('people') @Permissions('bi.visualizar') people(@CurrentUser() u:AuthUser,@Query() q:D.BiQuery){return this.service.people(u,q);}
 @Get('datasets') @Permissions('bi.visualizar') datasets(@CurrentUser() u:AuthUser,@Query() q:D.BiQuery){return this.service.list(u,q);}
 @Post('datasets') @Permissions('bi.configurar') create(@CurrentUser() u:AuthUser,@Body() d:D.DatasetDto){return this.service.create(u,d);}
 @Post('datasets/:id/access') @Permissions('bi.compartilhar') share(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.BiShareDto){return this.service.share(u,id,d);}
 @Post('datasets/:id/imports') @Permissions('bi.importar') import(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.BiImportDto){return this.service.import(u,id,d);}
 @Post('datasets/:id/goals') @Permissions('bi.configurar') goal(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.BiGoalDto){return this.service.goal(u,id,d);}
 @Get('datasets/:id/dashboard') @Permissions('bi.visualizar') dashboard(@CurrentUser() u:AuthUser,@Param('id') id:string,@Query() q:D.BiQuery){return this.service.dashboard(u,id,q);}
 @Get('datasets/:id/records') @Permissions('bi.visualizar') records(@CurrentUser() u:AuthUser,@Param('id') id:string,@Query() q:D.BiQuery){return this.service.records(u,id,q);}
 @Get('datasets/:id/export') @Permissions('bi.exportar') async export(@CurrentUser() u:AuthUser,@Param('id') id:string,@Query() q:D.BiQuery,@Res() res:Response){res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="bi-pagina.csv"');res.send(await this.service.export(u,id,q));}
 @Get('operations') @Permissions('bi.visualizar') operations(@CurrentUser() u:AuthUser,@Query() q:D.BiQuery){return this.service.operations(u,q);}
}
@Module({imports:[MongooseModule.forFeature(BI_MODELS)],controllers:[BiController],providers:[BiService,OperationalStore]})
export class BiModule {}
