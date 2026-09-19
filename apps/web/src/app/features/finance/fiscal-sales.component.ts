import { PermissionDirective } from '../../core/permission.directive';
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NumericInputDirective } from '../../core/numeric-input.directive';
import { FinanceService } from './finance.service';
import { today } from './finance.models';
@Component({selector:'app-fiscal-sales',standalone:true,imports: [PermissionDirective,CommonModule,FormsModule,NumericInputDirective],templateUrl:'./fiscal-sales.component.html',styleUrl:'./fiscal-sales.component.scss'})
export class FiscalSalesComponent {
 data=signal<any>({items:[],page:1,total:0,totalPages:0}); detail=signal<any>(null); loading=signal(false); error=signal('');products=signal<any[]>([]);
 filters:Record<string,string>={dateFrom:today().slice(0,7)+'-01',dateTo:today(),date:'',number:'',status:'',method:'',cashierId:'',productId:'',salesGroup:'',sort:'date',direction:'desc'};
 constructor(private api:FinanceService){void this.load();void this.catalog();}
 async catalog(){try{let page=1;const all:any[]=[];while(true){const r=await this.api.get<any>('products',{page,limit:100});all.push(...r.items);if(page++>=r.totalPages)break;}this.products.set(all);}catch{this.error.set('Não foi possível carregar o catálogo.');}}
 async load(page=1){if(this.loading())return;this.loading.set(true);this.error.set('');try{this.data.set(await this.api.get('sales',{...this.filters,page,limit:20}));}catch(e:any){this.error.set(e.error?.message??'Não foi possível consultar vendas.');}finally{this.loading.set(false);}}
 async open(id:string){try{this.detail.set(await this.api.get('sales/'+id));}catch{this.error.set('Não foi possível abrir a venda.');}}
 money(cents:number){return (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
 async export(){if(this.loading())return;this.loading.set(true);try{const blob=await this.api.download('sales-export',this.filters);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='vendas-fiscais.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{this.error.set('Não foi possível exportar. Restrinja a consulta a até 5000 vendas.');}finally{this.loading.set(false);}}
 print(){window.print();}
}
