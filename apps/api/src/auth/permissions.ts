import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../common/enums.js';
export const PERMISSIONS_KEY = 'permissions';
export const AUTHORIZED_CAPABILITIES = Symbol('server-authorized-capabilities');
const modules: Record<string, [string, string[]]> = {
  filiais: ['Diretório de filiais', ['visualizar','gerenciar']],
  documentos: ['Documentos', ['visualizar','criar','enviar','baixar','configurar','arquivar','equipe']],
  bi: ['Inteligência gerencial', ['visualizar','configurar','importar','exportar','compartilhar','equipe']],
  logistica: ['Logística e entregas', ['visualizar','planejar','conferir','despachar','executar']],
  compras: ['Compras', ['visualizar','criar','aprovar','receber','cancelar']],
  projetos: ['Projetos e tarefas', ['visualizar','criar','planejar','gerenciar','executar','horas','aprovar_horas','custos','equipe']],
  fidelidade: ['Fidelidade', ['visualizar','configurar','aderir','pontuar','resgatar','estornar']],
  contratos: ['Contratos e recorrências', ['visualizar','configurar','criar','aprovar','gerenciar','aditar','cobrar','receber','cancelar']],
  servicos: ['Agenda e ordens de serviço', ['visualizar', 'configurar', 'agendar', 'criar', 'aprovar', 'executar', 'cancelar', 'valores', 'equipe']],
  crm: ['Relacionamento com clientes', ['visualizar', 'criar', 'editar', 'propor', 'aprovar', 'configurar', 'equipe', 'exportar']],
  qualidade: ['Qualidade e devoluções', ['visualizar','configurar','receber','inspecionar']],
  empresa: ['Empresa', ['visualizar', 'editar', 'configurar']],
  landing_page: ['Vitrine pública', ['visualizar', 'configurar', 'publicar', 'despublicar']],
  categorias: ['Categorias', ['visualizar', 'criar', 'editar', 'ordenar', 'publicar', 'arquivar']],
  produtos: ['Produtos', ['visualizar', 'criar', 'editar', 'publicar', 'ordenar', 'arquivar', 'excluir']],
  vendas: ['Vendas', ['visualizar', 'criar', 'editar', 'aplicar_desconto', 'finalizar', 'cancelar', 'estornar']],
  producao: ['Produção', ['visualizar', 'registrar', 'editar', 'cancelar']],
  estoque: ['Estoque', ['visualizar', 'movimentar', 'ajustar', 'inventariar']],
  financeiro: ['Despesas', ['visualizar', 'criar', 'editar', 'pagar', 'cancelar', 'exportar']],
  tesouraria: ['Financeiro e tesouraria', ['visualizar', 'configurar', 'criar', 'liquidar', 'cancelar', 'transferir']],
  contabil: ['Escrituração contábil', ['visualizar', 'configurar', 'escriturar', 'estornar', 'fechar', 'exportar']],
  cadastros: ['Clientes e fornecedores', ['visualizar', 'editar']],
  vendas_fiscais: ['Dados fiscais de vendas', ['visualizar', 'exportar']],
  relatorios: ['Relatórios', ['visualizar', 'exportar']],
  usuarios: ['Usuários', ['visualizar', 'convidar', 'aprovar', 'editar', 'ativar', 'inativar', 'alterar_cargo']],
  cargos: ['Cargos', ['visualizar', 'criar', 'editar', 'atribuir', 'arquivar']],
  auditoria: ['Auditoria', ['visualizar', 'exportar']],
};
export const PERMISSION_CATALOG = Object.entries(modules).flatMap(([module, [moduleName, actions]]) => actions.map(action => ({
  key: `${module}.${action}`, module, moduleName,
  name: action.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()),
  description: `Permite ${action.replaceAll('_', ' ')} recursos de ${moduleName.toLowerCase()} da empresa.`,
  sensitive: ['cargos', 'usuarios', 'financeiro', 'auditoria', 'vendas_fiscais'].includes(module) || ['excluir', 'estornar', 'cancelar', 'publicar'].includes(action),
})));
export const ALL_PERMISSIONS = PERMISSION_CATALOG.map(p => p.key);
export function supportedPermissions(permissions: string[]): string[] { return permissions.filter(permission => ALL_PERMISSIONS.includes(permission)); }
export const Permissions = (...permissions: string[]) => {
  if (permissions.some(p => !ALL_PERMISSIONS.includes(p))) throw new Error('Unknown permission policy');
  return SetMetadata(PERMISSIONS_KEY, permissions);
};
export function legacyPermissions(role: UserRole | null): string[] {
  if (role === UserRole.OWNER || role === UserRole.ADMIN) return [...ALL_PERMISSIONS];
  if (role === UserRole.CASHIER) return ['produtos.visualizar', 'categorias.visualizar', ...['visualizar', 'criar', 'editar', 'finalizar', 'cancelar'].map(a => `vendas.${a}`)];
  if (role === UserRole.KITCHEN) return ['produtos.visualizar', 'categorias.visualizar', 'producao.visualizar', 'producao.registrar', 'estoque.visualizar'];
  if (role === UserRole.ACCOUNTANT) return ALL_PERMISSIONS.filter(p => p.startsWith('financeiro.') || p.startsWith('vendas_fiscais.'));
  return [];
}
