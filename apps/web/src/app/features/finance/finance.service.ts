import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category, Entry, History, Page, Recurrence, Summary } from './finance.models';
@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly url = `${environment.apiUrl}/finance`;
  constructor(private readonly http: HttpClient) {}
  get<T>(path: string, query: Record<string, unknown> = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) if (value !== '' && value !== null && value !== undefined) params = params.set(key, String(value));
    return firstValueFrom(this.http.get<T>(`${this.url}/${path}`, { params }));
  }
  download(path:string,query:Record<string,unknown>={}){let params=new HttpParams();for(const [k,v] of Object.entries(query))if(v!==''&&v!=null)params=params.set(k,String(v));return firstValueFrom(this.http.get(`${this.url}/${path}`,{params,responseType:'blob'}));}
  post<T>(path: string, body: unknown) { return firstValueFrom(this.http.post<T>(`${this.url}/${path}`, body)); }
  patch<T>(path: string, body: unknown) { return firstValueFrom(this.http.patch<T>(`${this.url}/${path}`, body)); }
  entries(query: Record<string, unknown>) { return this.get<Page<Entry>>('entries', query); }
  categories(query: Record<string, unknown>) { return this.get<Page<Category>>('categories', query); }
  recurrences(query: Record<string, unknown>) { return this.get<Page<Recurrence>>('recurrences', query); }
  history(id: string, page: number) { return this.get<Page<History>>(`entries/${id}/history`, { page, limit: 10 }); }
  summary(month: string) { return this.get<Summary>('reports/monthly', { year: Number(month.slice(0, 4)), month: Number(month.slice(5)) }); }
  async allCategories() {
    const result: Category[] = []; let page = 1;
    while (true) { const data = await this.categories({ page, limit: 100 }); result.push(...data.items); if (page >= data.totalPages) return result; page++; }
  }
}
