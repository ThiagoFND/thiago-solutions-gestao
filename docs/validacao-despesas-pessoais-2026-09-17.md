# Validação de despesas pessoais — 17/09/2026

Resultado: build raiz concluído, 164 testes unitários em 11 arquivos aprovados e 21 verificações de integração aprovadas (13 HTTP, 7 navegador e 1 preservação). A aplicação QA foi encerrada pelo próprio script ao finalizar.

O caso relatado pelo usuário foi exercitado em uma empresa nova, sem categorias pessoais: abrir Nova conta, preencher descrição, valor, tipo e vencimento, observar orientação de categoria ausente, abrir/cancelar cadastro inline, receber erro de cadastro, tentar novamente, selecionar automaticamente a categoria criada e salvar a conta com o rascunho original. O POST final retornou 201, tipo DESPESA_PESSOAL, categoria recém-criada e valor 750 centavos.

Implementação UI: `apps/web/src/app/features/finance/finance.component.{ts,html,scss}`. Orientações atualizadas pelo principal em [README](../README.md) e [manual financeiro](financeiro-manual.md). Script QA: [personal-expenses-integration.mjs](../scripts/personal-expenses-integration.mjs).

## Comandos e resultados

Todos os comandos abaixo receberam as duas variáveis exatamente assim:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:TEST_MONGODB_URI=$env:MONGODB_URI
npm test --prefix apps/api
npm run build
$env:PERSONAL_BROWSER='true'
node scripts/personal-expenses-integration.mjs
```

- `npm test --prefix apps/api`: 164/164, 11/11 arquivos; [log](personal-qa/2026-09-17/unit-retry.log).
- `npm run build`: Angular compilado, SPA copiada e Nest compilado; [log](personal-qa/2026-09-17/build-retry.log).
- Integração final: 21 aprovadas, zero falhas; [log](personal-qa/2026-09-17/integration-retry.log), [resultados individuais](tenancy-qa/1789642443151-f77d12131c/personal-expenses-results.json).
- `node --check scripts/personal-expenses-integration.mjs`: saída 0.

Build inicial e primeira tentativa de unitários foram bloqueados por `spawn EPERM` no sandbox; repetidos com execução escalada aprovada. Logs originais mantidos no mesmo diretório. A primeira integração teve 20 aprovações e uma falha do teste: esperava 400 para alteração de tipo de categoria utilizada, mas o contrato de conflito e a implementação retornam corretamente 409. Corrigida somente a expectativa do script e repetida a suíte; [log inicial](personal-qa/2026-09-17/integration.log).

## Banco e preservação

O harness exige a URI de teste exata, sobrescreve a configuração da aplicação para esse banco, valida o nome da conexão, gera empresas/usuários com identificadores únicos e serve a aplicação em `127.0.0.1:4329`. Não foram iniciadas aplicações com configuração operacional. Não houve delete, drop, reset ou limpeza de fixtures.

Primeira integração: 8128 documentos anteriores preservados integralmente. Integração final: **8165 anteriores, 8165 inalterados, zero ausentes, zero alterados**, total final 8202. Os 37 novos documentos da execução final permaneceram no banco. A preservação compara fingerprints BSON de todos os documentos anteriores em todas as coleções; [evidência](tenancy-qa/1789642443151-f77d12131c/preservation.json). O MongoDB reportou suporte a transações.

## Cobertura e limites

HTTP real cobriu categorias pessoais, edição de lançamento, validações negativas, pagamento PJ, histórico, recorrência/idempotência, filtros, isolamento entre empresas, subtotal pessoal e totais mistos. Browser Chrome headless cobriu também cadastro pela aba Categorias, filtro e resumo; verificou ausência de overflow horizontal do resumo em 320, 768 e 1440 px. Capturas estão no [diretório da execução](tenancy-qa/1789642443151-f77d12131c/), incluindo `personal-inline-category.png`.

O erro de cadastro inline foi um HTTP 400 **simulado no navegador**, para verificar retenção de nome e rascunho; a tentativa posterior, a seleção e o lançamento usaram API e MongoDB reais. Cancelamento inline preservou o rascunho. Não foram repetidas as suítes HTTP gerais, testados todos os papéis de acesso, nem executados testes unitários Angular (sem target configurado). O fluxo inline foi exercitado no viewport desktop; os três tamanhos referem-se ao resumo. Permanecem avisos de Node 25 sem LTS e de APIs Mongoose depreciadas, sem falha nesta execução. Esses resultados validam os cenários descritos e não constituem aprovação geral de produção.
