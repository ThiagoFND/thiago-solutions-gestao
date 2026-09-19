import { Component, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface AuditEvent {
  _id: string; occurredAt: string; action: string; outcome: 'success'|'failure'|'denied';
  actorId?: string; actorRole?: string; resourceType?: string; resourceId?: string;
}

@Component({selector:'app-audit',standalone:true,imports:[DatePipe],templateUrl:'./audit.component.html',styleUrl:'../business/business.component.scss'})
export class AuditComponent {
  rows=signal<AuditEvent[]>([]);busy=signal(false);error=signal('');page=1;total=0;totalPages=0;
  readonly outcomes={success:'Concluída',failure:'Falhou',denied:'Acesso negado'};
  constructor(private readonly http:HttpClient){this.load();}
  load(page=this.page){
    if(this.busy())return;
    this.busy.set(true);this.error.set('');
    this.http.get<{items:AuditEvent[];total:number;totalPages:number}>(`${environment.apiUrl}/audit`,{params:{page,limit:20}}).subscribe({
      next:result=>{this.rows.set(result.items);this.total=result.total;this.totalPages=result.totalPages;this.page=page;this.busy.set(false);},
      error:()=>{this.error.set('Não foi possível consultar a auditoria. Tente atualizar.');this.busy.set(false);},
    });
  }
}
