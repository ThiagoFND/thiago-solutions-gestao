# QA — módulos do contrato — 18/09/2026

## Escopo e isolamento

Validação da lista canônica de módulos em Empresa selecionada/Atualizar contrato e do limite de módulos nos DTOs comerciais. Instruções lidas: `AGENTS.md`, `.codex/agents/qa_integracao.toml` e `docs/financeiro-contrato.md`.

Todos os comandos de teste/compilação receberam `MONGODB_URI` e `TEST_MONGODB_URI` iguais a `mongodb://127.0.0.1:27017/salgados_financeiro_test`. Os testes executados são unitários, sem conexão com MongoDB. Nenhuma API foi iniciada; nenhum banco, coleção ou registro foi alterado, excluído ou reinicializado. Nenhuma migração ou seed foi executada.

## Comandos e resultados

Executados na raiz, exceto o comando TypeScript, executado em `apps/api`. Prefixo PowerShell de cada execução: `$env:MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'; $env:TEST_MONGODB_URI=$env:MONGODB_URI`.

| Comando | Resultado observado |
| --- | --- |
| `npm test --prefix apps/api -- src/commerce` | Primeira tentativa bloqueada por `spawn EPERM` no sandbox. Reexecução com permissão de subprocessos: **4 arquivos, 67 testes aprovados**, 0 falhas, duração 537 ms. |
| `node --test scripts/commerce-modules.test.mjs` | Runner bloqueado por `spawn EPERM` antes de executar os casos. |
| `node --test --test-isolation=none scripts/commerce-modules.test.mjs` | **7 testes aprovados**, 0 falhas, 0 pulados, duração 272 ms; executado no processo atual sem subprocesso. |
| `npm run build` | Interrompido em Angular por `spawn EPERM`; etapa `copy-web.mjs` e compilação Nest não chegaram a executar. Não repetido, pois a publicação em `apps/api/public` não integra esta validação. |
| `npm run build --prefix apps/web` | Primeira reexecução com permissão de subprocessos revelou erro real `NG5002` em `platform-commerce.component.html:13`, fechamento de `span`. Frontend corrigiu; repetição final **aprovada, exit code 0**, 3,429 s, saída `apps/web/dist/web`, bundle inicial 305,55 kB. |
| `node node_modules/typescript/bin/tsc -p tsconfig.build.json --noEmit --incremental false` | **Aprovado, exit code 0**. Verificação do backend sem emitir artefatos ou iniciar aplicação. |

## Cobertura executada

`apps/api/src/commerce/commerce.dto.spec.ts`: 18 casos novos, três para cada DTO `OfferDto`, `QuoteDto`, `AdminQuoteDto`, `AssignDto`, `DiscountDto` e `SubscriptionRequestDto`: aceitar os 14 módulos canônicos, rejeitar código desconhecido e rejeitar quantidade acima de 14. Executado junto aos 49 testes existentes de cálculo comercial, direitos de acesso e prévia de permissões.

`scripts/commerce-modules.test.mjs`: sete casos novos verificam paridade exata entre nomes frontend e os 14 códigos backend; lista completa mesmo com catálogo incompleto; exclusão dos nomes QA e ofertas extras da lista; preservação de preços sem mutar entrada; preço anual explícito/fallback e zero legítimo; indisponibilidade de oferta inativa/desabilitada; preço ausente/inválido sem gratuidade implícita; e deduplicação.

## Limitações

Resultado final: **74 testes de unidade/helper aprovados**, compilação Angular aprovada e verificação TypeScript backend aprovada. Não foi executado fluxo HTTP, interação de navegador ou alteração real de contrato/banco. A checagem frontend testa o helper puro usado pelo componente; interação, navegação e persistência não estão cobertas. O catálogo e os snapshots existentes não foram renomeados em banco. `TIME_CLOCK` e `TRACEABILITY` ausentes no catálogo permanecem sem preço e indisponíveis para novas contratações até configuração explícita. Não houve cópia para `apps/api/public`, reinício de aplicação ou implantação.

Avisos de ferramenta: Node 25 é uma versão ímpar sem LTS; Node informou inferência de ESM ao importar TypeScript do frontend no teste; Vitest informou que `vite-tsconfig-paths` pode ser substituído por suporte nativo do Vite. Build Angular alertou que `qrcode` usa CommonJS. Nenhum desses avisos causou falha nos testes/build aprovados.
