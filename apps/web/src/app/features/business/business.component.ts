import { Component, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { environment } from '../../../environments/environment';
import { parsePrice } from '../commerce/commerce-api.service';
@Component({selector:'app-business',standalone:true,imports:[FormsModule,CurrencyPipe],templateUrl:'./business.component.html',styleUrl:'./business.component.scss'})
export class BusinessComponent {
 ledgerAccountId='';ledger=signal<any>(null);statements=signal<any>(null);
 private references=new Map<string,string>();
 private requestReference(path:string){let value=this.references.get(path);if(!value){value=crypto.randomUUID();this.references.set(path,value);}return value;}

 mode:string;tab='summary';busy=signal(false);message=signal('');rows=signal<any[]>([]);accounts=signal<any[]>([]);parties=signal<any[]>([]);summary=signal<any>(null);sources=signal<any[]>([]);
 page=1;total=0;month=new Date().toISOString().slice(0,7);search='';reason='';date=new Date().toISOString().slice(0,10);amount='';
 party={name:'',role:'CUSTOMER',email:'',phone:'',notes:''};account={name:'',kind:'BANK',code:'',opening:'0'};
 entry={accountId:'',partyId:'',description:'',direction:'IN',dueDate:this.date};transfer={fromAccountId:'',toAccountId:''};description='';
 lines=[{accountId:'',debit:'',credit:''},{accountId:'',debit:'',credit:''}];debitAccountId='';creditAccountId='';obligation={name:'',dueDate:this.date,notes:''};
 readonly names:Record<string,string>={PENDING:'Pendente',SETTLED:'Liquidado',CANCELED:'Cancelado',DONE:'Concluída',NOT_APPLICABLE:'Não aplicável',BANK:'Banco',CASH:'Caixa',WALLET:'Carteira',ASSET:'Ativo',LIABILITY:'Passivo',EQUITY:'Patrimônio líquido',REVENUE:'Receita',EXPENSE:'Despesa',SALE:'Venda',TREASURY:'Movimento financeiro',IN:'Entrada',OUT:'Saída'};
 constructor(private http:HttpClient,route:ActivatedRoute,public auth:AuthService){this.mode=route.snapshot.data['mode'];this.tab=this.mode==='parties'?'parties':'summary';if(this.mode==='accounting')this.account.kind='ASSET';void this.load();}
 get title(){return this.mode==='accounting'?'Contábil':this.mode==='treasury'?'Financeiro':'Clientes e fornecedores';}
 get prefix(){return this.mode==='accounting'?'contabil':this.mode==='treasury'?'tesouraria':'cadastros';}
 url(path:string){return `${environment.apiUrl}/${path}`;}
 async get(path:string){return firstValueFrom(this.http.get<any>(this.url(path)));}
 async catalog(path:string){let page=1,items:any[]=[];while(true){const result=await this.get(`${path}?page=${page}&limit=100`);items.push(...result.items);if(items.length>=result.total||!result.items.length)return items;page++;}}
 fail(e:any){const msg=e.error?.message;this.message.set(Array.isArray(msg)?msg.join(' '):msg??'Não foi possível concluir. Atualize os dados e tente novamente.');}
 async load(){if(this.busy())return;this.busy.set(true);try{
  const query=`month=${this.month}&page=${this.page}&limit=20&search=${encodeURIComponent(this.search)}`;
  if(this.mode==='parties'){const p=await this.get(`parties?${query}`);this.rows.set(p.items);this.total=p.total;}
  else{this.accounts.set(await this.catalog(`${this.mode}/accounts`));
   if(this.mode==='treasury'){this.summary.set(await this.get(`treasury/summary?${query}`));if(this.auth.can('cadastros.visualizar'))this.parties.set(await this.catalog('parties'));}
   else this.summary.set(await this.get(`accounting/trial-balance?${query}`));
   if(this.tab==='entries'||this.tab==='journals'||this.tab==='obligations'){const p=await this.get(`${this.mode}/${this.tab}?${query}`);this.rows.set(p.items);this.total=p.total;}
   if(this.tab==='sources'){const p=await this.get(`accounting/sources?${query}`);this.sources.set(p.sources);this.total=Math.max(0,...p.sources.map((s:any)=>s.total));}
   if(this.tab==='ledger'){if(this.ledgerAccountId){const p=await this.get(`accounting/ledger?${query}&accountId=${this.ledgerAccountId}`);this.ledger.set(p);this.rows.set(p.items);this.total=p.total;}else{this.ledger.set(null);this.total=0;}}
   if(this.tab==='statements')this.statements.set(await this.get(`accounting/statements?${query}`));
  }
 }catch(e){this.fail(e);}finally{this.busy.set(false);}}
 choose(tab:string){this.tab=tab;this.page=1;this.rows.set([]);void this.load();}
 move(delta:number){this.page+=delta;void this.load();}
 async save(path:string,body:unknown){if(this.busy())return;this.busy.set(true);try{await firstValueFrom(this.http.post(this.url(path),body));this.references.delete(path);this.message.set('Operação registrada.');this.amount='';this.description='';this.reason='';}catch(e){this.fail(e);}finally{this.busy.set(false);await this.load();}}
 money(value:string){const cents=parsePrice(value||'0');if(cents===null)throw new Error('Valor inválido.');return cents;}
 createParty(){void this.save('parties',{name:this.party.name,roles:[this.party.role],...(this.party.email?{email:this.party.email}:{}),...(this.party.phone?{phone:this.party.phone}:{}),notes:this.party.notes});}
 createAccount(){try{void this.save(`${this.mode}/accounts`,this.mode==='accounting'?{code:this.account.code,name:this.account.name,kind:this.account.kind}:{name:this.account.name,kind:this.account.kind,openingCents:this.money(this.account.opening)});}catch{this.message.set('Informe um valor em reais com até duas casas decimais.');}}
 createEntry(){try{void this.save('treasury/entries',{...this.entry,partyId:this.entry.partyId||undefined,amountCents:this.money(this.amount),reference:this.requestReference('treasury/entries')});}catch{this.message.set('Confira o valor do lançamento.');}}
 settle(row:any){if(this.reason.trim().length<5){this.message.set('Informe o motivo com pelo menos 5 caracteres.');return;}if(window.confirm('Confirmar a liquidação deste lançamento?'))void this.save(`treasury/entries/${row._id}/settle`,{version:row.version,date:this.date,reason:this.reason});}
 cancel(row:any){if(this.reason.trim().length<5)return;if(window.confirm('Cancelar este lançamento pendente?'))void this.save(`treasury/entries/${row._id}/cancel`,{version:row.version,reason:this.reason});}
 createTransfer(){try{if(window.confirm('Confirmar transferência entre as contas selecionadas?'))void this.save('treasury/transfers',{...this.transfer,amountCents:this.money(this.amount),date:this.date,reference:this.requestReference('treasury/transfers'),reason:this.reason});}catch{this.message.set('Confira o valor da transferência.');}}
 journal(){try{void this.save('accounting/journals',{date:this.date,description:this.description,reference:this.requestReference('accounting/journals'),lines:this.lines.map(l=>({accountId:l.accountId,debitCents:this.money(l.debit),creditCents:this.money(l.credit)}))});}catch{this.message.set('Use valores em reais, com até duas casas decimais.');}}
 reverse(row:any){if(this.reason.trim().length<5){this.message.set('Informe a justificativa do estorno.');return;}if(window.confirm('Criar um lançamento inverso, preservando o original?'))void this.save(`accounting/journals/${row._id}/reverse`,{version:row.version,date:this.date,reason:this.reason});}
 import(source:string,row:any){if(window.confirm('Escriturar esta origem nas contas selecionadas? Confira a classificação para evitar dupla contabilização.'))void this.save('accounting/imports',{source,sourceId:row._id,debitAccountId:this.debitAccountId,creditAccountId:this.creditAccountId});}
 close(){if(window.confirm('Confirmar alteração do fechamento desta competência?'))void this.save('accounting/closing',{month:this.month,version:this.summary()?.closing?.version??0,closed:!this.summary()?.closing?.closed,reason:this.reason});}
 createObligation(){void this.save('accounting/obligations',this.obligation);}
 complete(row:any){void this.save(`accounting/obligations/${row._id}/status`,{version:row.version,status:'DONE',reason:this.reason});}
 async export(){try{const blob=await firstValueFrom(this.http.get(this.url(`accounting/trial-balance/export?month=${this.month}`),{responseType:'blob'}));const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`balancete-${this.month}.csv`;a.click();URL.revokeObjectURL(url);}catch(e){this.fail(e);}}
}
