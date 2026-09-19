import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { DailyReport } from '../../core/models';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Overview } from './overview.models';

@Component({ selector:'app-dashboard', standalone:true, imports:[FormsModule,DatePipe,RouterLink], templateUrl:'./dashboard.component.html', styleUrl:'./dashboard.component.scss' })
export class DashboardComponent implements OnInit {
  report=signal<DailyReport|null>(null); date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza'}).format(new Date());
  month=this.date.slice(0,7);overview=signal<Overview|null>(null);loading=signal(false);error=signal('');ranking='quantity';range='month';
  readonly weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];readonly hours=Array.from({length:24},(_,i)=>i);
  constructor(private readonly api:ApiService,private readonly http:HttpClient){} ngOnInit(){this.loadOverview();this.load();}
  load(){this.api.dailyReport(this.date).subscribe({next:v=>this.report.set(v),error:e=>this.fail(e)});}
  fail(e:any){this.error.set(e.error?.message??'Não foi possível carregar os indicadores. Tente novamente.');}
  loadOverview(){if(this.loading()||!this.month)return;this.loading.set(true);this.error.set('');this.overview.set(null);this.http.get<Overview>(`${environment.apiUrl}/reports/overview`,{params:{month:this.month}}).subscribe({next:v=>{this.overview.set(v);this.loading.set(false);},error:e=>{this.fail(e);this.loading.set(false);}});}
  percent(value:number|null){return value==null?'Sem vendas':value.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';}
  trend(){const rows=this.overview()?.trend??[];const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza'}).format(new Date());const end=this.month===today.slice(0,7)?Number(today.slice(8)):rows.length;return this.range==='week'?rows.slice(Math.max(0,end-7),end):rows;}
  bar(value:number){const max=Math.max(1,...this.trend().flatMap(x=>[x.producedQuantity,x.soldQuantity]));return value/max*100;}
  heat(day:number,hour:number){return this.overview()?.heatmap[day*24+hour]?.orderCount??0;}
  heatColor(day:number,hour:number){const max=Math.max(1,...(this.overview()?.heatmap.map(x=>x.orderCount)??[]));return `rgba(109, 77, 235, ${0.07+this.heat(day,hour)/max*0.85})`;}
  top(){return this.ranking==='quantity'?this.overview()?.topQuantity??[]:this.overview()?.topRevenue??[];}
  money(cents=0){return(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});} payment(name:string){return this.report()?.payments[name]??0;}
}
