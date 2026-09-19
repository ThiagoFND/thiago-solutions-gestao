import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import type { AuthUser } from '../common/auth-user.js';
import { OperationalStore } from '../common/operational-store.js';
import { BUSINESS_MODELS } from '../business/business.schemas.js';
import { CONTRACT_MODELS } from './contracts.schemas.js';
import { civilDate, cycleDate } from './contracts.rules.js';
import * as D from './contracts.dto.js';
const escape = (s:string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
@Injectable()
export class ContractsService {
  constructor(private store:OperationalStore) {}
  private model(name:string) { return this.store.model(name); }
  private write<T>(u:AuthUser, permission:string, event:string, work:(a:AuthUser,s:ClientSession)=>Promise<T>) { return this.store.write(u,permission,event,[...CONTRACT_MODELS,...BUSINESS_MODELS.filter(m=>m.name==='CashEntry')],work); }
  private clean(row:any) { const value=row.toObject?row.toObject():row; const {requestId,inputHash,...visible}=value;return visible; }
  private async row(a:AuthUser,id:string,s?:ClientSession) { const row=await this.model('CustomerContract').findOne({_id:this.store.id(id),tenantId:a.tenantId}).session(s??null);if(!row)throw new NotFoundException('Contrato não encontrado.');return row; }
  private version(row:any,version:number) { if(row.version!==version)throw new ConflictException('Contrato atualizado por outra pessoa. Atualize a tela.'); }
  private date(date:string) {try{return civilDate(date);}catch{throw new BadRequestException('Data civil inválida.');}}
  async list(u:AuthUser,q:D.ContractQuery) { const a=await this.store.access.require(u,['contratos.visualizar']);const f:any={tenantId:a.tenantId};if(q.status)f.status=q.status;if(q.search)f.$or=['title','number','partyName'].map(k=>({[k]:new RegExp(escape(q.search!),'i')}));return this.store.page('CustomerContract',f,q); }
  async detail(u:AuthUser,id:string) { const a=await this.store.access.require(u,['contratos.visualizar']);return this.clean(await this.row(a,id)); }
  async accounts(u:AuthUser,q:D.ContractQuery) { const a=await this.store.access.require(u,['contratos.visualizar']);return this.store.page('CashAccount',{tenantId:a.tenantId,active:true,...(q.search?{name:new RegExp(escape(q.search),'i')}:{})},q,{name:1,_id:1},'_id name kind'); }
  async createAccount(u:AuthUser,d:D.ContractAccountDto) { return this.write(u,'contratos.configurar','contracts.account.created',async(a,s)=>{
    const previous=await this.store.replay('ContractAccountRequest',a,d,s);if(previous)return this.model('CashAccount').findOne({_id:previous.accountId,tenantId:a.tenantId}).select('_id name kind').session(s);
    const [account]=await this.model('CashAccount').create([{tenantId:a.tenantId,actorId:a.sub,name:d.name,kind:d.kind,openingCents:0}],{session:s});
    await this.model('ContractAccountRequest').create([{...this.store.fields(a,d),accountId:account._id}],{session:s});return {_id:account._id,name:account.name,kind:account.kind};
  }); }
  async create(u:AuthUser,d:D.ContractDto) { this.date(d.startsOn);this.date(d.endsOn);if(d.endsOn<d.startsOn)throw new BadRequestException('Fim anterior ao início.');return this.write(u,'contratos.criar','contracts.created',async(a,s)=>{
    const previous=await this.store.replay('CustomerContract',a,d,s);if(previous)return this.clean(previous);
    const party=await this.model('BusinessParty').findOne({_id:d.partyId,tenantId:a.tenantId,active:true,roles:'CUSTOMER'}).session(s);
    const account=await this.model('CashAccount').findOne({_id:d.accountId,tenantId:a.tenantId,active:true}).session(s);
    if(!party||!account)throw new BadRequestException('Cliente ou conta de recebimento indisponível.');
    if(await this.model('CustomerContract').exists({tenantId:a.tenantId,number:d.number.trim()}).session(s))throw new ConflictException('Número já utilizado nesta empresa.');
    const {amountCents,terms,requestId,...data}=d;
    const [row]=await this.model('CustomerContract').create([{...data,...this.store.fields(a,d),partyName:party.name,revisions:[{revision:1,effectiveMonth:d.startsOn.slice(0,7),terms,amountCents,actorId:a.sub,reason:'Versão inicial',at:new Date()}],history:[{status:'DRAFT',reason:'Contrato criado',actorId:a.sub,at:new Date()}]}],{session:s});return this.clean(row);
  }); }
  async state(u:AuthUser,id:string,d:D.ContractStatusDto) {const permission=d.status==='APPROVED'?'contratos.aprovar':d.status==='CANCELED'?'contratos.cancelar':'contratos.gerenciar';return this.write(u,permission,'contracts.status.changed',async(a,s)=>{
    const row=await this.row(a,id,s);this.version(row,d.version);
    const transitions:Record<string,string[]>={DRAFT:['APPROVED','CANCELED'],APPROVED:['ACTIVE','CANCELED'],ACTIVE:['SUSPENDED','ENDED','CANCELED'],SUSPENDED:['ACTIVE','ENDED','CANCELED']};
    if(!transitions[row.status]?.includes(d.status))throw new ConflictException('Transição de contrato inválida.');
    row.status=d.status;row.version++;row.history.push({status:d.status,reason:d.reason,actorId:a.sub,at:new Date()});await row.save({session:s});return this.clean(row);
  }); }
  async amend(u:AuthUser,id:string,d:D.ContractAmendmentDto) {return this.write(u,'contratos.aditar','contracts.amended',async(a,s)=>{
    const row=await this.row(a,id,s);this.version(row,d.version);if(!['ACTIVE','SUSPENDED'].includes(row.status))throw new ConflictException('Somente contratos ativos ou suspensos recebem aditivos.');
    const last=row.revisions.at(-1);
    // Future competence only. Already issued obligations are immutable contractual snapshots.
    const currentMonth=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}).slice(0,7);
    if(d.effectiveMonth<=currentMonth||d.effectiveMonth<=last.effectiveMonth||d.effectiveMonth>row.endsOn.slice(0,7))throw new BadRequestException('Aditivo exige competência futura, posterior à última revisão e dentro da vigência.');
    if(await this.model('ContractCycle').exists({tenantId:a.tenantId,contractId:row._id,competence:{$gte:d.effectiveMonth}}).session(s))throw new ConflictException('Já existem cobranças emitidas a partir desta competência.');
    row.revisions.push({revision:last.revision+1,effectiveMonth:d.effectiveMonth,terms:d.terms,amountCents:d.amountCents,actorId:a.sub,reason:d.reason,at:new Date()});row.version++;await row.save({session:s});return this.clean(row);
  }); }
  async generate(u:AuthUser,id:string,d:D.GenerateCycleDto) {return this.write(u,'contratos.cobrar','contracts.cycle.generated',async(a,s)=>{
    const row=await this.row(a,id,s);
    const existing=await this.model('ContractCycle').findOne({tenantId:a.tenantId,contractId:row._id,competence:d.competence}).session(s);if(existing)return existing;
    if(row.status!=='ACTIVE')throw new ConflictException('Contrato não está ativo para novas cobranças.');
    let dueDate:string;try{dueDate=cycleDate(row.startsOn,row.endsOn,row.intervalMonths,row.billingDay,d.competence);}catch(e){throw new BadRequestException((e as Error).message);}
    if(!await this.model('CashAccount').exists({_id:row.accountId,tenantId:a.tenantId,active:true}).session(s))throw new ConflictException('Conta de recebimento inativa.');
    const revision=[...row.revisions].reverse().find(r=>r.effectiveMonth<=d.competence);if(!revision)throw new ConflictException('Condições contratuais não encontradas.');
    const [entry]=await this.model('CashEntry').create([{tenantId:a.tenantId,actorId:a.sub,accountId:row.accountId,partyId:row.partyId,description:`Contrato ${row.number} · ${d.competence}`,direction:'IN',amountCents:revision.amountCents,dueDate,status:'PENDING',reference:`contract:${row._id}:${d.competence}`}],{session:s});
    const [cycle]=await this.model('ContractCycle').create([{tenantId:a.tenantId,actorId:a.sub,contractId:row._id,competence:d.competence,revision:revision.revision,amountCents:revision.amountCents,dueDate,entryId:entry._id}],{session:s});return cycle;
  }); }
  async cycles(u:AuthUser,q:D.ContractQuery) {const a=await this.store.access.require(u,['contratos.visualizar']);const filter:any={tenantId:a.tenantId};if(q.contractId){await this.row(a,q.contractId);filter.contractId=this.store.id(q.contractId);}const page=await this.store.page('ContractCycle',filter,q,{competence:-1,_id:-1});const entries=await this.model('CashEntry').find({tenantId:a.tenantId,_id:{$in:page.items.map((r:any)=>r.entryId)}}).select('_id status settledDate version').lean();return {...page,items:page.items.map((r:any)=>({...r,payment:entries.find((e:any)=>String(e._id)===String(r.entryId))??null}))};}
  async settle(u:AuthUser,id:string,d:D.ContractSettlementDto) {this.date(d.settledDate);if(d.settledDate>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}))throw new BadRequestException('Recebimento não pode estar no futuro.');return this.write(u,'contratos.receber','contracts.cycle.settled',async(a,s)=>{
    const cycle=await this.model('ContractCycle').findOne({_id:this.store.id(id),tenantId:a.tenantId}).session(s);if(!cycle)throw new NotFoundException('Cobrança não encontrada.');
    const entry=await this.model('CashEntry').findOne({_id:cycle.entryId,tenantId:a.tenantId}).session(s);if(!entry)throw new ConflictException('Lançamento financeiro ausente.');
    if(entry.status!=='PENDING'||entry.version!==d.version)throw new ConflictException('Cobrança já alterada. Atualize a tela.');entry.status='SETTLED';entry.settledDate=d.settledDate;entry.reason=d.reason;entry.actorId=a.sub;entry.version++;await entry.save({session:s});return {_id:entry._id,status:entry.status,version:entry.version,settledDate:entry.settledDate};
  }); }
}
