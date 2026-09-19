import { LeadsComponent } from '../commerce/leads.component';
import { PlatformCommerceComponent } from '../commerce/platform-commerce.component';
import { Component, DestroyRef, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { catchError, EMPTY, exhaustMap, filter, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { PollingService } from '../../core/polling.service';
import { TenancyApi, Company, Decision } from '../../core/tenancy-api.service';
@Component({selector:'app-platform',standalone:true,imports:[FormsModule,DatePipe,PlatformCommerceComponent,LeadsComponent],templateUrl:'./platform.component.html',styleUrl:'./platform.component.scss'})
export class PlatformComponent {
 @ViewChild(PlatformCommerceComponent) commerce?:PlatformCommerceComponent;
 section='dashboard';
 sections=[{id:'leads',label:'Interessados'},{id:'dashboard',label:'Resumo'},{id:'companies',label:'Empresas e aprova\u00e7\u00f5es'},{id:'catalog',label:'Planos e m\u00f3dulos'},{id:'discounts',label:'Descontos'},{id:'coupons',label:'Cupons promocionais'},{id:'subscriptions',label:'Assinaturas e cobran\u00e7as'}];
 label(value:string){return ({PENDING:'Pendente',ACTIVE:'Ativa',REJECTED:'Recusada',SUSPENDED:'Suspensa',INACTIVE:'Inativa'} as Record<string,string>)[value]??value;}
 navigate(section:string){if(this.commerce?.busy())return;this.section=section;if(this.commerce){this.commerce.section=section;this.commerce.refreshView();if(section==='subscriptions'&&this.selected()&&this.commerce.tenant!==this.selected()!._id)this.commerce.selectTenant(this.selected()!._id);if(section==='coupons')this.commerce.loadCoupons();}}
 openContract(c:Company){if(this.commerce?.busy())return;this.selected.set(c);this.navigate('subscriptions');}
 items=signal<Company[]>([]); selected=signal<Company|null>(null); history=signal<Decision[]>([]); historyPage=1; historyPages=1;
 search='';planFilter='';subscriptionFilter='';paymentFilter='';
 filters(){return Object.fromEntries(Object.entries({search:this.search.trim(),plan:this.planFilter,subscriptionStatus:this.subscriptionFilter,paymentStatus:this.paymentFilter}).filter(([,v])=>!!v));}
 status='PENDING';page=1;pages=1;total=0;busy=signal(false);message=signal('');reason='';
 constructor(public readonly auth:AuthService,private readonly api:TenancyApi,private readonly router:Router,polling:PollingService,destroy:DestroyRef,route:ActivatedRoute){
  const tenant=route.snapshot.queryParamMap.get('tenant');if(tenant){this.section='subscriptions';this.api.company(tenant).subscribe({next:c=>this.selected.set(c),error:e=>this.fail(e)});}
  this.load();polling.every('PLATFORM_ADMIN').pipe(filter(()=>!this.busy()),exhaustMap(()=>this.fetch()),takeUntilDestroyed(destroy)).subscribe();
 }
 fetch(){this.busy.set(true);return this.api.companies(this.status,this.page,this.filters()).pipe(tap(p=>{this.items.set(p.items);this.pages=p.totalPages;this.total=p.total;this.busy.set(false);}),catchError(e=>{this.fail(e);return EMPTY;}));}
 load(reset=false){if(reset)this.page=1;if(!this.busy())this.fetch().subscribe();}
 fail(e:any){this.busy.set(false);this.message.set(e.error?.message??'Não foi possível concluir.');}
 detail(c:Company){if(this.busy())return;this.busy.set(true);this.api.company(c._id).subscribe({next:v=>{this.selected.set(v);this.reason='';this.busy.set(false);this.historyPage=1;this.loadHistory();},error:e=>this.fail(e)});}
 loadHistory(delta=0){const c=this.selected();if(!c)return;this.historyPage+=delta;const page=this.historyPage;this.api.history(c._id,this.historyPage).subscribe({next:p=>{if(this.selected()?._id!==c._id||this.historyPage!==page)return;this.history.set(p.items);this.historyPages=p.totalPages;},error:e=>this.fail(e)});}
 decide(action:string){const c=this.selected();if(!c||this.busy())return;if(action!=='approve'&&this.reason.trim().length<3){this.message.set('Informe um motivo com pelo menos 3 caracteres.');return;}if(!window.confirm('Confirmar esta decisão para '+c.tradeName+'?'))return;
 this.busy.set(true);this.api.decide(c._id,action,this.reason.trim()).subscribe({next:()=>{this.busy.set(false);this.selected.set({...c,status:action==='approve'||action==='reactivate'?'ACTIVE':action==='suspend'?'SUSPENDED':'REJECTED'});this.loadHistory();this.commerce?.load();this.message.set('Decisão registrada.');this.load();},error:e=>this.fail(e)});}
 move(d:number){this.page+=d;this.load();}
 logout(){this.auth.logout().subscribe({next:()=>void this.router.navigate(['/plataforma/login']),error:e=>this.fail(e)});}
}
