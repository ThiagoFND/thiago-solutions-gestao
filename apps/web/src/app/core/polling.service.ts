import { Injectable } from '@angular/core';
import { filter, interval, takeUntil } from 'rxjs';
import { AuthService } from './auth.service';
import { UserRole } from './models';

@Injectable({providedIn: 'root'})
export class PollingService {
  constructor(private readonly auth: AuthService) {}
  every(...roles: UserRole[]) {
    return interval(15000).pipe(filter(() => !document.hidden && this.auth.active() && this.auth.hasRole(...roles)), takeUntil(this.auth.sessionEnded$));
  }
  everyPermission(...permissions:string[]){return interval(15000).pipe(filter(()=>!document.hidden&&this.auth.can(...permissions)),takeUntil(this.auth.sessionEnded$));}
}
