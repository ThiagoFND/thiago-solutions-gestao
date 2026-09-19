import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Types, type Connection, type ClientSession } from 'mongoose';
import { TenantAccessService } from '../tenants/tenant-access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { civilDate } from '../finance/finance.helpers.js';
import { csvCell } from '../finance/fiscal-sales.service.js';
import { balancedTotal } from './accounting.rules.js';
import { BUSINESS_MODELS, Party, CashAccount, CashEntry, LedgerAccount, Journal, Closing, Obligation } from './business.schemas.js';
import * as D from './business.dto.js';

@Injectable()
export class BusinessService {
 constructor(@InjectConnection() private db:Connection,private access:TenantAccessService,private audit:AuditService){}
 private model<T>(name:string){return this.db.model<T>(name);}
 private id(value:string){if(!/^[a-f\d]{24}$/i.test(value))throw new BadRequestException('Identificador inválido.');return new Types.ObjectId(value);}
 private async actor(u:AuthUser,p:string,session?:ClientSession){return this.access.require(u,[p],session);}
 private month(q:D.BusinessQuery){const month=q.month??new Date().toISOString().slice(0,7);civilDate(month+'-01');return month;}
 private async write<T>(u:AuthUser,p:string,action:string,fn:(actor:AuthUser,s:ClientSession)=>Promise<T>){
  for(const {name,schema} of BUSINESS_MODELS){const unique=schema.indexes().filter(([,o])=>o.unique);if(!unique.length)continue;let indexes:any[];try{indexes=await this.db.model(name).collection.indexes();}catch{throw new ServiceUnavailableException({code:'STORAGE_REQUIRED',message:'Estrutura deste módulo ainda não provisionada.'});}if(unique.some(([key])=>!indexes.some(i=>i.unique&&JSON.stringify(i.key)===JSON.stringify(key))))throw new ServiceUnavailableException('Índices obrigatórios ausentes.');}
  return this.access.transaction(async session=>{const actor=await this.actor(u,p,session);await this.access.tenants.updateOne({_id:actor.tenantId},{$inc:{membershipVersion:1}},{session});const result=await fn(actor,session);await this.audit.record(action,'success',actor,'business',undefined,undefined,session);return result;});
 }
 private async page(name:string,u:AuthUser,p:string,q:D.BusinessQuery,extra:object={}){
  const actor=await this.actor(u,p),filter:any={tenantId:this.id(actor.tenantId!),...extra};
  if(q.search){const escaped=q.search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.$or=['name','description','code'].map(key=>({[key]:{$regex:escaped,$options:'i'}}));}
  const model=this.db.model(name);return {items:await model.find(filter).sort({_id:-1}).skip((q.page-1)*q.limit).limit(q.limit).select('-__v').lean(),total:await model.countDocuments(filter),page:q.page,limit:q.limit};
 }
 parties(u:AuthUser,q:D.BusinessQuery){return this.page('BusinessParty',u,'cadastros.visualizar',q);}
 createParty(u:AuthUser,d:D.PartyDto){return this.write(u,'cadastros.editar','party.created',async(a,s)=>(await this.model<Party>('BusinessParty').create([{...d,tenantId:this.id(a.tenantId!),actorId:this.id(a.sub)}],{session:s}))[0]);}
 cashAccounts(u:AuthUser,q:D.BusinessQuery){return this.page('CashAccount',u,'tesouraria.visualizar',q);}
 createCashAccount(u:AuthUser,d:D.CashAccountDto){return this.write(u,'tesouraria.configurar','treasury.account.created',async(a,s)=>(await this.model<CashAccount>('CashAccount').create([{...d,tenantId:this.id(a.tenantId!),actorId:this.id(a.sub)}],{session:s}))[0]);}
 cashEntries(u:AuthUser,q:D.BusinessQuery){return this.page('CashEntry',u,'tesouraria.visualizar',q,{dueDate:{$regex:'^'+this.month(q)},...(q.accountId?{accountId:this.id(q.accountId)}:{})});}
 createCashEntry(u:AuthUser,d:D.CashEntryDto){civilDate(d.dueDate);return this.write(u,'tesouraria.criar','treasury.entry.created',async(a,s)=>{
  const tenantId=this.id(a.tenantId!);await this.account(d.accountId,tenantId,s);
  if(d.partyId&&!await this.model<Party>('BusinessParty').exists({_id:this.id(d.partyId),tenantId,active:true}).session(s))throw new NotFoundException('Cliente ou fornecedor não encontrado.');
  const previous=await this.model<CashEntry>('CashEntry').findOne({tenantId,reference:d.reference}).session(s);if(previous){if(previous.description!==d.description||previous.amountCents!==d.amountCents||String(previous.accountId)!==d.accountId||previous.direction!==d.direction||previous.dueDate!==d.dueDate||String(previous.partyId??'')!==(d.partyId??''))throw new ConflictException('Referência já usada para outro lançamento.');return previous;}
  return (await this.model<CashEntry>('CashEntry').create([{...d,tenantId,actorId:this.id(a.sub)}],{session:s}))[0];
 });}
 private async account(id:string,tenantId:Types.ObjectId,s:ClientSession){if(!await this.model<CashAccount>('CashAccount').exists({_id:this.id(id),tenantId,active:true}).session(s))throw new NotFoundException('Conta não encontrada.');}
 settle(u:AuthUser,id:string,d:D.SettlementDto){civilDate(d.date);return this.write(u,'tesouraria.liquidar','treasury.entry.settled',async(a,s)=>{const row=await this.model<CashEntry>('CashEntry').findOneAndUpdate({_id:this.id(id),tenantId:this.id(a.tenantId!),version:d.version,status:'PENDING'},{$set:{status:'SETTLED',settledDate:d.date,reason:d.reason,actorId:this.id(a.sub)},$inc:{version:1}},{session:s,returnDocument:'after'});if(!row)throw new ConflictException('Lançamento ausente, liquidado ou alterado.');return row;});}
 cancelCash(u:AuthUser,id:string,d:D.VersionReason){return this.write(u,'tesouraria.cancelar','treasury.entry.canceled',async(a,s)=>{const row=await this.model<CashEntry>('CashEntry').findOneAndUpdate({_id:this.id(id),tenantId:this.id(a.tenantId!),version:d.version,status:'PENDING'},{$set:{status:'CANCELED',reason:d.reason,actorId:this.id(a.sub)},$inc:{version:1}},{session:s,returnDocument:'after'});if(!row)throw new ConflictException('Somente lançamentos pendentes podem ser cancelados.');return row;});}
 transfer(u:AuthUser,d:D.TransferDto){civilDate(d.date);if(d.fromAccountId===d.toAccountId)throw new BadRequestException('Escolha contas diferentes.');return this.write(u,'tesouraria.transferir','treasury.transfer.created',async(a,s)=>{
  const tenantId=this.id(a.tenantId!);await this.account(d.fromAccountId,tenantId,s);await this.account(d.toAccountId,tenantId,s);
  const references=['transfer-out-'+d.reference,'transfer-in-'+d.reference];const previous=await this.model<CashEntry>('CashEntry').find({tenantId,reference:{$in:references}}).session(s);
  if(previous.length){if(previous.length!==2||previous.some(r=>r.amountCents!==d.amountCents||r.settledDate!==d.date||String(r.accountId)!==(r.direction==='OUT'?d.fromAccountId:d.toAccountId)))throw new ConflictException('Referência de transferência já utilizada.');return previous;}
  return this.model<CashEntry>('CashEntry').create([['OUT',d.fromAccountId,references[0]],['IN',d.toAccountId,references[1]]].map(([direction,accountId,reference])=>({tenantId,actorId:this.id(a.sub),accountId:this.id(accountId),reference,direction:direction as 'IN'|'OUT',amountCents:d.amountCents,description:'Transferência entre contas',status:'SETTLED',dueDate:d.date,settledDate:d.date,reason:d.reason})),{session:s,ordered:true});
 });}
 async cashSummary(u:AuthUser,q:D.BusinessQuery){const a=await this.actor(u,'tesouraria.visualizar'),tenantId=this.id(a.tenantId!),month=this.month(q);const [accounts,totals,pending]=await Promise.all([
  this.model<CashAccount>('CashAccount').find({tenantId}).select('name kind openingCents active').lean(),
  this.model<CashEntry>('CashEntry').aggregate([{$match:{tenantId,status:'SETTLED'}},{$group:{_id:'$accountId',balanceCents:{$sum:{$cond:[{$eq:['$direction','IN']},'$amountCents',{$multiply:['$amountCents',-1]}]}}}}]),
  this.model<CashEntry>('CashEntry').aggregate([{$match:{tenantId,status:{$ne:'CANCELED'},dueDate:{$regex:'^'+month}}},{$group:{_id:{status:'$status',direction:'$direction'},amountCents:{$sum:'$amountCents'},count:{$sum:1}}}])]);
  return {month,accounts:accounts.map(account=>({...account,balanceCents:account.openingCents+(totals.find(t=>String(t._id)===String(account._id))?.balanceCents??0)})),totals:pending};
 }
 ledgerAccounts(u:AuthUser,q:D.BusinessQuery){return this.page('LedgerAccount',u,'contabil.visualizar',q);}
 createLedgerAccount(u:AuthUser,d:D.LedgerAccountDto){return this.write(u,'contabil.configurar','accounting.account.created',async(a,s)=>(await this.model<LedgerAccount>('LedgerAccount').create([{...d,tenantId:this.id(a.tenantId!),actorId:this.id(a.sub)}],{session:s}))[0]);}
 journals(u:AuthUser,q:D.BusinessQuery){return this.page('Journal',u,'contabil.visualizar',q,{date:{$regex:'^'+this.month(q)},...(q.accountId?{'lines.accountId':this.id(q.accountId)}:{})});}
 private async post(a:AuthUser,s:ClientSession,d:D.JournalDto,source='MANUAL',sourceId?:Types.ObjectId,reversalOf?:Types.ObjectId){
  civilDate(d.date);let total:number;try{total=balancedTotal(d.lines);}catch(e){throw new BadRequestException((e as Error).message);}
  const tenantId=this.id(a.tenantId!);
  const existing=await this.model<Journal>('Journal').findOne({tenantId,reference:d.reference}).session(s);if(existing){const shape=(lines:any[])=>JSON.stringify(lines.map(l=>({accountId:String(l.accountId),debitCents:l.debitCents,creditCents:l.creditCents})));if(existing.date!==d.date||existing.description!==d.description||shape(existing.lines)!==shape(d.lines)||existing.source!==source)throw new ConflictException('Referência contábil já utilizada.');return existing;}
  if(await this.model<Closing>('AccountingClosing').exists({tenantId,month:d.date.slice(0,7),closed:true}).session(s))throw new ConflictException('Competência fechada. Reabra com justificativa antes de lançar.');
  const accounts=await this.model<LedgerAccount>('LedgerAccount').find({tenantId,_id:{$in:d.lines.map(l=>this.id(l.accountId))},active:true}).session(s);
  const lines=d.lines.map(line=>{const account=accounts.find(ac=>String(ac._id)===line.accountId);if(!account)throw new BadRequestException('Conta contábil indisponível nesta empresa.');return {...line,accountId:account._id,code:account.code,name:account.name,kind:account.kind};});
  return (await this.model<Journal>('Journal').create([{tenantId,actorId:this.id(a.sub),date:d.date,description:d.description,reference:d.reference,source,sourceId,reversalOf,lines,totalCents:total}],{session:s}))[0];
 }
 createJournal(u:AuthUser,d:D.JournalDto){return this.write(u,'contabil.escriturar','accounting.journal.created',(a,s)=>this.post(a,s,d));}
 reverseJournal(u:AuthUser,id:string,d:D.SettlementDto){return this.write(u,'contabil.estornar','accounting.journal.reversed',async(a,s)=>{const previous=await this.model<Journal>('Journal').findOne({_id:this.id(id),tenantId:this.id(a.tenantId!)}).session(s);if(!previous)throw new NotFoundException('Lançamento não encontrado.');return this.post(a,s,{date:d.date,description:d.reason,reference:'reversal-'+id,lines:previous.lines.map(l=>({accountId:String(l.accountId),debitCents:l.creditCents,creditCents:l.debitCents}))},'REVERSAL',undefined,previous._id);});}
 async sources(u:AuthUser,q:D.BusinessQuery){const a=await this.actor(u,'contabil.visualizar'),tenantId=this.id(a.tenantId!),month=this.month(q);const start=new Date(month+'-01T00:00:00-03:00'),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
  // This accounting workspace may inspect the tenant's preserved source records without granting operation permissions.
  const sources=[{source:'SALE',collection:'orders_v2',filter:{status:'FINALIZED',finalizedAt:{$gte:start,$lt:end}},projection:{number:1,totalCents:1,finalizedAt:1}},{source:'EXPENSE',collection:'lancamentos_financeiros_v2',filter:{competence:month,status:{$ne:'CANCELADO'},type:{$ne:'DESPESA_PESSOAL'}},projection:{description:1,expectedAmountCents:1,competenceDate:1,dueDate:1,payment:1}},{source:'TREASURY',collection:'treasury_entries_v2',filter:{status:'SETTLED',settledDate:{$regex:'^'+month}},projection:{description:1,amountCents:1,settledDate:1,direction:1}}];
  const result:any[]=[];for(const item of sources){const filter={tenantId,...item.filter};const rows=await this.db.collection(item.collection).find(filter,{projection:item.projection}).sort({_id:-1}).skip((q.page-1)*q.limit).limit(q.limit).toArray();const imported=await this.model<Journal>('Journal').find({tenantId,source:item.source,sourceId:{$in:rows.map(r=>r._id)}}).select('sourceId').lean();result.push({source:item.source,items:rows.map(row=>({...row,imported:imported.some(j=>String(j.sourceId)===String(row._id))})),total:await this.db.collection(item.collection).countDocuments(filter)});}
  return {month,page:q.page,limit:q.limit,sources:result};
 }
 importJournal(u:AuthUser,d:D.ImportJournalDto){return this.write(u,'contabil.escriturar','accounting.source.imported',async(a,s)=>{
  const tenantId=this.id(a.tenantId!),sourceId=this.id(d.sourceId);const collections={SALE:'orders_v2',EXPENSE:'lancamentos_financeiros_v2',TREASURY:'treasury_entries_v2'};const row=await this.db.collection(collections[d.source]).findOne({_id:sourceId,tenantId},{session:s});if(!row)throw new NotFoundException('Origem não encontrada.');
  let date:string,amount:number;if(d.source==='SALE'){if(row.status!=='FINALIZED')throw new BadRequestException('Venda não finalizada.');amount=row.totalCents;date=new Date(row.finalizedAt).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});}else if(d.source==='EXPENSE'){if(row.status==='CANCELADO'||row.type==='DESPESA_PESSOAL')throw new BadRequestException('Despesa não elegível para escrituração empresarial.');amount=row.expectedAmountCents;date=row.competenceDate??row.competence+'-01';}else{if(row.status!=='SETTLED')throw new BadRequestException('Movimento não liquidado.');amount=row.amountCents;date=row.settledDate;}
  return this.post(a,s,{date,description:`Importação ${d.source} ${row.description??row.number??d.sourceId}`,reference:`import-${d.source}-${d.sourceId}`,lines:[{accountId:d.debitAccountId,debitCents:amount,creditCents:0},{accountId:d.creditAccountId,debitCents:0,creditCents:amount}]},d.source,sourceId);
 });}
 async trialBalance(u:AuthUser,q:D.BusinessQuery,p='contabil.visualizar'){
  const a=await this.actor(u,p),tenantId=this.id(a.tenantId!),month=this.month(q),begin=month+'-01',end=new Date(begin+'T12:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);const until=end.toISOString().slice(0,10);
  const accounts=await this.model<LedgerAccount>('LedgerAccount').find({tenantId}).sort({code:1}).lean();
  const totals=await this.model<Journal>('Journal').aggregate([{$match:{tenantId,date:{$lt:until}}},{$unwind:'$lines'},{$group:{_id:'$lines.accountId',openingCents:{$sum:{$cond:[{$lt:['$date',begin]},{$subtract:['$lines.debitCents','$lines.creditCents']},0]}},debitCents:{$sum:{$cond:[{$gte:['$date',begin]},'$lines.debitCents',0]}},creditCents:{$sum:{$cond:[{$gte:['$date',begin]},'$lines.creditCents',0]}}}}]);
  const rows=accounts.map(account=>{const total=totals.find(t=>String(t._id)===String(account._id))??{openingCents:0,debitCents:0,creditCents:0};return {accountId:account._id,code:account.code,name:account.name,kind:account.kind,openingCents:total.openingCents,debitCents:total.debitCents,creditCents:total.creditCents,closingCents:total.openingCents+total.debitCents-total.creditCents};});
  const sum=(kind:string)=>rows.filter(r=>r.kind===kind).reduce((n,r)=>n+r.debitCents-r.creditCents,0);return {month,rows,debitCents:rows.reduce((n,r)=>n+r.debitCents,0),creditCents:rows.reduce((n,r)=>n+r.creditCents,0),resultCents:-sum('REVENUE')-sum('EXPENSE'),closing:await this.model<Closing>('AccountingClosing').findOne({tenantId,month}).lean()};
 }
 async ledger(u:AuthUser,q:D.BusinessQuery){
  const a=await this.actor(u,'contabil.visualizar'),tenantId=this.id(a.tenantId!);if(!q.accountId)throw new BadRequestException('Selecione uma conta contábil.');const accountId=this.id(q.accountId);
  const account=await this.model<LedgerAccount>('LedgerAccount').findOne({_id:accountId,tenantId}).lean();if(!account)throw new NotFoundException('Conta contábil não encontrada.');
  const month=this.month(q),begin=month+'-01',end=new Date(begin+'T12:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);const until=end.toISOString().slice(0,10);
  const match:any={date:{$gte:begin}};if(q.search)match.description={$regex:q.search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'};
  const [data]=await this.model<Journal>('Journal').aggregate([
   {$match:{tenantId,date:{$lt:until},'lines.accountId':accountId}},{$unwind:'$lines'},{$match:{'lines.accountId':accountId}},
   {$group:{_id:'$_id',date:{$first:'$date'},description:{$first:'$description'},reference:{$first:'$reference'},source:{$first:'$source'},debitCents:{$sum:'$lines.debitCents'},creditCents:{$sum:'$lines.creditCents'}}},
   {$set:{movementCents:{$subtract:['$debitCents','$creditCents']}}},
   {$setWindowFields:{sortBy:{date:1,_id:1},output:{balanceCents:{$sum:'$movementCents',window:{documents:['unbounded','current']}}}}},
   {$facet:{items:[{$match:match},{$sort:{date:1,_id:1}},{$skip:(q.page-1)*q.limit},{$limit:q.limit}],count:[{$match:match},{$count:'total'}],totals:[{$group:{_id:null,openingCents:{$sum:{$cond:[{$lt:['$date',begin]},'$movementCents',0]}},debitCents:{$sum:{$cond:[{$gte:['$date',begin]},'$debitCents',0]}},creditCents:{$sum:{$cond:[{$gte:['$date',begin]},'$creditCents',0]}},closingCents:{$sum:'$movementCents'}}}]}}
  ]).option({maxTimeMS:10000});
  return {month,account,items:data.items,total:data.count[0]?.total??0,page:q.page,limit:q.limit,...(data.totals[0]??{openingCents:0,debitCents:0,creditCents:0,closingCents:0})};
 }
 async statements(u:AuthUser,q:D.BusinessQuery){
  const report=await this.trialBalance(u,q);const kinds=['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'];
  const groups=kinds.map(kind=>({kind,rows:report.rows.filter(r=>r.kind===kind),periodCents:report.rows.filter(r=>r.kind===kind).reduce((sum,r)=>sum+(r.debitCents-r.creditCents)*(['LIABILITY','EQUITY','REVENUE'].includes(kind)?-1:1),0),closingCents:report.rows.filter(r=>r.kind===kind).reduce((sum,r)=>sum+r.closingCents*(['LIABILITY','EQUITY','REVENUE'].includes(kind)?-1:1),0)}));
  const value=(kind:string)=>groups.find(g=>g.kind===kind)!;const carriedResultCents=value('REVENUE').closingCents-value('EXPENSE').closingCents;
  return {month:report.month,groups,resultCents:report.resultCents,carriedResultCents,balanceDifferenceCents:value('ASSET').closingCents-value('LIABILITY').closingCents-value('EQUITY').closingCents-carriedResultCents,closing:report.closing,basis:'Lançamentos escriturados; não inclui origens ainda não classificadas. Demonstrativos auxiliares sujeitos à revisão contábil.'};
 }
 async exportBalance(u:AuthUser,q:D.BusinessQuery){const report=await this.trialBalance(u,q,'contabil.exportar');await this.audit.record('accounting.export','success',u,'accounting');return '\uFEFF'+[['Conta','Descrição','Classe','Abertura centavos','Débitos centavos','Créditos centavos','Saldo centavos'],...report.rows.map(r=>[r.code,r.name,r.kind,r.openingCents,r.debitCents,r.creditCents,r.closingCents])].map(row=>row.map(csvCell).join(';')).join('\r\n');}
 close(u:AuthUser,d:D.ClosingDto){civilDate(d.month+'-01');return this.write(u,'contabil.fechar','accounting.period.changed',async(a,s)=>{const tenantId=this.id(a.tenantId!);const previous=await this.model<Closing>('AccountingClosing').findOne({tenantId,month:d.month}).session(s);if((previous?.version??0)!==d.version)throw new ConflictException('Competência alterada.');if(previous)return this.model<Closing>('AccountingClosing').findOneAndUpdate({_id:previous._id,version:d.version},{$set:{closed:d.closed,reason:d.reason,actorId:this.id(a.sub)},$inc:{version:1}},{session:s,returnDocument:'after'});return (await this.model<Closing>('AccountingClosing').create([{...d,tenantId,version:1,actorId:this.id(a.sub)}],{session:s}))[0];});}
 obligations(u:AuthUser,q:D.BusinessQuery){return this.page('AccountingObligation',u,'contabil.visualizar',q,{dueDate:{$regex:'^'+this.month(q)}});}
 createObligation(u:AuthUser,d:D.ObligationDto){civilDate(d.dueDate);return this.write(u,'contabil.configurar','accounting.obligation.created',async(a,s)=>(await this.model<Obligation>('AccountingObligation').create([{...d,tenantId:this.id(a.tenantId!),actorId:this.id(a.sub)}],{session:s}))[0]);}
 obligationState(u:AuthUser,id:string,d:D.ObligationStateDto){return this.write(u,'contabil.configurar','accounting.obligation.updated',async(a,s)=>{const result=await this.model<Obligation>('AccountingObligation').findOneAndUpdate({_id:this.id(id),tenantId:this.id(a.tenantId!),version:d.version},{$set:{status:d.status,notes:d.reason,actorId:this.id(a.sub)},$inc:{version:1}},{session:s,returnDocument:'after'});if(!result)throw new ConflictException('Obrigação ausente ou alterada.');return result;});}
}
