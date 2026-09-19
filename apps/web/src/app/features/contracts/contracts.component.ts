import { Component, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CommerceApi, parsePrice } from '../commerce/commerce-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-contracts',standalone:true,imports:[FormsModule,CurrencyPipe,DatePipe],templateUrl:'./contracts.component.html',styleUrls:['../business/business.component.scss','../crm/crm.component.scss']})
export class ContractsComponent {
  busy=signal(false);message=signal('');rows=signal<any[]>([]);selected=signal<any>(null);accounts=signal<any[]>([]);parties=signal<any[]>([]);cycles=signal<any[]>([]);
  page=1;total=0;cyclePage=1;cycleTotal=0;search='';status='';reason='';competence='';settledDate='';contactName='';account={name:'',kind:'BANK'};
  draft={partyId:'',accountId:'',number:'',title:'',terms:'',startsOn:'',endsOn:'',price:'',intervalMonths:1,billingDay:10};amendment={effectiveMonth:'',terms:'',price:''};
  labels:Record<string,string>={DRAFT:'Rascunho',APPROVED:'Aprovado',ACTIVE:'Ativo',SUSPENDED:'Suspenso',ENDED:'Encerrado',CANCELED:'Cancelado',PENDING:'A receber',SETTLED:'Recebido'};
  private keys=new Map<string,string>();
  constructor(private api:CommerceApi,public auth:AuthService){void this.load();}
  private fail(e:any){const m=e.error?.message??e.message;this.message.set(Array.isArray(m)?m.join(' '):m??'Não foi possível concluir.');}
  private get(path:string){return firstValueFrom(this.api.get<any>(path));}
  private money(value:string){const n=parsePrice(value);if(n===null||n<1)throw new Error('Informe valor positivo com até duas casas decimais.');return n;}
  private async catalog(path:string){let page=1,items:any[]=[];while(true){const r=await this.get(`${path}?page=${page}&limit=100`);items.push(...r.items);if(items.length>=r.total||!r.items.length)return items;page++;}}
  async load(){if(this.busy())return;this.busy.set(true);try{const q=new URLSearchParams({page:String(this.page),limit:'20',search:this.search});if(this.status)q.set('status',this.status);const [r,a,p]=await Promise.all([this.get('contracts?'+q),this.catalog('contracts/accounts'),this.auth.can('cadastros.visualizar')?this.catalog('parties'):Promise.resolve([])]);this.rows.set(r.items);this.total=r.total;this.accounts.set(a);this.parties.set(p);}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async save(path:string,body:any,create=false){if(this.busy())return null;this.busy.set(true);try{let key=this.keys.get(path);if(create&&!key){key=crypto.randomUUID();this.keys.set(path,key);}const r=await firstValueFrom(this.api.post<any>(path,{...body,...(create?{requestId:key}:{})}));this.keys.delete(path);this.message.set('Operação salva.');return r;}catch(e){this.fail(e);return null;}finally{this.busy.set(false);}}
  async createAccount(){if(await this.save('contracts/accounts',this.account,true)){this.account.name='';await this.load();}}
  async createContact(){if(await this.save('parties',{name:this.contactName,roles:['CUSTOMER'],notes:''})){this.contactName='';await this.load();}}
  async create(){try{const {price,...data}=this.draft;const r=await this.save('contracts',{...data,amountCents:this.money(price)},true);if(r){this.draft.number='';this.draft.title='';await this.load();await this.open(r);}}catch(e){this.fail(e);}}
  async open(row:any){if(this.busy())return;this.busy.set(true);try{this.selected.set(await this.get('contracts/'+row._id));this.cyclePage=1;await this.loadCycles();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async loadCycles(){try{const r=await this.get(`contracts/cycles?contractId=${this.selected()._id}&page=${this.cyclePage}&limit=20`);this.cycles.set(r.items);this.cycleTotal=r.total;}catch(e){this.fail(e);}}
  actions(){const row=this.selected();if(!row)return [];const map:Record<string,string[]>={DRAFT:['APPROVED','CANCELED'],APPROVED:['ACTIVE','CANCELED'],ACTIVE:['SUSPENDED','ENDED','CANCELED'],SUSPENDED:['ACTIVE','ENDED','CANCELED']};return(map[row.status]??[]).filter(s=>this.auth.can(s==='APPROVED'?'contratos.aprovar':s==='CANCELED'?'contratos.cancelar':'contratos.gerenciar'));}
  async state(status:string){const r=this.selected();if(['CANCELED','ENDED'].includes(status)&&!confirm('Encerrar novas operações deste contrato? As cobranças existentes serão preservadas.'))return;const result=await this.save(`contracts/${r._id}/status`,{version:r.version,reason:this.reason,status});if(result){this.selected.set(result);await this.load();}}
  async amend(){try{const r=this.selected(),{price,...data}=this.amendment;const result=await this.save(`contracts/${r._id}/amendments`,{...data,amountCents:this.money(price),version:r.version,reason:this.reason});if(result){this.selected.set(result);await this.load();}}catch(e){this.fail(e);}}
  async generate(){if(await this.save(`contracts/${this.selected()._id}/cycles`,{competence:this.competence})){this.cyclePage=1;await this.loadCycles();}}
  async settle(row:any){if(!confirm('Confirmar que este valor foi efetivamente recebido?'))return;if(await this.save(`contracts/cycles/${row._id}/settle`,{version:row.payment.version,reason:this.reason,settledDate:this.settledDate}))await this.loadCycles();}
}
