import { Component, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CommerceApi, parsePrice } from '../commerce/commerce-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-projects',standalone:true,imports:[FormsModule,DatePipe,CurrencyPipe],templateUrl:'./projects.component.html',styleUrls:['../business/business.component.scss','../crm/crm.component.scss']})
export class ProjectsComponent {
 busy=signal(false);message=signal('');rows=signal<any[]>([]);people=signal<any[]>([]);parties=signal<any[]>([]);selected=signal<any>(null);tasks=signal<any[]>([]);times=signal<any[]>([]);comments=signal<any[]>([]);commentTask=signal<any>(null);taskOptions=signal<any[]>([]);
 page=1;total=0;taskPage=1;taskTotal=0;timePage=1;timeTotal=0;commentPage=1;commentTotal=0;search='';status='';reason='';commentText='';board=false;
 draft={name:'',scope:'',partyId:'',managerId:'',memberIds:[] as string[],startsOn:'',endsOn:'',price:'0'};revision={scope:'',endsOn:'',price:'0'};
 task={title:'',description:'',assignedId:'',dueOn:'',priority:'NORMAL',estimatedMinutes:60,dependencies:[] as string[]};time={taskId:'',startsAt:'',endsAt:'',billable:false,description:''};
 labels:Record<string,string>={PLANNED:'Planejado',ACTIVE:'Ativo',SUSPENDED:'Suspenso',COMPLETED:'Concluído',CANCELED:'Cancelado',TODO:'A fazer',IN_PROGRESS:'Em execução',REVIEW:'Em revisão',DONE:'Concluída',PENDING:'Aguardando análise',APPROVED:'Aprovado',REJECTED:'Rejeitado'};states=['TODO','IN_PROGRESS','REVIEW','DONE','CANCELED'];private keys=new Map<string,string>();
 constructor(private api:CommerceApi,public auth:AuthService){this.draft.managerId=auth.user()!.sub;this.task.assignedId=auth.user()!.sub;void this.load();}
 private fail(e:any){const m=e.error?.message??e.message;this.message.set(Array.isArray(m)?m.join(' '):m??'Não foi possível concluir.');}
 private get(path:string){return firstValueFrom(this.api.get<any>(path));}
 private money(value:string){const n=parsePrice(value);if(n===null)throw new Error('Informe valor válido com até duas casas decimais.');return n;}
 private async catalog(path:string){let page=1,items:any[]=[];while(true){const r=await this.get(`${path}${path.includes('?')?'&':'?'}page=${page}&limit=100`);items.push(...r.items);if(items.length>=r.total||!r.items.length)return items;page++;}}
 async load(){if(this.busy())return;this.busy.set(true);try{const q=new URLSearchParams({page:String(this.page),limit:'20',search:this.search});if(this.status)q.set('status',this.status);const [r,p,c]=await Promise.all([this.get('projects?'+q),this.catalog('projects/people'),this.auth.can('cadastros.visualizar')?this.catalog('parties'):Promise.resolve([])]);this.rows.set(r.items);this.total=r.total;this.people.set(p);this.parties.set(c);}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async save(path:string,body:any,create=false){if(this.busy())return null;this.busy.set(true);try{let key=this.keys.get(path);if(create&&!key){key=crypto.randomUUID();this.keys.set(path,key);}const r=await firstValueFrom(this.api.post<any>(path,{...body,...(create?{requestId:key}:{})}));this.keys.delete(path);this.message.set('Operação salva.');return r;}catch(e){this.fail(e);return null;}finally{this.busy.set(false);}}
 toggle(list:string[],id:string,checked:boolean){if(checked&&!list.includes(id))list.push(id);if(!checked)list.splice(list.indexOf(id),1);}
 async create(){try{const {price,partyId,...data}=this.draft;const r=await this.save('projects',{...data,partyId:partyId||undefined,budgetCents:this.money(price)},true);if(r){this.draft.name='';await this.load();await this.open(r);}}catch(e){this.fail(e);}}
 async open(row:any){if(this.busy())return;this.busy.set(true);try{const p=await this.get('projects/'+row._id);this.selected.set(p);this.revision={scope:p.revisions.at(-1).scope,endsOn:p.revisions.at(-1).endsOn,price:((p.revisions.at(-1).budgetCents??0)/100).toFixed(2)};this.taskPage=1;this.timePage=1;this.commentTask.set(null);this.taskOptions.set(await this.catalog('projects/tasks?projectId='+p._id));await this.loadTasks();await this.loadTimes();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async loadTasks(){try{const r=await this.get(`projects/tasks?projectId=${this.selected()._id}&page=${this.taskPage}&limit=20`);this.tasks.set(r.items);this.taskTotal=r.total;}catch(e){this.fail(e);}}
 async loadTimes(){try{const r=await this.get(`projects/times?projectId=${this.selected()._id}&page=${this.timePage}&limit=20`);this.times.set(r.items);this.timeTotal=r.total;}catch(e){this.fail(e);}}
 projectActions(){const p=this.selected(),map:Record<string,string[]>={PLANNED:['ACTIVE','CANCELED'],ACTIVE:['SUSPENDED','COMPLETED','CANCELED'],SUSPENDED:['ACTIVE','CANCELED'],COMPLETED:['ACTIVE']};return this.auth.can('projetos.gerenciar')?(map[p?.status]??[]):[];}
 taskActions(t:any){if(!this.auth.can('projetos.executar')||(t.assignedId!==this.auth.user()?.sub&&!this.auth.can('projetos.gerenciar')))return [];const map:Record<string,string[]>={TODO:['IN_PROGRESS','CANCELED'],IN_PROGRESS:['REVIEW','TODO','CANCELED'],REVIEW:['DONE','IN_PROGRESS','CANCELED'],DONE:['TODO'],CANCELED:['TODO']};return(map[t.status]??[]).filter(s=>!(['DONE','CANCELED'].includes(s)||['DONE','CANCELED'].includes(t.status))||this.auth.can('projetos.gerenciar'));}
 async state(status:string){const p=this.selected();if(status==='CANCELED'&&!confirm('Cancelar o projeto e preservar seu histórico?'))return;if(await this.save(`projects/${p._id}/status`,{version:p.version,reason:this.reason,status})){await this.load();await this.open(p);}}
 async revise(){try{const p=this.selected(),{price,...r}=this.revision;if(await this.save(`projects/${p._id}/revisions`,{...r,budgetCents:this.money(price),version:p.version,reason:this.reason}))await this.open(p);}catch(e){this.fail(e);}}
 async createTask(){if(await this.save('projects/tasks',{...this.task,projectId:this.selected()._id},true)){this.task.title='';this.task.dependencies=[];await this.open(this.selected());}}
 async taskState(t:any,status:string){if(await this.save(`projects/tasks/${t._id}/status`,{version:t.version,reason:this.reason,status}))await this.open(this.selected());}
 async recordTime(){try{if(await this.save('projects/times',{...this.time,startsAt:new Date(this.time.startsAt).toISOString(),endsAt:new Date(this.time.endsAt).toISOString()},true)){this.time.description='';await this.open(this.selected());}}catch(e){this.fail(e);}}
 async reviewTime(t:any,status:string){if(await this.save(`projects/times/${t._id}/review`,{version:t.version,reason:this.reason,status}))await this.open(this.selected());}
 async openComments(t:any){this.commentTask.set(t);this.commentPage=1;await this.loadComments();}
 async loadComments(){try{const r=await this.get(`projects/tasks/${this.commentTask()._id}/comments?page=${this.commentPage}&limit=20`);this.comments.set(r.items);this.commentTotal=r.total;}catch(e){this.fail(e);}}
 async comment(){if(await this.save(`projects/tasks/${this.commentTask()._id}/comments`,{text:this.commentText},true)){this.commentText='';this.commentPage=1;await this.loadComments();}}
 person(id:string){return this.people().find(p=>p._id===id)?.name??'Colaborador';}
 taskName(id:string){return this.taskOptions().find(t=>t._id===id)?.title??'Tarefa';}
 group(status:string){return this.tasks().filter(t=>t.status===status);}
 editable(){return ['PLANNED','ACTIVE'].includes(this.selected()?.status);}
}
