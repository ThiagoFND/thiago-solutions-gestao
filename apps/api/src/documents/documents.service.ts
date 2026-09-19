import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { EntitlementsService } from '../commerce/entitlements.service.js';
import { AuditService } from '../audit/audit.service.js';
import { validateAttachment } from '../finance/attachments/attachment-validation.js';
import { assertStorageQuota } from '../common/storage-quota.js';
import { DOCUMENT_MODELS } from './documents.schemas.js';
import * as D from './documents.dto.js';
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
@Injectable()
export class DocumentsService {
 constructor(private store:OperationalStore,private entitlements:EntitlementsService,private audit:AuditService){}
 private model(name:string){return this.store.model(name);}
 private clean(row:any){const {inputHash,requestId,bytes,...r}=row.toObject?row.toObject():row;return r;}
 private scope(a:AuthUser){return {tenantId:a.tenantId,...(a.permissions?.includes('documentos.equipe')?{}:{allowedUserIds:a.sub})};}
 private async document(a:AuthUser,id:string,s?:ClientSession){const r=await this.model('ManagedDocument').findOne({_id:this.store.id(id),...this.scope(a)}).session(s??null);if(!r)throw new NotFoundException('Documento não encontrado.');return r;}
 private write<T>(u:AuthUser,p:string,event:string,fn:(a:AuthUser,s:ClientSession)=>Promise<T>){return this.store.write(u,p,event,DOCUMENT_MODELS,fn);}
 private async users(a:AuthUser,ids:string[],s:ClientSession){if(await this.model('User').countDocuments({_id:{$in:ids},tenantId:a.tenantId,status:'ACTIVE',active:true}).session(s)!==ids.length)throw new BadRequestException('Pessoa indisponível nesta empresa.');}
 async people(u:AuthUser,q:D.DocumentQuery){const a=await this.store.access.require(u,['documentos.configurar']);return this.store.page('User',{tenantId:a.tenantId,status:'ACTIVE',active:true},q,{name:1,_id:1},'_id name');}
 async list(u:AuthUser,q:D.DocumentQuery){const a=await this.store.access.require(u,['documentos.visualizar']);return this.store.page('ManagedDocument',{...this.scope(a),...(q.status?{status:q.status}:{}),...(q.search?{$or:['title','category','originReference'].map(k=>({[k]:new RegExp(escape(q.search!),'i')}))}:{})},q);}
 async detail(u:AuthUser,id:string){const a=await this.store.access.require(u,['documentos.visualizar']);return this.clean(await this.document(a,id));}
 async create(u:AuthUser,d:D.DocumentDto){return this.write(u,'documentos.criar','documents.created',async(a,s)=>{if(d.allowedUserIds.some(id=>id!==a.sub)&&!a.permissions?.includes('documentos.configurar'))throw new ForbiddenException('Configurar acesso exige permissão própria.');const previous=await this.store.replay('ManagedDocument',a,d,s);if(previous){await this.document(a,String(previous._id),s);return this.clean(previous);}const ids=[...new Set([...d.allowedUserIds,a.sub])];await this.users(a,ids,s);const [r]=await this.model('ManagedDocument').create([{...d,...this.store.fields(a,d),allowedUserIds:ids}],{session:s});return this.clean(r);});}
 async versions(u:AuthUser,id:string,q:D.DocumentQuery){const a=await this.store.access.require(u,['documentos.visualizar']);await this.document(a,id);return this.store.page('DocumentVersion',{tenantId:a.tenantId,documentId:id},q,{revision:-1},'-bytes -inputHash -requestId');}
 async upload(u:AuthUser,id:string,d:D.DocumentUploadDto,file:any){if(file?.buffer?.length>5*1024*1024)throw new PayloadTooLargeException('Limite de 5 MiB por versão.');const type=await validateAttachment(file),sha256=createHash('sha256').update(file.buffer).digest('hex');return this.write(u,'documentos.enviar','documents.version.created',async(a,s)=>{
  const doc=await this.document(a,id,s),payload={...d,documentId:id,sha256,name:file.originalname,mime:type.mime};const previous=await this.store.replay('DocumentVersion',a,payload,s);if(previous)return this.clean(previous);if(doc.status!=='ACTIVE'||doc.version!==d.version)throw new ConflictException('Documento arquivado ou atualizado. Recarregue.');
  const limits=(await this.entitlements.resolve(a.tenantId!,s)).limits;await assertStorageQuota(this.store.db,a.tenantId!,file.buffer.length,limits?.storageBytes,s);
  const revision=doc.latestRevision+1;const [row]=await this.model('DocumentVersion').create([{...this.store.fields(a,payload),documentId:doc._id,revision,name:file.originalname,mime:type.mime,size:file.buffer.length,sha256,bytes:file.buffer,reason:d.reason}],{session:s});doc.latestRevision=revision;doc.version++;doc.history.push({action:'VERSION',reason:d.reason,actorId:a.sub,at:new Date()});await doc.save({session:s});return this.clean(row);
 });}
 async share(u:AuthUser,id:string,d:D.DocumentShareDto){return this.write(u,'documentos.configurar','documents.access.changed',async(a,s)=>{const doc=await this.document(a,id,s);if(doc.version!==d.version)throw new ConflictException('Documento atualizado.');await this.users(a,d.allowedUserIds,s);doc.allowedUserIds=d.allowedUserIds;doc.version++;doc.history.push({action:'ACCESS',reason:d.reason,actorId:a.sub,at:new Date()});await doc.save({session:s});return this.clean(doc);});}
 async state(u:AuthUser,id:string,d:D.DocumentStateDto){return this.write(u,'documentos.arquivar','documents.status.changed',async(a,s)=>{const doc=await this.document(a,id,s);if(doc.version!==d.version||doc.status===d.status)throw new ConflictException('Documento atualizado ou já neste estado.');doc.status=d.status;doc.version++;doc.history.push({action:d.status,reason:d.reason,actorId:a.sub,at:new Date()});await doc.save({session:s});return this.clean(doc);});}
 async download(u:AuthUser,id:string,versionId:string){const a=await this.store.access.require(u,['documentos.baixar']);await this.document(a,id);const row=await this.model('DocumentVersion').findOne({_id:this.store.id(versionId),tenantId:a.tenantId,documentId:id}).select('+bytes');if(!row)throw new NotFoundException('Versão não encontrada.');if(createHash('sha256').update(row.bytes).digest('hex')!==row.sha256)throw new ConflictException('Integridade do arquivo inválida.');await this.audit.record('documents.download','success',a,'documents',String(row._id));return {bytes:row.bytes,name:row.name,mime:row.mime};}
}
