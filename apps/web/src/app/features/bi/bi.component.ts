import { Component, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CommerceApi } from '../commerce/commerce-api.service';
import { AuthService } from '../../core/auth.service';
import { biValue, parseBiCsv } from './bi-csv';
@Component({selector:'app-bi',standalone:true,imports:[FormsModule,DatePipe,CurrencyPipe],templateUrl:'./bi.component.html',styleUrls:['../business/business.component.scss','../crm/crm.component.scss']})
export class BiComponent {
 busy=signal(false);message=signal('');datasets=signal<any[]>([]);people=signal<any[]>([]);selected=signal<any>(null);dashboard=signal<any>(null);operations=signal<any>(null);records=signal<any[]>([]);preview=signal<any[]>([]);page=1;total=0;recordPage=1;recordTotal=0;search='';month=new Date().toISOString().slice(0,7);from='';to='';category='';csv='chave;data;valor;categoria\n';sourceFile='';reason='';allowedUserIds:string[]=[];
 draft={name:'',definition:'',sourceName:'',unit:'BRL_CENTS',allowedUserIds:[] as string[]};goal={month:this.month,value:'',direction:'AT_LEAST'};private keys=new Map<string,string>();
 labels:Record<string,string>={BRL_CENTS:'Reais (armazenados em centavos)',UNITS:'Unidades',MINUTES:'Minutos',MET:'Meta atendida',BELOW_TARGET:'Abaixo da meta',ABOVE_LIMIT:'Acima do limite',NO_DATA:'Sem dados',FILTERED_SCOPE:'Filtro aplicado; meta integral não avaliada',PARTIAL_PERIOD:'Período parcial; meta não avaliada'};
 constructor(private api:CommerceApi,private http:HttpClient,public auth:AuthService){void this.load();}
 private fail(e:any){if([403,404].includes(e.status)){this.dashboard.set(null);this.records.set([]);this.operations.set(null);}const m=e.error?.message??e.message;this.message.set(Array.isArray(m)?m.join(' '):m??'Não foi possível concluir.');}
 private get(path:string){return firstValueFrom(this.api.get<any>('bi/'+path));}
 private async team(){let page=1,items:any[]=[];while(true){const r=await this.get(`people?page=${page}&limit=100`);items.push(...r.items);if(items.length>=r.total||!r.items.length)return items;page++;}}
 query(){const q=new URLSearchParams({month:this.month,page:String(this.recordPage),limit:'20'});if(this.from)q.set('from',this.from);if(this.to)q.set('to',this.to);if(this.category)q.set('category',this.category);return q;}
 async load(){if(this.busy())return;this.busy.set(true);try{const [d,p,o]=await Promise.all([this.get('datasets?'+new URLSearchParams({page:String(this.page),limit:'20',search:this.search})),(this.auth.can('bi.configurar')||this.auth.can('bi.compartilhar'))?this.team():Promise.resolve([]),this.get('operations?'+this.query())]);this.datasets.set(d.items);this.total=d.total;this.people.set(p);this.operations.set(o);if(this.selected())await this.loadDashboard();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 async save(path:string,body:any,create=false){if(this.busy())return null;this.busy.set(true);try{let key=this.keys.get(path);if(create&&!key){key=crypto.randomUUID();this.keys.set(path,key);}const r=await firstValueFrom(this.api.post<any>('bi/'+path,{...body,...(create?{requestId:key}:{})}));this.keys.delete(path);this.message.set('Operação salva.');return r;}catch(e){this.fail(e);return null;}finally{this.busy.set(false);}}
 toggle(ids:string[],id:string,checked:boolean){if(checked&&!ids.includes(id))ids.push(id);if(!checked&&ids.includes(id))ids.splice(ids.indexOf(id),1);}
 async create(){const r=await this.save('datasets',this.draft,true);if(r){this.draft.name='';await this.load();await this.open(r);}}
 async open(row:any){this.dashboard.set(null);this.records.set([]);this.selected.set(row);this.preview.set([]);this.recordPage=1;this.allowedUserIds=[...row.allowedUserIds];await this.load();}
 async loadDashboard(){const id=this.selected()._id,q=this.query();const [d,r]=await Promise.all([this.get(`datasets/${id}/dashboard?${q}`),this.get(`datasets/${id}/records?${q}`)]);this.dashboard.set(d);this.selected.set(d.dataset);this.records.set(r.items);this.recordTotal=r.total;}
 async recordPageMove(delta:number){this.recordPage+=delta;await this.load();}
 async readFile(event:Event){const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;try{if(file.size>500000)throw new Error('Arquivo acima de 500 KB.');this.sourceFile=file.name;this.csv=await file.text();this.preview.set([]);}catch(e){this.fail(e);}}
 validate(){try{this.preview.set(parseBiCsv(this.csv,this.selected().unit));this.message.set('Prévia validada. Confira os valores antes de importar.');}catch(e){this.preview.set([]);this.fail(e);}}
 async import(){if(!this.preview().length)return;const r=await this.save(`datasets/${this.selected()._id}/imports`,{sourceFile:this.sourceFile,rows:this.preview()},true);if(r){this.preview.set([]);this.message.set(`${r.inserted} linhas importadas; ${r.repeated} repetições preservadas sem duplicar.`);await this.load();}}
 async share(){if(await this.save(`datasets/${this.selected()._id}/access`,{version:this.selected().version,reason:this.reason,allowedUserIds:this.allowedUserIds})){this.selected.set(null);this.dashboard.set(null);await this.load();}}
 async createGoal(){try{if(await this.save(`datasets/${this.selected()._id}/goals`,{month:this.goal.month,target:biValue(this.goal.value,this.selected().unit),direction:this.goal.direction,reason:this.reason},true))await this.load();}catch(e){this.fail(e);}}
 formatted(value:number|null){if(value===null)return 'Sem dados';return this.selected()?.unit==='BRL_CENTS'?(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):value.toLocaleString('pt-BR');}
 bar(value:number){const max=Math.max(1,...(this.dashboard()?.months??[]).map((m:any)=>Math.abs(m.value)));return Math.abs(value)/max*100;}
 async exportPage(){try{const blob=await firstValueFrom(this.http.get(`${environment.apiUrl}/bi/datasets/${this.selected()._id}/export?${this.query()}`,{responseType:'blob'}));const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`bi-pagina-${this.recordPage}.csv`;a.click();URL.revokeObjectURL(url);}catch(e){this.fail(e);}}
}
