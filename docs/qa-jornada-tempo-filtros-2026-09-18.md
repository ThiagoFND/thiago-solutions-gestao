> HISTORICO: o modulo de ponto foi removido por solicitacao do usuario em 18/09/2026. As referencias a ponto neste documento preservam apenas evidencias historicas, sem indicar disponibilidade ou trabalho pendente.

# QA — tempo diário, filtros e espelho auxiliar — 18/09/2026

## Resultado final

**53 testes unitários aprovados** em três arquivos, incluindo 24 casos de cálculo/CSV; **14 blocos HTTP/banco/Chrome aprovados** (11 da suíte base e 3 do complemento), incluindo quatro fluxos de navegador. Compilação API e build Angular final aprovados. Execução base `1789755638835-9008b5a21d`; complemento final `1789755925601-dd21877afb`.

Aplicação QA temporária na porta 4349, banco exclusivo `mongodb://127.0.0.1:27017/salgados_financeiro_test`. Encerramento confirmado por TCP recusado (`QA_PORT_CLOSED`). **10.341 documentos anteriores intactos, 0 alterados, 0 ausentes; 76 novos preservados; total 10.417.** Não houve exclusão, reset, seed operacional ou aplicação QA apontada a banco operacional.

## Comandos

Prefixo dos comandos de teste/build:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:TEST_MONGODB_URI=$env:MONGODB_URI
$env:LEAD_EMAIL_ENABLED='false'
```

| Comando | Resultado observado |
| --- | --- |
| `npm test --prefix apps/api -- src/workforce/time-clock.calculation.spec.ts` | 24 aprovados, cálculo puro e CSV. |
| `node node_modules/typescript/bin/tsc -p tsconfig.build.json --incremental false` em `apps/api` | Exit 0; compilação sem limpar diretório. |
| `npm test --prefix apps/api -- src/workforce src/tenants/time-clock-identity.spec.ts` | 3 arquivos, 53 aprovados, 688 ms. |
| `npm run build --prefix apps/web` | Exit 0; 3,112 s; bundle inicial 305,70 kB, `main-AZVTLI45.js`. |
| `node scripts/time-clock-daily-integration.mjs` | Exit 0; 11 blocos aprovados, 0 falhas. |
| `node node_modules/typescript/bin/tsc -p tsconfig.build.json --incremental false` após GET people | Exit 0; API recompilada para complemento. |
| `npm run build --prefix apps/web` após seletor/correção UTF-8 | Exit 0; build final 3,046 s; `main-XYIYO2WV.js`. |
| `node scripts/time-clock-people-integration.mjs` | Complemento final exit 0; 3 blocos aprovados, 0 falhas. |

Vitest/Angular/Chrome usaram permissões de subprocessos necessárias no Windows. Avisos existentes Node 25, Vite e qrcode CommonJS não impediram resultados.

## Casos unitários de cálculo e arquivo

- Entrada 08h, pausa 12–13h, saída 17h = 8 horas; múltiplos turnos somados.
- Turno 23–01h repartido entre dias civis; histórico anterior ao período e saída posterior recortados corretamente.
- Trabalho aberto separado de intervalos fechados; pausa aberta não conta como trabalho; pendências sinalizadas.
- Saída órfã não inventa tempo. Entrada duplicada sinaliza ambiguidade e conta apenas o trecho posterior não ambíguo.
- Usuários isolados, entrada desordenada ordenada sem mutação, limite pelo relógio servidor.
- Fuso São Paulo, virada UTC, dia histórico de horário de verão com 23 horas, datas inexistentes, intervalo invertido, parcial, misto ou excessivo rejeitados.
- CSV neutraliza sete prefixos de fórmula, escapa aspas/separadores e identifica o arquivo como auxiliar, não AFD/AEJ.
- Exportação não concedida automaticamente ao ADMIN; somente OWNER concede a permissão protegida.

## Casos HTTP, banco e privacidade

Histórico paginado com `limit=1` retorna uma marcação, mas total diário completo de quatro marcações/8 horas. Ajuste registrado separadamente não modifica o total dos originais. Filtro de nome com colchetes trata texto literalmente. CPF sintético validado e armazenado via `CpfCrypto`; filtros usam proteção do sistema, sem devolver CPF, hash, envelope ou coordenadas. O mesmo CPF em outro tenant não mistura pessoas. Os filtros também alcançam ajustes.

Registrador comum recebe somente seu resumo diário/estado/relógio, sem nome, identificador de pessoa ou histórico coletivo. GET de históricos e exportação continuam 403. Marcações fora da sequência são preservadas; tentativa repetida com a mesma chave continua idempotente e sequência irregular gera pendência no cálculo.

Registros auxiliares das últimas 48 horas permanecem próprios mesmo com injeção de `userId`/`tenantId` na query; registro com 49 horas foi excluído do retorno. GET clock retorna apenas `serverTime/timeZone`.

OWNER cria e aprova ajuste para funcionário, autoria separada; não aprova ajuste em benefício próprio. Alvo de outro tenant rejeitado. Originais e totais permanecem preservados. Leitor sem `ponto.exportar` recebe 403; OWNER e delegado exportador recebem CSV com fórmulas neutralizadas e sem CPF; evento de exportação é auditado.

## Fluxos Chrome

1. OWNER consulta equipe por nome e CPF, vê 08:00:00 calculado, baixa CSV filtrado; coluna Referência e UUIDs não aparecem na interface.
2. OWNER seleciona funcionário, solicita ajuste, preenche justificativa e aprova; banco confirma beneficiário, autoria e estado. Na tela própria, query de exportação força `userId` do OWNER.
3. Registrador vê relógio avançar e tempo próprio, botão Bater ponto explícito, sem tabela coletiva nem botão de exportação.

Os testes não imprimem CPF nem credenciais. O CPF sintético digitado foi limpo antes da captura de tela.

- [Resultados base](tenancy-qa/1789755638835-9008b5a21d/time-clock-daily-results.json)
- [Preservação base](tenancy-qa/1789755638835-9008b5a21d/preservation.json)
- [Consulta e tempo](tenancy-qa/1789755638835-9008b5a21d/daily-owner.png)
- [Ajuste pelo dono](tenancy-qa/1789755638835-9008b5a21d/daily-adjustment.png)
- [Relógio e resumo próprio](tenancy-qa/1789755638835-9008b5a21d/daily-recorder.png)
- [CSV auxiliar baixado](tenancy-qa/1789755638835-9008b5a21d/filtered-auxiliary.csv)

## Complemento: funcionário sem nenhuma marcação

GET `/time-clock/people` foi validado exigindo leitura+gestão: registrador comum e delegado apenas leitor recebem 403. Consulta de pessoa sem marcações retorna somente `_id/name`; filtro por ID de outro tenant não retorna dados. No Chrome, OWNER pesquisa pelo nome, seleciona esse funcionário, informa e aprova o ajuste. Banco confirma beneficiário/autoria/estado e **zero marcações originais**, sem criar uma marcação falsa.

Primeira tentativa do complemento `1789755820032-9df98a90d6`: 2 aprovados, 1 falha real de UI. Novos rótulos continham caracteres `?` no lugar de acentos (`funcion?rio`), causando timeout no seletor acessível. Principal corrigiu o trecho HTML por patch UTF-8; repetidos apenas build web e complemento afetado. Essa tentativa preservou 10.417 documentos anteriores, adicionou 20 e não alterou/excluiu nenhum anterior.

Complemento final `1789755925601-dd21877afb`: **3/3 aprovados; 10.437 documentos anteriores intactos; 0 alterados/ausentes; 25 novos preservados; total 10.462**. Porta 4350 encerrada e confirmada por conexão TCP recusada. A suíte base não foi repetida porque a alteração posterior se restringiu à consulta/seletor de pessoas e rótulos.

- [Resultados complemento](tenancy-qa/1789755925601-dd21877afb/time-clock-people-results.json)
- [Preservação complemento](tenancy-qa/1789755925601-dd21877afb/preservation.json)
- [Ajuste sem marcações](tenancy-qa/1789755925601-dd21877afb/adjustment-without-punches.png)

## Limitações e política atual

Esta validação não declara conformidade REP-P. Registro INPI, assinaturas ICP-Brasil, arquivos/comprovantes legais e evidência de sincronização com a Hora Legal Brasileira permanecem dependências concretas descritas em [requisitos e lacunas](jornada-rep-p-requisitos-2026-09-18.md). O relógio exibe horário recebido do servidor e avanço local entre sincronizações; isso não comprova sincronismo legal. O CSV e os registros próprios de 48 horas são auxiliares.

Geolocalização não foi validada fisicamente; os totais não aplicam ajustes aos originais nem tratam consolidação trabalhista/banco de horas. Consulta global de localização não foi revalidada nesta rodada. Suítes históricas com `state` exclusivamente `{allowed}`, ausência total de registros próprios ou rejeição de sequência irregular têm premissas superadas e não foram apresentadas como aprovadas. O comando canônico deste ciclo é `node scripts/time-clock-daily-integration.mjs`.

## Sincronização estática confirmada pelo principal

Após o complemento aprovado, o principal copiou `apps/web/dist/web/browser` para `apps/api/public` usando `cpSync(source,target,{recursive:true,force:true})`, com caminhos resolvidos/conferidos dentro do workspace e presença obrigatória de index: **43 entradas de primeiro nível copiadas, zero exclusões**. GET público somente de `http://localhost:3000/` retornou HTTP 200 com HTML idêntico ao build final `main-XYIYO2WV.js`, SHA-256 `b156525e8e6698a50418fa8756b40ebad3a87cbd3cbba23e2a003c93529baf8e`. Nenhuma chamada API autenticada operacional foi realizada. A igualdade do frontend servido não equivale à validação autenticada da instância operacional; as validações funcionais acima ocorreram apenas no banco de teste.
