export interface RankingItem {productId:string;name:string;quantity:number;revenueCents:number;revenueSharePercent:number|null}
export interface Overview {
 month:string;timezone:string;
 financial:{revenueCents:number;productionCostsCents:number;operationalExpensesCents:number;grossProfitCents:number;operatingResultCents:number;operatingMarginPercent:number|null;operationalCoverageGapCents:number;orderCount:number;averageTicketCents:number};
 lowStock:Array<{productId:string;name:string;availableStock:number;minimumStock:number}>;
 surplus:Array<{productId:string;name:string;producedQuantity:number;soldQuantity:number;difference:number;availableStock:number|null}>;
 trend:Array<{date:string;producedQuantity:number;soldQuantity:number;revenueCents:number;orderCount:number}>;
 heatmap:Array<{weekday:number;hour:number;orderCount:number;revenueCents:number}>;
 topQuantity:RankingItem[];topRevenue:RankingItem[];
 productionCost:{recordedCents:number;coveredQuantity:number;uncoveredQuantity:number};notes:string[];
}
