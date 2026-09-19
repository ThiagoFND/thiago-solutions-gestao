import { Permissions } from '../../auth/permissions.js';
import { Controller, Get, Post, Param, UploadedFile, UseInterceptors, Res, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Roles } from '../../auth/roles.decorator.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { UserRole } from '../../common/enums.js';
import type { AuthUser } from '../../common/auth-user.js';
import { EmptyDto } from '../../tenants/tenancy.dto.js';
import { AttachmentsService } from './attachments.service.js';
import { attachmentLimit } from './attachment-validation.js';
@Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.ACCOUNTANT)
@Controller('finance/entries/:id/attachments')
export class AttachmentsController {
 constructor(private service:AttachmentsService){}
 @Get() @Permissions('financeiro.visualizar') list(@CurrentUser() u:AuthUser,@Param('id') id:string){return this.service.list(u,id);}
 @Post() @UseInterceptors(FileInterceptor('file',{limits:{fileSize:attachmentLimit('ATTACHMENT_MAX_BYTES',5*1024*1024,25*1024*1024),files:1,fields:0,parts:2}})) @Permissions('financeiro.editar') upload(@CurrentUser() u:AuthUser,@Param('id') id:string,@UploadedFile() f:any){return this.service.upload(u,id,f);}
 @Get(':attachmentId/download') @Permissions('financeiro.visualizar') async download(@CurrentUser() u:AuthUser,@Param('id') id:string,@Param('attachmentId') a:string,@Res() res:Response){const f=await this.service.download(u,id,a);res.setHeader('Content-Type',f.mime);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition',`attachment; filename="documento.${f.mime.split('/')[1]}"; filename*=UTF-8''${encodeURIComponent(f.name)}`);res.send(f.bytes);}
 @Post(':attachmentId/remove') @Permissions('financeiro.editar') remove(@CurrentUser() u:AuthUser,@Param('id') id:string,@Param('attachmentId') a:string,@Body() _:EmptyDto){return this.service.remove(u,id,a);}
}
