import { PermissionDirective } from '../../core/permission.directive';
import { Component, Input, OnChanges, signal } from '@angular/core';
import { FinanceService } from './finance.service';
@Component({selector:'app-attachments',standalone:true,templateUrl:'./attachments.component.html',styleUrl:'./attachments.component.scss'})
export class AttachmentsComponent implements OnChanges {
 @Input({required:true}) entryId=''; items=signal<any[]>([]);busy=signal(false);error=signal('');message=signal('');
 constructor(private api:FinanceService){} ngOnChanges(){void this.load();}
 async load(){try{this.items.set(await this.api.get<any[]>(`entries/${this.entryId}/attachments`));}catch{this.error.set('Não foi possível carregar anexos.');}}
 async upload(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file||this.busy())return;this.busy.set(true);this.error.set('');this.message.set('');try{const body=new FormData();body.append('file',file);await this.api.post(`entries/${this.entryId}/attachments`,body);await this.load();this.message.set('Anexo enviado.');input.value='';}catch(e:any){this.error.set(e.error?.message??'Não foi possível enviar o anexo.');}finally{this.busy.set(false);}}
 async download(item:any){try{const blob=await this.api.download(`entries/${this.entryId}/attachments/${item._id}/download`),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=item.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{this.error.set('Não foi possível baixar o anexo.');}}
 async remove(item:any){if(this.busy()||!confirm('Remover este anexo da consulta? O registro de auditoria será preservado.'))return;this.busy.set(true);try{await this.api.post(`entries/${this.entryId}/attachments/${item._id}/remove`,{});await this.load();this.message.set('Anexo removido da consulta.');}catch{this.error.set('Não foi possível remover o anexo.');}finally{this.busy.set(false);}}
}
