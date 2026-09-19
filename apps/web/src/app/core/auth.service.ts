import { computed, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, map, Observable, of, shareReplay, Subject, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthUser, LoginResponse, UserRole } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSignal = signal<AuthUser | null>(null);
  readonly user = this.userSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.userSignal());
  readonly notice = signal('');
  readonly sessionEnded$ = new Subject<void>();
  private csrf?: string;
  private csrfRequest?: Observable<string>;
  private sessionRequest?: Observable<boolean>;
  constructor(private readonly http: HttpClient) {
    try { localStorage.removeItem('access_token'); localStorage.removeItem('auth_user'); } catch { /* Storage can be disabled. */ }
  }
  csrfToken(): Observable<string> {
    if (this.csrf) return of(this.csrf);
    return this.csrfRequest ??= this.http.get<{csrfToken: string}>(`${environment.apiUrl}/auth/csrf`).pipe(
      map(value => value.csrfToken), tap(value => this.csrf = value),
      finalize(() => this.csrfRequest = undefined), shareReplay({bufferSize: 1, refCount: true}),
    );
  }
  clearCsrf() { this.csrf = undefined; }
  restore(): Observable<boolean> {
    return this.sessionRequest ??= this.http.get<AuthUser>(`${environment.apiUrl}/auth/me`).pipe(
      tap(user => this.userSignal.set(user)), map(() => true),
      catchError(() => { this.clearSession(); return of(false); }),
      finalize(() => this.sessionRequest = undefined), shareReplay({bufferSize: 1, refCount: true}),
    );
  }
  login(email: string, password: string, cnpj: string, platform = false) {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/${platform ? 'platform-login' : 'login'}`, platform ? {email, password} : {email, password, cnpj}).pipe(
      tap(({user}) => { this.userSignal.set(user); this.notice.set(''); }),
    );
  }
  logout() { return this.http.post(`${environment.apiUrl}/auth/logout`, {}).pipe(tap(() => this.clearSession())); }
  clearSession() { this.userSignal.set(null); this.clearCsrf(); this.sessionEnded$.next(); }
  hasRole(...roles: UserRole[]) { return !!this.userSignal() && roles.includes(this.userSignal()!.role!); }
  can(...permissions: string[]) { return this.active() && permissions.every(p => this.user()?.permissions?.includes(p)); }
  active() { const u = this.user(); return u?.status === 'ACTIVE' && (u.role === 'PLATFORM_ADMIN' ? u.tenantId === null : !!u.tenantId && u.tenantStatus === 'ACTIVE'); }
  home() {
    if (!this.user()) return '/login';
    if (!this.active()) return '/aguardando-aprovacao';
    if (this.hasRole('PLATFORM_ADMIN')) return '/plataforma/empresas';
    if (this.user()?.subscriptionAllowed === false) return this.hasRole('OWNER','ADMIN') ? '/assinatura' : '/meu-perfil';
    const destinations = [['relatorios.visualizar financeiro.visualizar','/dashboard'],['vendas.visualizar','/vendas'],['producao.visualizar','/cozinha'],['tesouraria.visualizar','/financeiro'],['financeiro.visualizar','/despesas'],['contabil.visualizar','/contabil'],['crm.visualizar','/crm'],['servicos.visualizar','/servicos'],['contratos.visualizar','/contratos'],['fidelidade.visualizar','/fidelidade'],['projetos.visualizar','/projetos'],['compras.visualizar','/compras'],['logistica.visualizar','/logistica'],['bi.visualizar','/bi'],['documentos.visualizar','/documentos'],['filiais.visualizar','/filiais'],['qualidade.visualizar','/qualidade'],['estoque.visualizar','/estoque'],['landing_page.visualizar','/vitrine'],['produtos.visualizar categorias.visualizar','/produtos'],['cargos.visualizar','/cargos']];
    return destinations.find(([permission]) => this.can(...permission.split(' ')))?.[1] ?? '/meu-perfil';
  }
}
