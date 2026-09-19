import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { CommerceApi } from '../commerce/commerce-api.service';
import { AuthService } from '../../core/auth.service';
@Component({selector:'app-quality',standalone:true,imports:[FormsModule,DatePipe],templateUrl:'./quality.component.html',styleUrl:'../business/business.component.scss'})
export class QualityComponent {
 rows=signal<any[]>([]);products=signal<any[]>([]);reasons=signal<any[]>([]);selected=signal<any>(null);busy=signal(false);message=signal('');integration=signal(false);page=1;total=0;status='';productPage=0;productTotal=0;reasonPage=0;reasonTotal=0;catalogBusy=signal(false);
 reason={name:'',instructions:''};entry={productId:'',reasonId:'',quantity:1,originReference:'',quarantineLocation:'',lot:'',expiresAt:'',notes:''};private key=crypto.randomUUID();
 inspection={decision:'',conclusion:'',destination:''};assessments=this.checks();labels:Record<string,string>={QUARANTINE:'Em quarentena',APPROVED:'Aprovado',REJECTED:'Reprovado',IDENTITY:'Identificação do produto',PACKAGING:'Embalagem',CONDITION:'Condição e integridade',VALIDITY:'Validade',PASS:'Conforme',FAIL:'Não conforme',NOT_APPLICABLE:'Não se aplica'};
 constructor(private api:CommerceApi,public auth:AuthService){this.load();this.moreProducts();this.moreReasons();}
 checks(){return ['IDENTITY','PACKAGING','CONDITION','VALIDITY'].map(code=>({code,result:'',observation:''}));}
 load(){if(this.busy())return;this.busy.set(true);this.api.get<any>(`quality/returns?page=${this.page}&limit=20${this.status?'&status='+this.status:''}`).subscribe({next:p=>{this.rows.set(p.items);this.total=p.total;this.integration.set(p.inventoryIntegration);this.busy.set(false);},error:e=>this.fail(e)});}
 moreProducts(){this.api.get<any>(`quality/products?page=${this.productPage+1}&limit=100`).subscribe({next:p=>{this.productPage++;this.products.update(v=>[...v,...p.items]);this.productTotal=p.total;},error:e=>this.fail(e)});}
 moreReasons(){this.api.get<any>(`quality/reasons?page=${this.reasonPage+1}&limit=100`).subscribe({next:p=>{this.reasonPage++;this.reasons.update(v=>[...v,...p.items]);this.reasonTotal=p.total;},error:e=>this.fail(e)});}
 saveReason(){if(this.busy())return;this.busy.set(true);this.api.post('quality/reasons',this.reason).subscribe({next:()=>{this.busy.set(false);this.reason={name:'',instructions:''};this.reasonPage=0;this.reasons.set([]);this.moreReasons();this.message.set('Motivo cadastrado.');},error:e=>this.fail(e)});}
 toggleReason(r:any){if(this.busy())return;this.busy.set(true);this.api.post<any>(`quality/reasons/${r._id}/status`,{version:r.version,active:!r.active}).subscribe({next:updated=>{this.reasons.update(rows=>rows.map(row=>row._id===r._id?updated:row));this.busy.set(false);},error:e=>this.fail(e)});}
 receive(){if(this.busy())return;this.busy.set(true);const {expiresAt,...entry}=this.entry;this.api.post('quality/returns',{...entry,...(expiresAt?{expiresAt}:{}),requestId:this.key}).subscribe({next:()=>{this.key=crypto.randomUUID();this.entry={productId:'',reasonId:'',quantity:1,originReference:'',quarantineLocation:'',lot:'',expiresAt:'',notes:''};this.busy.set(false);this.message.set('Recebimento em quarentena registrado. O estoque vendável ainda não foi aumentado.');this.page=1;this.load();},error:e=>this.fail(e)});}
 select(row:any){this.selected.set(row);this.inspection={decision:'',conclusion:'',destination:''};this.assessments=this.checks();}
 inspect(){const row=this.selected();if(!row||this.busy()||!window.confirm(this.inspection.decision==='APPROVED'&&this.integration()?'Aprovar e adicionar a quantidade ao estoque agora?':'Confirmar esta avaliação?'))return;this.busy.set(true);this.api.post<any>(`quality/returns/${row._id}/inspect`,{...this.inspection,assessments:this.assessments,version:row.version}).subscribe({next:r=>{this.selected.set(null);this.busy.set(false);this.message.set(r.stockApplied?'Avaliação registrada e estoque reposto uma única vez.':'Avaliação registrada sem movimentação de estoque.');this.load();},error:e=>this.fail(e)});}
 fail(e:any){this.busy.set(false);const m=e.error?.message;this.message.set(Array.isArray(m)?m.join(' '):m??'Não foi possível concluir. Atualize e tente novamente.');}
}
