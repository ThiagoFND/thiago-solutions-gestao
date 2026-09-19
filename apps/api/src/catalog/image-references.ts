import { BadRequestException } from '@nestjs/common';
import type { Connection, Types } from 'mongoose';
export async function validateImageReferences(connection:Connection,tenantId:string|Types.ObjectId,urls:(string|undefined)[]){
  const ids=[...new Set(urls.filter((url):url is string=>!!url&&url.startsWith('/api/public/images/')).map(url=>url.split('/').pop()!))];
  if(ids.length && await connection.model('CatalogImage').countDocuments({tenantId,_id:{$in:ids}})!==ids.length)throw new BadRequestException('Imagem indisponível para esta empresa.');
}
