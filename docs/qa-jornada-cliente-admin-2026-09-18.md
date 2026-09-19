> HISTORICO: o modulo de ponto foi removido por solicitacao do usuario em 18/09/2026. As referencias a ponto neste documento preservam apenas evidencias historicas, sem indicar disponibilidade ou trabalho pendente.

# QA — jornada do colaborador e gestão — 18/09/2026

## Resultado executado

**76 testes unitários aprovados** em cinco arquivos (9 jornada e 67 commerce), **16 blocos de integração aprovados**, incluindo **4 fluxos reais em Chrome headless**, compilação TypeScript da API e build Angular aprovados.

Execução final: `1789753520533-eeef03af9b`. MongoDB confirmou suporte a transações. Aplicação QA servida temporariamente em `http://127.0.0.1:4344`, encerrada ao final. Todos os acessos MongoDB desta execução usaram exclusivamente `mongodb://127.0.0.1:27017/salgados_financeiro_test`.

## Isolamento e preservação

Antes de executar, foram inspecionados `scripts/time-clock-integration.mjs`, `scripts/tenancy-qa-harness.mjs`, configuração MongoDB e hooks de bootstrap. O harness exige a URI exata autorizada, fixa `NODE_ENV=test`, cria fixtures únicas por execução e registra hashes de documentos anteriores. Não executa exclusão, reset ou reinicialização de banco. A inicialização financeira não grava categorias. A fila de envio de leads não funciona em `NODE_ENV=test`; adicionalmente foi definido `LEAD_EMAIL_ENABLED=false`. Não foram enviados e-mails.

Preservação final: **9.990 documentos anteriores intactos; 0 alterados; 0 ausentes; 87 novos documentos preservados; total 10.077**. Relação dos novos IDs disponível em `time-clock-created-preserved.json` da execução. As fixtures incluem usuários, empresas, assinatura, marcações, localização, ajustes e auditoria, restritos ao banco de teste.

Não foi iniciada API operacional, não houve cópia para `apps/api/public` nem acesso ao banco `salgados_mvp`. O harness serviu diretamente o build Angular revisado. A API foi compilada com `tsc`, sem limpeza do diretório de saída.

## Comandos e resultados

Prefixo PowerShell para builds e integração:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:TEST_MONGODB_URI=$env:MONGODB_URI
$env:LEAD_EMAIL_ENABLED='false'
```

| Comando | Resultado |
| --- | --- |
| `node node_modules/typescript/bin/tsc -p tsconfig.build.json --incremental false` (cwd `apps/api`) | Exit 0; API compilada. |
| `npm run build --prefix apps/web` | Exit 0; Angular concluído em 3,220 s; bundle inicial 305,55 kB. |
| `npm test --prefix apps/api -- src/workforce src/commerce` | Exit 0; 5 arquivos, 76 testes aprovados, duração 701 ms. |
| `$env:PORTFOLIO_BROWSER='true'; node scripts/time-clock-integration.mjs` | Execução final exit 0; 16 blocos aprovados, 0 falhas. Chrome e API reais. |

Build Angular, Vitest e Chrome executados com permissão de subprocessos, necessária neste ambiente Windows. Avisos não impeditivos: Node 25 sem LTS, dependência `qrcode` CommonJS, sugestão Vite sobre `vite-tsconfig-paths` e Mongoose sobre opção `new` depreciada.

## Cobertura

HTTP e banco real:

- Sem autenticação: 401; sem contrato ou usuário global operando jornada empresarial: 403.
- Contratação independente `TIME_CLOCK` libera jornada sem liberar vendas/despesas.
- CASHIER, KITCHEN e ACCOUNTANT acessam marcações próprias, mas recebem 403 em equipe e ajustes da equipe.
- Duas requisições concorrentes com mesma chave geram uma marcação/recibo, com horário do servidor.
- Coordenadas ausentes das respostas empresariais e presentes apenas na consulta global autorizada/auditada.
- Payload com horário/tenant forjados, coordenadas inválidas ou estado inconsistente rejeitado.
- Sequência entrada/intervalo/retorno/saída respeitada; recusa de geolocalização não impede registro válido.
- Autoaprovação e dupla revisão rejeitadas; ajuste aprovado não altera nem apaga marcações originais.
- Filtro de ajustes por setembro/agosto e ID de revisão inválido retornando 400.
- Suspensão bloqueia acesso imediatamente sem excluir marcações.

Navegador real:

1. CASHIER faz login, acessa jornada, registra Entrada, vê recibo na tabela, não vê link de gestão nem coordenadas e solicita ajuste. Layout sem overflow da página em 320, 768 e 1440 px.
2. Outro usuário OWNER acessa Jornada da equipe, encontra o recibo, preenche justificativa e aprova com confirmação. Registro original continua único e coordenadas permanecem ocultas.
3. CASHIER entra em nova sessão e visualiza ajuste aprovado com justificativa do gestor e marcação original.
4. PLATFORM_ADMIN abre Registros de jornada, seleciona empresa pela busca CNPJ, consulta coordenadas e recibo e usa Configurar módulo de jornada para abrir o contrato correto.

## Evidências e tentativa inicial

- [Resultado final](tenancy-qa/1789753520533-eeef03af9b/time-clock-results.json)
- [Preservação final](tenancy-qa/1789753520533-eeef03af9b/preservation.json)
- [Novos documentos preservados](tenancy-qa/1789753520533-eeef03af9b/time-clock-created-preserved.json)
- [Colaborador](tenancy-qa/1789753520533-eeef03af9b/time-clock-employee.png)
- [Gestor](tenancy-qa/1789753520533-eeef03af9b/time-clock-manager.png)
- [Plataforma](tenancy-qa/1789753520533-eeef03af9b/time-clock-platform.png)

Primeira execução `1789753423220-e5b5f470b2`: 14 blocos aprovados e 2 falhos por seletores do teste desatualizados (mensagem de solicitação ampliada e dois botões com o mesmo nome). Solicitação e aprovação persistiram corretamente. Ajustados os seletores para mensagem estável e navegação/seleção explícita de empresa; repetição completa aprovada. Essa primeira execução preservou 9.904 documentos anteriores, criou 86 e não alterou/excluiu nenhum anterior. Seus artefatos permanecem registrados.

## Limitações

Geolocalização do Chrome foi configurada pelo teste em latitude/longitude zero; não comprova posição física nem uso de GPS real. Não houve validação em dispositivo móvel físico; os tamanhos responsivos foram simulados no navegador. Não foi testado reinício do servidor entre gravação e consulta; foi testada nova sessão de usuário lendo os dados persistidos. Não foi alterado/ativado contrato de cliente operacional e não houve implantação ou reinício do serviço usado pelo usuário. A validação é funcional de jornada gerencial, sem certificação REP-P ou geração de documentos trabalhistas.
