import { Component, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CommerceApi } from '../commerce/commerce-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-documents',standalone:true,imports:[FormsModule,DatePipe],templateUrl:'./documents.component.html',styleUrls:['../business/business.component.scss','../crm/crm.component.scss']})
export class DocumentsComponent {
 busy=signal(false);message=signal('');rows=signal<any[]>([]);people=signal<any[]>([]);selected=signal<any>(null);versions=signal<any[]>([]);page=1;total=0;versionPage=1;versionTotal=0;search='';status='';reason='';allowedUserIds:string[]=[];file:File|null=null;uploadKey='';
 draft={title:'',category:'',description:'',originReference:'',allowedUserIds:[] as string[]};private keys=new Map<string,string>();
 constructor(private api:CommerceApi,private http:HttpClient,public auth:AuthService){void this.load();}
 private fail(e:any){if([403,404].includes(e.status)){this.selected.set(null);this.versions.set([]);}const m=e.error?.message??e.message;this.message.set(Array.isArray(m)?m.join(' '):m??'Não foi possível concluir.');}
 private get(path:string){return firstValueFrom(this.api.get<any>('documents'+path));}
 private async team(){let page=1,items:any[]=[];while(true){const r=await this.get(`/people?page=${page}&limit=100`);items.push(...r.items);if(items.length>=r.total||!r.items.length)return items;page++;}}
 async load(){if(this.busy())return;this.busy.set(true);try{const q=new URLSearchParams({page:String(this.page),limit:'20',search:this.search});if(this.status)q.set('status',this.status);const [r,p]=await Promise.all([this.get('?'+q),this.auth.can('documentos.configurar')?this.team():Promise.resolve([])]);this.rows.set(r.items);this.total=r.total;this.people.set(p);}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async save(path:string,body:any,create=false){if(this.busy())return null;this.busy.set(true);try{let key=this.keys.get(path);if(create&&!key){key=crypto.randomUUID();this.keys.set(path,key);}const r=await firstValueFrom(this.api.post<any>('documents'+path,{...body,...(create?{requestId:key}:{})}));this.keys.delete(path);this.message.set('Operação salva.');return r;}catch(e){this.fail(e);return null;}finally{this.busy.set(false);}}
 toggle(ids:string[],id:string,checked:boolean){if(checked&&!ids.includes(id))ids.push(id);if(!checked&&ids.includes(id))ids.splice(ids.indexOf(id),1);}
 async create(){const r=await this.save('',this.draft,true);if(r){this.draft.title='';await this.load();await this.open(r);}}
 async open(row:any){if(this.busy())return;this.busy.set(true);try{const r=await this.get('/'+row._id);this.selected.set(r);this.allowedUserIds=[...r.allowedUserIds];this.versionPage=1;this.file=null;this.uploadKey='';await this.loadVersions();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async loadVersions(){try{const r=await this.get(`/${this.selected()._id}/versions?page=${this.versionPage}&limit=20`);this.versions.set(r.items);this.versionTotal=r.total;}catch(e){this.fail(e);}}
 chooseFile(event:Event){const file=(event.target as HTMLInputElement).files?.[0]??null;if(file&&file.size>5*1024*1024){this.file=null;this.message.set('Limite de 5 MiB por versão.');return;}this.file=file;this.uploadKey=crypto.randomUUID();}
 async upload(){if(this.busy()||!this.file||!this.selected())return;this.busy.set(true);const row=this.selected();let success=false;try{const data=new FormData();data.append('file',this.file);data.append('version',String(row.version));data.append('reason',this.reason);data.append('requestId',this.uploadKey||crypto.randomUUID());await firstValueFrom(this.http.post(`${environment.apiUrl}/documents/${row._id}/versions`,data));this.file=null;this.message.set('Nova versão preservada.');success=true;}catch(e){this.fail(e);}finally{this.busy.set(false);}if(success){await this.load();await this.open(row);}}
 async download(v:any){try{const blob=await firstValueFrom(this.http.get(`${environment.apiUrl}/documents/${this.selected()._id}/versions/${v._id}/download`,{responseType:'blob'}));const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=v.name;a.click();URL.revokeObjectURL(url);}catch(e){this.fail(e);}}
 async state(){const row=this.selected();if(!confirm(row.status==='ACTIVE'?'Arquivar mantendo todas as versões?':'Reativar este documento?'))return;const r=await this.save(`/${row._id}/status`,{version:row.version,reason:this.reason,status:row.status==='ACTIVE'?'ARCHIVED':'ACTIVE'});if(r){this.selected.set(r);await this.load();}}
 async share(){const row=this.selected();if(await this.save(`/${row._id}/access`,{version:row.version,reason:this.reason,allowedUserIds:this.allowedUserIds})){this.selected.set(null);this.versions.set([]);await this.load();}}
}
