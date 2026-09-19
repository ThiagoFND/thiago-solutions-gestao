# Portfólio profissional — contrato de evolução

Data: 18/09/2026. Especificação, não declaração de conclusão. Prevalece sobre o rollout comercial histórico. Não migrar, limpar ou provisionar a base operacional. Novas coleções sem autoCreate/autoIndex. QA apenas na URI literal autorizada.

## Diagnóstico e limites da base atual

O núcleo tem tenant, usuários, cargos, produtos e categorias únicos por empresa. Clientes/fornecedores compartilhados ainda precisam de cadastro mestre. SALES, INVENTORY, PRODUCTION, LANDING_PAGE têm implementações parciais com algumas integrações testadas. EXPENSES e FINANCE compartilham endpoints/permissões; ACCOUNTING_FISCAL só consulta vendas. PURCHASES/DOCUMENTS ainda não entregam fluxos independentes. Catálogo comercial não comprova capacidade disponível. Não repetir a auditoria histórica.

## Matriz de aceite

| Área | Entrega verificável |
|---|---|
| Núcleo | Partes (cliente/fornecedor), produtos/serviços/categorias únicos por tenant; snapshots em operações |
| Despesas | Gastos PF/PJ, vencimentos, pagamentos, comprovantes e recorrências; sem liberar tesouraria |
| Financeiro | Contas, recebíveis/pagáveis, recebimentos, pagamentos, transferências, conciliação e fluxo; independente de Vendas/Despesas |
| Contábil | Plano de contas, partidas dobradas, Diário, Razão, balancete, demonstrativos auxiliares, competências/fechamento, origem documental e exportação; escrituração sem simular transmissão fiscal |
| Compras | Fornecedor mestre, itens de produto, orçamento/pedido/recebimento; estoque opcional idempotente |
| Documentos | Classificação, upload privado validado, download e arquivamento independentes |
| Estoque/Qualidade | Entrada/saída/ajuste, prateleira/localização, retorno por motivo, quarentena, lote, validade, inspeção, aprovação/reprovação e recall; só saldo aprovado vendável |
| Agenda/OS | Cliente/serviço, agenda, conflito de técnico, orçamento, materiais, execução, conclusão e cancelamento |
| CRM | Contatos mestres, oportunidades, etapas, tarefas, histórico e consentimentos |
| Projetos | Projetos, participantes, tarefas, prazos, orçamento, tempo e entregas |
| Contratos | Partes, vigência, serviços, parcelas/recorrências, renovação, documentos e histórico; assinatura eletrônica externa explícita |
| Fidelidade | Regras, movimentações de pontos, resgate, expiração e reversão idempotentes |
| Logística | Expedição, volumes, transportador, rastreio e entrega; sem expedir saldo bloqueado |
| Filiais | Estabelecimentos do tenant e escopo por usuário; não agrega dados entre tenants sem vínculo autorizado |
| BI | Indicadores, metas, comparativos, projeções identificadas e alertas com origem/período; respeita módulos/permissões |
| Emissão fiscal | Integração real requer configuração fiscal, certificado/provedor e homologação; nunca exibir venda interna como NF-e autorizada |
| Comercial | Eventos em português, pesquisa paginada por nome/plano/status/cobrança; snapshots existentes preservados |
| Apresentação | Serviços e benefícios dos sete pacotes, sem preços; distinguir disponível de planejado |
| Captação | Diagnóstico do problema, recomendação explicável e mínima sem módulos supérfluos; nome/e-mail/telefone, consentimento; persistir recomendação versionada; fila de e-mail ao destinatário autorizado e painel global paginado |

Pacotes setoriais: Varejo (Vendas/Estoque/Fiscal/Fidelidade), Serviços (CRM/Agenda-OS/Financeiro/Contratos), Indústria (Compras/Estoque/Produção/Rastreabilidade), Distribuidora (CRM/Vendas/Estoque/Compras/Logística), Escritório (CRM/Projetos/Contratos/Financeiro), Rede (Filiais/BI/Auditoria/RBAC), Alimentação (Produção/Estoque/Vendas/Vitrine/Rastreabilidade). Novos preços não foram definidos pelo usuário; não inventar nem aplicar valores em contratos existentes.

## Segurança e integração

Assinatura válida + módulo + permissão + tenant. OWNER só visualiza permissões dos módulos contratados; preservar configuração de cargos ao retirar módulo. Registros financeiros em centavos. Operações com efeitos múltiplos em transação, identificador idempotente, controle de versão e auditoria. Lista e exportação limitadas/paginadas. Não executar exclusão operacional. Automação não reprocessa histórico antigo ao contratar módulo.


Envio de e-mail expressamente autorizado para thiagofernandess158@gmail.com. Provedor/credenciais ausentes até esta inspeção; implementar transporte configurável e fila sem declarar entrega quando não ocorreu. Não expor chaves no Angular, destinatário controlado no servidor, rate limit e antirrepetição.

## Pesquisa oficial (18/09/2026)

- [CFC — normas específicas/ITG 2000](https://cfc.org.br/tecnica/normas-brasileiras-de-contabilidade/normas-especificas/): referência para escrituração e documentação.
- [Receita — ECD](https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/ecd): livros Diário/Razão, balancetes e fichas; exportação auxiliar não é transmissão/autenticação.
- [Receita — ECF](https://www.gov.br/pt-br/servicos/entregar-escrituracao-contabil-fiscal): informações fiscais relacionadas à apuração; não calcular tributos sem enquadramento/regra validada.
- [Receita — integração eSocial/Reinf/DCTFWeb](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/sped/efd-reinf/efdr/7-integracao-da-efd-reinf-com-a-dctfweb/7-4-como-e-feita): depende do envio e fechamento bem-sucedidos; não simular automação externa.
- [MTE — Registro Eletrônico de Ponto](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/rep) e [FAQ Portaria 671](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP): requisitos de registros, atestados e comprovantes.
- [ANPD — titular de dados](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados): geolocalização é dado pessoal; aplicar minimização, transparência e acesso restrito.

## Execução

Somente principal: tentativa de revisão por arquiteto recusada pelo limite de threads; nenhum agente iniciou. Sequência: correções comerciais, matriz e núcleo compartilhado, financeiro/contábil, demais operações, site/captação, testes integrados/builds/handoff. Registros de validação serão anexados com resultados reais. 100% de funcionamento não é garantido por execução de testes.


## Evidências e andamento

Ver [portfolio-profissional-handoff.md](portfolio-profissional-handoff.md) para a matriz atual de implementação e limitações. Reposição aprovada usa transação, sem representar rastreabilidade completa do saldo por lote. Referência adicional: [Anvisa — RDC 655/2022](https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2022/rdc-655-2022) e [comunicação de recolhimento](https://www.gov.br/pt-br/servicos/enviar-relatorio-de-recolhimento-de-alimentos-a-anvisa); cadastro interno não substitui comunicações e procedimentos externos aplicáveis.
