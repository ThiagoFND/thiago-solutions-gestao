export type UserRole = 'MEMBER' | 'PLATFORM_ADMIN' | 'OWNER' | 'ADMIN' | 'KITCHEN' | 'CASHIER' | 'ACCOUNTANT';
export type AvailabilityMode = 'PRODUCTION_CONTROLLED' | 'MADE_TO_ORDER';
export type OrderType = 'DINE_IN' | 'TAKEAWAY';
export type OrderStatus = 'OPEN' | 'FINALIZED' | 'CANCELED' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT';

export interface AuthUser { subscriptionAllowed?:boolean; contractedModules?:string[]; permissions?:string[]; customRoleId?:string; customRoleName?:string; sub: string; name: string; email: string; role: UserRole | null; status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'INACTIVE'; tenantId: string | null; tenantStatus: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'INACTIVE' | null; }
export interface LoginResponse { user: AuthUser; }

export type ProductOrigin='PRODUCED'|'PURCHASED_FOR_RESALE';
export type SalesGroup='SNACKS'|'BEVERAGES'|'OTHER';
export interface Product {
  categoryId?:string; categoryOrder?:number; supplyMode?:string; shortDescription?:string; description?:string; unit?:string; additionalImages?:string[]; published?:boolean; manuallyHidden?:boolean; featured?:boolean; publicOrder?:number; internalOrder?:number; version?:number;
  origin?:ProductOrigin;
  salesGroup?:SalesGroup;
  _id: string;
  name: string;
  category: string;
  priceCents: number;
  availableStock: number;
  minimumStock: number;
  availabilityMode: AvailabilityMode;
  active: boolean;
  imageUrl?: string;
}

export type KitchenProduct = Omit<Product, 'priceCents' | 'imageUrl'>;

export interface Production {
  ingredientCostCents?:number;ingredientCostPerUnitCents?:number;recipeVersion?:number;
  _id: string;
  productId: string;
  productName: string;
  quantity: number;
  createdAt: string;
  createdByName?: string; // Administrative report only; kitchen API omits attribution.
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  stockControlled: boolean;
}

export interface Payment {
  method: PaymentMethod;
  amountCents: number;
  receivedCents?: number;
  changeCents?: number;
}

export interface Order {
  _id: string;
  number: number;
  type: OrderType;
  identifier?: string;
  notes?: string;
  items: OrderItem[];
  totalCents: number;
  status: OrderStatus;
  payments: Payment[];
  openedByName: string;
  createdAt: string;
  finalizedAt?: string;
}

export interface DailyReport {
  date: string;
  orderCount: number;
  revenueCents: number;
  averageTicketCents: number;
  payments: Record<string, number>;
  soldProducts: Array<{ name: string; quantity: number; totalCents: number }>;
  productionQuantity: number;
  productionEntries: Production[];
  orders: Order[];
}
