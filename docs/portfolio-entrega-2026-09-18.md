# Portfólio: implementação, validação e pendências

Data: 18/09/2026. Execução por um único agente. Esta é uma entrega incremental implementada; **não representa conclusão de todo o documento de requisitos enviado pelo proprietário**.

## Resultado verificável

- API e Angular compilados. Artefato web: `apps/web/dist/web/browser`, entrada `main-PPLZ3XGG.js`.
- Regressão: **349 testes em 27 arquivos**, todos aprovados.
- Integração: **120 blocos de cenários em 15 suítes**, todos aprovados nas últimas execuções selecionadas. Um bloco pode conter várias verificações; não equivale a um teste unitário.
- Cada suíte verificou a preservação de documentos anteriores: zero ausentes e zero alterados. Fixtures novas também foram preservadas.
- Fonte reproduzível dos números, runs e relatórios: [portfolio-validation-2026-09-18.json](portfolio-validation-2026-09-18.json).
- Histórico da investigação, fontes oficiais e limitações por incremento: [portfolio-ampliacao-2026-09-18.md](portfolio-ampliacao-2026-09-18.md).

## O que pode ser demonstrado no código e ambiente de QA

| Solução | Fluxo implementado | Limite material da entrega |
| --- | --- | --- |
| CRM | Contato central, funil, oportunidade, atividades, versões de proposta, aprovação, ganho/perda e CSV filtrado | Sem PDF, Kanban completo ou conversão automática para venda/OS/contrato |
| Agenda e OS | Profissionais/recursos, conflitos concorrentes e preparação, remarcação, orçamento, atribuição técnica, checklist, conclusão e consumo único de estoque | Sem calendário de expediente/feriados, lembretes externos, aditivos e integração financeira completa |
| Contratos | Vigência, aprovações, aditivos futuros, estados, ciclo por competência, ajuste de dia 31 e recebimento no mesmo lançamento da tesouraria | Geração de ciclos solicitada pelo operador; sem agendador, assinatura externa, franquias ou prorrateio |
| Fidelidade | Participante central, regras de pontos e validade, crédito com origem confirmada, resgate concorrente, estorno parcial e compensação | Pontuação manual; sem integração automática com Vendas, campanhas ou cancelamento de resgate |
| Projetos | Projeto interno ou com cliente, escopo versionado, equipe, tarefas, dependências sem ciclos, comentários, esforço manual e aprovação | Sem anexos, Gantt, cronômetro, faturamento de horas ou custos realizados. Esforço de projeto não é ponto trabalhista |
| Compras | Fornecedor e produtos centrais, preço histórico, aprovação, recebimento parcial avaliado e encerramento do saldo pendente | Recebimento de produtos inteiros; sem cotação, XML ou devolução ao fornecedor. Integração opcional com estoque e obrigação financeira |
| Estoque avulso | Página `/estoque`, produtos/insumos, cadastro de insumo, entradas e saídas manuais, referência única, custo médio de insumos, histórico e pesquisa paginada | Sem inventário contado completo, depósitos e lotes físicos. Reutiliza Product/Ingredient e seus movimentos, não cria outro saldo |
| Qualidade | Motivos configuráveis, devolução em quarentena, lote/validade informativos, quatro avaliações e destino/prateleira; aprovação repõe estoque uma vez quando contratado | **Sem genealogia real de lotes, FEFO, recall ou rastreio completo das saídas** |
| Logística | Entrega manual/externa, remessas parciais, conferência/despacho, atribuição, tentativa, recebedor e retorno | Sem integração automática com Vendas/Estoque, frete, mapas, anexos, tracking público ou offline. Retorno não repõe saldo automaticamente |
| Documentos | Arquivos privados, versões preservadas com hash, upload idempotente, compartilhamento nominal, download autorizado, arquivamento e quota comum | Sem antivírus externo, OCR, assinatura ou retenção automática; novos módulos ainda não possuem todos os anexos vinculados |
| Filiais | Diretório, endereço, CNPJ opcional validado, horários, responsável, equipe autorizada, orientações, encerramento e histórico | **Somente diretório**: vendas, caixas, estoque e documentos fiscais ainda não têm segregação por filial; não há grupos entre tenants |
| BI | Fontes externas, CSV com prévia, importação deduplicada, painéis, filtros, metas, ausência de dados explícita, exportação paginada e revogação | Sem XLSX, projeções/IA, alertas externos, exportação grande assíncrona e consolidação por filial |
| Contábil | Plano de contas e partidas já existentes; acrescentados Razão paginado com saldo acumulado, demonstrativos auxiliares e conferência patrimonial | **Não gera nem transmite ECD/ECF e não classifica automaticamente sem parametrização**; não constitui validação legal da escrituração |
| Despesas / Financeiro | Telas e permissões distintas; contratos e compras usam o mesmo CashEntry da tesouraria | **Despesas antigas ainda usam FinancialEntry; unificação de obrigações/pagamentos, conciliação e automações completas permanecem pendentes** |

## Catálogo, planos e apresentação

