import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, Observable, of, switchMap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const base = new URL(environment.apiUrl, window.location.origin);
  const target = new URL(request.url, window.location.origin);
  if (target.origin !== base.origin || !(target.pathname === base.pathname || target.pathname.startsWith(`${base.pathname}/`))) return next(request);
  const auth = inject(AuthService); const router = inject(Router);
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const nonce: Observable<string | null> = mutation ? auth.csrfToken() : of(null);
  return nonce.pipe(
    switchMap(csrf => next(request.clone({withCredentials: true, headers: csrf ? request.headers.delete('Authorization').set('X-CSRF-Token', csrf) : request.headers.delete('Authorization')}))),
    catchError(error => {
      if (error.status === 401) {
        const platform = auth.hasRole('PLATFORM_ADMIN') || router.url.startsWith('/plataforma');
        auth.clearSession();
        const publicSessionCheck = /\/auth\/me$/.test(target.pathname) && router.url.split(/[?#]/)[0] === '/';
        if (!publicSessionCheck && !/\/auth\/(platform-login|login)$/.test(target.pathname)) { auth.notice.set('Sessao expirada. Entre novamente.'); void router.navigate([platform ? '/plataforma/login' : '/login']); }
      } else if (error.status === 403) {
        auth.clearCsrf();
        auth.notice.set('Acesso negado. Verifique sua permissao; se a sessao expirou, entre novamente.');
      } else if (error.status === 429) auth.notice.set('Limite de solicitacoes atingido. Aguarde antes de tentar novamente.');
      return throwError(() => error);
    }),
  );
};
