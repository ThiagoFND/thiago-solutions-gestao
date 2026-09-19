import { PermissionDirective } from '../../core/permission.directive';
import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { KitchenProduct, Production } from '../../core/models';
import { PollingService } from '../../core/polling.service';
import { RouterLink } from '@angular/router';
import { NumericInputDirective } from '../../core/numeric-input.directive';
import { InventoryService, RecipeCost } from '../inventory/inventory.service';

@Component({
  selector: 'app-kitchen', standalone: true, imports: [PermissionDirective,FormsModule, DatePipe,RouterLink,NumericInputDirective],
  templateUrl: './kitchen.component.html', styleUrl: './kitchen.component.scss',
})
export class KitchenComponent implements OnInit, OnDestroy {
  products = signal<KitchenProduct[]>([]);
  productions = signal<Production[]>([]);
  selectedProductId = '';
  quantity = 1;
  loading = signal(false);
  message = signal('');
  cost=signal<RecipeCost|null>(null);costLoading=signal(false);costError=signal('');private costRequest=0;
  private productionKey='';private productionPayload='';
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly api: ApiService, private readonly polling: PollingService,private readonly inventory:InventoryService) {}
  ngOnInit() {
    this.load();
    this.polling.everyPermission('producao.visualizar','produtos.visualizar').pipe(takeUntil(this.destroy$)).subscribe(() => { if (!this.loading()) this.load(); });
  }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
  load() { this.loadProducts(); this.api.productionsToday().pipe(takeUntil(this.destroy$)).subscribe({next:v => this.productions.set(v),error:e=>this.message.set(e.error?.message??'Não foi possível carregar a produção.')}); }
  loadProducts() { this.api.kitchenProducts().pipe(takeUntil(this.destroy$)).subscribe({next:v => {const produced=v.filter(p=>p.origin==='PRODUCED'); this.products.set(produced); if (!this.selectedProductId && produced.length) this.selectedProductId = produced[0]._id;void this.loadCost();},error:e=>this.message.set(e.error?.message??'Não foi possível carregar os produtos.')}); }
  async loadCost(){const request=++this.costRequest;this.cost.set(null);this.costError.set('');if(!this.selectedProductId)return;this.costLoading.set(true);try{const cost=await this.inventory.cost(this.selectedProductId);if(request===this.costRequest)this.cost.set(cost);}catch(e:any){if(request===this.costRequest)this.costError.set(e.error?.message??'Não foi possível conferir a ficha. Tente novamente.');}finally{if(request===this.costRequest)this.costLoading.set(false);}}
  money(cents:number){return(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
  register() {
    if (this.loading()||this.costLoading()||this.costError()||!this.selectedProductId || !Number.isInteger(Number(this.quantity)) || this.quantity < 1) return;
    const payload=`${this.selectedProductId}:${this.quantity}`;if(payload!==this.productionPayload||!this.productionKey){this.productionPayload=payload;this.productionKey=crypto.randomUUID();}
    this.loading.set(true); this.message.set('');
    this.api.createProduction(this.selectedProductId, Number(this.quantity),this.productionKey).subscribe({
      next: () => { this.productionKey='';this.loading.set(false); this.message.set(`${this.quantity} unidade(s) adicionadas ao salão.`); this.quantity = 1; this.load(); },
      error: e => { this.loading.set(false); this.message.set(e.error?.message ?? 'Erro ao registrar produção'); },
    });
  }
  totalToday() { return this.productions().reduce((sum, item) => sum + item.quantity, 0); }
  productMode(product: KitchenProduct) { return product.availabilityMode === 'MADE_TO_ORDER' ? 'Sob demanda' : `${product.availableStock} disponíveis`; }
}
