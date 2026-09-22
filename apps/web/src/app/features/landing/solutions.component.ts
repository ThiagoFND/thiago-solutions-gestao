import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** Estado de entrega do serviço: o tom pinta, a palavra informa. Cor nunca vai sozinha. */
type ServiceState = { label: string; tone: 'success' | 'info' | 'warning' | 'neutral' };

@Component({selector:'app-solutions',standalone:true,imports:[FormsModule],templateUrl:'./solutions.component.html',styleUrl:'./solutions.component.scss'})
export class SolutionsComponent {
 catalog=signal<any>(null);loading=signal(true);loadError=signal(false);
 result=signal<any>(null);message=signal('');busy=signal(false);sent=signal(false);
 problem='';needs:string[]=[];name='';email='';phone='';consent=false;website='';requestId=crypto.randomUUID();
 /** Marcas de lugar do carregamento, na contagem real de cartões que o catálogo costuma trazer. */
 readonly placeholders=[0,1,2,3,4,5];
 private readonly states:Record<string,ServiceState>={
  AVAILABLE:{label:'Disponível',tone:'success'},
  PARTIAL:{label:'Disponível com escopo definido',tone:'info'},
  PLANNED:{label:'Em preparação',tone:'warning'},
  EXTERNAL:{label:'Requer integração externa',tone:'neutral'},
 };
 constructor(private http:HttpClient){this.load();}
 /** Os quatro finais desta seção saem daqui: dados, carregando, erro e vazio. */
 load(){
  this.loading.set(true);this.loadError.set(false);
  this.http.get(`${environment.apiUrl}/public/solutions`).subscribe({
   next:r=>{this.catalog.set(r);this.loading.set(false);},
   error:()=>{this.loadError.set(true);this.loading.set(false);},
  });
 }
 state(code:string):ServiceState{return this.states[code]??{label:code,tone:'neutral'};}
 nameOf(code:string){return this.catalog()?.services.find((s:any)=>s.code===code)?.name??code;}
 toggle(code:string,checked:boolean){this.needs=checked?[...this.needs,code]:this.needs.filter(n=>n!==code);this.changed();}
 changed(){this.result.set(null);this.sent.set(false);this.message.set('');this.requestId=crypto.randomUUID();}
 recommend(){if(this.busy())return;this.busy.set(true);this.message.set('');this.http.post(`${environment.apiUrl}/public/solutions/recommend`,{problem:this.problem,needs:this.needs}).subscribe({next:r=>{this.result.set(r);this.busy.set(false);},error:e=>this.fail(e)});}
 submit(){if(this.busy()||this.sent())return;this.busy.set(true);this.http.post<any>(`${environment.apiUrl}/public/solutions/contact`,{name:this.name,email:this.email,phone:this.phone,problem:this.problem,needs:this.needs,consent:this.consent,website:this.website,requestId:this.requestId}).subscribe({next:r=>{this.result.set(r.recommendation);this.message.set(r.message);this.sent.set(true);this.busy.set(false);},error:e=>this.fail(e)});}
 fail(e:any){this.busy.set(false);const m=e.error?.message;this.message.set(e.status===429?'Você enviou várias solicitações. Aguarde um minuto antes de tentar novamente.':Array.isArray(m)?m.join(' '):m??'Não foi possível concluir. Tente novamente.');}
}
