import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order } from '../orders/order.schema.js';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import { UserRole } from '../common/enums.js';
import type { AuthUser } from '../common/auth-user.js';
import { FiscalSalesQuery } from './fiscal-sales.dto.js';
import { civilDate } from './finance.helpers.js';
import { AuditService } from '../audit/audit.service.js';
export const csvCell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
@Injectable()
export class FiscalSalesService {
 constructor(@InjectModel(Order.name) private orders:Model<Order>,private access:TenantAccessService,private audit:AuditService){}
 private async filter(actor:AuthUser,q:FiscalSalesQuery){
  const filter:any={tenantId:await this.access.scope(actor,[...OWNERS,UserRole.ACCOUNTANT])};
  const from=q.date??q.dateFrom,to=q.date??q.dateTo;
  if(from&&to&&from>to)throw new BadRequestException('A data inicial deve ser anterior ou igual à final.');
  if(from||to)filter.createdAt={...(from?{$gte:new Date(civilDate(from)+'T00:00:00-03:00')}:{}),...(to?{$lt:new Date(new Date(civilDate(to)+'T00:00:00-03:00').getTime()+86400000)}:{})};
  if(q.number)filter.number=q.number;if(q.status)filter.status=q.status;if(q.method)filter['payments.method']=q.method;
  if(q.cashierId)filter.openedById=new Types.ObjectId(q.cashierId);
  const item:any={};if(q.productId)item.productId=new Types.ObjectId(q.productId);if(q.salesGroup)item.salesGroup=q.salesGroup;
  if(Object.keys(item).length)filter.items={$elemMatch:item};return filter;
 }
 private async company(tenantId:Types.ObjectId){return this.access.tenants.findById(tenantId).select('_id cnpj legalName tradeName').lean();}
 private serialize(order:any,company:any){return {_id:order._id,number:order.number,createdAt:order.createdAt,finalizedAt:order.finalizedAt,status:order.status,items:order.items,payments:order.payments,totalCents:order.totalCents,openedById:order.openedById,openedByName:order.openedByName,finalizedByName:order.finalizedByName,company,fiscalStatus:'NOT_INTEGRATED'};}
 async list(actor:AuthUser,q:FiscalSalesQuery){const filter=await this.filter(actor,q),sort:any={[{date:'createdAt',number:'number',total:'totalCents'}[q.sort]??'createdAt']:q.direction==='asc'?1:-1,_id:q.direction==='asc'?1:-1};const [rows,total,company]=await Promise.all([this.orders.find(filter).sort(sort).skip((q.page-1)*q.limit).limit(q.limit).lean(),this.orders.countDocuments(filter),this.company(filter.tenantId)]);return {items:rows.map(r=>this.serialize(r,company)),total,page:q.page,limit:q.limit,totalPages:Math.ceil(total/q.limit)};}
 async detail(actor:AuthUser,id:string){const filter=await this.filter(actor,new FiscalSalesQuery());const row=await this.orders.findOne({...filter,_id:id}).lean();if(!row)throw new NotFoundException('Venda não encontrada.');return this.serialize(row,await this.company(filter.tenantId));}
 async export(actor:AuthUser,q:FiscalSalesQuery){const filter=await this.filter(actor,q);if(await this.orders.countDocuments(filter)>5000)throw new PayloadTooLargeException('Restrinja o período: exportação limitada a 5000 vendas.');const company=await this.company(filter.tenantId);const lines=[['Venda','Data','Situação','Produto','Grupo','Quantidade','Unitário (centavos)','Total venda (centavos)','Pagamentos','Caixa','Empresa','CNPJ','Fiscal'].map(csvCell).join(';')];const sort:any={[{date:'createdAt',number:'number',total:'totalCents'}[q.sort]??'createdAt']:q.direction==='asc'?1:-1,_id:q.direction==='asc'?1:-1};const rows=await this.orders.find(filter).sort(sort).limit(5001).lean();if(rows.length>5000)throw new PayloadTooLargeException('Restrinja o período para exportar.');for(const row of rows)for(const i of row.items)lines.push([row.number,(row as any).createdAt.toISOString(),row.status,i.name,i.salesGroup??'OTHER',i.quantity,i.unitPriceCents,row.totalCents,row.payments.map(p=>p.method+':'+p.amountCents).join('|'),row.openedByName,company?.legalName,company?.cnpj,'Não integrado'].map(csvCell).join(';'));await this.audit.record('finance.sales.export','success',actor,'orders');return '\ufeff'+lines.join('\r\n');}
}
