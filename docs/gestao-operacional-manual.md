# Visão geral, insumos e fichas técnicas

Na página inicial, a marca é **Thiago Solutions Digitais**. Use Entrar, Cadastrar empresa ou Solicitar acesso. A apresentação é pública; os dados do negócio continuam exigindo sessão e permissões.

## Visão geral

Disponível para proprietário e administrador. Selecione a competência e clique em Consultar mês. Vendas são os pedidos finalizados naquele mês, no fuso America/Fortaleza. Custos e despesas são os valores previstos da mesma competência no financeiro; contas canceladas e despesas pessoais ficam fora do resultado operacional.

- Lucro bruto estimado: receita menos custos de produção.
- Resultado operacional estimado: lucro bruto menos despesas operacionais.
- Margem operacional: resultado dividido pela receita; sem vendas, não há percentual.
- Cobertura de despesas: quanto falta de receita para cobrir despesas operacionais previstas. É uma comparação simples, não um ponto de equilíbrio contábil completo.

Estoque baixo mostra produtos ativos de estoque controlado com saldo atual menor ou igual ao mínimo. Sob demanda fica fora desse alerta. A diferença entre produção e venda indica possível excesso, mas não comprova sobra física: reservas de pedidos abertos e estoque anterior também afetam os saldos.

A curva compara unidades fabricadas com vendas de fabricação própria. Alternar mês completo/últimos sete dias muda a visualização da curva. O mapa de calor conta finalizações por dia da semana e hora. Top 5 pode ser ordenado por quantidade ou faturamento; preços são os registrados nas vendas. O resumo diário permanece em Consultar resumo diário.

## Começar a controlar insumos

1. Em **Insumos e fichas**, cadastre o ingrediente com nome, unidade e estoque mínimo. O saldo começa em zero.
2. No **Financeiro**, registre uma conta do tipo **Custo de produção**, classificação **Compra de insumo**, com categoria correspondente, quantidade, unidade, data da compra e valor. Não há recebimento de estoque automático ao salvar a conta.
3. Em **Insumos e fichas → Receber uma compra**, escolha a conta e o ingrediente, confira e confirme. A unidade deve ser idêntica; não há conversão automática entre KG/G, L/ML, caixas ou pacotes.
4. Em **Fichas técnicas**, selecione um produto de fabricação própria. Informe o rendimento do lote e a quantidade de cada ingrediente nesse lote. Cada ingrediente aparece uma única vez. Salve a ficha.
5. Na **Cozinha**, selecione o produto e a quantidade pronta. A tela mostra a ficha e o custo médio dos ingredientes. Ao confirmar, os ingredientes são consumidos proporcionalmente e o produto entra no saldo disponível.

Uma compra só pode ser recebida uma vez. Repetir a mesma solicitação devolve o recebimento existente. Quantidade ou associação inválida não deve ser contornada criando lançamentos duplicados.

Se faltar qualquer ingrediente, a produção com ficha inteira é recusada; não há débito parcial. Frações menores que seis casas decimais exigem ajustar a ficha ou o lote. O sistema usa custo médio ponderado e registra o custo consumido no momento da produção, com arredondamento monetário por componente em centavos. No esgotamento do ingrediente, consome o valor remanescente.

Produtos sem ficha continuam permitindo produção, com indicação de custo não calculado e sem baixar ingredientes. Não se reconstrói consumo de produções antigas. O custo calculado cobre os ingredientes rastreados, não mão de obra, energia, tributos ou perdas. Ele é mostrado separado do financeiro para evitar somar a compra duas vezes.

Proprietário e administrador cadastram ingredientes, recebem compras e editam fichas. Cozinha consulta saldos, fichas e seus custos de ingredientes e confirma produção; não consulta lançamentos financeiros por essa tela. Caixa, contador e administração da plataforma não têm acesso ao estoque de insumos.

## Persistência e limites

Recebimentos e produções com ficha exigem MongoDB com transações. Sem suporte, são recusados antes das mutações. Não há rotina automática de limpeza, seed, recebimento de compras antigas, estorno de insumos ou conversão de unidades. Corrigir uma conta financeira depois do recebimento não revaloriza os movimentos existentes.

Os índices únicos de recebimento, ficha e idempotência precisam estar provisionados. No banco de teste autorizado, depois de compilar, o comando `node scripts/tenancy-storage.mjs provision` cria coleções/índices aditivamente; exige `TEST_MONGODB_URI=mongodb://127.0.0.1:27017/salgados_financeiro_test`. O harness QA também provisiona os modelos antes dos testes. Nenhuma implantação ou provisionamento em banco operacional foi executado nesta entrega.
