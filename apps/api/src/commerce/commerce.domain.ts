/** Commercial capabilities are independent; integrations never imply a purchase. */
export const MODULE_CODES = ['SALES', 'INVENTORY', 'PURCHASES', 'PRODUCTION', 'EXPENSES', 'FINANCE', 'LANDING_PAGE', 'ACCOUNTING_FISCAL', 'REPORTS', 'DOCUMENTS', 'CUSTOM_RBAC', 'ADVANCED_AUDIT', 'TRACEABILITY', 'CRM', 'SERVICE_ORDERS', 'CONTRACTS', 'LOYALTY', 'PROJECTS', 'LOGISTICS', 'BI', 'BRANCHES'] as const;
export type ModuleCode = typeof MODULE_CODES[number];
export function supportedModules(modules: readonly string[]): ModuleCode[] { return modules.filter((code): code is ModuleCode => MODULE_CODES.includes(code as ModuleCode)); }
export const SUBSCRIPTION_STATUSES = ['TRIAL', 'ACTIVE', 'PENDING_PAYMENT', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED'] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export interface UsageLimits { activeUsers: number; products: number; categories: number; storageBytes: number; landingPages: number }
export interface Offer {
  testOnly?: boolean;
  code: string; kind: 'BASE' | 'MODULE' | 'PLAN'; name: string; description: string; version: number;
  monthlyCents: number; annualCents?: number; currency: 'BRL'; modules: ModuleCode[];
  active: boolean; available: boolean; order: number; featured: boolean; limits: UsageLimits;
}
/** Recognize only the exact legacy fixtures emitted by the integration harness. */
export function isTestOffer(offer: Pick<Offer, 'code' | 'kind' | 'name' | 'testOnly'> & { reason?: string }): boolean {
  if (typeof offer.testOnly === 'boolean') return offer.testOnly;
  if (offer.kind !== 'PLAN') return false;
  const match = /^(QA|WEB)_(\d{13})_([A-F0-9]{10})$/.exec(offer.code);
  if (!match) return false;
  const run = `${match[2]}-${match[3].toLowerCase()}`;
  const names = match[1] === 'QA' ? ['QA isolated commercial plan'] : ['Plano navegador QA', `Plano navegador QA ${run}`];
  return offer.reason === `QA ${run}` && names.includes(offer.name);
}
export function isContractableOffer(offer: Offer & { reason?: string }): boolean {
  return offer.active && offer.available && !isTestOffer(offer) && offer.modules.every(code => MODULE_CODES.includes(code)) && (offer.kind !== 'MODULE' || MODULE_CODES.includes(offer.code as ModuleCode));
}
export function contractableOffers(offers: (Offer & { reason?: string })[]): Offer[] {
  const available = offers.filter(isContractableOffer);
  return available.filter(offer => offer.kind !== 'PLAN' || offer.modules.every(code => available.some(module => module.kind === 'MODULE' && module.code === code)));
}
export interface Promotion {
  code: string; name: string; kind: 'PERCENT' | 'FIXED' | 'FREE'; value: number;
  scope: 'SUBTOTAL' | 'MODULE'; modules: ModuleCode[]; plans: string[];
  startsAt: string; endsAt?: string; maxCycles?: number; cycle?: BillingCycle;
  combinable: boolean; active: boolean; tenantId?: string;
}
export interface PriceItem { code: string; name: string; version: number; unitCents: number; quantity: 1; subtotalCents: number; discountCents: number; totalCents: number }
export interface Quote {
  cycle: BillingCycle; currency: 'BRL'; planCode: string; modules: ModuleCode[]; limits: UsageLimits;
  items: PriceItem[]; subtotalCents: number; discountCents: number; totalCents: number;
  afterPromotionCents: number; applied: { code: string; cents: number; endsAt?: string; maxCycles?: number }[];
  rejected: { code: string; reason: string }[]; dependenciesAdded: never[]; quotedAt: string;
}
const MAX_MONEY = 1_000_000_000_000;
export function cents(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY) throw new Error('Valor monetário inválido.');
  return value;
}
export function percentage(amount: number, basisPoints: number): number {
  cents(amount);
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) throw new Error('Percentual inválido.');
  return Number((BigInt(amount) * BigInt(basisPoints) + 5000n) / 10000n);
}
/** Date and installment are explicit inputs: no clock, DB or implicit pricing in calculation. */
export function calculateQuote(input: {
  offers: Offer[]; planCode?: string; modules: ModuleCode[]; cycle: BillingCycle;
  promotions: Promotion[]; at: string; installment: number; tenantId?: string;
  /** Only for immutable stored contract snapshots; never supplied by request DTOs. */
  preserveSnapshotModules?: boolean;
}): Quote {
  const at = new Date(input.at);
  if (!Number.isFinite(at.getTime()) || !Number.isInteger(input.installment) || input.installment < 1) throw new Error('Vigência inválida.');
  if (!['MONTHLY', 'ANNUAL'].includes(input.cycle)) throw new Error('Ciclo inválido.');
  const chosen = [...new Set(input.modules)].sort();
  if (!input.preserveSnapshotModules && chosen.some(m => !MODULE_CODES.includes(m))) throw new Error('Módulo não suportado.');
  const get = (code: string, kind: Offer['kind']) => {
    const offer = input.offers.find(o => o.code === code && o.kind === kind);
    if (!offer || !(input.preserveSnapshotModules ? offer.active && offer.available : isContractableOffer(offer)) || offer.currency !== 'BRL') throw new Error(`Oferta indisponível: ${code}.`);
    return offer;
  };
  const planCode = input.planCode ?? 'CUSTOM';
  if (planCode !== 'CUSTOM' && chosen.length) throw new Error('Plano fechado não aceita módulos adicionais nesta cotação.');
  const root = get(planCode === 'CUSTOM' ? 'BASE' : planCode, planCode === 'CUSTOM' ? 'BASE' : 'PLAN');
  const modules = planCode === 'CUSTOM' ? chosen : [...new Set(root.modules)].sort();
  for (const module of modules) get(module, 'MODULE');
  const offers = planCode === 'CUSTOM' ? [root, ...modules.map(code => get(code, 'MODULE'))] : [root];
  const items: PriceItem[] = offers.map(o => {
    const price = cents(input.cycle === 'MONTHLY' ? o.monthlyCents : o.annualCents ?? cents(o.monthlyCents * 12));
    return { code: o.code, name: o.name, version: o.version, unitCents: price, quantity: 1, subtotalCents: price, discountCents: 0, totalCents: price };
  });
  const subtotalCents = cents(items.reduce((sum, i) => sum + i.subtotalCents, 0));
  const applied: Quote['applied'] = [], rejected: Quote['rejected'] = [];
  const seen = new Set<string>(); let previousCombinable = true;
  for (const p of [...input.promotions].sort((a, b) => a.code.localeCompare(b.code, 'en'))) {
    const reject = (reason: string) => rejected.push({ code: p.code, reason });
    if (seen.has(p.code)) { reject('Desconto duplicado.'); continue; } seen.add(p.code);
    if (!p.active) { reject('Desconto inativo.'); continue; }
    const start = Date.parse(p.startsAt), end = p.endsAt ? Date.parse(p.endsAt) : Infinity;
    if (!Number.isFinite(start) || Number.isNaN(end) || at.getTime() < start || at.getTime() >= end) { reject('Fora do período de validade.'); continue; }
    if (p.tenantId && p.tenantId !== input.tenantId) { reject('Empresa não elegível.'); continue; }
    if (p.plans.length && !p.plans.includes(planCode)) { reject('Plano não elegível.'); continue; }
    if (p.cycle && p.cycle !== input.cycle) { reject('Ciclo não elegível.'); continue; }
    if (p.maxCycles !== undefined && input.installment > p.maxCycles) { reject('Quantidade de cobranças encerrada.'); continue; }
    if (applied.length && (!p.combinable || !previousCombinable)) { reject('Combinação não permitida.'); continue; }
    const eligible = p.scope === 'SUBTOTAL' ? items : items.filter(i => p.modules.includes(i.code as ModuleCode));
    const remaining = cents(eligible.reduce((sum, i) => sum + i.totalCents, 0));
    if (!eligible.length || remaining === 0) { reject('Nenhum item elegível.'); continue; }
    let discount: number;
    if (p.kind === 'PERCENT') discount = percentage(remaining, p.value);
    else if (p.kind === 'FREE') discount = remaining;
    else if (p.kind === 'FIXED') { discount = cents(p.value); if (discount > remaining) { reject('Desconto fixo supera o subtotal elegível.'); continue; } }
    else throw new Error('Tipo de desconto inválido.');
    // Allocate without changing the rounded aggregate. Stable item order, residual last.
    let residual = discount;
    eligible.forEach((item, index) => {
      const share = index === eligible.length - 1 ? residual : Number(BigInt(discount) * BigInt(item.totalCents) / BigInt(remaining));
      item.discountCents += share; item.totalCents -= share; residual -= share;
    });
    applied.push({ code: p.code, cents: discount, endsAt: p.endsAt, maxCycles: p.maxCycles }); previousCombinable = p.combinable;
  }
  const totalCents = cents(items.reduce((sum, i) => sum + i.totalCents, 0));
  return { cycle: input.cycle, currency: 'BRL', planCode, modules, limits: { ...root.limits }, items, subtotalCents, discountCents: subtotalCents - totalCents, totalCents, afterPromotionCents: subtotalCents, applied, rejected, dependenciesAdded: [], quotedAt: at.toISOString() };
}
export function permittedSubscription(s: { status: SubscriptionStatus; startsAt: Date | string; endsAt: Date | string; graceUntil?: Date | string }, now: Date): boolean {
  const time = now.getTime(), start = new Date(s.startsAt).getTime(), end = new Date(s.endsAt).getTime();
  if (!Number.isFinite(time) || !Number.isFinite(start) || !Number.isFinite(end) || time < start) return false;
  if (['ACTIVE', 'TRIAL', 'CANCELED'].includes(s.status)) return time < end;
  if (['PENDING_PAYMENT', 'PAST_DUE'].includes(s.status)) return !!s.graceUntil && time < new Date(s.graceUntil).getTime();
  return false;
}
export function permissionModules(permission: string): ModuleCode[] {
  const prefix = permission.split('.')[0];
  const map: Record<string, ModuleCode[]> = {
    filiais: ['BRANCHES'], documentos: ['DOCUMENTS'],
    bi: ['BI'], logistica: ['LOGISTICS'], compras: ['PURCHASES'],
    produtos: ['SALES','INVENTORY','PURCHASES','PRODUCTION','LANDING_PAGE','CRM','SERVICE_ORDERS','TRACEABILITY'],
    categorias: ['SALES','INVENTORY','PURCHASES','PRODUCTION','LANDING_PAGE','CRM','SERVICE_ORDERS','TRACEABILITY'],
    cadastros: ['SALES','INVENTORY','PURCHASES','EXPENSES','FINANCE','ACCOUNTING_FISCAL','CRM','SERVICE_ORDERS','CONTRACTS','LOYALTY','TRACEABILITY','PROJECTS','LOGISTICS'],
    projetos: ['PROJECTS'], fidelidade: ['LOYALTY'], contratos: ['CONTRACTS'], servicos: ['SERVICE_ORDERS'], crm: ['CRM'], qualidade: ['TRACEABILITY'], vendas: ['SALES'], estoque: ['INVENTORY'], producao: ['PRODUCTION'], financeiro: ['EXPENSES'], tesouraria: ['FINANCE'], contabil: ['ACCOUNTING_FISCAL'],
    landing_page: ['LANDING_PAGE'], vendas_fiscais: ['ACCOUNTING_FISCAL'], relatorios: ['REPORTS'], auditoria: ['ADVANCED_AUDIT'],
  };
  return map[prefix] ?? [];
}
export function effectivePermissions(permissions: string[], modules: ModuleCode[]): string[] {
  return permissions.filter(p => { const required = permissionModules(p); return !required.length || required.some(m => modules.includes(m)); });
}
