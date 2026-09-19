import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { LOYALTY_MODELS } from './loyalty.schemas.js';
import { LoyaltyService } from './loyalty.service.js';
import * as D from './loyalty.dto.js';
@Controller('loyalty')
class LoyaltyController {
 constructor(private service:LoyaltyService){}
 @Get('programs') @Permissions('fidelidade.visualizar') programs(@CurrentUser() u:AuthUser,@Query() q:D.LoyaltyQuery){return this.service.programs(u,q);}
 @Post('programs') @Permissions('fidelidade.configurar') program(@CurrentUser() u:AuthUser,@Body() d:D.ProgramDto){return this.service.createProgram(u,d);}
 @Post('programs/:id/status') @Permissions('fidelidade.configurar') state(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.ProgramStateDto){return this.service.state(u,id,d);}
 @Get('members') @Permissions('fidelidade.visualizar') members(@CurrentUser() u:AuthUser,@Query() q:D.LoyaltyQuery){return this.service.members(u,q);}
 @Post('members') @Permissions('fidelidade.aderir') enroll(@CurrentUser() u:AuthUser,@Body() d:D.MemberDto){return this.service.enroll(u,d);}
 @Get('members/:id') @Permissions('fidelidade.visualizar') detail(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.service.detail(u,id);}
 @Post('members/:id/earn') @Permissions('fidelidade.pontuar') earn(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.EarnDto){return this.service.earn(u,id,d);}
 @Post('members/:id/redeem') @Permissions('fidelidade.resgatar') redeem(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.RedeemDto){return this.service.redeem(u,id,d);}
 @Get('entries') @Permissions('fidelidade.visualizar') entries(@CurrentUser() u:AuthUser,@Query() q:D.LoyaltyQuery){return this.service.entries(u,q);}
 @Post('entries/:id/reverse') @Permissions('fidelidade.estornar') reverse(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.ReverseDto){return this.service.reverse(u,id,d);}
}
@Module({imports:[MongooseModule.forFeature(LOYALTY_MODELS)],controllers:[LoyaltyController],providers:[LoyaltyService,OperationalStore]})
export class LoyaltyModule {}
