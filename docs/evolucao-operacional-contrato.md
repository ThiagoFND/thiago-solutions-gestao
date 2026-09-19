# Evolução da visão geral e gestão de insumos

Contrato proposto e coordenado em 17/09/2026. Este documento registra a arquitetura e os critérios de integração; sua existência não comprova implementação ou validação. O pedido atual autoriza evoluir produção, estoque e dashboard e prevalece sobre as restrições históricas de escopo em `financeiro-contrato.md`.

Implementação e validação posteriores: [relatório da evolução](validacao-evolucao-operacional-2026-09-17.md) e [guia de uso](gestao-operacional-manual.md). Foram concluídos 185 unitários, 12 cenários HTTP e 8 browser, em execuções complementares. A versão entregue usa unidade idêntica entre compra e ingrediente, não oferece desativação/remoção de ingredientes e permite à cozinha consultar custo de ingredientes sem acessar os lançamentos financeiros. Recebimentos guardam descrição e versão financeira; movimentos de consumo preservam quantidade/valor por ingrediente e referência da produção. As demais limitações estão no relatório.

## Evidências da situação inicial

- `apps/api/src/reports/reports.service.ts:20`: relatório diário, pedidos `FINALIZED` por `finalizedAt`, produção por `createdAt`, escopo da empresa e acesso OWNER/ADMIN. Não cruza lançamentos financeiros nem oferece série mensal.
- `apps/api/src/finance/finance.service.ts:231`: resumo por competência mensal. Custos de produção e despesas operacionais usam valores previstos; cancelados são excluídos e despesas pessoais são separadas.
- `apps/api/src/finance/schemas/financial-entry.schema.ts`: compras possuem `entryKind`, `purchaseDate`, `quantity`, `unit` e valor previsto, mas inicialmente não possuem vínculo com ingrediente. Categoria ou nome textual não identificam insumo com segurança.
- `apps/api/src/products/product.schema.ts:16`: `availableStock` representa saldo disponível após reservas/vendas. `minimumStock` é o limite de alerta. `OrdersService.applyItems` desconta estoque ao abrir/editar pedido; pedido aberto não é receita finalizada.
- `apps/api/src/productions/productions.service.ts:25`: criação inicial incrementa produto, grava produção e depois movimento; compensação cobre falha de gravação da produção, mas não fornece atomicidade entre todas as coleções.
- `apps/api/src/tenants/tenant-access.service.ts:37`: já existe transação com verificação de suporte e erro 503 `TRANSACTIONS_REQUIRED` em standalone antes do callback. O contrato financeiro antigo sobre infraestrutura standalone não é evidência de que transações estejam disponíveis hoje.

## Visão geral mensal

Adicionar `GET /api/reports/overview?month=YYYY-MM`, preservando `/reports/daily`. Validar competência real, intervalo de anos permitido e identidade por `TenantAccessService.scope(user, OWNERS)`. Não aceitar tenant do cliente. Toda consulta, agregação e lookup deve manter o mesmo `tenantId`; dashboard não amplia permissões de cozinha, caixa, contador ou administrador da plataforma.

Vendas e produção usam o mês civil no fuso de negócio, com limites inclusivo/exclusivo. A resposta informa o fuso efetivo. Alinhar limites e agrupamento de dia/hora; não misturar agrupamento UTC com filtro local. Financeiro usa `competence`, independentemente de vencimento ou pagamento. Todos os valores monetários agregados precisam permanecer inteiros seguros em centavos.

| Indicador | Regra |
|---|---|
| Receita | Soma de `totalCents` de pedidos finalizados no mês; excluir abertos/cancelados. |
| Custos de produção | Soma de valores previstos de `CUSTO_PRODUCAO` da competência, excluindo cancelados. |
| Despesas operacionais | Soma de valores previstos de `DESPESA_OPERACIONAL` da competência, excluindo cancelados. |
| Lucro bruto estimado | Receita menos custos de produção. |
| Resultado operacional estimado | Receita menos custos de produção menos despesas operacionais. |
| Margem operacional estimada | Resultado operacional / receita × 100; `null` quando receita zero. Aceitar resultado negativo. |
| Falta para cobrir despesas operacionais | `max(0, despesasOperacionais - receita)`. Mostrar a base prevista; não chamar de break-even contábil completo. |

