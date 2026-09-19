import { SolutionsComponent } from './solutions.component';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({selector:'app-landing',standalone:true,imports:[RouterLink,SolutionsComponent],templateUrl:'./landing.component.html',styleUrl:'./landing.component.scss'})
export class LandingComponent {
  readonly auth=inject(AuthService);
  constructor(){this.auth.restore().subscribe();}
}
