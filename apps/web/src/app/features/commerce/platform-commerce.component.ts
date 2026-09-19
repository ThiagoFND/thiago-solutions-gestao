import { commercialLabel } from './commercial-labels';
import { SYSTEM_MODULE_NAMES, activeModuleCodes, moduleName, systemModuleChoices } from './system-modules';
import { availablePlanChoices } from './plan-choices';
import { TenancyApi, Company } from '../../core/tenancy-api.service';
import { Component, signal, Output, EventEmitter, ChangeDetectorRef, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CommerceApi, parsePrice, type Offer, type Quote, type Invoice, type SubscriptionDetail } from './commerce-api.service';
@Component({selector:'app-platform-commerce',standalone:true,imports:[CurrencyPipe,DatePipe,FormsModule],templateUrl:'./platform-commerce.component.html',styleUrls:['./commerce.scss','./platform-commerce.scss']})
export class PlatformCommerceComponent {
  private readonly changeDetector=inject(ChangeDetectorRef);
  refreshView(){this.changeDetector.markForCheck();}
  @Output() companyRequested=new EventEmitter<Company>();
  @Output() sectionRequested=new EventEmitter<string>();
  catalogLoaded=signal(false);detailLoading=signal(false);detailError=signal('');
  requestCompany(id:string){this.tenancy.company(id).subscribe({next:c=>this.companyRequested.emit(c),error:e=>this.fail(e)});}
  selectTenant(id:string){if(this.busy())return;this.tenant=id;this.reason='';this.discountCodes='';this.couponCodes='';this.method='';this.scheduled=false;this.invoicePage=1;this.loadTenant();}
  label=commercialLabel;
  moduleName=moduleName;
  configurableModules=Object.keys(SYSTEM_MODULE_NAMES);
  segmentPlans=signal<any[]>([]);
  portfolioServices=signal<any[]>([]);
  segmentMissing(plan:any){return plan.modules.filter((code:string)=>!Object.hasOwn(SYSTEM_MODULE_NAMES,code)).map((code:string)=>this.portfolioServices().find(s=>s.code===code)?.name??code).join(', ');}
  configureSegment(plan:any){if(this.segmentMissing(plan))return;const existing=this.offers().find(o=>o.kind==='PLAN'&&o.code===plan.code);if(existing){this.edit(existing);return;}this.newPlan();this.editing={...this.editing!,code:plan.code,name:plan.name,description:plan.benefit,active:false,available:false};this.selectedModules=[...plan.modules];}
  moduleToConfigure='';
  newModule(){const code=this.moduleToConfigure;if(!Object.hasOwn(SYSTEM_MODULE_NAMES,code))return;const existing=this.offers().find(o=>o.kind==='MODULE'&&o.code===code);if(existing){this.edit(existing);return;}this.newPlan();this.editing={...this.editing!,kind:'MODULE',code,name:moduleName(code),description:moduleName(code),modules:[code]};}
  planChoices(){return availablePlanChoices(this.offers(),this.detail()?.subscription?.snapshot.planCode);}
  planAvailable(){return (this.plan==='CUSTOM'&&this.offers().some(o=>o.kind==='BASE'&&o.code==='BASE'&&o.active&&o.available&&!o.testOnly))||this.planChoices().some(o=>o.code===this.plan&&o.available);}
  moduleChoices(){return systemModuleChoices(this.detail()?.availableModules??Object.keys(SYSTEM_MODULE_NAMES),this.offers(),this.cycle);}
  effectiveModuleNames(codes:string[]){return activeModuleCodes(codes).map(moduleName).join(', ');}
  configureModule(code:string){
    const existing=this.offers().find(o=>o.kind==='MODULE'&&o.code===code);
    if(existing)this.edit(existing);
    else{this.newPlan();this.editing={...this.editing!,kind:'MODULE',code,name:moduleName(code),description:moduleName(code),modules:[code]};}
    this.sectionRequested.emit('catalog');
  }
  historyPage=1;historyTotal=0;
  loadHistory(delta=0){const tenant=this.tenant,page=this.historyPage+delta;this.historyPage=page;this.api.get<any>(`platform/commerce/tenants/${tenant}/history?page=${page}&limit=20`).subscribe({next:p=>{if(tenant===this.tenant&&page===this.historyPage){this.history.set(p.items);this.historyTotal=p.total;}},error:e=>this.fail(e)});}
  offers=signal<Offer[]>([]);dashboard=signal<any>(null);detail=signal<SubscriptionDetail|null>(null);invoices=signal<Invoice[]>([]);quote=signal<Quote|null>(null);history=signal<any[]>([]);busy=signal(false);message=signal('');
  section='dashboard';tenant='';reason='';plan='CUSTOM';modules:string[]=[];cycle='MONTHLY';discountCodes='';status='ACTIVE';startsAt=new Date().toISOString().slice(0,10);endsAt='';dueAt='';competence=new Date().toISOString().slice(0,7);invoicePage=1;invoiceTotal=0;method='';
  editing:Offer|null=null;monthly='';annual='';selectedModules:string[]=[];
  promotion={code:'',name:'',kind:'PERCENT',value:2000,scope:'SUBTOTAL',modules:[] as string[],plans:[] as string[],startsAt:new Date().toISOString().slice(0,10),endsAt:'',maxCycles:12,combinable:false,active:true,version:0};
  discounts=signal<any[]>([]);
  scheduled=false;couponRows=signal<any[]>([]);couponPage=1;couponTotal=0;couponCodes='';
  coupon={code:'',discountCode:'',startsAt:new Date().toISOString().slice(0,10),endsAt:'',maxUses:100,perTenant:1,active:true,version:0};
  constructor(private readonly api:CommerceApi,private readonly tenancy:TenancyApi,route:ActivatedRoute){this.tenant=route.snapshot.queryParamMap.get('tenant')??'';this.api.get<any>('public/solutions').subscribe({next:r=>{this.segmentPlans.set(r.plans);this.portfolioServices.set(r.services);},error:e=>this.fail(e)});this.load();if(this.tenant){this.section='subscriptions';this.loadTenant();}}
  load(){this.api.catalog(true).subscribe({next:o=>{this.offers.set(o);this.catalogLoaded.set(true);},error:e=>this.fail(e)});this.api.get('platform/commerce/dashboard').subscribe({next:d=>this.dashboard.set(d),error:e=>this.fail(e)});this.api.get<any[]>('platform/commerce/discounts').subscribe({next:d=>this.discounts.set(d),error:e=>this.fail(e)});}
  fail(e:any){this.busy.set(false);const m=e.error?.message;this.message.set(Array.isArray(m)?m.join(' '):m||'Não foi possível concluir a operação.');}
  mutate(path:string,body:unknown,done?:()=>void){if(this.busy())return;this.busy.set(true);this.api.post(path,body).subscribe({next:()=>{this.busy.set(false);this.message.set('Operação registrada com sucesso.');this.load();done?.();},error:e=>this.fail(e)});}
  confirm(label:string){if(this.reason.trim().length<5){this.message.set('Informe um motivo com pelo menos 5 caracteres.');return false;}return window.confirm(label);}
  initialize(){if(this.confirm('Cadastrar apenas as ofertas iniciais ainda ausentes?'))this.mutate('platform/commerce/catalog/initialize',{reason:this.reason});}
  edit(o:Offer){this.editing=structuredClone(o);this.monthly=(o.monthlyCents/100).toFixed(2);this.annual=o.annualCents===undefined?'':(o.annualCents/100).toFixed(2);this.selectedModules=activeModuleCodes(o.modules);}
  newQuality(){const existing=this.offers().find(o=>o.code==='TRACEABILITY');if(existing){this.edit(existing);return;}this.newPlan();this.editing={...this.editing!,kind:'MODULE',code:'TRACEABILITY',name:'Qualidade e devoluções',description:'Recebimento, inspeção e reposição aprovada. Rastreabilidade completa e recalls pendentes.',modules:['TRACEABILITY']};}
  newPlan(){this.editing={code:'',kind:'PLAN',name:'',description:'',version:0,monthlyCents:0,currency:'BRL',modules:[],active:true,available:true,order:0,featured:false,limits:{activeUsers:3,products:10000,categories:1000,storageBytes:1073741824,landingPages:1}};this.monthly='';this.annual='';this.selectedModules=[];}
  toggle(list:'modules'|'selectedModules',code:string,checked:boolean){this[list]=checked?[...this[list],code]:this[list].filter(m=>m!==code);this.quote.set(null);}
  saveOffer(){if(!this.editing)return;const monthlyCents=parsePrice(this.monthly),annualCents=this.annual.trim()?parsePrice(this.annual):undefined;if(monthlyCents===null||annualCents===null){this.message.set('Informe preços em reais com até duas casas decimais.');return;}if(!this.confirm('Criar uma nova versão para futuras contratações?'))return;this.mutate('platform/commerce/catalog/versions',{...this.editing,monthlyCents,annualCents,modules:this.editing.kind==='PLAN'?this.selectedModules:this.editing.modules,reason:this.reason},()=>this.editing=null);}
  loadTenant(){
    if(!/^[a-f\d]{24}$/i.test(this.tenant)){return;}
    const tenant=this.tenant;this.detailLoading.set(true);this.detailError.set('');this.message.set('');this.detail.set(null);this.quote.set(null);this.invoices.set([]);this.history.set([]);
    this.plan='CUSTOM';this.modules=[];this.status='ACTIVE';this.cycle='MONTHLY';this.endsAt='';this.dueAt='';this.startsAt=new Date().toISOString().slice(0,10);
    this.api.detail(tenant).subscribe({next:d=>{if(tenant!==this.tenant)return;this.detailLoading.set(false);this.detail.set(d);if(d.subscription){this.status=d.subscription.status;this.plan=d.subscription.snapshot.planCode;this.cycle=d.subscription.snapshot.cycle;this.modules=activeModuleCodes(d.subscription.snapshot.modules);this.startsAt=d.subscription.startsAt.slice(0,10);this.endsAt=d.subscription.endsAt.slice(0,10);this.dueAt=d.subscription.nextDueAt.slice(0,10);}},error:e=>{if(tenant===this.tenant){this.detailLoading.set(false);this.detailError.set(e.status===404?'Empresa ou endpoint de assinatura n\u00e3o encontrado. Atualize a API e confira a empresa selecionada.':'N\u00e3o foi poss\u00edvel carregar o contrato. Tente atualizar.');this.fail(e);}}});
    this.loadInvoices();this.historyPage=1;this.loadHistory();
  }
  loadInvoices(delta=0){this.invoicePage+=delta;const tenant=this.tenant,page=this.invoicePage;this.api.invoices(page,tenant).subscribe({next:p=>{if(tenant!==this.tenant||page!==this.invoicePage)return;this.invoices.set(p.items);this.invoiceTotal=p.total;},error:e=>{if(tenant===this.tenant)this.fail(e);}});}
  choices(){return {planCode:this.plan,modules:this.plan==='CUSTOM'?this.modules:[],cycle:this.cycle,coupons:this.couponCodes.split(',').map(c=>c.trim().toUpperCase()).filter(Boolean),discounts:this.discountCodes.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean)};}
  simulate(){if(this.busy()||!this.detail()||!this.planAvailable())return;if(!this.offers().length){this.message.set('Configure o cat\u00e1logo de planos antes de simular a contrata\u00e7\u00e3o.');return;}this.busy.set(true);this.api.post<Quote>(`platform/commerce/tenants/${this.tenant}/quote`,this.choices()).subscribe({next:q=>{this.quote.set(q);this.busy.set(false);},error:e=>this.fail(e)});}
  assign(){if(!this.quote()||!this.startsAt||!this.endsAt||!this.dueAt){this.message.set('Simule a proposta e preencha todas as datas.');return;}if(!this.confirm('Aplicar esta contratação imediatamente para a empresa selecionada?'))return;this.mutate(`platform/commerce/tenants/${this.tenant}/${this.scheduled?'schedule':'subscription'}`,{...this.choices(),status:this.status,version:this.detail()?.subscription?.version??0,startsAt:this.startsAt,endsAt:this.endsAt,nextDueAt:this.dueAt,reason:this.reason},()=>this.loadTenant());}
  changeStatus(){const s=this.detail()?.subscription;if(!s||!this.confirm('Confirmar alteração do estado da assinatura?'))return;this.mutate(`platform/commerce/tenants/${this.tenant}/status`,{status:this.status,version:s.version,reason:this.reason},()=>this.loadTenant());}
  invoice(){if(!this.dueAt||!this.confirm('Gerar rascunho de cobrança com os preços contratados?'))return;this.mutate(`platform/commerce/tenants/${this.tenant}/invoices`,{competence:this.competence,dueAt:this.dueAt,reason:this.reason},()=>this.loadTenant());}
  invoiceAction(i:Invoice,status:string){if(status==='PAID'&&this.method.trim().length<2){this.message.set('Informe a forma de pagamento confirmada.');return;}if(!this.confirm('Confirmar esta alteração de cobrança? Pagamentos confirmados não poderão ser editados.'))return;this.mutate(`platform/commerce/tenants/${this.tenant}/invoices/${i._id}/status`,{version:i.version,status,reason:this.reason,...(status==='PAID'?{method:this.method.trim()}:{})},()=>this.loadTenant());}
  saveDiscount(){if(!this.confirm('Criar versão deste desconto para novas contratações?'))return;this.mutate('platform/commerce/discounts/versions',{...this.promotion,endsAt:this.promotion.endsAt||undefined,reason:this.reason});}
  editDiscount(d:any){this.promotion={code:d.code,name:d.name,kind:d.kind,value:d.value,scope:d.scope,modules:d.modules,plans:d.plans,startsAt:d.startsAt.slice(0,10),endsAt:d.endsAt?.slice(0,10)??'',maxCycles:d.maxCycles??12,combinable:d.combinable,active:d.active,version:d.version};}
  loadCoupons(delta=0){this.couponPage+=delta;this.api.get<any>(`platform/commerce/coupons?page=${this.couponPage}&limit=20`).subscribe({next:p=>{this.couponRows.set(p.items);this.couponTotal=p.total;},error:e=>this.fail(e)});}
  saveCoupon(){if(!this.confirm('Salvar as regras deste cupom?'))return;this.mutate('platform/commerce/coupons',{...this.coupon,reason:this.reason},()=>this.loadCoupons());}
  editCoupon(c:any){this.coupon={code:c.code,discountCode:c.discountCode,startsAt:c.startsAt.slice(0,10),endsAt:c.endsAt.slice(0,10),maxUses:c.maxUses,perTenant:c.perTenant,active:c.active,version:c.version};}
  decideRequest(r:any,status:string){if(!this.confirm('Registrar decisão desta solicitação? A aprovação exige que a alteração contratual já tenha sido aplicada.'))return;this.mutate(`platform/commerce/tenants/${r.tenantId}/requests/${r._id}/decision`,{version:r.version,status,reason:this.reason});}
}
