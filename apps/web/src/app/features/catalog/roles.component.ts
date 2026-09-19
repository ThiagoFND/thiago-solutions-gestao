import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { CatalogApi, errorText } from './catalog-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-custom-roles',standalone:true,imports:[FormsModule,DatePipe],templateUrl:'./roles.component.html',styleUrl:'./admin.scss'})
export class RolesComponent implements OnInit {
  rows=signal<any[]>([]);catalog=signal<any[]>([]);message=signal('');busy=signal(false);editing='';form={name:'',description:'',permissions:[] as string[],active:true,archived:false,version:0};members=signal<any[]>([]);history=signal<any[]>([]);users=signal<any[]>([]);target='';page=1;pages=1;
  constructor(private readonly api:CatalogApi,public readonly auth:AuthService){}
  ngOnInit(){this.api.get('roles/permissions').subscribe({next:r=>this.catalog.set(r),error:e=>this.message.set(errorText(e))});this.load();}
  load(){this.api.get('roles',{page:this.page,limit:100}).subscribe({next:r=>{this.rows.set(r.items);this.pages=r.totalPages;},error:e=>this.message.set(errorText(e))});}
  groups(){return [...new Map(this.catalog().map(p=>[p.module,{key:p.module,name:p.moduleName}])).values()];}
  group(key:string){return this.catalog().filter(p=>p.module===key);}
  selected(key:string){return this.form.permissions.includes(key);}
  toggle(key:string,value:boolean){this.form.permissions=value?[...new Set([...this.form.permissions,key])]:this.form.permissions.filter(p=>p!==key);}
  toggleGroup(key:string,value:boolean){for(const p of this.group(key).filter(p=>p.assignable))this.toggle(p.key,value);}
  whole(key:string){const allowed=this.group(key).filter(p=>p.assignable);return allowed.length>0&&allowed.every(p=>this.selected(p.key));}
  reset(){this.editing='';this.form={name:'',description:'',permissions:[],active:true,archived:false,version:0};this.members.set([]);this.history.set([]);this.users.set([]);this.target='';}
  edit(r:any){this.editing=r._id;this.form={name:r.name,description:r.description,permissions:[...r.permissions],active:r.active,archived:r.archived,version:r.version};this.members.set([]);this.history.set([]);if(this.auth.can('usuarios.visualizar')){this.api.get(`roles/${r._id}/users`,{limit:100}).subscribe({next:v=>this.members.set(v.items),error:e=>this.message.set(errorText(e))});this.loadUsers(1,[]);}this.api.get(`roles/${r._id}/history`,{limit:100}).subscribe({next:v=>this.history.set(v.items),error:e=>this.message.set(errorText(e))});}
  loadUsers(page:number,all:any[]){this.api.get('users',{page,limit:100,status:'ACTIVE'}).subscribe({next:r=>{const next=[...all,...r.items];if(page<r.totalPages)this.loadUsers(page+1,next);else this.users.set(next.filter(u=>!['OWNER','ADMIN','PLATFORM_ADMIN'].includes(u.role)&&u._id!==this.auth.user()?.sub));},error:e=>this.message.set(errorText(e))});}
  save(f:NgForm){if(this.busy())return;if(f.invalid){f.control.markAllAsTouched();this.message.set('Confira o nome e a descrição do cargo.');return;}if(!confirm(`Salvar “${this.form.name}” com ${this.form.permissions.length} permissões? As sessões dos usuários afetados serão revogadas.`))return;this.busy.set(true);const req=this.editing?this.api.patch(`roles/${this.editing}`,this.form):this.api.post('roles',this.form);req.subscribe({next:()=>{this.busy.set(false);this.message.set('Cargo salvo. Sessões afetadas revogadas.');this.reset();this.load();},error:e=>{this.busy.set(false);this.message.set(errorText(e));}});}
  duplicate(r:any){const name=prompt('Nome do novo cargo:',`${r.name} (cópia)`);if(!name||this.busy())return;this.busy.set(true);this.api.post(`roles/${r._id}/duplicate`,{name}).subscribe({next:()=>{this.busy.set(false);this.message.set('Cargo duplicado.');this.load();},error:e=>{this.busy.set(false);this.message.set(errorText(e));}});}
  assign(){if(!this.target||this.busy()||!confirm('Atribuir este cargo ao usuário? As permissões anteriores serão substituídas e as sessões serão revogadas.'))return;this.busy.set(true);this.api.post(`roles/${this.editing}/assign/${this.target}`).subscribe({next:()=>{this.busy.set(false);this.message.set('Cargo atribuído. O usuário precisa entrar novamente.');this.edit({...this.form,_id:this.editing});},error:e=>{this.busy.set(false);this.message.set(errorText(e));}});}
  action(key:string){return({created:'Cargo criado',updated:'Permissões ou cadastro alterados',assigned:'Cargo atribuído',removed:'Cargo removido'} as Record<string,string>)[key]??key;}
}
