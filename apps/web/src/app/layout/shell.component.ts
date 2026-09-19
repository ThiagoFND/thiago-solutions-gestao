import { Component, DestroyRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, exhaustMap, filter, interval, takeUntil } from 'rxjs';
import { TenancyApi } from '../core/tenancy-api.service';
import { PollingService } from '../core/polling.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell', standalone: true, imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html', styleUrl: './shell.component.scss',
})
export class ShellComponent {
  constructor(public readonly tenancy: TenancyApi, polling: PollingService, public readonly auth: AuthService, private readonly router: Router, destroyRef: DestroyRef) {
    const count = () => tenancy.count().pipe(catchError(() => EMPTY));
    if(auth.can('usuarios.visualizar')) count().subscribe(v=>tenancy.pending.set(v.count));
    polling.everyPermission('usuarios.visualizar').pipe(exhaustMap(count),takeUntilDestroyed(destroyRef)).subscribe(v=>tenancy.pending.set(v.count));
    auth.sessionEnded$.pipe(takeUntilDestroyed(destroyRef)).subscribe(()=>tenancy.pending.set(0));
    interval(15000).pipe(filter(()=>!document.hidden),exhaustMap(() => this.auth.restore()), takeUntil(this.auth.sessionEnded$), takeUntilDestroyed(destroyRef)).subscribe(valid => {
      if (!valid) void this.router.navigate(['/login']);
      else if (auth.user()?.subscriptionAllowed === false && !['/meu-perfil','/assinatura'].includes(router.url.split(/[?#]/)[0])) void router.navigate([auth.home()]);
      else if ((!auth.active() || auth.hasRole('PLATFORM_ADMIN')) && router.url.split(/[?#]/)[0] !== '/meu-perfil') void router.navigate([auth.home()]);
    });
  }
  logout() { this.auth.logout().subscribe({ next: () => void this.router.navigate(['/login']), error: () => this.auth.notice.set('Nao foi possivel encerrar a sessao no servidor. Aguarde e tente sair novamente.') }); }
}
