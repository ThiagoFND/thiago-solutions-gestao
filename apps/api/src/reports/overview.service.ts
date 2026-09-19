import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IsString, Matches } from 'class-validator';
import { TenantAccessService, OWNERS } from '../tenants/tenant-access.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { OrderStatus, ProductOrigin, AvailabilityMode } from '../common/enums.js';
import { Order } from '../orders/order.schema.js';
import { Production } from '../productions/production.schema.js';
import { Product } from '../products/product.schema.js';
import { FinancialEntry } from '../finance/schemas/financial-entry.schema.js';
import { FinancialStatus, FinancialType } from '../finance/finance.enums.js';
import { competence, safeSum } from '../finance/finance.helpers.js';
export class OverviewQueryDto { @IsString() @Matches(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/) month!: string; }
const TIMEZONE = 'America/Fortaleza';
function localDate(date:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function buildOverview(month:string,orders:any[],productions:any[],entries:any[],products:any[]) {
  competence(month);
  const [year,m]=month.split('-').map(Number),days=new Date(Date.UTC(year,m,0)).getUTCDate();
  const trend=Array.from({length:days},(_,i)=>({date:`${month}-${String(i+1).padStart(2,'0')}`,producedQuantity:0,soldQuantity:0,revenueCents:0,orderCount:0}));
  const dates=new Map(trend.map(x=>[x.date,x]));
  const catalog=new Map(products.map(p=>[String(p._id),p]));
  const heatmap=Array.from({length:168},(_,i)=>({weekday:Math.floor(i/24),hour:i%24,orderCount:0,revenueCents:0}));
  const sold=new Map<string,{productId:string;name:string;quantity:number;revenueCents:number;producedSoldQuantity:number}>();
  let revenueCents=0,productionCostsCents=0,operationalExpensesCents=0,recordedCents=0,coveredQuantity=0,uncoveredQuantity=0;
  for(const entry of entries){if(entry.status===FinancialStatus.CANCELADO)continue;if(entry.type===FinancialType.CUSTO_PRODUCAO)productionCostsCents=safeSum(productionCostsCents,entry.expectedAmountCents);if(entry.type===FinancialType.DESPESA_OPERACIONAL)operationalExpensesCents=safeSum(operationalExpensesCents,entry.expectedAmountCents);}
  for(const order of orders){
    revenueCents=safeSum(revenueCents,order.totalCents);
    const date=localDate(new Date(order.finalizedAt)),day=dates.get(date);
    const weekday=new Date(`${date}T12:00:00Z`).getUTCDay();
    const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:TIMEZONE,hour:'2-digit',hourCycle:'h23'}).format(new Date(order.finalizedAt)));
    heatmap[weekday*24+hour].orderCount++;heatmap[weekday*24+hour].revenueCents=safeSum(heatmap[weekday*24+hour].revenueCents,order.totalCents);
    if(day){day.orderCount++;day.revenueCents=safeSum(day.revenueCents,order.totalCents);}
    for(const item of order.items){const id=String(item.productId),current=sold.get(id)??{productId:id,name:item.name,quantity:0,revenueCents:0,producedSoldQuantity:0};current.quantity=safeSum(current.quantity,item.quantity);current.revenueCents=safeSum(current.revenueCents,item.quantity*item.unitPriceCents);if((item.origin??catalog.get(id)?.origin)===ProductOrigin.PRODUCED){current.producedSoldQuantity=safeSum(current.producedSoldQuantity,item.quantity);if(day)day.soldQuantity=safeSum(day.soldQuantity,item.quantity);}sold.set(id,current);}
  }
  const made=new Map<string,{productId:string;name:string;quantity:number}>();
  for(const p of productions){const id=String(p.productId),current=made.get(id)??{productId:id,name:p.productName,quantity:0};current.quantity=safeSum(current.quantity,p.quantity);made.set(id,current);const day=dates.get(localDate(new Date(p.createdAt)));if(day)day.producedQuantity=safeSum(day.producedQuantity,p.quantity);if(p.ingredientCostCents!=null){recordedCents=safeSum(recordedCents,p.ingredientCostCents);coveredQuantity=safeSum(coveredQuantity,p.quantity);}else uncoveredQuantity=safeSum(uncoveredQuantity,p.quantity);}
  const surplus=[...made.values()].map(p=>{const soldQuantity=sold.get(p.productId)?.quantity??0;return{productId:p.productId,name:p.name,producedQuantity:p.quantity,soldQuantity,difference:p.quantity-soldQuantity,availableStock:catalog.get(p.productId)?.availableStock??null};}).filter(p=>p.difference>0).sort((a,b)=>b.difference-a.difference||a.name.localeCompare(b.name));
  const ranking=[...sold.values()].map(({producedSoldQuantity,...p})=>({...p,revenueSharePercent:revenueCents?p.revenueCents/revenueCents*100:null}));
  const grossProfitCents=safeSum(revenueCents,-productionCostsCents),operatingResultCents=safeSum(grossProfitCents,-operationalExpensesCents);
  return {month,timezone:TIMEZONE,financial:{revenueCents,productionCostsCents,operationalExpensesCents,grossProfitCents,operatingResultCents,operatingMarginPercent:revenueCents?operatingResultCents/revenueCents*100:null,operationalCoverageGapCents:Math.max(0,operationalExpensesCents-revenueCents),orderCount:orders.length,averageTicketCents:orders.length?Math.round(revenueCents/orders.length):0},
    lowStock:products.filter(p=>p.active&&p.availabilityMode===AvailabilityMode.PRODUCTION_CONTROLLED&&p.availableStock<=p.minimumStock).sort((a,b)=>a.availableStock-b.availableStock).map(p=>({productId:p._id,name:p.name,availableStock:p.availableStock,minimumStock:p.minimumStock,origin:p.origin})),surplus,trend,heatmap,
    topQuantity:[...ranking].sort((a,b)=>b.quantity-a.quantity||b.revenueCents-a.revenueCents||a.productId.localeCompare(b.productId)).slice(0,5),topRevenue:[...ranking].sort((a,b)=>b.revenueCents-a.revenueCents||b.quantity-a.quantity||a.productId.localeCompare(b.productId)).slice(0,5),productionCost:{recordedCents,coveredQuantity,uncoveredQuantity},
    notes:['Receita de vendas finalizadas no mês; custos e despesas previstos pela competência financeira. Cancelados e despesas pessoais não compõem o resultado operacional.','Resultado estimado: não representa lucro contábil, tributos ou custos ainda não registrados. Custos de insumos calculados pela ficha são exibidos separadamente, sem soma dupla ao financeiro.','Cobertura operacional é a diferença simples entre despesas operacionais e receita; não é o ponto de equilíbrio econômico com margem de contribuição.','Produção menos vendas é um sinal de possível excesso, não uma contagem de sobra física. Estoque disponível inclui reservas de pedidos abertos e reflete o saldo atual.','Curva compara fabricação própria e suas vendas. Itens antigos sem classificação usam o cadastro atual como referência. Horários de finalização no fuso America/Fortaleza.']};
}
@Injectable()
export class OverviewService {
  constructor(private readonly access:TenantAccessService,
    @InjectModel(Order.name) private readonly orders:Model<Order>,
    @InjectModel(Production.name) private readonly productions:Model<Production>,
    @InjectModel(FinancialEntry.name) private readonly entries:Model<FinancialEntry>,
    @InjectModel(Product.name) private readonly products:Model<Product>){}
  async overview(month:string,user:AuthUser){
    competence(month);const tenantId=await this.access.scope(user,OWNERS),[year,m]=month.split('-').map(Number);
    const start=new Date(`${month}-01T00:00:00-03:00`),end=new Date(Date.UTC(year,m,1,3));
    const [orders,productions,entries,products]=await Promise.all([
      this.orders.find({tenantId,status:OrderStatus.FINALIZED,finalizedAt:{$gte:start,$lt:end}}).select('totalCents items finalizedAt').lean(),
      this.productions.find({tenantId,createdAt:{$gte:start,$lt:end}}).select('productId productName quantity createdAt ingredientCostCents').lean(),
      this.entries.find({tenantId,competence:month,status:{$ne:FinancialStatus.CANCELADO},type:{$in:[FinancialType.CUSTO_PRODUCAO,FinancialType.DESPESA_OPERACIONAL]}}).select('type status expectedAmountCents').lean(),
      this.products.find({tenantId}).select('name active minimumStock availableStock origin availabilityMode').lean(),
    ]);return buildOverview(month,orders,productions,entries,products);
  }
}
