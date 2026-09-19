import { DocumentDirective } from '../../core/document.directive';
import { PhoneDirective } from '../../core/phone.directive';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TenancyApi } from '../../core/tenancy-api.service';
@Component({selector:'app-registration', standalone:true, imports:[FormsModule,RouterLink,PhoneDirective,DocumentDirective], templateUrl:'./registration.component.html', styleUrl:'./registration.component.scss'})
export class RegistrationComponent {
  employee = false; busy = signal(false); message = signal(''); success = signal(false);
  company = {cnpj:'',legalName:'',tradeName:'',corporateEmail:'',phone:''};
  owner = {name:'',email:'',password:'',passwordConfirmation:''};
  cpf = ''; phone = ''; jobDescription = ''; available = signal(false);
  constructor(private readonly api: TenancyApi, router: Router) { this.employee = router.url === '/solicitar-acesso'; }
  lookup() { if(this.busy()) return; this.busy.set(true); this.api.lookup(this.company.cnpj).subscribe({next:()=>{this.available.set(true);this.message.set('Empresa disponível para solicitação.');this.busy.set(false);},error:e=>{this.available.set(false);this.fail(e);}}); }
  fail(e: any) { this.busy.set(false); this.message.set(Array.isArray(e.error?.message) ? e.error.message.join('. ') : e.error?.message ?? 'Não foi possível concluir. Tente novamente.'); }
  submit() {
    if(this.busy()) return;
    if(this.owner.password !== this.owner.passwordConfirmation){this.message.set('As senhas informadas não são iguais.');return;}
    if(this.owner.password!==this.owner.password.trim() || this.owner.password.length<12 || new TextEncoder().encode(this.owner.password).length>72){this.message.set('Use 12 a 72 caracteres, até 72 bytes, sem espaços nas pontas.');return;}
    if(!/^\d{10,11}$/.test(this.employee?this.phone:this.company.phone)){this.message.set('Informe o DDD e um telefone válido com 10 ou 11 dígitos');return;}
    this.owner.email=this.owner.email.replace(/\s/g,'').toLowerCase();this.company.corporateEmail=this.company.corporateEmail.replace(/\s/g,'').toLowerCase();
    this.busy.set(true); this.message.set('');
    const call = this.employee ? this.api.request({...this.owner,cnpj:this.company.cnpj,cpf:this.cpf,phone:this.phone,jobDescription:this.jobDescription}) : this.api.onboarding({company:this.company,owner:this.owner});
    call.subscribe({next:()=>{this.busy.set(false);this.success.set(true);this.cpf='';this.owner.password='';this.owner.passwordConfirmation='';},error:e=>this.fail(e)});
  }
}