Despesas pessoais ficam excluídas desses resultados. Compras de estoque são custos previstos da competência e podem não representar consumo efetivo; valores pagos diferentes não substituem silenciosamente a previsão. Exibir nota curta sobre competência e estimativa. Não afirmar lucro líquido exato, pois perdas, estoque inicial, impostos e outros custos podem não estar completos. Futuro custo de consumo por ficha não deve ser somado às mesmas compras, evitando dupla contagem.

Resposta deve incluir competência, fuso, indicadores financeiros, quantidade de pedidos, ticket médio, alertas de estoque, comparativo por produto, curva diária, heatmap de 7 dias da semana × 24 horas e top 5. Nomes finais dos campos devem ser compartilhados entre modelos frontend e backend antes da integração; arrays completos para todos os dias/horários permitem gráficos com zero sem dados fictícios.

- Estoque baixo: produtos ativos de estoque controlado, saldo atual `<= minimumStock`. Mostrar saldo e mínimo; rotular como situação atual, mesmo quando mês histórico estiver selecionado. Produtos sob demanda não devem gerar alerta de falta física com base em saldo negativo.
- Produzido versus vendido: por produto produzido, somar produção e unidades de pedidos finalizados no período. Diferença positiva é indicador de produção não vendida no período, não prova de sobra física, perecimento ou tempo na vitrine. Exibir saldo disponível atual separadamente. Pedidos abertos, estoque anterior e cancelamentos de reserva explicam divergências. Bebidas compradas não entram na curva de produção própria.
- Heatmap: contar pedidos pela hora local de finalização, uma vez por pedido. Informar que representa fechamento de vendas, não abertura de pedidos.
- Curva: uma linha por dia com unidades produzidas e vendidas de produtos produzidos. Para itens antigos sem `origin` no snapshot, usar cadastro com mesmo tenant como fallback e registrar a limitação histórica.
- Top 5: ordenar quantidade decrescente, desempatar por faturamento e identificador; devolver quantidade, receita de itens e participação na receita total. Usar preço do item no pedido, preservando história após edição do produto. Participação `null` sem receita. Não truncar consultas antes da agregação.

## Insumos, compras e fichas técnicas

Novas coleções isoladas por empresa para ingredientes, recebimentos/movimentos e fichas. Não converter automaticamente lançamentos históricos em estoque; recebimento explícito permite conferir unidade e vínculo. Não criar nem pagar conta financeira implicitamente.

| Endpoint proposto | Responsabilidade |
|---|---|
| GET/POST `/api/inventory/ingredients` | Listar/cadastrar insumo, unidade base fixa, saldo e custo de estoque derivados das movimentações. |
| POST `/api/inventory/receipts` | Receber compra com `financialEntryId` e `ingredientId`; quantidade/unidade/custo derivados do lançamento. |
| GET/PUT `/api/inventory/recipes/:productId` | Ler/salvar ficha: `yieldQuantity`, `components: [{ingredientId,quantity}]`, versão quando aplicável. |
| POST `/api/productions` existente | Confirmar produção e, quando houver ficha, consumir proporcionalmente os ingredientes na mesma transação. |

Acesso de escrita de ingredientes/recebimentos/fichas: OWNER/ADMIN. Cozinha pode consultar informação necessária à produção, sem obter lançamentos financeiros por acesso indireto. Definir proteção de custo explicitamente caso concedido acesso ao custo à cozinha.

Recebimento exige compra `INPUT_PURCHASE`, tipo `CUSTO_PRODUCAO`, não cancelada, com quantidade positiva, unidade e valor válidos, ingrediente ativo e ambos do tenant atual. Índice único `{tenantId,financialEntryId}` evita duas baixas da mesma compra; nova tentativa equivalente retorna resultado existente e associação diferente retorna 409. Regra inicial pode exigir unidades idênticas; conversões KG/G e L/ML, se implementadas, devem ser exatas e rejeitar dimensões incompatíveis. CAIXA/PACOTE não possuem conversão implícita.

Recebimento guarda snapshot do valor previsto, quantidade, unidade, descrição e versão da conta. Edição ou correção futura do financeiro não reescreve custos de produções anteriores. A versão inicial não deve oferecer estorno parcial implícito: divergências precisam ser informadas e fluxo posterior de ajuste deve preservar movimentos originais. Autorização de leitura da conta e revalidação dos dados devem ocorrer durante a operação transacional.

