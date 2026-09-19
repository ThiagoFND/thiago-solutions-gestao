import { Component, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CommerceApi } from '../commerce/commerce-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-logistics',standalone:true,imports:[FormsModule,DatePipe],templateUrl:'./logistics.component.html',styleUrls:['../business/business.component.scss','../crm/crm.component.scss']})
export class LogisticsComponent {
 busy=signal(false);message=signal('');rows=signal<any[]>([]);selected=signal<any>(null);people=signal<any[]>([]);source=signal<any>(null);tab='shipments';page=1;total=0;search='';status='';reason='';receivedBy='';
 order={reference:'',recipient:'',phone:'',address:'',windowStart:'',windowEnd:'',notes:'',lines:[{code:'1',description:'',quantity:1}]};shipment={assignedId:'',routeName:'',stopNumber:1,volumes:1,weightGrams:0,lines:[] as {code:string;quantity:number;pending:number;description:string}[]};assignment={assignedId:'',routeName:'',stopNumber:1};
 labels:Record<string,string>={PENDING:'A separar',CHECKED:'Conferida',DISPATCHED:'Despachada',IN_TRANSIT:'Em trânsito',DELIVERED:'Entregue',FAILED:'Tentativa sem sucesso',RETURN_RECEIVED:'Retorno recebido',CANCELED:'Cancelada'};private keys=new Map<string,string>();
 constructor(private api:CommerceApi,public auth:AuthService){void this.load();}
 private fail(e:any){const m=e.error?.message??e.message;this.message.set(Array.isArray(m)?m.join(' '):m??'Não foi possível concluir.');}
 private get(path:string){return firstValueFrom(this.api.get<any>('logistics/'+path));}
 private async team(){let page=1,items:any[]=[];while(true){const r=await this.get(`people?page=${page}&limit=100`);items.push(...r.items);if(items.length>=r.total||!r.items.length)return items;page++;}}
 async load(){if(this.busy())return;this.busy.set(true);try{const q=new URLSearchParams({page:String(this.page),limit:'20',search:this.search});if(this.status&&this.tab==='shipments')q.set('status',this.status);const [r,p]=await Promise.all([this.get(this.tab+'?'+q),this.auth.can('logistica.planejar')?this.team():Promise.resolve([])]);this.rows.set(r.items);this.total=r.total;this.people.set(p);}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 choose(tab:string){this.tab=tab;this.page=1;this.rows.set([]);this.selected.set(null);void this.load();}
 async save(path:string,body:any,create=false){if(this.busy())return null;this.busy.set(true);try{let key=this.keys.get(path);if(create&&!key){key=crypto.randomUUID();this.keys.set(path,key);}const r=await firstValueFrom(this.api.post<any>('logistics/'+path,{...body,...(create?{requestId:key}:{})}));this.keys.delete(path);this.message.set('Operação salva.');return r;}catch(e){this.fail(e);return null;}finally{this.busy.set(false);}}
 async createOrder(){try{if(await this.save('orders',{...this.order,windowStart:new Date(this.order.windowStart).toISOString(),windowEnd:new Date(this.order.windowEnd).toISOString()},true)){this.order.reference='';this.choose('orders');}}catch(e){this.fail(e);}}
 plan(row:any){this.source.set(row);this.shipment.lines=row.lines.filter((l:any)=>l.quantity>l.allocated).map((l:any)=>({code:l.code,description:l.description,pending:l.quantity-l.allocated,quantity:0}));}
 async createShipment(){if(await this.save('shipments',{...this.shipment,orderId:this.source()._id,lines:this.shipment.lines.filter(l=>l.quantity>0).map(l=>({code:l.code,quantity:l.quantity}))},true)){this.source.set(null);this.choose('shipments');}}
 async open(row:any){if(this.busy())return;this.busy.set(true);try{const r=await this.get('shipments/'+row._id);this.selected.set(r);this.assignment={assignedId:r.assignedId,routeName:r.routeName,stopNumber:r.stopNumber};}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 actions(){const r=this.selected();if(!r)return [];const map:Record<string,string[]>={PENDING:['CHECKED','CANCELED'],CHECKED:['DISPATCHED','CANCELED'],DISPATCHED:['IN_TRANSIT'],IN_TRANSIT:['DELIVERED','FAILED'],FAILED:['IN_TRANSIT','RETURN_RECEIVED']};return(map[r.status]??[]).filter(s=>this.auth.can(['IN_TRANSIT','DELIVERED','FAILED'].includes(s)?'logistica.executar':s==='CHECKED'?'logistica.conferir':s==='DISPATCHED'?'logistica.despachar':'logistica.planejar'));}
 async state(status:string){const r=this.selected();if(!confirm('Registrar esta etapa e preservar o histórico da remessa?'))return;const result=await this.save(`shipments/${r._id}/status`,{version:r.version,status,reason:this.reason,...(status==='DELIVERED'?{receivedBy:this.receivedBy}:{})});if(result){this.selected.set(result);await this.load();}}
 async assign(){const r=this.selected();const result=await this.save(`shipments/${r._id}/assign`,{...this.assignment,version:r.version,reason:this.reason});if(result){this.selected.set(result);await this.load();}}
}
