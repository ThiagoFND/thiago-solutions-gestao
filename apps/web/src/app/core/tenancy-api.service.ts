import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { UserRole } from './models';
export interface Page<T> { items: T[]; total: number; page: number; limit: number; totalPages: number }
export interface Member { customRoleId?:string;customRoleName?:string; _id: string; name: string; email: string; role: UserRole | null; status: string; cpfMasked?: string; phone?: string; jobDescription?: string; requestedAt?: string; rejectionReason?: string }
export interface Company { planCode?:string;subscriptionStatus?:string;paymentStatus?:string; _id: string; cnpj: string; legalName: string; tradeName: string; corporateEmail: string; phone: string; status: string; owner?: { name: string; email: string; status: string }; decisionHistory?: Decision[] }
export interface Decision { _id: string; action: string; reason?: string; occurredAt: string }
@Injectable({providedIn:'root'})
export class TenancyApi {
  readonly pending = signal(0);
  private readonly base = environment.apiUrl;
  constructor(private readonly http: HttpClient) {}
  onboarding(body: unknown) { return this.http.post(`${this.base}/auth/onboarding`, body); }
  request(body: unknown) { return this.http.post(`${this.base}/auth/access-requests`, body); }
  lookup(cnpj: string) { return this.http.post<{acceptingRequests:boolean}>(`${this.base}/auth/company-lookup`, {cnpj}); }
  members(status: string, page = 1) { return this.http.get<Page<Member>>(`${this.base}/users${status === 'PENDING' ? '/requests' : ''}`, {params:{status,page,limit:20}}); }
  count() { return this.http.get<{count:number}>(`${this.base}/users/pending-count`); }
  customRoles(page=1) { return this.http.get<Page<{_id:string;name:string;active:boolean;archived:boolean;permissions:string[]}>>(`${this.base}/roles`,{params:{page,limit:100}}); }
  changeMember(id: string, action: string, body: unknown) { return action === 'role' || action === 'status' ? this.http.patch<Member>(`${this.base}/users/${id}/${action}`, body) : this.http.post<Member>(`${this.base}/users/${id}/${action}`, body); }
  companies(status: string, page = 1, filters:Record<string,string>={}) { return this.http.get<Page<Company>>(`${this.base}/platform/tenants`, {params:{status,page,limit:20,...filters}}); }
  company(id: string) { return this.http.get<Company>(`${this.base}/platform/tenants/${id}`); }
  history(id: string, page = 1) { return this.http.get<Page<Decision>>(`${this.base}/platform/tenants/${id}/history`, {params:{page,limit:20}}); }
  decide(id: string, action: string, reason: string) { return this.http.post<Company>(`${this.base}/platform/tenants/${id}/${action}`, action === 'approve' ? {} : {reason}); }
}
