import type { Offer } from './commerce-api.service';

export const SYSTEM_MODULE_NAMES: Readonly<Record<string, string>> = {
  SALES: 'Vendas', INVENTORY: 'Estoque', PURCHASES: 'Compras', PRODUCTION: 'Produção',
  EXPENSES: 'Despesas', FINANCE: 'Financeiro', LANDING_PAGE: 'Vitrine pública',
  ACCOUNTING_FISCAL: 'Consulta contábil e fiscal', REPORTS: 'Relatórios', DOCUMENTS: 'Documentos',
  CUSTOM_RBAC: 'Permissões avançadas', ADVANCED_AUDIT: 'Auditoria avançada',
  TRACEABILITY: 'Qualidade e devoluções',
  CRM: 'Relacionamento com clientes',
  SERVICE_ORDERS: 'Agenda e ordens de serviço',
  CONTRACTS: 'Contratos e recorrências',
  LOYALTY: 'Fidelidade',
  PROJECTS: 'Projetos e tarefas',
  LOGISTICS: 'Logística e entregas',
  BI: 'Inteligência gerencial',
  BRANCHES: 'Diretório de filiais',
};

export const moduleName = (code: string) => SYSTEM_MODULE_NAMES[code] ?? code;
export const activeModuleCodes = (codes: readonly string[]) => codes.filter(code=>Object.hasOwn(SYSTEM_MODULE_NAMES,code));

export function systemModuleChoices(codes: readonly string[], offers: readonly Offer[], cycle: string) {
  return [...new Set(activeModuleCodes(codes))].map(code => {
    const offer = offers.find(o => o.kind === 'MODULE' && o.code === code);
    const priceCents = offer ? (cycle === 'ANNUAL' ? offer.annualCents ?? offer.monthlyCents * 12 : offer.monthlyCents) : null;
    const hasPrice = priceCents !== null && Number.isSafeInteger(priceCents) && priceCents >= 0;
    const available = !!offer?.active && !!offer.available && !offer.testOnly && hasPrice;
    const unavailableReason = !offer ? 'Preço não configurado' : offer.testOnly ? 'Oferta de teste' : !offer.active ? 'Oferta inativa' : !offer.available ? 'Indisponível para contratação' : !hasPrice ? 'Preço não configurado' : '';
    return { code, name: moduleName(code), priceCents: hasPrice ? priceCents : null, available, unavailableReason };
  });
}
