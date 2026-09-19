# QA da retomada — 16/09/2026

Resultado observado: build Angular/Nest concluído; 153 testes em 11 arquivos passaram; usabilidade HTTP/Chrome 70/70; regressão multitenancy HTTP/Chrome 417/417. Nenhuma falha de aplicação permaneceu nos cenários executados. Isso não equivale a aprovação de implantação ou dos cenários não exercitados abaixo.

## Segurança e ambiente

Todas as execuções definiram literalmente `TEST_MONGODB_URI` e `MONGODB_URI` como `mongodb://127.0.0.1:27017/salgados_financeiro_test`, sem parâmetros. Guards verificam igualdade antes de iniciar aplicação/conectar. A instrução atual de AGENTS.md prevaleceu sobre a antiga URI com replicaSet/directConnection. Não houve alteração de `.env`, configuração do Mongo, limpeza, reinicialização ou migração apply. API QA temporária na porta 4329, encerrada pelos scripts; serviços operacionais não foram iniciados ou encerrados. O Mongo existente confirmou suporte a transações (`transactions: true`) com a URI autorizada.

Fixtures têm identificadores exclusivos por execução. Preservação compara fingerprints BSON dos documentos anteriores, coleção por coleção. Anexos QA permanecem em diretórios exclusivos `.qa-attachments/<run>`; remoção funcional testada é lógica, mantendo arquivos/registros.

## Comandos e evidências

Em PowerShell, prefixo usado em cada comando:

```powershell
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
```

Logs em [tenancy-qa/resume-20260916](tenancy-qa/resume-20260916/). Todos os resultados abaixo são desta retomada.

| Comando | Resultado | Log |
|---|---|---|
| `node scripts/usability-migration.mjs dry-run` | Exit 0, zero alterações | migration-dry-run.log |
| `npm.cmd test --prefix apps/api -- src/common/business-validation.spec.ts src/common/mongodb.config.spec.ts` | 44/44, 2 arquivos | targeted-tests-approved.log |
| `npm.cmd run build` | Exit 0, Angular + cópia SPA + Nest | build.log |
| `npm.cmd test --prefix apps/api` | 153/153, 11 arquivos | full-tests.log |
| `$env:USABILITY_BROWSER='true'; node scripts/usability-integration.mjs` | 70/70, sendo 29 browser; scan de 19 JS sem achados | usability-browser.log |
| `node scripts/tenancy-integration.mjs` antes de atualizar expectativas antigas | 355 passaram, 7 falharam, 0 bloqueados | tenancy-regression.log |
| `$env:TENANCY_BROWSER='true'; node scripts/tenancy-integration.mjs` após ajuste QA | 417/417, sendo 58 browser; 0 bloqueados | tenancy-regression-corrected.log |

A primeira tentativa direcionada não chegou a executar testes: `spawn EPERM` no sandbox, registrado em targeted-tests.log. A primeira revisão automática da execução escalada rejeitou alegando URI divergente. Nova leitura de AGENTS.md e dos guards comprovou a URI literal correta; ambos os campos foram explicitados no comando e a nova execução foi aprovada. Não resta bloqueio por essa rejeição. Warnings de Node 25 sem LTS, vite-tsconfig-paths e deprecações Mongoose estão preservados nos logs, sem impedir os checks.

## Correções e cobertura efetiva

A rodada histórica `1789585312334-5bfd43f5ed` tinha 66/68 checks e overflow em produtos 320/768px. O frontend corrigiu a tabela com rolagem local. A rodada nova verifica sete páginas em 320/768/1440px e inclui dois checks adicionais: foco na região, ArrowRight aumentando scrollLeft, botão Editar visível ao receber foco e Enter abrindo edição em 320/768px. Ambos passaram, além da ausência de overflow global.

Os checks de usabilidade cobriram validação HTTP de telefone/email/confirmação, perfil somente leitura, isolamento por tenant, compras pagas/pendentes, datas/quantidades inválidas, upload PDF/XML/PNG, conteúdo inválido/tamanho/XXE, download privado, remoção lógica, concorrência do limite de anexos, revenda/produção/estoque/pedido, fiscal read-only/CSV e roles. Navegação real incluiu cadastro de produto, grupos da venda, compra/anexo, fiscal do contador, máscara de telefone e confirmação de senha.

