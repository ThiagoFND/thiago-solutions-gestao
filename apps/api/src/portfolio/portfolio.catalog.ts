export const PORTFOLIO_VERSION='2026-09-18.2';
export const SERVICES=[
 {code:'SALES',name:'Vendas',benefit:'Organize o atendimento e saiba o que foi vendido, por quem e como foi pago.',keywords:['venda','vender','caixa','balcao','pdv'],state:'AVAILABLE'},
 {code:'INVENTORY',name:'Estoque',benefit:'Acompanhe entradas, saídas e reposição para evitar falta de produtos.',keywords:['estoque','saldo','reposicao','inventario','prateleira'],state:'PARTIAL'},
 {code:'PURCHASES',name:'Compras',benefit:'Organize fornecedores, pedidos e recebimentos antes de pagar ou movimentar mercadoria.',keywords:['compra','fornecedor','cotacao','recebimento'],state:'PARTIAL'},
 {code:'PRODUCTION',name:'Produção',benefit:'Planeje a fabricação e acompanhe receitas, insumos, rendimento e perdas.',keywords:['producao','fabricar','fabrica','receita','insumo'],state:'PARTIAL'},
 {code:'EXPENSES',name:'Despesas',benefit:'Não perca vencimentos: organize gastos, recorrências, pagamentos e comprovantes.',keywords:['despesa','gasto','aluguel','recorrencia','comprovante'],state:'AVAILABLE'},
 {code:'FINANCE',name:'Financeiro',benefit:'Veja contas a pagar e receber, saldos, liquidações e transferências entre contas.',keywords:['financeiro','fluxo de caixa','contas a receber','recebivel','tesouraria','transferencia'],state:'PARTIAL'},
 {code:'LANDING_PAGE',name:'Vitrine pública',benefit:'Apresente seus produtos com a identidade da empresa e facilite o contato, sem checkout público.',keywords:['vitrine','catalogo','site','divulgar','apresentar produtos'],state:'AVAILABLE'},
 {code:'ACCOUNTING_FISCAL',name:'Contábil',benefit:'Centralize origens, classifique lançamentos e confira Diário, balancete e competências.',keywords:['contabil','contador','contabilidade','balancete','escrituracao'],state:'PARTIAL'},
 {code:'REPORTS',name:'Relatórios',benefit:'Transforme os registros da operação em informações para acompanhar resultados.',keywords:['relatorio','resultado','resumo'],state:'PARTIAL'},
 {code:'DOCUMENTS',name:'Documentos',benefit:'Organize arquivos por assunto, origem e responsável, com acesso controlado.',keywords:['documento','arquivo','anexo'],state:'PARTIAL'},
 {code:'CUSTOM_RBAC',name:'Cargos e permissões',benefit:'Cada pessoa acessa apenas o que precisa para trabalhar.',keywords:['permissao','cargo','acesso da equipe'],state:'AVAILABLE'},
 {code:'ADVANCED_AUDIT',name:'Auditoria',benefit:'Acompanhe alterações e responsáveis para investigar divergências.',keywords:['auditoria','rastrear alteracao','historico de alteracao'],state:'PARTIAL'},
 {code:'CRM',name:'Relacionamento com clientes',benefit:'Acompanhe oportunidades e próximos contatos sem perder o histórico do cliente.',keywords:['crm','cliente','oportunidade','prospect','funil'],state:'PARTIAL'},
 {code:'SERVICE_ORDERS',name:'Agenda e ordens de serviço',benefit:'Do horário marcado à conclusão: organize técnicos, serviços, materiais e orçamento.',keywords:['agenda','agendamento','ordem de servico','assistencia','oficina','estetica','tecnico'],state:'PARTIAL'},
 {code:'FISCAL_ISSUANCE',name:'Emissão fiscal',benefit:'Integração fiscal planejada para documentos autorizados, com configuração e homologação próprias.',keywords:['nota fiscal','nfe','nf-e','nfse','nfce','emissao fiscal'],state:'EXTERNAL'},
 {code:'LOYALTY',name:'Fidelidade',benefit:'Valorize quem volta, com regras claras de pontos e benefícios.',keywords:['fidelidade','pontos','recompensa'],state:'PARTIAL'},
 {code:'CONTRACTS',name:'Contratos',benefit:'Acompanhe vigência, entregas, renovações e cobranças combinadas com o cliente.',keywords:['contrato','renovacao','mensalidade do cliente'],state:'PARTIAL'},
 {code:'TRACEABILITY',name:'Qualidade e rastreabilidade',benefit:'Registre devoluções, lote e validade; preencha a inspeção antes de repor o estoque.',keywords:['lote','validade','recall','rastreabilidade','qualidade','devolucao','inspecao'],state:'PARTIAL'},
 {code:'LOGISTICS',name:'Logística',benefit:'Organize separação, expedição, transporte e confirmação de entrega.',keywords:['logistica','entrega','expedicao','transportadora','rota'],state:'PARTIAL'},
 {code:'PROJECTS',name:'Projetos',benefit:'Divida o trabalho em entregas, responsáveis e prazos visíveis para a equipe.',keywords:['projeto','tarefa','entrega de projeto','agencia','prazo'],state:'PARTIAL'},
 {code:'BRANCHES',name:'Diretório de filiais',benefit:'Organize endereços, horários, orientações e responsáveis pelas unidades da sua empresa.',keywords:['filial','filiais','rede de lojas','estabelecimento'],state:'PARTIAL'},
 {code:'BI',name:'Inteligência gerencial',benefit:'Acompanhe metas, tendências e alertas com dados e critérios identificáveis.',keywords:['bi','dashboard','meta','projecao','indicador','inteligencia'],state:'PARTIAL'},
];
export const SEGMENT_PLANS=[
 {code:'RETAIL',name:'Loja e varejo',audience:'Para quem atende no balcão e quer cuidar da recompra.',benefit:'Conecte venda e reposição; fidelidade e integração fiscal ampliam o atendimento conforme forem disponibilizadas.',modules:['SALES','INVENTORY','FISCAL_ISSUANCE','LOYALTY']},
 {code:'SERVICES',name:'Prestador de serviços',audience:'Para oficinas, assistência, estética e manutenção.',benefit:'Acompanhe o cliente desde o primeiro contato até o serviço concluído e o recebimento.',modules:['CRM','SERVICE_ORDERS','FINANCE','CONTRACTS']},
 {code:'INDUSTRY',name:'Indústria e produção',audience:'Para quem transforma insumos em produtos.',benefit:'Planeje o abastecimento, registre a produção e acompanhe a qualidade por lote.',modules:['PURCHASES','INVENTORY','PRODUCTION','TRACEABILITY']},
 {code:'DISTRIBUTOR',name:'Distribuidora',audience:'Para negócios que compram, armazenam e entregam.',benefit:'Organize oportunidades, pedidos e abastecimento até a expedição.',modules:['CRM','SALES','INVENTORY','PURCHASES','LOGISTICS']},
 {code:'OFFICE',name:'Escritório ou agência',audience:'Para equipes que vendem conhecimento e entregas.',benefit:'Conecte oportunidades a contratos e projetos, acompanhando prazo e recebimentos.',modules:['CRM','PROJECTS','CONTRACTS','FINANCE']},
 {code:'NETWORK',name:'Rede de empresas',audience:'Para gestores que precisam organizar suas unidades.',benefit:'Reúna o diretório das unidades, indicadores de fontes autorizadas, auditoria e permissões. A separação operacional de saldos por filial está em evolução.',modules:['BRANCHES','BI','ADVANCED_AUDIT','CUSTOM_RBAC']},
 {code:'FOOD',name:'Alimentação',audience:'Para restaurantes, lanchonetes e produtores.',benefit:'Conecte preparo, disponibilidade e venda, mantendo o cuidado com validade e origem.',modules:['PRODUCTION','INVENTORY','SALES','LANDING_PAGE','TRACEABILITY']},
];
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function recommend(problem:string,needs:string[]=[]){
 const text=normalize(problem),selected=SERVICES.filter(service=>needs.includes(service.code)||service.keywords.some(word=>{const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`\\b${escaped}`).test(text)&&!new RegExp(`(?:nao preciso|nao quero|sem necessidade de)\\s+(?:de\\s+)?${escaped}`).test(text);}));
 const codes=selected.map(s=>s.code);const exact=SEGMENT_PLANS.find(plan=>plan.modules.length===codes.length&&plan.modules.every(m=>codes.includes(m)));
 return {version:PORTFOLIO_VERSION,kind:exact?'SEGMENT':codes.length?'CUSTOM':'DISCOVERY',plan:exact?{code:exact.code,name:exact.name}:null,modules:selected.map(({code,name,benefit,state})=>({code,name,reason:benefit,state})),message:codes.length?'Esta é uma sugestão inicial com base nas necessidades informadas. Confirme os processos e a disponibilidade com nossa equipe antes de contratar.':'Precisamos entender melhor sua rotina. Nossa equipe analisará o relato para indicar uma solução, sem adicionar módulos por suposição.'};
}
