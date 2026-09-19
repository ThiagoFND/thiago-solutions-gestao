import { Directive, ElementRef, effect, input, inject } from '@angular/core';
import { AuthService } from './auth.service';
/** Presentation only. The API independently validates every operation. */
@Directive({selector:'[appPermission]',standalone:true})
export class PermissionDirective {
  appPermission=input.required<string>();
  private readonly auth=inject(AuthService);
  private readonly element=inject(ElementRef<HTMLElement>);
  constructor(){effect(()=>{const allowed=this.auth.can(...this.appPermission().split(' ').filter(Boolean));this.element.nativeElement.style.setProperty('display',allowed?'':'none',allowed?'':'important');});}
}
