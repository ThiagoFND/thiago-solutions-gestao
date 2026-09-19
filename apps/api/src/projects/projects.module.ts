import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { PROJECT_MODELS } from './projects.schemas.js';
import { ProjectsService } from './projects.service.js';
import * as D from './projects.dto.js';
@Controller('projects')
class ProjectsController {
 constructor(private service:ProjectsService){}
 @Get('people') @Permissions('projetos.visualizar') people(@CurrentUser() u:AuthUser,@Query() q:D.ProjectQuery){return this.service.people(u,q);}
 @Get('tasks') @Permissions('projetos.visualizar') tasks(@CurrentUser() u:AuthUser,@Query() q:D.ProjectQuery){return this.service.tasks(u,q);}
 @Post('tasks') @Permissions('projetos.planejar') task(@CurrentUser() u:AuthUser,@Body() d:D.ProjectTaskDto){return this.service.createTask(u,d);}
 @Post('tasks/:id/status') @Permissions('projetos.executar') taskState(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.TaskStateDto){return this.service.taskState(u,id,d);}
 @Post('tasks/:id/dependencies') @Permissions('projetos.planejar') dependencies(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.TaskDependenciesDto){return this.service.taskDependencies(u,id,d);}
 @Get('tasks/:id/comments') @Permissions('projetos.visualizar') comments(@CurrentUser() u:AuthUser,@Param('id') id:string,@Query() q:D.ProjectQuery){return this.service.comments(u,id,q);}
 @Post('tasks/:id/comments') @Permissions('projetos.executar') comment(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.TaskCommentDto){return this.service.comment(u,id,d);}
 @Get('times') @Permissions('projetos.visualizar') times(@CurrentUser() u:AuthUser,@Query() q:D.ProjectQuery){return this.service.times(u,q);}
 @Post('times') @Permissions('projetos.horas') time(@CurrentUser() u:AuthUser,@Body() d:D.ProjectTimeDto){return this.service.time(u,d);}
 @Post('times/:id/review') @Permissions('projetos.aprovar_horas') review(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.TimeApprovalDto){return this.service.approveTime(u,id,d);}
 @Get() @Permissions('projetos.visualizar') list(@CurrentUser() u:AuthUser,@Query() q:D.ProjectQuery){return this.service.list(u,q);}
 @Post() @Permissions('projetos.criar') create(@CurrentUser() u:AuthUser,@Body() d:D.ProjectDto){return this.service.create(u,d);}
 @Get(':id') @Permissions('projetos.visualizar') detail(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.service.detail(u,id);}
 @Post(':id/status') @Permissions('projetos.gerenciar') state(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.ProjectStateDto){return this.service.state(u,id,d);}
 @Post(':id/revisions') @Permissions('projetos.gerenciar') revise(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.ProjectRevisionDto){return this.service.revise(u,id,d);}
}
@Module({imports:[MongooseModule.forFeature(PROJECT_MODELS)],controllers:[ProjectsController],providers:[ProjectsService,OperationalStore]})
export class ProjectsModule {}
