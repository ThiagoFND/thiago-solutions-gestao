import { MODULE_CODES, type ModuleCode, type Offer, type UsageLimits } from './commerce.domain.js';
// Suggestions for an explicit administrator command, never runtime pricing or startup seeds.
export function suggestedOffers(): Offer[] {
  const limits = (users: number): UsageLimits => ({ activeUsers: users, products: 10000, categories: 1000, storageBytes: 1073741824, landingPages: 1 });
  const make = (code: string, kind: Offer['kind'], name: string, monthlyCents: number, modules: ModuleCode[], users: number, order: number): Offer => ({ code, kind, name, description: name, monthlyCents, currency: 'BRL', version: 1, modules, active: true, available: true, order, featured: false, limits: limits(users) });
  const prices = [3990, 3990, 2990, 4990, 2990, 5990, 3990, 4990, 2990, 1990, 3990, 3990];
  const names = ['Vendas', 'Estoque', 'Compras', 'Produção', 'Despesas', 'Financeiro', 'Vitrine pública', 'Consulta contábil e fiscal', 'Relatórios', 'Documentos', 'Permissões avançadas', 'Auditoria avançada'];
  const basic: ModuleCode[] = ['SALES'];
  const operational: ModuleCode[] = [...basic, 'INVENTORY', 'PURCHASES', 'PRODUCTION'];
  const management: ModuleCode[] = [...operational, 'EXPENSES', 'FINANCE', 'DOCUMENTS', 'ACCOUNTING_FISCAL', 'REPORTS'];
  return [make('BASE', 'BASE', 'Plataforma-base', 4990, [], 3, 0),
    ...MODULE_CODES.slice(0,prices.length).map((code, i) => make(code, 'MODULE', names[i], prices[i], [code], 3, i)),
    make('BASIC', 'PLAN', 'Básico', 7990, basic, 3, 1), make('OPERATIONAL', 'PLAN', 'Operacional', 13990, operational, 8, 2),
    make('MANAGEMENT', 'PLAN', 'Gestão', 21990, management, 15, 3), make('COMPLETE', 'PLAN', 'Completo', 31990, MODULE_CODES.slice(0,prices.length), 25, 4)];
}
