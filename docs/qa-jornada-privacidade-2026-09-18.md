> HISTORICO: o modulo de ponto foi removido por solicitacao do usuario em 18/09/2026. As referencias a ponto neste documento preservam apenas evidencias historicas, sem indicar disponibilidade ou trabalho pendente.

# QA — registro separado do histórico de jornada — 18/09/2026

## Resultado e regra atual

**28 testes unitários e 11 blocos de integração aprovados**, incluindo quatro fluxos reais Chrome. Compilação API e build Angular aprovados. Execução `1789754977629-8e62b45191`.

Todos os membros ativos de empresa com `TIME_CLOCK` autorizado mantêm o registro próprio. Consultar históricos exige `ponto.visualizar`; alterar/analisar ajustes exige também `ponto.gerenciar`. OWNER possui acesso; ADMIN não recebe acesso privado automaticamente. Somente OWNER pode conceder as permissões privadas. Registrador comum recebe estado mínimo `{allowed}`, usa botão explícito Bater ponto e recebe confirmação pontual, sem obter históricos.

## Comandos e isolamento

Todos os comandos de aplicação/teste usaram `MONGODB_URI` e `TEST_MONGODB_URI` iguais a `mongodb://127.0.0.1:27017/salgados_financeiro_test`. `LEAD_EMAIL_ENABLED=false` e harness com `NODE_ENV=test`. Aplicação QA temporária na porta 4348, encerrada após execução; socket confirmou `ECONNREFUSED`/`QA_PORT_CLOSED`.

| Comando | Resultado |
| --- | --- |
| `node node_modules/typescript/bin/tsc -p tsconfig.build.json --incremental false` em `apps/api` | Exit 0, sem limpar diretório. |
| `npm test --prefix apps/api -- src/workforce src/tenants/time-clock-identity.spec.ts` | 2 arquivos, 28 testes aprovados, 982 ms. |
| `npm run build --prefix apps/web` | Exit 0, 5,801 s, bundle inicial 305,70 kB; `main-NUWF23NF.js`. |
| `node scripts/time-clock-privacy-integration.mjs` | Exit 0; 11 blocos aprovados, 0 falhas. |
| `node --check scripts/time-clock-members-integration.mjs` | Sintaxe aprovada após adaptação do novo seletor/botão; integração desse script não repetida nesta rodada. |

Subprocessos Vitest/Angular/Chrome executados com a permissão necessária neste ambiente. Avisos existentes Node 25, qrcode CommonJS e Vite não impediram execução.

Nenhuma API operacional foi iniciada. Fixtures receberam identificador exclusivo; nenhum banco, coleção ou registro foi excluído/reinicializado. **10.276 documentos anteriores preservados sem alteração; 0 ausentes; 63 novos documentos preservados; total 10.339.**

## Evidência HTTP e banco

- Registrador sem leitura recebe apenas `allowed` no GET `/time-clock/state`; POST punch persiste marcação.
- O mesmo usuário recebe 403 em GET `mine`, `team`, `corrections/mine` e `corrections/team`, e em POST corrections. A proteção foi testada diretamente por HTTP, independente da interface.
- ADMIN legado acessa o estado mínimo mas recebe 403 nos históricos. ADMIN e delegado gestor com permissão de criar cargos recebem 403 ao tentar conceder `ponto.visualizar`; OWNER cria o cargo autorizado.
- Registrador com acesso à auditoria geral não recebe eventos `time.*` ou recurso `time-clock`. Total retornado coincide com a contagem filtrada no banco.
- OWNER, delegado de leitura e delegado gestor consultam históricos da empresa. Outro tenant consultando ID de usuário externo recebe lista vazia. Coordenadas não aparecem nas respostas empresariais.
- Delegado somente leitor recebe 403 na revisão de ajuste; gestor com leitura+gestão aprova. Marcação original permanece intacta.

## Evidência Chrome

1. Registrador comum abre Bater ponto, seleciona Saída e confirma no botão Bater ponto; recebe sucesso. DOM não contém tabela nem formulário de ajustes. Captura de requisições comprova que não chamou endpoints de histórico. Menu não oferece equipe.
2. OWNER abre equipe e encontra o recibo do funcionário.
3. Delegado de leitura abre equipe e encontra o mesmo recibo.
4. Delegado gestor abre equipe e encontra o mesmo recibo.

- [Resultados](tenancy-qa/1789754977629-8e62b45191/time-clock-privacy-results.json)
- [Preservação](tenancy-qa/1789754977629-8e62b45191/preservation.json)
- [Registrador sem histórico](tenancy-qa/1789754977629-8e62b45191/privacy-recorder.png)
- [OWNER](tenancy-qa/1789754977629-8e62b45191/privacy-owner.png)
- [Delegado leitor](tenancy-qa/1789754977629-8e62b45191/privacy-viewer.png)
- [Delegado gestor](tenancy-qa/1789754977629-8e62b45191/privacy-manager.png)

## Suítes anteriores e limitações

O comando canônico para a regra atual de privacidade é `node scripts/time-clock-privacy-integration.mjs`. `scripts/time-clock-integration.mjs` e relatórios antigos incluem premissas superadas (registrador comum consultando históricos e solicitando ajustes, botões individuais Entrada/Saída). Esse script antigo não foi executado nem declarado aprovado nesta rodada. Seu histórico de resultados permanece preservado. `scripts/time-clock-members-integration.mjs` teve seletor adaptado ao botão atual e somente checagem de sintaxe nesta rodada; seus resultados anteriores não validam a política nova de leitura.

A consulta global de localização permaneceu fora desta validação enquanto sua política estava sendo esclarecida pelo principal; os resultados acima não constituem aprovação dessa política. Revogação de permissão durante uma tela já aberta não foi exercitada em Chrome nesta rodada. Geolocalização usada no navegador é simulada, sem comprovação de presença física.

## Sincronização estática pelo principal

Após os 11 blocos aprovados, o principal informou cópia `cpSync(source,target,{recursive:true,force:true})` de `apps/web/dist/web/browser` para `apps/api/public`, caminhos absolutos verificados no workspace, 43 entradas copiadas e nenhuma exclusão. GET público `http://localhost:3000/` retornou 200 com `indexMatchesBuild:true`, SHA-256 `f942bdd1806d46e5387391891c8c8d9f42ce441768fd60ac03df07d6ba493a3a`, script `main-NUWF23NF.js`. Essa verificação confirma o frontend servido; não equivale a testar a política backend na sessão operacional do usuário. Nenhum reinício de API ou intervenção em contratos existentes foi executado pelo QA.
