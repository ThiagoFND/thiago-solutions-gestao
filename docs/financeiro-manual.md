# Financeiro — guia de uso

Controle gerencial interno de despesas e custos de produção. Não substitui contabilidade fiscal. O acesso exige vínculo ativo com a empresa ativa e perfil OWNER, ADMIN ou ACCOUNTANT, tanto nas telas quanto na API.

## Despesas pessoais

Em **Nova conta**, selecione **Despesa pessoal**. Se ainda não houver categorias desse tipo, use **Cadastrar categoria** na própria tela e informe um nome (por exemplo, Alimentação pessoal). A categoria criada será selecionada e os dados já preenchidos da conta serão mantidos. Informe valor, competência e vencimento, e salve. Também é possível gerenciar categorias pela aba **Categorias**. O tipo está disponível nas recorrências e nos filtros.

O resumo apresenta **Despesas pessoais previstas** separadamente das despesas operacionais e custos de produção. Os totais gerais incluem os três tipos. A origem PF/PJ informa de onde saiu o pagamento e não determina se a despesa é pessoal. Esses lançamentos continuam acessíveis aos perfis autorizados do financeiro da empresa, como os demais lançamentos.

Para execução e QA atuais, siga o [README](../README.md).

## Executar

1. Mantenha o serviço MongoDB em execução.
2. Na raiz do projeto, defina `MONGODB_URI` e `TEST_MONGODB_URI` como `mongodb://127.0.0.1:27017/salgados_financeiro_test` e execute `npm run build`.
3. Para QA automatizado das despesas pessoais, defina `$env:PERSONAL_BROWSER="true"` e execute `node scripts/personal-expenses-integration.mjs`. O script inicia e encerra sua API temporária e usa contas exclusivas da execução.
4. Para uso manual em ambiente de teste já configurado, entre com CNPJ, e-mail e senha de um membro autorizado e acesse **Financeiro** no menu.

Não há credenciais padrão nem criação automática de administrador na inicialização. Usuários e senhas existentes são preservados.

Nesta etapa, toda aplicação e escrita de teste usa exclusivamente a URI acima. Preserve dados anteriores e use identificadores exclusivos por execução; não apague bancos, coleções ou registros nem reinicialize dados. Antes de qualquer escrita no banco operacional `salgados_mvp`, explique exatamente o que será gravado e obtenha confirmação explícita, inclusive para seeds do bootstrap. Não inicie a API operacional durante QA nem encerre serviços do usuário para liberar portas.

Os cinco agentes nomeados estão configurados em `.codex/agents/`, com regras em `AGENTS.md` e `.codex/config.toml`: `arquiteto`, `banco_mongodb`, `backend_nestjs`, `frontend_angular` e `qa_integracao`. A disponibilidade foi validada por orquestração explícita; configuração em disco não comprova processos simultaneamente ativos ou recarregamento automático.

## Roteiro manual de aceitação

