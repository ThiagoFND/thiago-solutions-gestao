# Contrato de implementação — Financeiro

## Adendo: despesas pessoais (16/09/2026)

O tipo `DESPESA_PESSOAL` complementa despesas operacionais e custos de produção em categorias, lançamentos, recorrências e filtros. Sua classificação é `PERSONAL_EXPENSE`; não aceita dados de produção nem classificação de compra de insumo. O resumo mensal retorna `personalExpensesCents` separadamente, mantendo essas despesas nos totais gerais e excluindo cancelados. PF/PJ continua indicando a origem do pagamento, independentemente do tipo. O acesso permanece no financeiro da empresa atual, com as permissões existentes; este tipo não cria um espaço privado por usuário. Não exige migração nem categorias automáticas.

Este adendo complementa os contratos posteriores de multitenancy/usabilidade, que prevalecem sobre as descrições históricas de autenticação e infraestrutura abaixo.

## Arquitetura verificada

Monorepo simples: `apps/api` usa NestJS 12, Mongoose 9, ESM (imports locais `.js`), ValidationPipe global com whitelist/transform/forbidNonWhitelisted; `apps/web` usa Angular 22 standalone, componentes lazy, HttpClient e interceptor JWT. API possui prefixo `/api`, autenticação JWT e RolesGuard globais via AuthModule. Roles existentes: ADMIN, KITCHEN, CASHIER. Usar `@Roles(UserRole.ADMIN)` em todo controller financeiro e `roleGuard('ADMIN')` nas rotas Angular. Valores de pedidos existentes já usam centavos inteiros. Não mudar módulos de estoque, produção, pedidos ou vendas.

