import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';
import { UserRole } from './models';
export const authGuard: CanActivateFn = () => {
 const auth=inject(AuthService),router=inject(Router);
 return auth.restore().pipe(map(valid=>{if(!valid)return router.createUrlTree(['/login']);if(!auth.active()||auth.hasRole('PLATFORM_ADMIN'))return router.createUrlTree([auth.home()]);return true;}));
};
export const waitingGuard: CanActivateFn = () => {
 const auth=inject(AuthService),router=inject(Router);
 return auth.restore().pipe(map(valid=>!valid?router.createUrlTree(['/login']):auth.active()?router.createUrlTree([auth.home()]):true));
};
export const roleGuard=(...roles:UserRole[]):CanActivateFn=>()=>{
 const auth=inject(AuthService),router=inject(Router);
 return auth.restore().pipe(map(valid=>{
  if(!valid)return router.createUrlTree([roles.includes('PLATFORM_ADMIN')?'/plataforma/login':'/login']);
  if(auth.active()&&auth.hasRole(...roles))return true;
  auth.notice.set('Você não possui permissão para acessar essa área.');return router.createUrlTree([auth.home()]);
 }));
};

export const sessionGuard: CanActivateFn = () => { const auth=inject(AuthService), router=inject(Router); return auth.restore().pipe(map(ok=>ok?true:router.createUrlTree(['/login']))); };
export const permissionGuard = (...permissions: string[]): CanActivateFn => () => {
 const auth=inject(AuthService),router=inject(Router);
 return auth.restore().pipe(map(valid=>!valid?router.createUrlTree(['/login']):auth.can(...permissions)?true:router.createUrlTree([auth.user()?.subscriptionAllowed===false?auth.home():'/meu-perfil'])));
};
