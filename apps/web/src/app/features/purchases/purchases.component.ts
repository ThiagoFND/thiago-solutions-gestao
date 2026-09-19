import { Component, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommerceApi, parsePrice } from '../commerce/commerce-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-purchases',standalone:true,imports:[FormsModule,CurrencyPipe,DatePipe,RouterLink],templateUrl:'./purchases.component.html',styleUrls:['../business/business.component.scss','../crm/crm.component.scss']})
export class PurchasesComponent {
 busy=signal(false);message=signal('');rows=signal<any[]>([]);selected=signal<any>(null);products=signal<any[]>([]);suppliers=signal<any[]>([]);accounts=signal<any[]>([]);receipts=signal<any[]>([]);page=1;total=0;receiptPage=1;receiptTotal=0;search='';status='';reason='';supplierName='';
 draft={supplierId:'',reference:'',expectedOn:'',notes:'',lines:[{productId:'',quantity:1,price:''}]};receipt={reference:'',receivedOn:'',assessment:'',accountId:'',dueDate:'',lines:[] as {productId:string;quantity:number;pending:number;name:string}[]};
 labels:Record<string,string>={DRAFT:'Rascunho',APPROVED:'Aprovado',PARTIAL:'Recebido parcialmente',RECEIVED:'Recebido',CLOSED:'Saldo encerrado',CANCELED:'Cancelado'};private keys=new Map<string,string>();
 constructor(private api:CommerceApi,public auth:AuthService){void this.load();}
 private fail(e:any){const m=e.error?.message??e.message;this.message.set(Array.isArray(m)?m.join(' '):m??'Não foi possível concluir.');}
 private get(path:string){return firstValueFrom(this.api.get<any>(path));}
 private async catalog(path:string){let page=1,items:any[]=[];while(true){const r=await this.get(`${path}?page=${page}&limit=100`);items.push(...r.items);if(items.length>=r.total||!r.items.length)return items;page++;}}
 async load(){if(this.busy())return;this.busy.set(true);try{const q=new URLSearchParams({page:String(this.page),limit:'20',search:this.search});if(this.status)q.set('status',this.status);const [r,p,s,a]=await Promise.all([this.get('purchases?'+q),this.catalog('purchases/products'),this.catalog('purchases/suppliers'),this.auth.can('tesouraria.visualizar','tesouraria.criar')?this.catalog('treasury/accounts'):Promise.resolve([])]);this.rows.set(r.items);this.total=r.total;this.products.set(p);this.suppliers.set(s);this.accounts.set(a);}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async save(path:string,body:any,create=false){if(this.busy())return null;this.busy.set(true);try{let key=this.keys.get(path);if(create&&!key){key=crypto.randomUUID();this.keys.set(path,key);}const r=await firstValueFrom(this.api.post<any>(path,{...body,...(create?{requestId:key}:{})}));this.keys.delete(path);this.message.set('Operação salva.');return r;}catch(e){this.fail(e);return null;}finally{this.busy.set(false);}}
 async createSupplier(){if(await this.save('parties',{name:this.supplierName,roles:['SUPPLIER'],notes:''})){this.supplierName='';await this.load();}}
 async create(){try{const r=await this.save('purchases',{...this.draft,lines:this.draft.lines.map(({price,...l})=>{const n=parsePrice(price);if(n===null)throw new Error('Informe valor unitário com até duas casas decimais.');return {...l,unitCents:n};})},true);if(r){this.draft.reference='';await this.load();await this.open(r);}}catch(e){this.fail(e);}}
 async open(row:any){if(this.busy())return;this.busy.set(true);try{const r=await this.get('purchases/'+row._id);this.selected.set(r);this.receipt.lines=r.lines.filter((l:any)=>l.quantity>l.receivedQuantity).map((l:any)=>({productId:l.productId,name:l.productName,quantity:0,pending:l.quantity-l.receivedQuantity}));this.receiptPage=1;await this.loadReceipts();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async loadReceipts(){try{const r=await this.get(`purchases/receipts?orderId=${this.selected()._id}&page=${this.receiptPage}&limit=20`);this.receipts.set(r.items);this.receiptTotal=r.total;}catch(e){this.fail(e);}}
 actions(){const r=this.selected();if(!r)return [];return(r.status==='DRAFT'?['APPROVED','CANCELED']:r.status==='APPROVED'?['CANCELED']:r.status==='PARTIAL'?['CLOSED']:[]).filter(s=>this.auth.can(s==='APPROVED'?'compras.aprovar':'compras.cancelar'));}
 async state(status:string){const r=this.selected();if(status!=='APPROVED'&&!confirm('Encerrar o saldo pendente? Os recebimentos existentes permanecem.'))return;if(await this.save(`purchases/${r._id}/status`,{version:r.version,status,reason:this.reason})){await this.load();await this.open(r);}}
 async receive(){const r=this.selected();if(!confirm('Confirmar as quantidades efetivamente recebidas e conferidas?'))return;const {accountId,dueDate,lines,...data}=this.receipt;if(await this.save(`purchases/${r._id}/receipts`,{...data,...(accountId?{accountId,dueDate}:{}),lines:lines.filter(l=>l.quantity>0).map(l=>({productId:l.productId,quantity:l.quantity}))},true)){this.receipt.reference='';this.receipt.assessment='';await this.load();await this.open(r);}}
}
