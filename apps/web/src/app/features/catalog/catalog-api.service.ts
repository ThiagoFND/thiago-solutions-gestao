import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  constructor(private readonly http: HttpClient) {}
  get<T = any>(path: string, params: Record<string, string | number> = {}) { return this.http.get<T>(`${environment.apiUrl}/${path}`, { params }); }
  post<T = any>(path: string, body: unknown = {}) { return this.http.post<T>(`${environment.apiUrl}/${path}`, body); }
  put<T = any>(path: string, body: unknown) { return this.http.put<T>(`${environment.apiUrl}/${path}`, body); }
  patch<T = any>(path: string, body: unknown) { return this.http.patch<T>(`${environment.apiUrl}/${path}`, body); }
}
export function errorText(e: any): string {
  if(e.status===429)return 'Muitas tentativas. Aguarde um momento e tente novamente.';
  if(e.status===401)return 'Sua sessão expirou. Entre novamente.';
  if(e.status===403)return 'Você não tem permissão para esta ação.';
  if(e.status===404)return 'Registro não encontrado ou indisponível.';
  if(e.status===409)return 'O registro foi alterado ou já existe. Atualize a tela e confira os dados.';
  const text=e.error?.message;return Array.isArray(text)?text.join(' '):typeof text==='string'&&e.status<500?text:'Não foi possível concluir. Tente novamente.';
}
