import { Body, Controller, Get, Module, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Permissions } from '../auth/permissions.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { DOCUMENT_MODELS } from './documents.schemas.js';
import { DocumentsService } from './documents.service.js';
import * as D from './documents.dto.js';
@Controller('documents')
class DocumentsController {
 constructor(private service:DocumentsService){}
 @Get('people') @Permissions('documentos.configurar') people(@CurrentUser() u:AuthUser,@Query() q:D.DocumentQuery){return this.service.people(u,q);}
 @Get() @Permissions('documentos.visualizar') list(@CurrentUser() u:AuthUser,@Query() q:D.DocumentQuery){return this.service.list(u,q);}
 @Post() @Permissions('documentos.criar') create(@CurrentUser() u:AuthUser,@Body() d:D.DocumentDto){return this.service.create(u,d);}
 @Get(':id') @Permissions('documentos.visualizar') detail(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.service.detail(u,id);}
 @Post(':id/access') @Permissions('documentos.configurar') share(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.DocumentShareDto){return this.service.share(u,id,d);}
 @Post(':id/status') @Permissions('documentos.arquivar') state(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.DocumentStateDto){return this.service.state(u,id,d);}
 @Get(':id/versions') @Permissions('documentos.visualizar') versions(@CurrentUser() u:AuthUser,@Param('id') id:string,@Query() q:D.DocumentQuery){return this.service.versions(u,id,q);}
 @Post(':id/versions') @Permissions('documentos.enviar') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:5*1024*1024,files:1,fields:3,parts:5}})) upload(@CurrentUser() u:AuthUser,@Param('id') id:string,@Body() d:D.DocumentUploadDto,@UploadedFile() file:any){return this.service.upload(u,id,d,file);}
 @Get(':id/versions/:versionId/download') @Permissions('documentos.baixar') async download(@CurrentUser() u:AuthUser,@Param('id') id:string,@Param('versionId') versionId:string,@Res() res:Response){const file=await this.service.download(u,id,versionId);res.setHeader('Content-Type',file.mime);res.setHeader('Content-Disposition',`attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(file.name)}`);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");res.send(file.bytes);}
}
@Module({imports:[MongooseModule.forFeature(DOCUMENT_MODELS)],controllers:[DocumentsController],providers:[DocumentsService,OperationalStore]})
export class DocumentsModule {}
