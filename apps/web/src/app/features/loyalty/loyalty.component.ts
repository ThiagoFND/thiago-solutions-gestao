import { Component, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CommerceApi, parsePrice } from '../commerce/commerce-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-loyalty',standalone:true,imports:[FormsModule,DatePipe,CurrencyPipe],templateUrl:'./loyalty.component.html',styleUrls:['../business/business.component.scss','../crm/crm.component.scss']})
export class LoyaltyComponent {
 busy=signal(false);message=signal('');programs=signal<any[]>([]);members=signal<any[]>([]);parties=signal<any[]>([]);selected=signal<any>(null);entries=signal<any[]>([]);page=1;total=0;entryPage=1;entryTotal=0;search='';programId='';reason='';reference='';contactName='';
 program={name:'',terms:'',price:'1,00',validityDays:365,maxPointsPerOperation:1000};enrollment={programId:'',partyId:'',acceptedTerms:false,marketingConsent:false};earnForm={price:'',paymentConfirmed:false};redeemForm={points:1,benefit:''};reversePoints=1;
 labels:Record<string,string>={CREDIT:'Crédito',REDEEM:'Resgate',REVERSAL:'Estorno'};private keys=new Map<string,string>();
 constructor(private api:CommerceApi,public auth:AuthService){void this.load();}
 private fail(e:any){const m=e.error?.message??e.message;this.message.set(Array.isArray(m)?m.join(' '):m??'Não foi possível concluir.');}
 private get(path:string){return firstValueFrom(this.api.get<any>(path));}
 private money(value:string){const n=parsePrice(value);if(n===null||n<1)throw new Error('Informe valor positivo com até duas casas decimais.');return n;}
 private async catalog(path:string){let page=1,items:any[]=[];while(true){const r=await this.get(`${path}?page=${page}&limit=100`);items.push(...r.items);if(items.length>=r.total||!r.items.length)return items;page++;}}
 async load(){if(this.busy())return;this.busy.set(true);try{const q=new URLSearchParams({page:String(this.page),limit:'20',search:this.search});if(this.programId)q.set('programId',this.programId);const [m,p,c]=await Promise.all([this.get('loyalty/members?'+q),this.catalog('loyalty/programs'),this.auth.can('cadastros.visualizar')?this.catalog('parties'):Promise.resolve([])]);this.members.set(m.items);this.total=m.total;this.programs.set(p);this.parties.set(c);}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async save(path:string,body:any,create=false){if(this.busy())return null;this.busy.set(true);try{let key=this.keys.get(path);if(create&&!key){key=crypto.randomUUID();this.keys.set(path,key);}const r=await firstValueFrom(this.api.post<any>(path,{...body,...(create?{requestId:key}:{})}));this.keys.delete(path);this.message.set('Operação salva.');return r;}catch(e){this.fail(e);return null;}finally{this.busy.set(false);}}
 async createProgram(){try{const {price,...d}=this.program;if(await this.save('loyalty/programs',{...d,spendCentsPerPoint:this.money(price)},true)){this.program.name='';await this.load();}}catch(e){this.fail(e);}}
 async createContact(){if(await this.save('parties',{name:this.contactName,roles:['CUSTOMER'],notes:''})){this.contactName='';await this.load();}}
 async enroll(){if(await this.save('loyalty/members',this.enrollment,true)){this.enrollment.partyId='';this.enrollment.acceptedTerms=false;this.enrollment.marketingConsent=false;await this.load();}}
 async state(row:any){if(await this.save(`loyalty/programs/${row._id}/status`,{version:row.version,reason:this.reason,active:!row.active}))await this.load();}
 async open(row:any){if(this.busy())return;this.busy.set(true);try{this.selected.set(await this.get('loyalty/members/'+row._id));this.entryPage=1;await this.loadEntries();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async loadEntries(){try{const r=await this.get(`loyalty/entries?memberId=${this.selected()._id}&page=${this.entryPage}&limit=20`);this.entries.set(r.items);this.entryTotal=r.total;}catch(e){this.fail(e);}}
 async earn(){try{const {price,...d}=this.earnForm;if(await this.save(`loyalty/members/${this.selected()._id}/earn`,{...d,eligibleCents:this.money(price),reason:this.reason,externalReference:this.reference},true)){this.reference='';this.earnForm.paymentConfirmed=false;await this.open(this.selected());}}catch(e){this.fail(e);}}
 async redeem(){if(!confirm('Confirmar entrega do benefício e consumo dos pontos?'))return;if(await this.save(`loyalty/members/${this.selected()._id}/redeem`,{...this.redeemForm,reason:this.reason,externalReference:this.reference},true)){this.reference='';await this.open(this.selected());}}
 async reverse(row:any){if(!confirm('Estornar os pontos informados? Pontos já usados gerarão uma pendência de compensação.'))return;if(await this.save(`loyalty/entries/${row._id}/reverse`,{points:this.reversePoints,reason:this.reason,externalReference:this.reference},true)){this.reference='';await this.open(this.selected());}}
 terms(){return this.programs().find(p=>p._id===this.enrollment.programId)?.terms??'';}
}
