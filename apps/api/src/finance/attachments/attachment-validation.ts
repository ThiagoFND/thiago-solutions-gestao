import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import { XMLValidator } from 'fast-xml-parser';
export function attachmentLimit(name:string,fallback:number,max:number){const v=Number(process.env[name]??fallback);if(!Number.isSafeInteger(v)||v<1||v>max)throw new Error('Invalid attachment limit');return v;}
export async function validateAttachment(file:{originalname:string;mimetype:string;buffer:Buffer}) {
 if(!file?.buffer?.length)throw new BadRequestException('Selecione um arquivo não vazio.');
 if(file.buffer.length>attachmentLimit('ATTACHMENT_MAX_BYTES',5*1024*1024,25*1024*1024))throw new PayloadTooLargeException('O arquivo excede o tamanho permitido.');
 if(file.originalname.length>180 || /[\/\\\x00-\x1f]/.test(file.originalname))throw new BadRequestException('Nome de arquivo inválido.');
 const extension=file.originalname.split('.').pop()?.toLowerCase();
 const accepted:Record<string,string>={pdf:'application/pdf',xml:'application/xml',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
 if(!extension||!accepted[extension])throw new BadRequestException('Use PDF, XML, JPG, JPEG, PNG ou WEBP.');
 let mime:string|undefined;
 if(extension==='xml'){
  let xml:string;try{xml=new TextDecoder('utf-8',{fatal:true}).decode(file.buffer);}catch{throw new BadRequestException('Envie XML em UTF-8.');}
  if(/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|<(?:html|script)(?:\s|>)/i.test(xml)||XMLValidator.validate(xml)!==true)throw new BadRequestException('XML inválido ou com conteúdo não permitido.');
  mime='application/xml';
 }else{try{mime=(await fileTypeFromBuffer(file.buffer))?.mime;}catch{throw new BadRequestException('Arquivo incompleto ou inválido.');}}
 if(mime!==accepted[extension] || !(file.mimetype===mime || extension==='xml'&&file.mimetype==='text/xml'))throw new BadRequestException('O conteúdo, a extensão e o tipo do arquivo devem corresponder.');
 return {mime,extension:extension==='jpeg'?'jpg':extension};
}
