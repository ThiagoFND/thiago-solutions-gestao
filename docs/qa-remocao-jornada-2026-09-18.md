# QA — remoção de Bater ponto — 18/09/2026

## Resultado

**179 testes unitários backend + 10 testes helper frontend aprovados; 8 blocos de integração aprovados**, incluindo dois fluxos reais Chrome. Compilação API e build Angular aprovados. Execução `1789765695534-540ae828f1`.

Os 13 endpoints antigos de leitura/escrita/global retornaram **404**. Menus, controles e seção de plataforma removidos. Contrato histórico que contém o código retirado conserva o snapshot e continua permitindo Vendas; o código não volta a integrar módulos efetivos, catálogo ou novas cotações. Cargo legado pode ser listado, atribuído e editado sem falha por permissões retiradas.

## Scripts e evidências anteriores

Removidos os cinco scripts exclusivos da funcionalidade:

- `scripts/time-clock-integration.mjs`
- `scripts/time-clock-members-integration.mjs`
- `scripts/time-clock-privacy-integration.mjs`
- `scripts/time-clock-daily-integration.mjs`
- `scripts/time-clock-people-integration.mjs`

`scripts/portfolio-storage.mjs` deixou de importar/provisionar schemas retirados. Os testes helper e o cenário comercial de menu foram atualizados de 14 para 13 capacidades. O teste novo `scripts/removed-capability-integration.mjs` contém somente regressões da remoção, incluindo simulação de registros legados exclusivamente em fixtures novas.

Relatórios e artefatos de QA anteriores foram preservados como evidência histórica; seus comandos antigos não representam funcionalidade atual. Nenhum dado histórico de MongoDB foi removido.

## Comandos e isolamento

Todas as aplicações/testes receberam:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:TEST_MONGODB_URI=$env:MONGODB_URI
$env:LEAD_EMAIL_ENABLED='false'
```

| Comando | Resultado |
| --- | --- |
| `node --test --test-isolation=none scripts/commerce-modules.test.mjs` | 10 aprovados, 0 falhas; paridade exata dos 13 módulos atuais. |
| `node --check scripts/commerce-catalog-menu-integration.mjs` | Sintaxe aprovada; suíte ampla não repetida nesta rodada. |
| `node --check scripts/portfolio-storage.mjs` | Sintaxe aprovada; provisionamento não executado. |
| `node node_modules/typescript/bin/tsc -p tsconfig.build.json --incremental false` em `apps/api` | Exit 0. |
| `npm test --prefix apps/api -- src/commerce src/auth src/tenants src/portfolio` | 10 arquivos, 179 aprovados, 1,40 s; testes unitários sem conexão com banco. |
| `npm run build --prefix apps/web` | Exit 0; 4,793 s; bundle inicial 305,33 kB; `main-XVLSR62D.js`. |
| `node scripts/removed-capability-integration.mjs` | Exit 0; 8 blocos aprovados, 0 falhas. |

Vitest/Angular/Chrome receberam permissões de subprocessos necessárias no ambiente. Avisos existentes Node 25, Vite, qrcode CommonJS, inferência ESM e opção Mongoose depreciada não impediram a validação.

Aplicação QA temporária em `http://127.0.0.1:4351`, sempre no banco de teste autorizado. Encerramento confirmado por conexão TCP recusada (`QA_PORT_CLOSED`). Nenhuma API operacional foi iniciada; nenhuma exclusão de banco/coleção/registro ou reinicialização foi executada.

## Cobertura de integração

1. Contrato de fixture nova recebeu um snapshot legado simulado. API conserva exatamente o snapshot e valores, filtra o código removido de módulos efetivos e mantém permissão `vendas.criar` e GET orders.
2. Catálogos administrativo e do cliente não retornam a oferta retirada. Cotações de cliente/administrador com o código removido recebem 400.
3. Cargo de fixture nova recebeu permissões legadas via atualização direta restrita à fixture. Listagem filtra permissões retiradas; atribuição funciona; identidade autenticada não retorna `ponto.*`; atualização do cargo funciona preservando histórico. A compatibilidade dos schemas de snapshots históricos foi corrigida pelo backend antes da execução.
4. Evento de auditoria legado simulado permanece armazenado, mas não aparece na consulta de auditoria.
5. GET antigos `state`, `clock`, `receipts`, `mine`, `team`, `people`, `export`, `corrections/mine`, `corrections/team`; POST `punch`, `corrections`, `corrections/:id/review`; GET global: todos 404.
6. Chrome OWNER conserva Vendas e assinatura, não possui links de jornada nem botão Bater ponto. A rota antiga redireciona; componente não existe. Catálogo não oferece checkbox do módulo removido.
7. Chrome administrador da plataforma não possui seção Registros de jornada nem componente/checkbox em contrato.
8. Preservação integral de todos os documentos anteriores por hashes.

## Preservação e evidências

**10.462 documentos anteriores intactos; 0 alterados; 0 ausentes; 19 novos documentos preservados; total 10.481.** Os únicos registros modificados para simular legados pertencem à própria execução e não existiam no snapshot inicial. Coleções históricas da funcionalidade permaneceram intactas.

- [Resultados](tenancy-qa/1789765695534-540ae828f1/removed-capability-results.json)
- [Preservação](tenancy-qa/1789765695534-540ae828f1/preservation.json)
- [OWNER sem funcionalidade removida](tenancy-qa/1789765695534-540ae828f1/removed-owner.png)
- [Plataforma sem funcionalidade removida](tenancy-qa/1789765695534-540ae828f1/removed-platform.png)

## Limitações

O teste simula legado apenas em novos documentos do banco de teste; não altera contratos/cargos operacionais ou documentos anteriores. O código retirado pode continuar presente em snapshots e relatórios históricos preservados, sem constituir recurso ativo. As suítes comerciais amplas não foram executadas integralmente; foram usados testes unitários pertinentes e regressão focada HTTP/Chrome.

## Limpeza de artefatos e sincronização pelo principal

O principal confirmou remoção de seis arquivos compilados antigos em `apps/api/dist/workforce`, nomes e caminhos absolutos previamente verificados dentro do workspace. Após os testes, copiou 41 entradas do build atual para `apps/api/public`. Removeu com `Remove-Item -LiteralPath` 146 bundles compilados antigos ausentes no novo build, somente nomes correspondentes a `chunk/main/polyfills` JS/map e com cada caminho validado dentro de `public`. Nenhum dado de banco ou evidência histórica foi apagado.

GET público `http://localhost:3000/`: HTTP 200, HTML idêntico ao build `main-XVLSR62D.js`, SHA-256 `0351880caa0676ced2b46993e68ef5dd14f907649492b85cab5102ed17d4d1ca`. Busca nos JS publicados encontrou zero referências à capacidade/interface retirada. Essas verificações foram executadas pelo principal; o agente QA não iniciou nem reiniciou a API operacional.