MongoDB local e docker-compose são standalone. Portanto usar três coleções novas e auditoria embutida no documento do lançamento, garantindo alteração de estado e evento em uma única operação MongoDB. Uma coleção separada de histórico exigiria transações/replica set ou reconciliação e não é necessária nesta versão. Não alterar/apagar coleções existentes nem exigir migração destrutiva. Existem `AGENTS.md`, `.codex/config.toml` e cinco definições em `.codex/agents/`: `arquiteto.toml`, `banco_mongodb.toml`, `backend_nestjs.toml`, `frontend_angular.toml` e `qa_integracao.toml`. A disponibilidade foi validada por orquestração explícita e leitura das instruções; configuração em disco não significa processos simultaneamente ativos nem garante recarregamento automático. Referência: [documentação oficial de subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Convenções e invariantes

- Nomes técnicos de campos em inglês, alinhados ao código existente; enums financeiros em português, isolados dos enums de vendas.
- Todo ID externo usa string ObjectId válida; documento retornado usa `_id`, como as APIs existentes. Campos de autoria `createdById/createdByName`, timestamps `createdAt/updatedAt`.
- Dinheiro usa Number inteiro em centavos, validado com `Number.isSafeInteger`, mínimo 1 em valores de conta/pagamento; máximo 1.000.000.000.000 centavos por valor. Quantidade opcional é número positivo finito com até 6 casas decimais. Resumos devem verificar segurança dos totais e nunca arredondar valores de dinheiro silenciosamente.
- Datas civis `dueDate`, `paidOn`, `startDate` e filtros são strings reais `YYYY-MM-DD`, validadas contra calendário (rejeitar 2026-02-30). Competência usa `YYYY-MM`, apresentada como MM/AAAA. Horários de auditoria e cadastro são BSON Date, serializados ISO UTC e exibidos com `Intl.DateTimeFormat('pt-BR', {timeZone:'America/Recife', ...})`. Nunca interpretar data civil como meia-noite UTC para exibição; formatar seus componentes diretamente. Hoje é calculado explicitamente em America/Recife, independentemente de TZ da máquina.
- Status persistido é PENDENTE, PAGO ou CANCELADO. VENCIDO é derivado quando persistido=PENDENTE e dueDate < hoje Recife. Hoje ainda é PENDENTE. Serializer, filtros e resumo compartilham mesma regra. Nunca atualizar PAGO/CANCELADO pelo vencimento.
- Conta paga não pode receber edição comum nem cancelamento; apenas correção explícita de pagamento. Conta cancelada é imutável. Conta pendente/vencida permite editar campos cadastrais, pagar e cancelar. Não existe DELETE de lançamento ou categoria.
- Uma conta possui um pagamento integral gerencial: paidAmountCents pode divergir do previsto e finaliza como PAGO; diferença = pago - previsto, sem saldo parcial implícito.
- Edições financeiras devem usar controle otimista por `version` numérica e update condicional por `_id/version/status` incrementando version; se concorrência perder, HTTP 409. A API pode aceitar `version` opcional nos comandos; o serviço sempre lê versão e a inclui no filtro atômico. Corrigir pagamento exige `confirmed: true` e justificativa `reason` não vazia.

## Persistência (responsável banco_mongodb)

Pasta exclusiva `apps/api/src/finance/schemas/` e `apps/api/src/finance/finance.enums.ts`.

Enums exportados: `FinancialType` (DESPESA_OPERACIONAL,CUSTO_PRODUCAO), `FinancialNature` (FIXA,VARIAVEL), `FinancialStatus` (PENDENTE,PAGO,VENCIDO,CANCELADO), `FinancialFrequency` (SEMANAL,MENSAL,ANUAL), `FinancialOrigin` (PF,PJ), `FinancialPaymentMethod` (DINHEIRO,PIX,DEBITO,CREDITO,BOLETO,TRANSFERENCIA,OUTRO), `FinancialUnit` (KG,G,L,ML,UNIDADE,CAIXA,PACOTE), `FinancialAction` (CRIACAO,EDICAO,PAGAMENTO,CORRECAO_PAGAMENTO,CANCELAMENTO).

### `categorias_financeiras`: FinancialCategory

Arquivo `financial-category.schema.ts`, exports classe, Document e Schema com nomes usuais. Campos: name (trim, 2..100), normalizedName (normalização lowercase/acento removido, backend), type enum, active boolean default true, createdById ObjectId opcional para seeds, createdByName string, timestamps. Índice único `{type:1,normalizedName:1}` inclusive inativos; `{type:1,active:1}`. Tipo de categoria não pode ser alterado após uso em conta ou recorrência; nome pode. Desativar não altera referências/histórico. Seed idempotente por chave normalizada usando `$setOnInsert`, sem reativar ou renomear categorias editadas.

As categorias iniciais também possuem `seedKey` estável e índice único parcial nesse campo. O bootstrap identifica seeds já existentes por essa chave, inclusive após renomeação ou desativação; categorias anteriores com o nome original recebem a chave sem alteração dos dados cadastrais. A chave é interna e não pode ser enviada pelos DTOs.

### `lancamentos_financeiros`: FinancialEntry

Arquivo `financial-entry.schema.ts`. Campos obrigatórios: description (3..200), categoryId ObjectId ref FinancialCategory, type enum, nature enum, expectedAmountCents, dueDate, competence, recurring boolean default false, status default PENDENTE, version integer default 0, createdById ref User, createdByName, timestamps. Opcionais: notes (até 2000), supplier (até 160), recurrenceId ref FinancialRecurrence, occurrenceKey string, installmentNumber integer >=1. Subdocumentos `production`, `payment`, array `history`.

`production` opcional: productId ref Product, inputName string até 160, quantity número positivo, unit enum, unitAmountCents inteiro, totalAmountCents inteiro. Todos opcionais; campos de produção somente em CUSTO_PRODUCAO. Validar existência de produto se informado sem exigir que esteja ativo. supplier permanece campo da conta. totalAmountCents informado deve coincidir com expectedAmountCents para evitar dois totais contraditórios. Não calcular ou alterar estoque; quantidade e preço unitário informativos, sem multiplicação float de dinheiro.

`payment` opcional: paidAmountCents, paidOn data civil real não futura Recife, origin enum, method enum, notes opcional até 2000, registeredAt Date, registeredById ref User, registeredByName. Correção preserva metadados do cadastro original e grava `correctedAt`, `correctedById`, `correctedByName`; histórico retém pagamento anterior completo. Resposta inclui `differenceCents` (= payment.paidAmountCents - expectedAmountCents) ou null se não pago.

`history` array de subdocumentos com `_id`, action enum, occurredAt Date, userId ref User, userName, before e after (snapshots Mixed de campos relevantes sem incluir history), reason opcional. Criação inclui primeiro evento na inserção; cada mutação usa `$set/$inc/$push` atômicos. Nunca substituir history pelo payload do cliente. Limite de paginação na leitura não elimina eventos armazenados.

Índices: `{competence:1,dueDate:1}`, `{dueDate:1}`, `{status:1,dueDate:1}`, `{categoryId:1,competence:1}`, `{type:1,competence:1}`, `{'payment.origin':1,competence:1}`, `{'payment.method':1,competence:1}`. Único parcial `{recurrenceId:1,occurrenceKey:1}` somente quando recurrenceId é ObjectId e occurrenceKey string. Contas avulsas não participam. Paginação ordena `{dueDate:1,_id:1}`.

### `recorrencias_financeiras`: FinancialRecurrence

Arquivo `financial-recurrence.schema.ts`. Campos template: description, categoryId, type, nature, expectedAmountCents, notes?, supplier?, production? com mesmos contratos. Campos: frequency enum, startDate data civil (primeira ocorrência), billingDay opcional 1..31 obrigatório para mensal, installments opcional 1..600, active default true, version default 0, createdById/Name, timestamps. Não requer uma coleção de ingredientes. Índices `{active:1,frequency:1}`, `{categoryId:1}`.

## Recorrências e idempotência

A UI cadastra conta recorrente usando POST /finance/recurrences, que salva template e gera primeira competência; contas avulsas usam POST /finance/entries. `recurring`, `recurrenceId`, `occurrenceKey` e installmentNumber são controlados exclusivamente pelo servidor. Na criação recorrente competência inicial é a do startDate. Falha de geração não deve apagar template; operação gerar pode ser repetida e recuperar lançamento faltante. Resposta da criação recorrente é o próprio template, com a primeira geração concluída antes de sucesso.

Geração é explícita na tela de recorrências para competência selecionada, disponível enquanto recorrência ativa. A criação gera a primeira competência. Consultas e inicialização não criam lançamentos implicitamente. Não precisa de cron, scheduler ou geração infinita. Recorrência sem installments permanece disponível para futuras gerações até desativação. Gerar mês fora do período retorna contagem zero e mensagem informativa; nunca criar antes do startDate nem após número de parcelas. A API recebe uma competência por requisição; a UI pode gerar sucessivamente um intervalo de meses limitado, se desejar.

- MENSAL: uma ocorrência por competência desde o mês inicial; occurrenceKey=YYYY-MM. Dia habitual limitado ao último dia do mês, preservando dia original nos meses seguintes. Validar startDate coerente com billingDay limitado ao mês, para evitar primeira parcela ambígua.
- ANUAL: uma ocorrência no mês de aniversário do startDate a cada ano; 29/02 vira 28/02 em ano não bissexto. occurrenceKey=YYYY-MM; installmentNumber = diferença de anos + 1.
- SEMANAL: ocorrências startDate + 7*n dias civis; gerar todas que caiam no mês solicitado. occurrenceKey=YYYY-MM-DD, pois várias semanas legítimas compartilham competência. installmentNumber=n+1. Não criar duas ocorrências da mesma semana. A regra de não duplicar competência significa uma ocorrência mensal/anual ou cada ocorrência semanal individual, e não impedir semanas diferentes no mesmo mês.
- Utilizar upsert `$setOnInsert` com chave única; repetição e chamadas simultâneas não duplicam eventos nem lançamentos. Tratar duplicate-key concorrente como já existente. Resposta `{ competence, created, existing, entries }`.
- Editar template afeta somente gerações futuras. frequency/startDate/billingDay/installments imutáveis após criação para manter identidade/numeração; usuário pode desativar e criar outra série. Editar descrição/categoria/natureza/valor/notas/fornecedor/produção/active permitido, respeitando consistência tipo/categoria. Desativar não cancela lançamentos existentes.

## API (responsável backend_nestjs)

Prefixo `/api/finance`, todos endpoints JWT + ADMIN. Dados de autoria extraídos exclusivamente de CurrentUser. DTOs independentes com class-validator/class-transformer, sem dependência nova obrigatória. Datas reais e regras cruzadas validadas no serviço/helpers. Erros em português, 400 entrada inválida, 401 sem JWT, 403 role, 404 ausente, 409 conflito de estado/concorrrência/duplicidade. IDs malformados => 400, nunca CastError 500.

| Método/caminho | Corpo ou query | Retorno |
|---|---|---|
| POST /entries | description, categoryId, type, nature, expectedAmountCents, dueDate, competence, notes?, supplier?, production? | FinancialEntry serializado |
| GET /entries | filtros abaixo | página de FinancialEntry sem history |
| GET /entries/:id | — | FinancialEntry sem history (metadados autoria inclusos) |
| PATCH /entries/:id | campos cadastrais opcionais, version? | FinancialEntry |
| POST /entries/:id/payment | paidAmountCents, paidOn, origin, method, notes?, version? | FinancialEntry PAGO |
| PATCH /entries/:id/payment | mesmos campos pagamento + confirmed:true, reason, version? | FinancialEntry PAGO |
| POST /entries/:id/cancel | reason obrigatório (3..500), version? | FinancialEntry CANCELADO |
| GET /entries/:id/history | page?, limit? | página de eventos, mais recente primeiro |
| GET /summary | month (1..12), year (2000..2100) | resumo mensal abaixo |
| GET /reports/monthly | month, year | mesmo resumo + byCategory (estrutura extensível para exportadores) |
| GET /categories | page?, limit?, active? boolean estrito, type? | página de FinancialCategory |
| POST /categories | name, type | FinancialCategory |
| PATCH /categories/:id | name?, type?, active? | FinancialCategory |
| POST /categories/:id/deactivate | vazio | FinancialCategory active=false |
| GET /recurrences | page?, limit?, active?, type? | página de FinancialRecurrence |
| GET /recurrences/:id | — | FinancialRecurrence |
| POST /recurrences | template + frequency, startDate, billingDay?, installments? | FinancialRecurrence |
| PATCH /recurrences/:id | template mutável, active?, version? | FinancialRecurrence |
| POST /recurrences/:id/generate | competence | {competence,created,existing,entries} |
| POST /recurrences/:id/deactivate | version? | FinancialRecurrence active=false |

Paginação uniforme `{items,total,page,limit,totalPages}`, default page=1, limit=20, máximo limit=100; inteiros positivos. Front deve percorrer páginas de categorias para seletores, não truncar silenciosamente.

Em PATCH, ausência de campo significa preservar. Campos opcionais notes/supplier/production e campos opcionais de production aceitam null explícito para limpeza; serviço transforma em `$unset` ou remove do subdocumento. Campos obrigatórios rejeitam null, inclusive em DTOs parciais (não usar IsOptional de forma que null burle obrigatoriedade). No pagamento, notes null limpa observação. Na troca de tipo para operacional, production deve ser removido e categoria compatível informada. Nunca espalhar DTO diretamente no update MongoDB.

Filtros de GET /entries: page, limit, competence, dateFrom, dateTo (período inclusivo de vencimento), dueDate (vencimento exato), status (inclui VENCIDO derivado), categoryId, type, nature, origin, method, description (substring case-insensitive literal escapada, até 200 caracteres). Validar dateFrom<=dateTo. categoryId pode referenciar categoria desativada para histórico. Ao editar manter categoria desativada já associada é permitido; nova associação exige categoria ativa e tipo compatível.

Resumo/relatório usa competência contábil do lançamento, não data do pagamento; indicar isso na tela. Ignora CANCELADO nos valores e count; inclui canceledCount separadamente. `pendingCents` soma apenas PENDENTE não vencido, `overdueCents` apenas vencidos (não duplicar). `paidCents`, `paidPfCents`, `paidPjCents` usam valor efetivo pago, `expectedCents`, `productionCostsCents`, `operationalExpensesCents` usam previsto. Resposta: `{competence, count, canceledCount, expectedCents, paidCents, pendingCents, overdueCents, productionCostsCents, operationalExpensesCents, paidPfCents, paidPjCents, byCategory:[{categoryId,categoryName,type,count,expectedCents,paidCents,pendingCents,overdueCents}]}`. Summary pode devolver byCategory também. Somar no MongoDB/serviço sobre todos os resultados do mês, nunca só uma página.

Seed inicial no bootstrap de FinanceModule: Aluguel, Energia, Água, Internet, Telefone, Funcionários, Contabilidade, Impostos, Manutenção, Empréstimos, Parcelamentos, Marketing, Transporte, Outras despesas (DESPESA_OPERACIONAL); Farinha, Carne, Frango, Queijo, Óleo, Gás, Temperos, Bebidas, Embalagens, Material de limpeza, Outros insumos (CUSTO_PRODUCAO). Seeds usam upsert seguro sem tocar seed de usuários/produtos.

## Frontend (responsável frontend_angular)

Criar pasta `apps/web/src/app/features/finance/` com modelos/serviço HTTP próprios e componentes standalone. Modificar somente app.routes.ts, layout/shell.component.html (e TS se necessário) fora dessa pasta. Menu Financeiro só ADMIN, rota `/financeiro` protegida roleGuard. Abas/áreas: Resumo financeiro (mês/ano, oito cartões e relatório por categoria), Lista de contas (todos filtros, paginação e indicadores), Nova conta (também edição), Categorias (lista paginada, criação/edição/desativação), Contas recorrentes (configuração, edição, desativação e geração de mês).

Lista oferece visualizar detalhes, editar/pagar/cancelar para PENDENTE ou VENCIDO; corrigir pagamento para PAGO com confirmação e motivo; histórico para todos. Status visível em texto além de cor: amarelo, verde, vermelho, cinza. Mostrar previsto, pago e diferença; detalhes mostram data real e data/hora de registro separadas com autoria. Tela de custo oferece todos campos opcionais e seletor de produtos via API existente. Explicar que não movimenta estoque.

Valores em inputs monetários convertidos por parser decimal textual validando no máximo duas casas (aceitar vírgula brasileira), sem `parseFloat(x)*100` desprotegido. Datas civis não mudam de dia. Confirmações de correção/cancelamento/desativação, mensagens do backend, loading, prevenção de duplo submit e estados vazios. Sem dados simulados ou placeholders funcionais. Não alterar dashboard de vendas.

## Responsabilidade e sequência exclusiva de edição

1. arquiteto: somente este documento.
2. banco_mongodb: `finance.enums.ts` e `finance/schemas/*.ts`, podendo adicionar teste de schema nesse diretório. Não tocar módulo raiz ou DTOs.
3. backend_nestjs: demais arquivos `apps/api/src/finance/` (finance.module/service/controller, dto, helpers, specs), `apps/api/src/app.module.ts`, teste financeiro e2e em `apps/api/test/finance.e2e-spec.ts`. Se schema precisar ajuste, solicitar retorno ao banco ou autorização de transferência pelo principal antes de editar. Não tocar web.
4. frontend_angular: pasta finance web e rotas/menu designados. Consulta este contrato e implementação backend entregue antes de começar.
5. principal: integra, resolve pequenas incompatibilidades com dono, README/documentação final.
6. qa_integracao: executa testes/builds e pode criar testes isolados de integração, sem alterar implementação; retorna falhas ao responsável. Nenhum arquivo tem dois escritores simultâneos.

## Validação real

API usa Vitest (`npm test --prefix apps/api`), e2e usa Vitest/Supertest com TEST_MONGODB_URI e é pulado sem a variável. Front possui script ng test mas não possui target test configurado: não declarar testes Angular executados sem providenciar configuração; build estrito de templates é obrigatório. Build raiz `npm run build` compila Angular, copia SPA para API public e compila Nest.

Backend deve testar regras de dinheiro/datas/vencimento/recorrência/pagamento/correção/status/categorias. QA deve executar e2e contra MongoDB real exclusivo `mongodb://127.0.0.1:27017/salgados_financeiro_test` (confirmado serviço disponível pelo principal), sem usar DB operacional. Cobrir HTTP autenticação/403 KITCHEN e CASHIER, criação despesa/custo sem movimentar produto, filtros/paginação/totais PF/PJ, pagamento retroativo versus cadastro atual, correção com confirmação e auditoria, cancelamento, categoria inativa, mensal dia 31/fevereiro, semanal múltipla e anual bissexto, repetir e paralelizar geração/pagamento sem duplicação, persistência após fechar/reabrir aplicação. Executar também a regressão exclusivamente em `salgados_financeiro_test`. Ambas as suítes preservam dados anteriores, usam identificadores exclusivos por execução e não apagam bancos, coleções ou registros nem reinicializam dados. Rodar novamente testes/builds após correções. Nunca matar serviços API 3000/Angular 4200 do usuário para testar. Os e2e usam aplicações de teste locais; para navegador, após o build, definir `TEST_MONGODB_URI` exatamente como a URI acima e executar `node scripts/start-finance-qa.mjs`, que serve a SPA compilada em `http://127.0.0.1:3000`. O endpoint `/api/qa-context` identifica o banco e o modo `local-preserve-data`. O teste `node --test scripts/finance-browser.test.mjs` exige a mesma variável exata e verifica esse marcador antes dos fluxos. Relatar comandos, quantidades e limitações reais.

Antes de qualquer escrita em salgados_mvp, explicar exatamente as gravações e obter confirmação explícita do usuário, inclusive para seeds do bootstrap. Não iniciar API com configuração operacional durante esta validação. As instruções atuais de AGENTS.md prevalecem sobre orientações anteriores deste contrato.

