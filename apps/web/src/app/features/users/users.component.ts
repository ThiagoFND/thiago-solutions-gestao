import { AuthService } from '../../core/auth.service';
import { PermissionDirective } from '../../core/permission.directive';
import { Component, DestroyRef, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, exhaustMap, filter, tap } from 'rxjs';
import { TenancyApi, Member } from '../../core/tenancy-api.service';
import { PollingService } from '../../core/polling.service';
@Component({selector:'app-users',standalone:true,imports: [PermissionDirective,FormsModule,DatePipe],templateUrl:'./users.component.html',styleUrl:'./users.component.scss'})
export class UsersComponent {
 readonly statuses:Record<string,string>={PENDING:'Pendente',ACTIVE:'Ativo',INACTIVE:'Inativo',REJECTED:'Recusado'};
 readonly roles:Record<string,string>={OWNER:'Proprietário',ADMIN:'Administrador',MEMBER:'Cargo a definir',CASHIER:'Atribua um cargo da empresa',KITCHEN:'Atribua um cargo da empresa',ACCOUNTANT:'Atribua um cargo da empresa',PLATFORM_ADMIN:'Administrador da plataforma'};
 users=signal<Member[]>([]); status='PENDING'; page=1; pages=1; total=0; busy=signal(false); message=signal(''); choices:Record<string,string>={};
 customRoles=signal<{_id:string;name:string}[]>([]);rolesLoading=signal(false);
 constructor(public readonly auth:AuthService, public readonly api:TenancyApi,polling:PollingService,destroy:DestroyRef){
  this.load();this.loadRoles(); polling.everyPermission('usuarios.visualizar').pipe(filter(()=>!this.busy()),exhaustMap(()=>this.fetch()),takeUntilDestroyed(destroy)).subscribe();
 }
 fetch(){this.busy.set(true);return this.api.members(this.status,this.page).pipe(tap(p=>{this.users.set(p.items);this.total=p.total;this.pages=p.totalPages;this.busy.set(false);if(this.status==='PENDING')this.api.pending.set(p.total);}),catchError(e=>{this.fail(e);return EMPTY;}));}
 load(reset=false){if(reset)this.page=1;if(!this.busy())this.fetch().subscribe();}
 fail(e:any){this.busy.set(false);this.message.set(e.error?.message??'Não foi possível carregar os usuários.');}
 loadRoles(page=1,all:{_id:string;name:string}[]=[]){
  if(!this.auth.can('cargos.visualizar')||!this.auth.can('cargos.atribuir'))return;
  this.rolesLoading.set(true);this.api.customRoles(page).subscribe({next:r=>{
    const next=[...all,...r.items.filter(role=>role.active&&!role.archived&&role.permissions.every(p=>this.auth.can(p)))];
    if(page<r.totalPages)this.loadRoles(page+1,next);else{this.customRoles.set(next);this.rolesLoading.set(false);}
  },error:()=>{this.rolesLoading.set(false);this.message.set('Não foi possível carregar os cargos da empresa. Atualize a página para tentar novamente.');}});
 }
 assignable(user:Member){return user._id!==this.auth.user()?.sub&&!['OWNER','ADMIN','PLATFORM_ADMIN'].includes(user.role??'')&&this.auth.can('cargos.atribuir')&&this.auth.can(user.status==='PENDING'?'usuarios.aprovar':'usuarios.alterar_cargo');}
 change(user:Member,action:string){
  if(this.busy())return;
  const role=this.choices[user._id]; if((action==='approve'||action==='role')&&(!role?.startsWith('custom:')||!this.customRoles().some(r=>r._id===role.slice(7)))){this.message.set('Selecione o cargo antes de confirmar.');return;}
  let body:unknown={customRoleId:role?.slice(7)};
  if(action==='reject'){const reason=window.prompt('Motivo da recusa (opcional):');if(reason===null)return;body={reason};}
  else if(action==='status'){const status=user.status==='ACTIVE'?'INACTIVE':'ACTIVE';if(!window.confirm(status==='INACTIVE'?'Inativar usuário e revogar todas as sessões?':'Reativar este usuário?'))return;body={status};}
  else if(!window.confirm(action==='approve'?'Aprovar com o perfil selecionado?':'Alterar perfil e revogar as sessões?'))return;
  this.busy.set(true);this.api.changeMember(user._id,action,body).subscribe({next:()=>{this.busy.set(false);this.message.set('Alteração salva. As sessões anteriores foram revogadas.');delete this.choices[user._id];this.load();this.api.count().subscribe(v=>this.api.pending.set(v.count));},error:e=>this.fail(e)});
 }
 move(delta:number){this.page+=delta;this.load();}
}
