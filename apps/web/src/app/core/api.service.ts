import { EMPTY, expand, reduce } from 'rxjs';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AvailabilityMode, KitchenProduct, DailyReport, Order, OrderType, Payment, Product, Production, UserRole } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private readonly http: HttpClient) {}
  private allPages<T>(path: string, filters: Record<string, string> = {}) {
    const page = (number: number) => this.http.get<T[]>(`${environment.apiUrl}${path}`, {params: {...filters, page: number, limit: 100}});
    return page(1).pipe(expand((items, index) => items.length === 100 ? page(index + 2) : EMPTY, 1), reduce((all, items) => [...all, ...items], [] as T[]));
  }
  products(activeOnly = false) { return this.allPages<Product>('/products', {activeOnly: String(activeOnly)}); }
  kitchenProducts() { return this.allPages<KitchenProduct>('/products', {activeOnly: 'true'}); }
  purchaseProduct(id:string,quantity:number){return this.http.post<Product>(`${environment.apiUrl}/products/${id}/purchases`,{quantity});}
  createProduct(dto: Partial<Product>) {
    return this.http.post<Product>(`${environment.apiUrl}/products`, dto);
  }
  updateProduct(id: string, dto: Partial<Product>) { return this.http.patch<Product>(`${environment.apiUrl}/products/${id}`, dto); }
  productionsToday() { return this.allPages<Production>('/productions/today'); }
  createProduction(productId: string, quantity: number, idempotencyKey?:string) { return this.http.post<Production>(`${environment.apiUrl}/productions`, { productId, quantity, ...(idempotencyKey?{idempotencyKey}:{}) }); }
  orders(status?: string) { return this.allPages<Order>('/orders', status ? {status} : {}); }
  createOrder(dto: { type: OrderType; identifier?: string; notes?: string; items: Array<{ productId: string; quantity: number }> }) {
    return this.http.post<Order>(`${environment.apiUrl}/orders`, dto);
  }
  updateOrder(id: string, dto: { type: OrderType; identifier?: string; notes?: string; items: Array<{ productId: string; quantity: number }> }) {
    return this.http.patch<Order>(`${environment.apiUrl}/orders/${id}`, dto);
  }
  finalizeOrder(id: string, payments: Payment[]) { return this.http.post<Order>(`${environment.apiUrl}/orders/${id}/finalize`, { payments }); }
  cancelOrder(id: string, reason: string) { return this.http.post<Order>(`${environment.apiUrl}/orders/${id}/cancel`, { reason }); }
  dailyReport(date?: string) { return this.http.get<DailyReport>(`${environment.apiUrl}/reports/daily${date ? `?date=${date}` : ''}`); }
  financeProducts() {
    type Item = Pick<Product, '_id' | 'name' | 'active'>;
    const page = (n: number) => this.http.get<{items: Item[]; totalPages:number; page:number}>(`${environment.apiUrl}/finance/products`, {params:{page:n,limit:100}});
    return page(1).pipe(expand(p => p.page < p.totalPages ? page(p.page + 1) : EMPTY, 1), reduce((all, p) => [...all, ...p.items], [] as Item[]));
  }
}
