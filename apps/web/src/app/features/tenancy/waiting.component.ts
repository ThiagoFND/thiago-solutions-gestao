import { Component, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { filter, interval, exhaustMap, takeUntil } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-waiting',standalone:true,templateUrl:'./waiting.component.html',styleUrl:'./waiting.component.scss'})
export class WaitingComponent {
 constructor(public readonly auth:AuthService,private readonly router:Router,destroy:DestroyRef) {
   interval(15000).pipe(filter(()=>!document.hidden),exhaustMap(()=>auth.restore()),takeUntil(auth.sessionEnded$),takeUntilDestroyed(destroy)).subscribe(valid=>{if(valid && auth.active()) void router.navigate([auth.home()]);});
 }
 logout(){this.auth.logout().subscribe({next:()=>void this.router.navigate(['/login']),error:()=>this.auth.notice.set('Não foi possível sair. Tente novamente.')});}
}
