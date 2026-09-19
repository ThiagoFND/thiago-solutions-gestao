import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommerceApi,parsePrice } from '../commerce/commerce-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-stock',standalone:true,imports:[FormsModule,DatePipe,RouterLink],templateUrl:'./stock.component.html',styleUrls:['../business/business.component.scss','../crm/crm.component.scss']})
export class StockComponent {
 busy=signal(false);message=signal('');rows=signal<any[]>([]);movements=signal<any[]>([]);selected=signal<any>(null);kind='PRODUCT';search='';page=1;total=0;historyPage=1;historyTotal=0;direction='IN';quantity='1';cost='0';reference='';reason='';key=crypto.randomUUID();
 constructor(private api:CommerceApi,public auth:AuthService){void this.load();}
 ingredient={name:'',unit:'KG',minimumStock:0};
 async createIngredient(){if(this.busy())return;this.busy.set(true);let success=false;try{await firstValueFrom(this.api.post('inventory/ingredients',this.ingredient));this.ingredient={name:'',unit:'KG',minimumStock:0};this.kind='INGREDIENT';this.page=1;this.selected.set(null);this.message.set('Insumo cadastrado com saldo zero.');success=true;}catch(e){this.fail(e);}finally{this.busy.set(false);}if(success)await this.load();}
 private fail(e:any){const m=e.error?.message??e.message;this.message.set(Array.isArray(m)?m.join(' '):m??'Não foi possível concluir.');}
 async load(){if(this.busy())return;this.busy.set(true);try{const q=new URLSearchParams({kind:this.kind,page:String(this.page),limit:'20',search:this.search});const r=await firstValueFrom(this.api.get<any>('stock/items?'+q));this.rows.set(r.items);this.total=r.total;}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async choose(){this.page=1;this.selected.set(null);this.movements.set([]);await this.load();}
 async open(row:any){this.selected.set(row);this.historyPage=1;this.key=crypto.randomUUID();await this.history();}
 async history(){if(!this.selected())return;try{const r=await firstValueFrom(this.api.get<any>('stock/movements?'+new URLSearchParams({kind:this.kind,targetId:this.selected()._id,page:String(this.historyPage),limit:'20'})));this.movements.set(r.items);this.historyTotal=r.total;}catch(e){this.fail(e);}}
 async move(){if(this.busy()||!this.selected())return;const quantity=Number(this.quantity.replace(',','.')),costCents=this.kind==='INGREDIENT'&&this.direction==='IN'?parsePrice(this.cost):undefined;if(!Number.isFinite(quantity)||quantity<=0||costCents===null){this.message.set('Confira a quantidade e o custo.');return;}if(!confirm('Confirmar esta movimentação física? Ela não registra pagamento.'))return;this.busy.set(true);let r:any;try{r=await firstValueFrom(this.api.post<any>('stock/movements',{requestId:this.key,kind:this.kind,targetId:this.selected()._id,direction:this.direction,quantity,costCents,reference:this.reference,reason:this.reason}));this.selected.set({...this.selected(),stock:r.balanceAfter});this.key=crypto.randomUUID();this.reference='';this.reason='';this.message.set('Movimentação registrada no saldo central.');}catch(e){this.fail(e);}finally{this.busy.set(false);}if(r){await this.load();await this.history();}}
}
