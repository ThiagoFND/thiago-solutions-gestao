import { Component, signal, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
@Component({selector:'app-profile',standalone:true,imports:[DatePipe,RouterLink],templateUrl:'./profile.component.html',styleUrl:'./profile.component.scss'})
export class ProfileComponent {
 profile=signal<any>(null); error=signal('');
 constructor(){inject(HttpClient).get(`${environment.apiUrl}/users/me/profile`).subscribe({next:p=>this.profile.set(p),error:()=>this.error.set('Não foi possível carregar o perfil.')});}
}
