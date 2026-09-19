# QA — planos de teste e menu do proprietário — 18/09/2026

## Resultado

**89 testes unitários backend + 10 testes helper frontend aprovados; 10 blocos HTTP/navegador/preservação aprovados.** Compilação TypeScript da API e build Angular aprovados. Execução final `1789754158481-e3a64f2dee`; aplicação QA na porta 4346 encerrada, confirmado por conexão TCP recusada (`QA_PORT_CLOSED`).

## Diagnóstico somente leitura

Executado `node scripts/commerce-qa-readonly-diagnostic.mjs`, usando diretamente `MongoClient` no servidor local. Somente `find`, `countDocuments` e leitura de configuração; nenhuma API, model, índice, seed, gravação, exclusão ou migração. Saída limitada a códigos, nomes comerciais, motivos e contagens, sem dados pessoais ou credenciais.

[Diagnóstico JSON](qa-catalogo-diagnostico-2026-09-18.json), capturado antes das novas fixtures desta tarefa:

| Banco | Versões de ofertas | Ofertas atuais | Módulos atuais | Ofertas com nomes/códigos QA |
| --- | ---: | ---: | ---: | ---: |
| `salgados_financeiro_test` | 35 | 27 | 14 | 10: 8 planos e 2 módulos |
| `salgados_mvp` | 0 | 0 | 0 | 0 |

Os oito planos são quatro `QA_<run>` chamados `QA isolated commercial plan` e quatro `WEB_<run>` chamados `Plano navegador QA` (três sem sufixo, um com identificador). Todos têm motivo `QA <run>` correspondente. Fonte confirmada: `scripts/commerce-integration.mjs` criava ambos os tipos. Cada plano QA possui duas faturas; um ainda possui assinatura; os quatro WEB possuem apenas evento de criação. Nenhum desses oito planos apareceu em agendamento ou solicitação. Detalhes por código e contagens de eventos constam no JSON.

Os módulos `TIME_CLOCK` e `TRACEABILITY` possuem nomes QA históricos, mas são capacidades válidas do sistema e têm contratos vinculados; não são tratados como planos fictícios apenas pelo nome. A apresentação de nomes canônicos foi validada na tarefa anterior.

O arquivo `apps/api/.env` aponta para `salgados_financeiro_test`. `MONGODB_URI` não estava definida no processo do diagnóstico. Isso descreve configuração em disco, **não prova o ambiente efetivo de processos já iniciados**. Inspeção `Get-CimInstance Win32_Process` retornou acesso negado; não foram expostas linhas de comando ou segredos.

## Validação executada

Todos os comandos de aplicação/teste receberam:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:TEST_MONGODB_URI=$env:MONGODB_URI
$env:LEAD_EMAIL_ENABLED='false'
```

| Comando | Resultado |
| --- | --- |
| `node node_modules/typescript/bin/tsc -p tsconfig.build.json --incremental false` em `apps/api` | Exit 0; emissão sem limpar diretório. |
| `npm run build --prefix apps/web` | Exit 0; 3,283 s; bundle inicial 305,69 kB. |
| `npm test --prefix apps/api -- src/commerce src/workforce` | 6 arquivos, 89 testes aprovados, 815 ms. |
| `node --test --test-isolation=none scripts/commerce-modules.test.mjs` | 10 aprovados, 0 falhas. |
| `node scripts/commerce-catalog-menu-integration.mjs` | Execução final: 10 blocos aprovados, 0 falhas. API e Chrome headless reais. |
| `node --check scripts/commerce-integration.mjs` | Sintaxe aprovada; suíte ampla não reexecutada nesta tarefa. |

Unitários novos validam identificação estrita por código/nome/motivo dos planos legados, prevalência de `testOnly` explícito, preservação de planos comerciais legítimos fora dos padrões iniciais, indisponibilidade de planos com módulos ausentes/inativos/de teste e rejeição de novas cotações. Helpers frontend verificam nomes repetidos, conflito com Personalizado, histórico indisponível e módulos de teste não selecionáveis.

HTTP/navegador real:

- Plano `testOnly:true` permanece no catálogo administrativo, desaparece do catálogo cliente e não pode ser cotado por cliente ou administrador.
- Plano comercial legítimo continua ofertado. Reclassificação posterior como teste bloqueia novas cotações sem modificar snapshot já contratado.
- Omissão de `testOnly` herda classificação; `false` explícito cria nova versão com evento contendo `before.testOnly:true` e `after.testOnly:false`.
- OWNER com COMPLETE possui 12 módulos, vê Auditoria e não vê Jornada/Qualidade. A tela Auditoria recebeu GET 200, renderizou a quantidade de linhas retornada e mostrou botão Anterior desabilitado na primeira página.
- Comparação do cliente e seletor real de contrato administrativo não exibem os planos QA legados nem o plano reclassificado de teste. Seleção COMPLETE foi preservada no painel administrativo.
- OWNER com os 14 módulos vê Jornada, Jornada da equipe, Qualidade e Auditoria. Rotas Jornada e Qualidade abriram sem erros JavaScript.
- OWNER sem ADVANCED_AUDIT não vê o link e recebe 403 no endpoint de auditoria.

## Preservação e evidências

Execução final: **10.140 documentos anteriores intactos, 0 alterados, 0 ausentes; 29 documentos novos preservados; total 10.169**. Novos planos criados pela execução foram encerrados com nova versão `available:false` via API, exclusivamente no banco de teste. Nenhum registro anterior foi reclassificado, renomeado ou removido.

- [Resultados finais](tenancy-qa/1789754158481-e3a64f2dee/catalog-menu-results.json)
- [Preservação](tenancy-qa/1789754158481-e3a64f2dee/preservation.json)
- [OWNER COMPLETE e Auditoria](tenancy-qa/1789754158481-e3a64f2dee/owner-complete-12.png)
- [Plano do cliente](tenancy-qa/1789754158481-e3a64f2dee/owner-plans.png)
- [OWNER com 14 módulos](tenancy-qa/1789754158481-e3a64f2dee/owner-custom-14.png)
- [Seletor administrativo](tenancy-qa/1789754158481-e3a64f2dee/platform-plan-selector.png)

Primeira tentativa `1789754084053-e9f01a0b07`: 7/8 aprovados; falha na asserção do teste que buscava código em `event.resourceId`, quando a API registra ID da versão. Corrigida a consulta para `after.code` e flags antes/depois. Segunda tentativa `1789754114991-3b2940cc15`: 9/9 aprovados. Última execução ampliou evidência da resposta de auditoria e seletor administrativo e aprovou 10/10. As três preservaram todos os documentos preexistentes e encerraram somente suas novas ofertas.

## Limites e interpretação do menu

As capacidades comerciais não correspondem necessariamente a uma tela independente: Estoque/recebimento integra Insumos e fichas; Relatórios aparece em Visão geral; Documentos integra anexos de despesas; Compras não possui tela independente. COMPLETE continua com 12 módulos; não houve inclusão automática de Jornada/Qualidade em contratos existentes.

O diagnóstico operacional foi somente leitura. As validações e novas fixtures foram exclusivamente no banco de teste, sem iniciar API operacional. Não houve publicação em `apps/api/public`, reinício do serviço do usuário ou alteração de contrato operacional. Cargo personalizado autorizado à auditoria não foi exercitado no navegador nesta rodada. A suíte commerce ampla recebeu proteção para encerrar suas ofertas únicas, mas teve somente sintaxe verificada nesta tarefa. Avisos existentes de Node 25, qrcode CommonJS, Vite, ESM e Mongoose não impediram os resultados aprovados.
