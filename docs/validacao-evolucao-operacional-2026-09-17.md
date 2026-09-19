# Validação da evolução operacional — 17/09/2026

Entrega implementada: apresentação pública **Thiago Solutions Digitais**, painel mensal com cruzamento financeiro/operacional, alertas/gráficos/rankings, cadastro e recebimento de insumos, fichas técnicas e consumo transacional na cozinha. Guia: [gestão operacional](gestao-operacional-manual.md).

Resultado consolidado: **185 testes unitários em 13 arquivos**, **12 cenários HTTP** e **8 cenários de navegador** aprovados, além da preservação dos documentos anteriores. Os cenários HTTP e browser foram concluídos em execuções complementares; não houve uma rodada única final de 21 aprovações. Build Angular/cópia SPA/Nest aprovado; última correção backend recompilada e validada.

## Comandos e evidências

Todas as compilações/aplicações/testes desta rodada definiram:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
```

| Comando | Resultado / log em `operational-qa/2026-09-17` |
|---|---|
| `npm.cmd run build` no sandbox | `spawn EPERM`, build.log; nenhum teste executado |
| Mesmo build com subprocessos autorizados | Angular passou; Nest detectou referência ObjectId onde StockMovement exige string, corrigida; build-approved.log |
| `npm.cmd run build --prefix apps/api` | exit 0, api-build.log |
| `npm.cmd test --prefix apps/api` | 183 pass / 1 fail, inventário de endpoints desatualizado; unit.log |
| `npm.cmd run build` após integração | exit 0, build-final.log |
| `npm.cmd test --prefix apps/api` após inventário | 184/184, unit-final.log |
| `npm.cmd run build --prefix apps/api` após correção de validação | exit 0, api-build-corrected.log |
| `npm.cmd test --prefix apps/api` final | **185/185**, exit 0, unit-verified.log |
| `node --check scripts/operational-integration.mjs` e `node --check scripts/tenancy-storage.mjs` | exit 0 |
| `$env:OPERATIONAL_BROWSER='true'; node scripts/operational-integration.mjs` | três rodadas, integration-1/2/3.log; detalhes abaixo |
| Mesmo script com `$env:OPERATIONAL_FOCUS='browser'` | diagnóstico e rodada final focados; **9/9** (8 browser + preservação), browser-final.log |

Escalação autorizada foi necessária para subprocessos de compilação, Vitest e Chrome. Harness inicia API temporária em `127.0.0.1:4329` com configuração de teste, cria índices aditivamente e usa empresas/usuários exclusivos. Mongo confirmou transações. Aplicação e navegador foram encerrados no `finally`. Não houve `.env` alterado, daemon reconfigurado, seed, migração apply, exclusão ou aplicação operacional.

## Cobertura efetiva

- Fórmulas financeiras: competência, custos/despesas previstos, exclusão de pessoais/cancelados, margem negativa, receita zero, preços históricos, top 5, mudança de dia UTC/local e curva separando revenda da fabricação própria.
- HTTP: ingrediente/recebimento, snapshot financeiro intacto, recebimento repetido e paralelo sem duplicação, custo ponderado, versão otimista da ficha, produto de revenda recusado, consumo proporcional e custo registrado.
- Idempotência: mesma chave de produção devolve o registro sem novas mutações; corpo diferente retorna 409. Insuficiência de saldo e falha injetada depois do débito antes do movimento deixam os documentos de negócio completos inalterados. Duas produções concorrentes com saldo para apenas uma retornam 201/409, sem saldo negativo ou consumo parcial.
- Produção sem ficha mantém comportamento legado, explicitamente sem custo calculado. Cozinha consulta ingredientes/fichas/custo, mas não compras financeiras. Caixa/contador não acessam inventário nem o painel; IDs de outra empresa são recusados.
- Navegador: apresentação pública continua na raiz mesmo com sessão anônima, marca e links reais, login, consulta mensal, heatmap com 168 células, gráfico, mês sem vendas e recuperação após erro HTTP simulado.
- Fluxo real browser: cadastrar insumo → receber compra → salvar ficha → confirmar produção → verificar custo e saldo no Mongo. Testa a interface construída, sem mock de sucesso desse fluxo.
- Layout sem overflow global em 320/768/1440px para apresentação, painel, insumos e cozinha. Capturas preservadas; apresentação/painel desktop também inspecionados visualmente. Nenhum erro JavaScript não tratado nos cenários finais.

## Rodadas e preservação

| Run | Resultado | Documentos prévios intactos | Total final |
|---|---|---:|---:|
| 1789692376796-c23d7e466c | 12 pass / 3 fail | 8292/8292 | 8396 |
| 1789692485695-4fa1daf921 | 20 pass / 1 fail | 8399/8399 | 8513 |
| 1789692549222-9ec8009983 | 20 pass / 1 fail | 8513/8513 | 8627 |
| 1789692619394-dd203e8bc5 | browser diagnóstico: 8 pass / 1 fail | 8627/8627 | 8654 |
| 1789692667289-bfa465df29 | browser final: **9 pass / 0 fail** | **8654/8654** | **8687** |

Todos os snapshots reportaram zero documentos ausentes e zero alterados. Novos registros de fixtures/auditoria foram mantidos. Evidências finais: [resultados browser](tenancy-qa/1789692667289-bfa465df29/operational-results.json), [preservação](tenancy-qa/1789692667289-bfa465df29/preservation.json), [HTTP aprovado na rodada anterior](tenancy-qa/1789692549222-9ec8009983/operational-results.json). Capturas estão nos diretórios das execuções.

Defeito real corrigido: `class-validator` instalado lançava TypeError para `1e-7` com `maxDecimalPlaces`, retornando 500. Novos DTOs validam número finito e limites; serviço valida representação exata em milionésimos e retorna 400. Casos unitários incluem `1e-7` e `1e-10`. PUT foi incluído nos métodos CORS para o salvamento de fichas.

Falhas de browser eram seletores do teste: seta decorativa não faz parte do nome acessível de Entrar; os nomes dinâmicos do NgModel não são atributos nativos dos componentes da ficha e o texto do label contém opções. Diagnóstico registrou HTML real; seletores dos campos da linha foram corrigidos. Nenhuma alteração de aplicação foi necessária para esse último problema. As rodadas reprovadas foram preservadas, sem reclassificá-las como aprovadas.

## Arquivos e coordenação

Arquiteto escreveu contrato; frontend nomeado criou landing/login/branding e base de insumos; QA nomeado realizou revisão inicial. Os processos dos agentes frontend/QA terminaram por limite de uso, e novas instâncias backend/banco foram recusadas pelo limite de threads. O principal assumiu explicitamente a integração restante, backend/schemas, dashboard/cozinha e execução de testes, preservando as alterações já feitas. Configurações em disco não foram tratadas como processos ativos.

Novos arquivos principais: `apps/api/src/inventory/*`, `reports/overview.service.ts`/`overview.spec.ts`, `features/landing/*`, `features/inventory/*`, `features/dashboard/overview.models.ts`, `scripts/operational-integration.mjs`. Integração em reports/productions, DTO/schema produção, política HTTP/CORS, frontend dashboard/cozinha/core/rotas/layout, página inicial/title/styles e documentação. Sem repositório Git nesta cópia: não há alegação de commit/diff.

## Limites

- Lucro é estimado por previsão financeira, não demonstração contábil. Custo unitário cobre ingredientes rastreados; não inclui mão de obra/energia/perdas. Recebimento usa valor previsto da compra, não reajusta história por pagamento/correção posterior.
- Sem conversão automática de unidades, estoque inicial inferido, estorno de ingrediente, desativação de ingrediente ou migração de compras antigas. Legado sem ficha mantém o fluxo anterior e não ganha garantia transacional/idempotência de consumo de ingredientes.
- Estoque baixo é atual, mesmo em mês histórico; produção menos venda não comprova sobra física. Datas usam America/Fortaleza, coerente com os limites mensais UTC−03.
- Produções com ficha e recebimentos exigem transações. Foi validado replica set disponível; não reexecutado ambiente standalone. Não houve testes de carga, backup/restauração ou implantação operacional.
- Atualizado o provisionador aditivo para incluir os quatro modelos de insumos; sintaxe conferida, comando CLI de provisionamento não reexecutado. Os índices novos foram efetivamente criados pelo harness antes dos testes de concorrência.
- Não repetidas suítes HTTP completas de tenancy/usabilidade nem testes Angular isolados. Suíte unitária API completa passou. Avisos não bloqueantes de Node 25 e depreciações Mongoose preservados nos logs.
