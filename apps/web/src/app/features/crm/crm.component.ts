import { Component, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CommerceApi, parsePrice } from '../commerce/commerce-api.service';
import { AuthService } from '../../core/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
@Component({selector:'app-crm', standalone:true, imports:[FormsModule,CurrencyPipe,DatePipe], templateUrl:'./crm.component.html', styleUrls:['../business/business.component.scss','./crm.component.scss']})
export class CrmComponent {
  rows=signal<any[]>([]);pipelines=signal<any[]>([]);parties=signal<any[]>([]);people=signal<any[]>([]);selected=signal<any>(null);summary=signal<any>(null);busy=signal(false);message=signal('');
  page=1;total=0;detailPage=1;search='';status='';view='list';reason='';stage='';contactName='';
  pipeline={name:'Comercial',stages:[{code:'CONTACT',name:'Primeiro contato',probability:10},{code:'PROPOSAL',name:'Proposta',probability:50},{code:'NEGOTIATION',name:'Negociação',probability:75}]};
  opportunity={title:'',partyId:'',pipelineId:'',assignedId:'',amount:'0',expectedDate:new Date().toISOString().slice(0,10),source:'',notes:''};
  activity={kind:'CALL',description:'',dueDate:new Date().toISOString().slice(0,10)};
  proposal={validUntil:new Date().toISOString().slice(0,10),conditions:'Condições de atendimento a combinar.',discount:'0',lines:[{description:'',quantity:1,price:'0'}]};
  readonly labels:Record<string,string>={OPEN:'Em negociação',WON:'Ganha',LOST:'Perdida',CALL:'Ligação',MEETING:'Reunião',EMAIL:'E-mail',TASK:'Tarefa',NOTE:'Anotação',STAGE:'Mudança de etapa',RESULT:'Resultado',DRAFT:'Rascunho',APPROVED:'Aprovada'};
  private keys=new Map<string,string>();
  constructor(private api:CommerceApi,public auth:AuthService,private http:HttpClient){this.opportunity.assignedId=auth.user()!.sub;void this.load();}
  async exportPage(){if(this.busy())return;this.busy.set(true);try{const q=new URLSearchParams({page:String(this.page),limit:'20',search:this.search});if(this.status)q.set('status',this.status);const blob=await firstValueFrom(this.http.get(`${environment.apiUrl}/crm/export?${q}`,{responseType:'blob'}));const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='crm-pagina.csv';a.click();URL.revokeObjectURL(url);}catch(e){this.error(e);}finally{this.busy.set(false);}}
  private key(path:string){let id=this.keys.get(path);if(!id){id=crypto.randomUUID();this.keys.set(path,id);}return id;}
  private async get(path:string){return firstValueFrom(this.api.get<any>(path));}
  private error(e:any){const text=e.error?.message??e.message;this.message.set(Array.isArray(text)?text.join(' '):text??'Não foi possível concluir a operação.');}
  private async lookup(path:string){let page=1,result:any[]=[];while(true){const response=await this.get(`${path}?page=${page}&limit=100`);result.push(...response.items);if(result.length>=response.total||!response.items.length)return result;page++;}}
  async load(){if(this.busy())return;this.busy.set(true);try{const q=new URLSearchParams({page:String(this.page),limit:'20',search:this.search});if(this.status)q.set('status',this.status);const [list,pipelines,parties,people,summary]=await Promise.all([this.get(`crm/opportunities?${q}`),this.lookup('crm/pipelines'),this.lookup('crm/parties'),this.lookup('crm/people'),this.get('crm/summary')]);this.rows.set(list.items);this.total=list.total;this.pipelines.set(pipelines);this.parties.set(parties);this.people.set(people);this.summary.set(summary);if(!this.opportunity.pipelineId)this.opportunity.pipelineId=pipelines[0]?._id??'';}catch(e){this.error(e);}finally{this.busy.set(false);}}
  async open(row:any,page=1){if(this.busy())return;this.busy.set(true);try{this.selected.set(await this.get(`crm/opportunities/${row._id}?page=${page}&limit=20`));this.detailPage=page;this.stage=this.selected().opportunity.stage;this.reason='';}catch(e){this.error(e);}finally{this.busy.set(false);}}
  async save(path:string,body:any,idempotent=false){if(this.busy())return;this.busy.set(true);try{await firstValueFrom(this.api.post(path,{...body,...(idempotent?{requestId:this.key(path)}:{})}));this.keys.delete(path);this.message.set('Registro salvo com sucesso.');return true;}catch(e){this.error(e);return false;}finally{this.busy.set(false);}}
  amount(text:string){const value=parsePrice(text);if(value===null)throw new Error('Informe um valor com até duas casas decimais.');return value;}
  async createPipeline(){if(await this.save('crm/pipelines',this.pipeline,true))await this.load();}
  addStage(){if(this.pipeline.stages.length<20)this.pipeline.stages.push({code:`STAGE_${this.pipeline.stages.length+1}`,name:'',probability:0});}
  async createContact(){if(await this.save('parties',{name:this.contactName,roles:['CUSTOMER'],notes:''})){this.contactName='';await this.load();}}
  async createOpportunity(){try{const {amount,...data}=this.opportunity;if(await this.save('crm/opportunities',{...data,amountCents:this.amount(amount)},true)){this.opportunity.title='';await this.load();}}catch(e){this.error(e);}}
  private async action(suffix:string,body:any,idempotent=false){const row=this.selected().opportunity;if(await this.save(`crm/opportunities/${row._id}/${suffix}`,body,idempotent)){await this.open(row);await this.load();}}
  move(){void this.action('stage',{version:this.selected().opportunity.version,stage:this.stage,reason:this.reason});}
  close(status:string){if(window.confirm('Registrar o resultado comercial? Isso não confirma pagamento, estoque ou emissão fiscal.'))void this.action('result',{version:this.selected().opportunity.version,status,reason:this.reason});}
  addActivity(){void this.action('activities',this.activity,true);}
  complete(row:any){void this.action(`activities/${row._id}/complete`,{version:row.version,reason:this.reason});}
  addLine(){if(this.proposal.lines.length<100)this.proposal.lines.push({description:'',quantity:1,price:'0'});}
  createProposal(){try{void this.action('proposals',{validUntil:this.proposal.validUntil,conditions:this.proposal.conditions,discountCents:this.amount(this.proposal.discount),lines:this.proposal.lines.map(line=>({description:line.description,quantity:line.quantity,unitCents:this.amount(line.price)}))},true);}catch(e){this.error(e);}}
  approve(row:any){if(window.confirm('Aprovar esta versão e preservar suas condições?'))void this.action(`proposals/${row._id}/approve`,{version:row.version,reason:this.reason});}
  stageName(row:any){return row.stages.find((s:any)=>s.code===row.stage)?.name??row.stage;}
}
