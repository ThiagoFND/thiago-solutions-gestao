import { Component, signal, computed } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { availablePlanChoices } from './plan-choices';
import { activeModuleCodes, moduleName } from './system-modules';
import { CommerceApi, type Offer, type Quote, type Invoice, type SubscriptionDetail } from './commerce-api.service';
@Component({selector:'app-subscription',standalone:true,imports:[CurrencyPipe,DatePipe,FormsModule],templateUrl:'./subscription.component.html',styleUrls:['./commerce.scss','./subscription-comparison.scss']})
export class SubscriptionComponent {
  detail=signal<SubscriptionDetail|null>(null);offers=signal<Offer[]>([]);quote=signal<Quote|null>(null);invoices=signal<Invoice[]>([]);busy=signal(false);message=signal('');
  permissionGroups=computed(()=>{const rows=this.quote()?.accessComparison?.permissions??[];return [...new Set(rows.map(p=>p.module))].map(module=>({module,name:rows.find(p=>p.module===module)!.moduleName,permissions:rows.filter(p=>p.module===module)}));});
  plan='CUSTOM';cycle='MONTHLY';modules:string[]=[];note='';page=1;total=0;
  planChoices(){return availablePlanChoices(this.offers(),this.detail()?.subscription?.snapshot.planCode);}
  moduleNames(codes:string[]){return activeModuleCodes(codes).map(moduleName).join(', ');}
  planAvailable(){return (this.plan==='CUSTOM'&&this.offers().some(o=>o.kind==='BASE'&&o.code==='BASE'&&o.active&&o.available&&!o.testOnly))||this.planChoices().some(o=>o.code===this.plan&&o.available);}
  coupons='';
  requests=signal<any[]>([]);requestPage=1;requestTotal=0;
  readonly statusNames:Record<string,string>={TRIAL:'Em teste',ACTIVE:'Ativa',PENDING_PAYMENT:'Aguardando pagamento',PAST_DUE:'Em atraso',SUSPENDED:'Suspensa',CANCELED:'Cancelada',EXPIRED:'Expirada',DRAFT:'Rascunho',OPEN:'Em aberto',PAID:'Paga',OVERDUE:'Vencida',WAIVED:'Isenta'};
  constructor(private readonly api:CommerceApi){this.load();this.loadRequests();}
  loadRequests(delta=0){this.requestPage+=delta;this.api.get<any>(`subscription/requests?page=${this.requestPage}&limit=20`).subscribe({next:p=>{this.requests.set(p.items);this.requestTotal=p.total;},error:e=>this.fail(e)});}
  load(){this.api.detail().subscribe({next:d=>this.detail.set(d),error:e=>this.fail(e)});this.api.catalog().subscribe({next:o=>this.offers.set(o),error:e=>this.fail(e)});this.loadInvoices();}
  loadInvoices(delta=0){this.page+=delta;this.api.invoices(this.page).subscribe({next:p=>{this.invoices.set(p.items);this.total=p.total;},error:e=>this.fail(e)});}
  select(code:string,checked:boolean){this.modules=checked?[...this.modules,code]:this.modules.filter(m=>m!==code);this.quote.set(null);}
  choices(){return {planCode:this.plan,modules:this.plan==='CUSTOM'?this.modules:[],cycle:this.cycle,coupons:this.coupons.split(',').map(c=>c.trim().toUpperCase()).filter(Boolean)};}
  simulate(){if(this.busy()||!this.planAvailable())return;this.quote.set(null);this.busy.set(true);this.api.post<Quote>('subscription/quote',this.choices()).subscribe({next:q=>{this.quote.set(q);this.busy.set(false);this.message.set('Simulação atualizada. Nenhuma contratação foi realizada.');},error:e=>this.fail(e)});}
  request(kind:'CHANGE'|'CANCEL'){
    if(this.busy()||this.note.trim().length<5){this.message.set('Descreva a solicitação com pelo menos 5 caracteres.');return;}
    if(kind==='CHANGE'&&!this.quote()){this.message.set('Simule os valores antes de enviar.');return;}
    if(!window.confirm(kind==='CANCEL'?'Enviar pedido de cancelamento para análise?':'Enviar esta proposta para aprovação administrativa?'))return;
    this.busy.set(true);this.api.post('subscription/requests',{...this.choices(),kind,note:this.note.trim()}).subscribe({next:()=>{this.busy.set(false);this.message.set('Solicitação enviada. Seu contrato atual permanece vigente até a decisão administrativa.');this.note='';this.loadRequests();},error:e=>this.fail(e)});
  }
  fail(e:any){this.busy.set(false);const message=e.error?.message;this.message.set(Array.isArray(message)?message.join(' '):message||'Não foi possível concluir. Atualize a página e tente novamente.');}
}
