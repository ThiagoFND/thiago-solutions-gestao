import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { CONTRACT_MODELS } from './contracts.schemas.js';
import { ContractsService } from './contracts.service.js';
import * as D from './contracts.dto.js';
@Controller('contracts')
class ContractsController {
  constructor(private service:ContractsService) {}
  @Get('accounts') @Permissions('contratos.visualizar') accounts(@CurrentUser() u:AuthUser,@Query() q:D.ContractQuery){return this.service.accounts(u,q);}
  @Post('accounts') @Permissions('contratos.configurar') account(@CurrentUser() u:AuthUser,@Body() d:D.ContractAccountDto){return this.service.createAccount(u,d);}
  @Get('cycles') @Permissions('contratos.visualizar') cycles(@CurrentUser() u:AuthUser,@Query() q:D.ContractQuery){return this.service.cycles(u,q);}
  @Post('cycles/:id/settle') @Permissions('contratos.receber') settle(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.ContractSettlementDto){return this.service.settle(u,id,d);}
  @Get() @Permissions('contratos.visualizar') list(@CurrentUser() u:AuthUser,@Query() q:D.ContractQuery){return this.service.list(u,q);}
  @Post() @Permissions('contratos.criar') create(@CurrentUser() u:AuthUser,@Body() d:D.ContractDto){return this.service.create(u,d);}
  @Get(':id') @Permissions('contratos.visualizar') detail(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.service.detail(u,id);}
  @Post(':id/status') @Permissions('contratos.visualizar') state(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.ContractStatusDto){return this.service.state(u,id,d);}
  @Post(':id/amendments') @Permissions('contratos.aditar') amend(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.ContractAmendmentDto){return this.service.amend(u,id,d);}
  @Post(':id/cycles') @Permissions('contratos.cobrar') generate(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.GenerateCycleDto){return this.service.generate(u,id,d);}
}
@Module({imports:[MongooseModule.forFeature(CONTRACT_MODELS)],controllers:[ContractsController],providers:[ContractsService,OperationalStore]})
export class ContractsModule {}
