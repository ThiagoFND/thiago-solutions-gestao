import { Injectable } from '@nestjs/common';
import { mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
export abstract class AttachmentStorage { abstract put(key:string,bytes:Buffer):Promise<void>; abstract get(key:string):Promise<Buffer>; }
@Injectable()
export class LocalAttachmentStorage extends AttachmentStorage {
 private root=resolve(process.env.ATTACHMENT_STORAGE_DIR ?? '.private-attachments');
 private async path(key:string) {
  if(!/^[a-f0-9-]{36}\.(pdf|xml|jpg|png|webp)$/.test(key)) throw new Error('Invalid storage key');
  await mkdir(this.root,{recursive:true,mode:0o700});
  const root=await realpath(this.root);
  if(root.split(sep).some(s=>['public','browser'].includes(s.toLowerCase()))) throw new Error('Attachment storage must be private');
  const path=resolve(root,key), rel=relative(root,path);
  if(rel.startsWith('..') || isAbsolute(rel)) throw new Error('Invalid storage path');
  return path;
 }
 async put(key:string,bytes:Buffer){await writeFile(await this.path(key),bytes,{flag:'wx',mode:0o600});}
 async get(key:string){const path=await this.path(key);if(await realpath(path)!==path)throw new Error('Symbolic links are not allowed');return readFile(path);}
}