Ficha somente para produto produzido da mesma empresa. Rendimento inteiro positivo, componentes sem ingredientes repetidos, quantidades positivas finitas, limites explícitos e unidade de cada componente igual à unidade base do ingrediente. Um ingrediente inativo, removido da disponibilidade ou insuficiente impede confirmação. Quantidade consumida = quantidade de produção / rendimento × quantidade da ficha. Usar escala inteira definida (por exemplo, seis casas) e política explícita para frações não representáveis; rejeitar antes de qualquer débito ou arredondar de forma documentada. Não depender de multiplicação binária flutuante sem validação.

Recebimentos acumulam quantidade e valor de estoque; custo médio = valor de estoque / saldo. Ao consumir, calcular parcela monetária conforme quantidade, arredondando somente em ponto definido. No esgotamento, consumir exatamente o custo remanescente para não deixar centavos sem estoque. Conferir inteiros seguros e limites em cada operação; guardar snapshots das quantidades, ficha/versão e custos utilizados na produção. Custo unitário calculado refere-se aos insumos rastreados, sem prometer custo total exato com mão de obra, gás ou perdas não cadastradas. Sem ficha/custo disponível, retornar estado explícito de custo não calculado, nunca zero como se fosse medição.

## Atomicidade e preservação

Recebimento atualiza ingrediente e movimento/vínculo financeiro numa única transação. Produção com ficha deve revalidar tenant e ficha, reservar/debitar todos os ingredientes com condição de saldo, incrementar produto, gravar produção e todos os movimentos em uma única sessão MongoDB. Falha em qualquer etapa aborta tudo; eventos websocket só após commit. A transação pode repetir seu callback: não produzir efeitos externos nesse callback.

Adicionar chave de idempotência à confirmação de produção, única por tenant e operação, e comparar payload em reenvios. Mesma chave com corpo diferente retorna conflito. Falhas de rede e concorrência não podem duplicar produção ou consumo. Produto sem ficha mantém produção legada, com indicação de custo não calculado; integrar fluxo transacional sem inventar consumo histórico. MongoDB sem suporte retorna erro antes de qualquer gravação; não implementar fallback com baixas parciais.

Não apagar ou reinicializar dados. Toda execução de teste e escrita de validação deve usar exclusivamente `mongodb://127.0.0.1:27017/salgados_financeiro_test`, com identificadores exclusivos. Não iniciar aplicação operacional, seeds ou migrações em `salgados_mvp`. Índices novos precisam ser provisionados no banco de teste antes dos testes de concorrência; índice declarado no schema com `autoIndex:false` não comprova índice criado.

## Apresentação inicial

Criar/evoluir página de apresentação pública com a marca literal **Thiago Solutions Digitais**, descrevendo gestão de vendas, produção, estoque e financeiro, com acesso a login/cadastro/solicitação de acesso. Usar imagens locais de `referências` como inspiração visual. Não incluir métricas fictícias como resultados reais do negócio, nem renomear identificadores técnicos/bancos para alterar apenas a marca exibida.

## Critérios de validação a executar

1. Compilação API/frontend e testes de fórmulas: competência versus pagamento, pessoais/cancelados excluídos, zero receita, margem negativa, virada de dia local, histórico de preços e reserva aberta.
2. Integração entre tenants: nenhum acesso por ID estrangeiro em dashboard, ingredientes, compras, ficha ou produção; verificar perfis autorizados e 403.
3. Recebimento duplicado e paralelo, mesma chave com payload diferente, unidade incompatível e compra cancelada; dados anteriores preservados.
4. Produção com consumo proporcional e custo ponderado, insuficiência em um entre vários ingredientes, falha injetada após primeiro débito e concorrência real. Confirmar atomicidade e idempotência em MongoDB com transações.
5. Navegador: gráfico vazio, erro HTTP legível, seletor de competência, baixo estoque atual, leitura de ficha, vínculo de compra e confirmação de produção. Verificar página pública e identidade visual.

Nesta inspeção foram executadas apenas leituras `Get-Content` e pesquisas `rg`, além da escrita deste documento. Aplicações iniciadas: 0. Testes executados pelo arquiteto: 0. Operações de banco: 0. Não há aprovação de QA neste documento; comandos, contagens e limitações das execuções reais serão registrados pelo responsável pela validação.
