import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { activeModuleCodes } from './system-modules';
import { environment } from '../../../environments/environment';
export interface Offer { testOnly?:boolean; code:string; kind:'BASE'|'MODULE'|'PLAN'; name:string; description:string; version:number; monthlyCents:number; annualCents?:number; currency:'BRL'; modules:string[]; active:boolean; available:boolean; order:number; featured:boolean; limits:{activeUsers:number;products:number;categories:number;storageBytes:number;landingPages:number} }
export interface AccessComparison { currentCount:number; proposedCount:number; addedCount:number; removedCount:number; keptCount:number; permissions:{key:string;module:string;moduleName:string;name:string;current:boolean;proposed:boolean;change:string}[] }
export interface Quote { accessComparison?:AccessComparison; limits:Offer['limits']; cycle:string; currency:string; planCode:string; modules:string[]; items:{code:string;name:string;version:number;unitCents:number;totalCents:number}[]; subtotalCents:number;discountCents:number;totalCents:number;afterPromotionCents:number;applied:{code:string;cents:number}[];rejected:{code:string;reason:string}[] }
export interface Subscription { _id:string; version:number; status:string; startsAt:string;endsAt:string;nextDueAt:string;scheduled?:{effectiveAt:string;snapshot:Quote};snapshot:Quote; }
export interface SubscriptionDetail { subscription:Subscription|null; currentPrice:Quote|null; usage:{activeUsers:number;products:number;categories:number}; modules:string[];availableModules:string[] }
export interface Invoice { _id:string;version:number;competence:string;status:string;dueAt:string;paidAt?:string;method?:string;snapshot:Quote }
export interface Page<T> { items:T[];total:number;page:number;limit:number }
@Injectable({providedIn:'root'})
export class CommerceApi {
  private base=environment.apiUrl;
  constructor(private readonly http:HttpClient){}
  get<T>(path:string){return this.http.get<T>(`${this.base}/${path}`);}
  post<T>(path:string,body:unknown){return this.http.post<T>(`${this.base}/${path}`,body);}
  catalog(global=false){return this.get<Offer[]>(global?'platform/commerce/catalog':'subscription/catalog').pipe(map(offers=>offers.filter(o=>o.kind!=='MODULE'||activeModuleCodes([o.code]).length>0)));}
  detail(tenant?:string){return this.get<SubscriptionDetail>(tenant?`platform/commerce/tenants/${tenant}/subscription`:'subscription');}
  invoices(page:number,tenant?:string){return this.get<Page<Invoice>>(`${tenant?`platform/commerce/tenants/${tenant}/invoices`:'subscription/invoices'}?page=${page}&limit=20`);}
}
export function parsePrice(value:string):number|null {
  const normalized=value.trim().replace(',','.');
  if(!/^\d{1,10}(\.\d{1,2})?$/.test(normalized))return null;
  const [whole,decimal='']=normalized.split('.');const result=Number(whole)*100+Number(decimal.padEnd(2,'0'));
  return Number.isSafeInteger(result)&&result<=1_000_000_000_000?result:null;
}
