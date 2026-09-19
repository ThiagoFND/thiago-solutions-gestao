import { Body, Controller, Get, Module, Param, Post, Query, Res } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Permissions } from '../auth/permissions.js';
import type { AuthUser } from '../common/auth-user.js';
import { BusinessService } from './business.service.js';
import { BUSINESS_MODELS } from './business.schemas.js';
import * as D from './business.dto.js';
@Controller('parties')
class PartiesController {
 constructor(private service:BusinessService){}
 @Get() @Permissions('cadastros.visualizar') list(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery){return this.service.parties(u,q);}
 @Post() @Permissions('cadastros.editar') create(@CurrentUser() u:AuthUser,@Body() d:D.PartyDto){return this.service.createParty(u,d);}
}
@Controller('treasury')
class TreasuryController {
 constructor(private service:BusinessService){}
 @Get('accounts') @Permissions('tesouraria.visualizar') accounts(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery){return this.service.cashAccounts(u,q);}
 @Post('accounts') @Permissions('tesouraria.configurar') account(@CurrentUser() u:AuthUser,@Body() d:D.CashAccountDto){return this.service.createCashAccount(u,d);}
 @Get('entries') @Permissions('tesouraria.visualizar') entries(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery){return this.service.cashEntries(u,q);}
 @Post('entries') @Permissions('tesouraria.criar') entry(@CurrentUser() u:AuthUser,@Body() d:D.CashEntryDto){return this.service.createCashEntry(u,d);}
 @Post('entries/:id/settle') @Permissions('tesouraria.liquidar') settle(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.SettlementDto){return this.service.settle(u,id,d);}
 @Post('entries/:id/cancel') @Permissions('tesouraria.cancelar') cancel(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.VersionReason){return this.service.cancelCash(u,id,d);}
 @Post('transfers') @Permissions('tesouraria.transferir') transfer(@CurrentUser() u:AuthUser,@Body() d:D.TransferDto){return this.service.transfer(u,d);}
 @Get('summary') @Permissions('tesouraria.visualizar') summary(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery){return this.service.cashSummary(u,q);}
}
@Controller('accounting')
class AccountingController {
 constructor(private service:BusinessService){}
 @Get('accounts') @Permissions('contabil.visualizar') accounts(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery){return this.service.ledgerAccounts(u,q);}
 @Post('accounts') @Permissions('contabil.configurar') account(@CurrentUser() u:AuthUser,@Body() d:D.LedgerAccountDto){return this.service.createLedgerAccount(u,d);}
 @Get('journals') @Permissions('contabil.visualizar') journals(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery){return this.service.journals(u,q);}
 @Post('journals') @Permissions('contabil.escriturar') journal(@CurrentUser() u:AuthUser,@Body() d:D.JournalDto){return this.service.createJournal(u,d);}
 @Post('journals/:id/reverse') @Permissions('contabil.estornar') reverse(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.SettlementDto){return this.service.reverseJournal(u,id,d);}
 @Get('sources') @Permissions('contabil.visualizar') sources(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery){return this.service.sources(u,q);}
 @Post('imports') @Permissions('contabil.escriturar') import(@CurrentUser() u:AuthUser,@Body() d:D.ImportJournalDto){return this.service.importJournal(u,d);}
 @Get('trial-balance') @Permissions('contabil.visualizar') balance(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery){return this.service.trialBalance(u,q);}
 @Get('ledger') @Permissions('contabil.visualizar') ledger(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery){return this.service.ledger(u,q);}
 @Get('statements') @Permissions('contabil.visualizar') statements(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery){return this.service.statements(u,q);}
 @Get('trial-balance/export') @Permissions('contabil.exportar') async export(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery,@Res() res:Response){res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="balancete-auxiliar.csv"');res.send(await this.service.exportBalance(u,q));}
 @Post('closing') @Permissions('contabil.fechar') close(@CurrentUser() u:AuthUser,@Body() d:D.ClosingDto){return this.service.close(u,d);}
 @Get('obligations') @Permissions('contabil.visualizar') obligations(@CurrentUser() u:AuthUser,@Query() q:D.BusinessQuery){return this.service.obligations(u,q);}
 @Post('obligations') @Permissions('contabil.configurar') obligation(@CurrentUser() u:AuthUser,@Body() d:D.ObligationDto){return this.service.createObligation(u,d);}
 @Post('obligations/:id/status') @Permissions('contabil.configurar') state(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.ObligationStateDto){return this.service.obligationState(u,id,d);}
}
@Module({imports:[MongooseModule.forFeature(BUSINESS_MODELS)],controllers:[PartiesController,TreasuryController,AccountingController],providers:[BusinessService]})
export class BusinessModule {}