Os sete erros iniciais da regressão eram expectativas QA obsoletas: seis GETs do perfil eram classificados erroneamente como 403 porque o inventário lia `sessionOnly` apenas da classe; OWNER alterando o próprio status esperava 409, enquanto o contrato atual exige 403. O inventário agora respeita metadata do handler, e oito checks positivos verificam identidade do perfil, tenant, ausência de segredos, PATCH negado e perfil inalterado para todas as roles/sessões. A tentativa de autoalteração do único OWNER compara o documento completo antes/depois. O menu browser passou a exigir também Meu perfil. Não foram removidas asserções de autorização dos demais endpoints.

Regressão final inclui onboarding, solicitação de acesso, aprovação/rejeição de empresa, suspensão/reativação e invalidação de sessão, alterações de membros, isolamento de produtos/pedidos/financeiro, cookies/CSRF e navegação/menu/logout de seis roles. Browser público confirmou onboarding e solicitação de acesso com resposta transacional de sucesso.

## Preservação

| Execução | Anteriores intactos | Ausentes/alterados | Total final |
|---|---:|---:|---:|
| [1789598899698-31ea6cd3b4](tenancy-qa/1789598899698-31ea6cd3b4/preservation.json), usabilidade | 6498/6498 | 0/0 | 6592 |
| [1789598928572-e4a030087d](tenancy-qa/1789598928572-e4a030087d/preservation.json), regressão com expectativas antigas | 6592/6592 | 0/0 | 7319 |
| [1789599001436-642e7c5177](tenancy-qa/1789599001436-642e7c5177/preservation.json), regressão final | 7319/7319 | 0/0 | 8074 |

JSON de resultados, inventário de endpoints e screenshots estão nos respectivos diretórios. Contagens crescem pelas fixtures e auditorias; não houve remoção de dados anteriores.

## Limitações e pendências

- Dry-run encontrou 26 produtos, 14 sem classificação, 17 conflitos de email, zero telefones/emails inválidos, plano vazio e zero aplicados. São dados do banco de teste acumulado; não representam diagnóstico de produção. Não houve classificação automática nem correção desses registros.
- A regressão não executa injeção de falha/rollback de onboarding nem concorrência sobre o último OWNER no ramo com replica set. O rótulo antigo de proteção do único OWNER exercitava apenas autoalteração; a nova asserção explicita esse alcance. Não declarar esses cenários aprovados.
- Browser não clicou nas decisões de aprovação/rejeição/suspensão de membros/empresas; verificou telas, motivo obrigatório, badge e formulários públicos. As mutações transacionais correspondentes foram exercitadas por HTTP.
- Não executados: restauração de backup, migração apply, validação de infraestrutura de produção, TLS/credenciais reais do Mongo, dispositivos móveis físicos ou teste completo com leitor de tela. Scan de bundle é heurístico.
- Unitários Angular não foram executados: a evidência frontend é build de templates e Chrome headless. Não se reexecutaram suites após checks aprovados sem alterações relevantes; a repetição tenancy ocorreu para corrigir expectativas QA e incluir browser.

## Inventário QA desta retomada

Escrita exclusiva QA: `scripts/tenancy-qa-harness.mjs`, `scripts/tenancy-storage.mjs`, `scripts/usability-migration.mjs` (somente guards URI); `apps/api/src/tenants/tenancy-persistence.spec.ts`; `scripts/usability-browser.mjs`; `scripts/tenancy-integration.mjs`; `scripts/tenancy-browser.mjs`; este relatório e logs/artefatos próprios. Ajuste inicial de `apps/api/src/common/mongodb.config.spec.ts` foi coordenado e transferido ao backend, que finalizou os casos negativos. Aplicação e frontend foram alterados por seus responsáveis; QA executou os builds finais. Arquivos gerados em dist/public derivam do build raiz.
