import { Permissions } from '../auth/permissions.js';
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { UserRole } from '../common/enums.js';
import { PageDto } from '../finance/finance.dto.js';
import { IngredientDto, ReceiptDto, RecipeDto } from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';
@Controller('inventory')
@Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.KITCHEN)
export class InventoryController {
  constructor(private readonly service:InventoryService){}
  @Get('ingredients') @Permissions('estoque.visualizar') ingredients(@Query() q:PageDto,@CurrentUser() u:AuthUser){return this.service.list(u,q.page,q.limit);}
  @Post('ingredients') @Roles(UserRole.OWNER,UserRole.ADMIN) @Permissions('estoque.movimentar') create(@Body() dto:IngredientDto,@CurrentUser() u:AuthUser){return this.service.create(dto,u);}
  @Get('purchases') @Roles(UserRole.OWNER,UserRole.ADMIN) @Permissions('estoque.visualizar', 'financeiro.visualizar') purchases(@Query() q:PageDto,@CurrentUser() u:AuthUser){return this.service.purchases(u,q.page,q.limit);}
  @Post('receipts') @Roles(UserRole.OWNER,UserRole.ADMIN) @Permissions('estoque.movimentar', 'financeiro.visualizar') receive(@Body() dto:ReceiptDto,@CurrentUser() u:AuthUser){return this.service.receive(dto,u);}
  @Get('recipes/:productId') @Permissions('producao.visualizar') recipe(@Param('productId') id:string,@CurrentUser() u:AuthUser){return this.service.recipe(id,u);}
  @Get('recipes/:productId/cost') @Permissions('producao.visualizar') cost(@Param('productId') id:string,@CurrentUser() u:AuthUser){return this.service.cost(id,u);}
  @Put('recipes/:productId') @Roles(UserRole.OWNER,UserRole.ADMIN) @Permissions('producao.editar') save(@Param('productId') id:string,@Body() dto:RecipeDto,@CurrentUser() u:AuthUser){return this.service.saveRecipe(id,dto,u);}
}
