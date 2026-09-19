import { ForbiddenException } from '@nestjs/common';
import { Types, type ClientSession, type Connection } from 'mongoose';
/** Caller must hold the tenant write fence in the same transaction. Retained bytes count too. */
export async function assertStorageQuota(db:Connection,tenantId:string,additional:number,limit:number|undefined,session:ClientSession){
 if(!Number.isSafeInteger(additional)||additional<1||typeof limit!=='number'||!Number.isSafeInteger(limit)||limit<0)throw new ForbiddenException('Limite de armazenamento indisponível.');
 const tenant=new Types.ObjectId(tenantId);let used=0;
 for(const [collection,expression] of [['financial_attachments_v2','$size'],['catalog_images_v2',{$binarySize:'$bytes'}],['document_versions_v2','$size']] as const){
  const [row]=await db.collection(collection).aggregate([{$match:{tenantId:tenant}},{$group:{_id:null,total:{$sum:expression}}}],{session,maxTimeMS:10000}).toArray();used+=row?.total??0;
 }
 if(!Number.isSafeInteger(used)||used+additional>limit!)throw new ForbiddenException('Limite de armazenamento contratado atingido. As versões preservadas também ocupam espaço.');
}
