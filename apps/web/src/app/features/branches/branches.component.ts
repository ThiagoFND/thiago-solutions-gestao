import { Component, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CommerceApi } from '../commerce/commerce-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-branches',standalone:true,imports:[FormsModule,DatePipe],templateUrl:'./branches.component.html',styleUrls:['../business/business.component.scss','../crm/crm.component.scss']})
export class BranchesComponent {
 busy=signal(false);message=signal('');rows=signal<any[]>([]);people=signal<any[]>([]);selected=signal<any>(null);page=1;total=0;search='';reason='';key=crypto.randomUUID();
 draft={code:'',name:'',cnpj:'',address:'',phone:'',managerId:'',memberIds:[] as string[],hours:'',policy:''};
 settings={managerId:'',memberIds:[] as string[],hours:'',policy:'',active:true};
 constructor(private api:CommerceApi,public auth:AuthService){void this.load();}
 private get(path:string){return firstValueFrom(this.api.get<any>('branches'+path));}
 private fail(e:any){if([403,404].includes(e.status))this.selected.set(null);const m=e.error?.message??e.message;this.message.set(Array.isArray(m)?m.join(' '):m??'Não foi possível concluir.');}
 async load(){if(this.busy())return;this.busy.set(true);try{const r=await this.get('?'+new URLSearchParams({page:String(this.page),limit:'20',search:this.search}));this.rows.set(r.items);this.total=r.total;if(this.auth.can('filiais.gerenciar')){const items:any[]=[];let p=1;while(true){const team=await this.get(`/people?page=${p}&limit=100`);items.push(...team.items);if(items.length>=team.total||!team.items.length)break;p++;}this.people.set(items);}}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 toggle(ids:string[],id:string,checked:boolean){if(checked&&!ids.includes(id))ids.push(id);if(!checked&&ids.includes(id))ids.splice(ids.indexOf(id),1);}
 async create(){if(this.busy())return;this.busy.set(true);let row:any;try{row=await firstValueFrom(this.api.post<any>('branches',{...this.draft,cnpj:this.draft.cnpj||undefined,requestId:this.key}));this.key=crypto.randomUUID();this.draft={code:'',name:'',cnpj:'',address:'',phone:'',managerId:'',memberIds:[],hours:'',policy:''};this.message.set('Unidade cadastrada.');}catch(e){this.fail(e);}finally{this.busy.set(false);}if(row){await this.load();await this.open(row);}}
 async open(row:any){if(this.busy())return;this.busy.set(true);try{const r=await this.get('/'+row._id);this.selected.set(r);this.settings={managerId:r.managerId,memberIds:[...r.memberIds],hours:r.hours,policy:r.policy,active:r.active};this.reason='';}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async save(){if(this.busy()||!this.selected())return;this.busy.set(true);let success=false;try{await firstValueFrom(this.api.post<any>(`branches/${this.selected()._id}/settings`,{...this.settings,version:this.selected().version,reason:this.reason}));this.selected.set(null);this.message.set('Responsabilidades atualizadas.');success=true;}catch(e){this.fail(e);}finally{this.busy.set(false);}if(success)await this.load();}
 person(id:string){return this.people().find(p=>p._id===id)?.name??'Colaborador vinculado';}
}