- 21 capacidades operacionais reconhecidas no backend e no seletor administrativo. Emissão fiscal aparece no portfólio como integração externa ainda pendente, sem contratação operacional fictícia.
- Sete modelos de segmento disponíveis para configuração. Um novo pacote começa inativo/indisponível; valores e limites precisam ser configurados. Varejo continua bloqueado enquanto a emissão fiscal não estiver implementada.
- Contratos existentes conservam seus snapshots, módulos e preços. Não foi feita atualização em massa de planos ou assinaturas.
- A página inicial apresenta 22 serviços, os sete modelos de segmento e os planos atualmente contratáveis, sem valores. Planos de teste/inativos/indisponíveis são filtrados na contratação pública, reutilizando a regra comercial.
- O Básico continua com Vendas; Operacional, Gestão e Completo seguem sua composição efetivamente configurada. A palavra “Completo” não concede novos módulos automaticamente.
- Recomendação por correspondência explícita de necessidades e texto. Pode sugerir módulos avulsos e evita pacote com módulos extras quando a composição não coincide. Não é IA semântica nem garantia de resolver qualquer relato.
- Nome, telefone, e-mail, relato, consentimento e sugestão calculada no servidor são preservados. Inbox do administrador tem filtros, paginação e alterações versionadas.
- Transportador de e-mail tem fila, idempotência e tentativas limitadas, com destino `thiagofernandess158@gmail.com`. **Envio real não configurado/validado nesta execução**; todos os testes desativaram envio externo.
- Menus, rotas, página inicial após login e permissões foram integrados. `auth.can` exige todas as permissões recebidas; os ajustes de navegação não constituem evidência de uma exposição anterior de módulos.
- Preços e ofertas do banco operacional, inclusive o vínculo dos registros antigos de QA com contratos reais, **não foram saneados ou excluídos**. A investigação operacional e eventual alteração precisam respeitar a autorização de banco.

## Requisitos ainda não atendidos integralmente

Além dos limites na tabela: emissão fiscal homologada, rastreabilidade completa, unificação financeira, conversões operacionais entre todos os módulos, anexos em todos os fluxos, calendários avançados, automações recorrentes, grupos/filiais operacionais e consolidação segura continuam necessários para atender todo o pedido.

Os cenários QA-01 a QA-16 do documento original estão cobertos apenas nas capacidades implementadas e descritas nas suítes. Não foram demonstrados: carga representativa e metas de desempenho, todos os casos de acessibilidade/zoom 200%, todos os estados de desligamento de módulo, recuperação de provedores reais e toda a combinação Fiscal + Fidelidade + Vendas + Estoque. Não há certificação de conformidade nem garantia de 100%.

Ponto continua removido, seguindo a instrução específica anterior; a divergência com o pedido amplo reenviado foi submetida para esclarecimento. Não foi recriado REP-P.

## Comandos e segurança da execução

Todas as aplicações/testes de escrita utilizaram exclusivamente:

```powershell
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:MONGODB_URI=$env:TEST_MONGODB_URI
$env:LEAD_EMAIL_ENABLED='false'
```

Comandos executados:

```text
apps/api: node node_modules/typescript/bin/tsc -p tsconfig.build.json --incremental false
apps/api: npm test
apps/web: npm run build
raiz: node scripts/<nome-da-suite>-integration.mjs
raiz: node scripts/portfolio-storage.mjs --dry-run
```

Suítes: crm, service-orders, contracts, loyalty, projects, purchases, logistics, bi, documents, branches, accounting-reports, portfolio, portfolio-access, manual-stock e quality. Os testes de navegador opcionais em portfolio/quality usam `PORTFOLIO_BROWSER=true`. Subprocessos de build/Chrome exigiram execução fora da restrição de spawn da sandbox, aprovada automaticamente; o URI de teste permaneceu explícito.

Falhas corrigidas incluem o guard de paginação de detalhe do CRM, estado de aba antigo na OS, seletor acessível do Razão, leitura de CSV pelo harness, seleção ambígua de documento e sincronização da renderização dos quatro campos de avaliação. A última falha de Qualidade foi no teste: ele enumerava os campos antes da renderização; o formulário corretamente permanecia bloqueado com campos vazios. Os relatórios das tentativas anteriores foram preservados.

Uma revisão de segurança acrescentou autorização própria para compartilhar documentos durante sua criação. O teste confirma que permissão de criar sozinha não concede compartilhamento. O seletor de colaboradores do BI atende quem pode compartilhar, sem exigir permissão de configurar indicadores.

O antigo script `catalog-rbac-integration.mjs` tinha exclusão das próprias fixtures. Essa limpeza foi substituída por registro e preservação; o script não foi usado como evidência nesta entrega.

## Situação de publicação

Código e builds existem no workspace. **Não foi publicado no processo operacional nem sincronizado o novo frontend para `apps/api/public`.** A consulta somente de leitura a `http://127.0.0.1:3000/api/public/solutions` retornou 404, portanto aquele processo ainda não serve a nova API. Não iniciar a API operacional somente para testar esta entrega.

O provisionador de portfólio foi ampliado para os novos schemas e continua aceitando somente o banco de teste autorizado. Uma implantação operacional futura precisa de revisão de índices/estrutura, configuração real dos preços e assinatura, verificação de compatibilidade, build/API correspondentes e autorização explícita para gravações operacionais exigida nas instruções do projeto. Nenhuma dessas gravações foi realizada implicitamente.