1. Em **Categorias**, crie uma categoria própria, edite seu nome e desative-a. Ela deve continuar visível nos registros antigos e indisponível para novas associações.
2. Em **Nova conta**, cadastre uma despesa operacional de R$ 100,00, natureza fixa, competência do mês e vencimento futuro. Ela deve aparecer como PENDENTE, em amarelo.
3. Cadastre outra conta com vencimento anterior a hoje. Ela deve aparecer como VENCIDO, em vermelho. Uma conta vencendo hoje ainda é PENDENTE.
4. Cadastre um CUSTO_PRODUCAO, preenchendo opcionalmente produto, insumo, quantidade, unidade, fornecedor e preços. Confira que o estoque de produtos prontos não mudou.
5. Abra **Registrar pagamento** na despesa de R$ 100,00. Informe R$ 98,50, uma data passada, origem PF e PIX. Confira status PAGO, valor previsto R$ 100,00, pago R$ 98,50 e diferença -R$ 1,50.
6. Nos detalhes, confira separadamente a data real do pagamento, o instante de cadastro e o usuário responsável. O instante de cadastro deve corresponder ao registro atual, exibido em America/Recife.
7. Pague outra conta usando origem PJ. No resumo, confira a separação PF/PJ e os valores efetivamente pagos.
8. Corrija um pagamento com confirmação e justificativa. O histórico deve mostrar valores anteriores, novos, autor e horário; os dados do cadastro original permanecem disponíveis.
9. Edite uma conta pendente e confira o histórico. Cancele-a com motivo: ela fica cinza e deixa de participar dos totais financeiros. Contas pagas não aceitam edição comum nem cancelamento.
10. Crie uma recorrência mensal, informando primeira data, dia habitual e número de parcelas opcional. Em **Contas recorrentes**, gere uma competência futura duas vezes: a segunda geração não deve duplicar lançamentos. Cada mês tem valor, vencimento e status próprios.
11. Teste o dia 31 em fevereiro: o vencimento deve cair no último dia do mês. Para semanal, várias cobranças no mesmo mês são válidas, mas repetir a geração não duplica a mesma ocorrência.
12. Na lista, combine filtros de período de vencimento, competência, data exata, status, categoria, tipo, natureza, PF/PJ, forma de pagamento e descrição. Confira também a paginação.
13. No resumo, selecione mês/ano e confira a quantidade de contas e o relatório por categoria. Os valores são agrupados pela competência da conta; pagamentos retroativos continuam associados à competência original.
14. Reinicie o backend com o mesmo banco configurado e consulte os lançamentos e históricos: devem permanecer salvos.
15. Saia e entre como COZINHA ou BALCÃO. O menu Financeiro não deve aparecer e o acesso direto à rota deve ser bloqueado. A API também deve negar acesso com HTTP 403; sem login, HTTP 401.

## Regras de leitura

- Valores monetários são armazenados em centavos inteiros.
- Pago representa uma quitação gerencial: um valor pago diferente do previsto encerra a conta; não cria saldo parcial.
- Pendente e vencido são grupos separados no resumo. Cancelados possuem contagem própria e não entram nos valores.
- Totais de despesas e custos usam valores previstos; total pago e PF/PJ usam valores efetivamente pagos.
- Recorrências futuras são geradas explicitamente por competência na tela. A criação gera a primeira competência. Desativar uma série não cancela contas já geradas.
- Categorias e lançamentos financeiros não possuem exclusão definitiva pela API.
- Não há movimentação automática de estoque, integração fiscal nem PDF nesta versão.

O contrato de campos, índices e endpoints está em [financeiro-contrato.md](financeiro-contrato.md).

## Verificação automatizada

Com MongoDB local ativo, execute na raiz do projeto:

```powershell
npm test --prefix apps/api
$env:TEST_MONGODB_URI="mongodb://127.0.0.1:27017/salgados_financeiro_test"
npm run test:finance --prefix apps/api
npm run test:e2e --prefix apps/api
node --test scripts/finance-ui.test.mjs
npm run build
```

As duas suítes integradas usam somente `salgados_financeiro_test`, recusam outro endereço e preservam os dados existentes, usando fixtures exclusivas por execução. O financeiro verifica chamadas HTTP, persistência e concorrência no MongoDB real; a regressão verifica produção, estoque, pedido e venda. A compilação Angular verifica os templates; os três testes de `finance-ui.test.mjs` verificam funções monetárias e data, sem navegador.

Com a aplicação de QA iniciada conforme a seção Executar, abra outro terminal, defina a mesma `TEST_MONGODB_URI` exata e execute `node --test scripts/finance-browser.test.mjs`. O script exige essa variável e verifica `/api/qa-context` antes dos fluxos. Registre comandos, contagens, resultados e limitações; a existência do roteiro ou do teste não comprova aprovação. O roteiro manual acima também cobre a apresentação visual.
