import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID, createHash } from 'node:crypto';
import { Attachment } from './attachment.schema.js';
import { AttachmentStorage } from './attachment-storage.js';
import { attachmentLimit, validateAttachment } from './attachment-validation.js';
import { FinancialEntry } from '../schemas/financial-entry.schema.js';
import { TenantAccessService, OWNERS } from '../../tenants/tenant-access.service.js';
import { UserRole } from '../../common/enums.js';
import type { AuthUser } from '../../common/auth-user.js';
import { AuditService } from '../../audit/audit.service.js';
import { EntitlementsService } from '../../commerce/entitlements.service.js';
import { assertStorageQuota } from '../../common/storage-quota.js';
const roles=[...OWNERS,UserRole.ACCOUNTANT];
@Injectable()
export class AttachmentsService {
 constructor(@InjectModel(Attachment.name) private model:Model<Attachment>,@InjectModel(FinancialEntry.name) private entries:Model<FinancialEntry>,private access:TenantAccessService,private storage:AttachmentStorage,private audit:AuditService,private entitlements:EntitlementsService){}
 private async scope(actor:AuthUser,id:string){const tenantId=await this.access.scope(actor,roles);if(!await this.entries.exists({_id:id,tenantId}))throw new NotFoundException('Lançamento não encontrado.');return {tenantId,entryId:new Types.ObjectId(id)};}
 async list(actor:AuthUser,id:string){return this.model.find({...await this.scope(actor,id),removedAt:{$exists:false}}).select('_id name mime size createdAt').sort({createdAt:1,_id:1}).lean();}
 async upload(actor:AuthUser,id:string,file:any){
  const scope=await this.scope(actor,id), type=await validateAttachment(file), key=randomUUID()+'.'+type.extension;
  const max=attachmentLimit('ATTACHMENT_MAX_COUNT',5,20);
  if(await this.model.countDocuments({...scope,removedAt:{$exists:false}})>=max)throw new ConflictException('Limite de anexos atingido.');
  // Verify transaction capability before storing a file. No operational bootstrap.
  const hello=await this.access.connection.db!.admin().command({hello:1});
  if(!hello.setName && hello.msg!=='isdbgrid')throw new BadRequestException('Anexos exigem MongoDB com transações.');
  await this.storage.put(key,file.buffer);
  return this.access.transaction(async session=>{
   await this.access.check(actor,roles,false,session);
   await this.access.tenants.updateOne({_id:scope.tenantId},{$inc:{membershipVersion:1}},{session});
   await assertStorageQuota(this.access.connection,String(scope.tenantId),file.buffer.length,(await this.entitlements.resolve(String(scope.tenantId),session)).limits?.storageBytes,session);
   const entry=await this.entries.findOneAndUpdate({_id:id,tenantId:scope.tenantId,$or:[{attachmentCount:{$lt:max}},{attachmentCount:{$exists:false}}]},{$inc:{attachmentCount:1}},{session,new:true});
   if(!entry)throw new ConflictException('Limite de anexos atingido.');
   const [row]=await this.model.create([{...scope,name:file.originalname,mime:type.mime,size:file.buffer.length,storageKey:key,sha256:createHash('sha256').update(file.buffer).digest('hex'),createdById:actor.sub}],{session});
   await this.audit.record('attachment.upload','success',actor,'attachments',String(row._id),undefined,session);
   return {_id:row._id,name:row.name,mime:row.mime,size:row.size};
  });
 }
 async download(actor:AuthUser,id:string,attachmentId:string){const row=await this.model.findOne({...await this.scope(actor,id),_id:attachmentId,removedAt:{$exists:false}}).select('+storageKey');if(!row)throw new NotFoundException('Anexo não encontrado.');const bytes=await this.storage.get(row.storageKey);if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw new ConflictException('Integridade do anexo inválida.');await this.audit.record('attachment.download','success',actor,'attachments',attachmentId);return {bytes,mime:row.mime,name:row.name};}
 async remove(actor:AuthUser,id:string,attachmentId:string){const scope=await this.scope(actor,id);return this.access.transaction(async session=>{await this.access.check(actor,roles,false,session);const row=await this.model.findOneAndUpdate({...scope,_id:attachmentId,removedAt:{$exists:false}},{$set:{removedAt:new Date(),removedById:actor.sub}},{session,new:true});if(!row)throw new NotFoundException('Anexo não encontrado.');await this.entries.updateOne({_id:id,tenantId:scope.tenantId,attachmentCount:{$gt:0}},{$inc:{attachmentCount:-1}},{session});await this.audit.record('attachment.remove','success',actor,'attachments',attachmentId,undefined,session);return {removed:true};});}
}
