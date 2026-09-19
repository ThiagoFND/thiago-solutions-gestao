import { PermissionDirective } from '../../core/permission.directive';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Order, OrderType, Payment, PaymentMethod, Product } from '../../core/models';
import { PollingService } from '../../core/polling.service';
import { AuthService } from '../../core/auth.service';

interface PaymentForm { method: PaymentMethod; amount: number; received?: number; }

@Component({
  selector: 'app-pos', standalone: true, imports: [PermissionDirective,FormsModule, DatePipe],
  templateUrl: './pos.component.html', styleUrl: './pos.component.scss',
})
export class PosComponent implements OnInit, OnDestroy {
  products = signal<Product[]>([]);
  openOrders = signal<Order[]>([]);
  category = signal('Todos');
  search=signal('');
  get groups(){return [...new Map([...this.products()].sort((a,b)=>(a.categoryOrder??0)-(b.categoryOrder??0)).map(p=>[p.categoryId??p.category,{key:p.categoryId??p.category,label:p.category}])).values()];}
  grouped(key:string){return this.filteredProducts().filter(p=>(p.categoryId??p.category)===key && (p.name+' '+p.category).toLocaleLowerCase().includes(this.search().trim().toLocaleLowerCase()));}
  editingId = signal<string | null>(null);
  orderType: OrderType = 'TAKEAWAY';
  identifier = '';
  notes = '';
  draft = new Map<string, number>();
  original = new Map<string, number>();
  checkout = signal(false);
  payments: PaymentForm[] = [{ method: 'PIX', amount: 0 }];
  message = signal('');
  saving = signal(false);
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly api: ApiService, private readonly polling: PollingService, private readonly auth: AuthService) {}
  ngOnInit() {
    this.reload();
    this.polling.everyPermission('vendas.visualizar','produtos.visualizar').pipe(takeUntil(this.destroy$)).subscribe(() => { if (!this.saving()) this.reload(); });
  }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
  reload() { this.loadProducts(); this.loadOrders(); }
  loadProducts() { this.api.products(true).pipe(takeUntil(this.destroy$)).subscribe(v => this.products.set(v)); }
  loadOrders() { this.api.orders('OPEN').pipe(takeUntil(this.destroy$)).subscribe(v => this.openOrders.set(v)); }
  categories() { return ['Todos', ...new Set(this.products().map(p => p.category))]; }
  filteredProducts() { return this.category() === 'Todos' ? this.products() : this.products().filter(p => p.category === this.category()); }
  qty(id: string) { return this.draft.get(id) ?? 0; }
  private inventoryActive() { const modules = this.auth.user()?.contractedModules; return modules === undefined || modules.includes('INVENTORY'); }
  isAvailable(product: Product) { return !this.inventoryActive() || product.availabilityMode === 'MADE_TO_ORDER' || product.availableStock > 0; }
  canAdd(product: Product) {
    if (!this.inventoryActive() || product.availabilityMode === 'MADE_TO_ORDER') return true;
    const extraAfterClick = Math.max(0, this.qty(product._id) + 1 - (this.auth.user()?.contractedModules === undefined ? (this.original.get(product._id) ?? 0) : 0));
    return product.availableStock >= extraAfterClick;
  }
  add(product: Product) { if (this.canAdd(product)) this.draft.set(product._id, this.qty(product._id) + 1); }
  remove(product: Product) { const next = this.qty(product._id) - 1; next > 0 ? this.draft.set(product._id, next) : this.draft.delete(product._id); }
  draftLines() { return [...this.draft.entries()].map(([id, quantity]) => ({ product: this.products().find(p => p._id === id)!, quantity })).filter(v => v.product); }
  totalCents() { return this.draftLines().reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0); }
  itemCount() { return [...this.draft.values()].reduce((sum, qty) => sum + qty, 0); }
  money(cents: number) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  stockLabel(product: Product) { return !this.inventoryActive() ? 'Disponível para venda' : product.availabilityMode === 'MADE_TO_ORDER' ? 'Sob demanda' : product.availableStock > 0 ? `${product.availableStock} disponíveis` : 'Indisponível'; }

  newOrder() { this.editingId.set(null); this.draft.clear(); this.original.clear(); this.identifier = ''; this.notes = ''; this.orderType = 'TAKEAWAY'; this.checkout.set(false); this.message.set(''); }
  edit(order: Order) {
    this.editingId.set(order._id); this.draft.clear(); this.original.clear();
    order.items.forEach(item => { this.draft.set(item.productId, item.quantity); this.original.set(item.productId, item.quantity); });
    this.orderType = order.type; this.identifier = order.identifier ?? ''; this.notes = order.notes ?? ''; this.checkout.set(false); this.message.set('');
  }
  save() {
    if(this.saving())return;
    if (!this.draft.size) { this.message.set('Adicione pelo menos um produto.'); return; }
    this.saving.set(true); this.message.set('');
    const dto = { type: this.orderType, identifier: this.identifier || undefined, notes: this.notes || undefined, items: [...this.draft].map(([productId, quantity]) => ({ productId, quantity })) };
    const request = this.editingId() ? this.api.updateOrder(this.editingId()!, dto) : this.api.createOrder(dto);
    request.subscribe({ next: () => { this.saving.set(false); this.newOrder(); this.reload(); }, error: e => { this.saving.set(false); this.message.set(e.error?.message ?? 'Não foi possível salvar o pedido'); } });
  }
  openCheckout() {
    if (!this.editingId()) { this.message.set('Salve o pedido antes de finalizar.'); return; }
    this.payments = [{ method: 'PIX', amount: this.totalCents() / 100 }]; this.checkout.set(true); this.message.set('');
  }
  addPayment() { if(this.payments.length>=10)return; this.payments.push({ method: 'CASH', amount: 0 }); }
  removePayment(index: number) { if (this.payments.length > 1) this.payments.splice(index, 1); }
  paymentSumCents() { return Math.round(this.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0) * 100); }
  finalize() {
    if(this.saving())return;
    if (!this.editingId()) return;
    const payload: Payment[] = this.payments.map(p => ({ method: p.method, amountCents: Math.round(Number(p.amount) * 100), receivedCents: p.method === 'CASH' ? Math.round(Number(p.received || p.amount) * 100) : undefined }));
    this.saving.set(true);
    this.api.finalizeOrder(this.editingId()!, payload).subscribe({ next: () => { this.saving.set(false); this.newOrder(); this.reload(); }, error: e => { this.saving.set(false); this.message.set(e.error?.message ?? 'Erro ao finalizar'); } });
  }
  cancelOrder(order: Order) {
    const reason = window.prompt(`Motivo do cancelamento do pedido #${order.number}:`);
    if (!reason) return;
    this.api.cancelOrder(order._id, reason).subscribe(() => { if (this.editingId() === order._id) this.newOrder(); this.reload(); });
  }
}
