# SaaS modular: contrato de implementação

Andamento em 18/09/2026: núcleo comercial implementado e validado; escopo integral ainda parcial. Consultar [handoff e matriz de pendências](saas-planos-assinaturas-handoff.md) e [resultados atuais](saas-qa/results.json). O estado inicial descrito abaixo foi registrado antes de implementar.

Estado inicial: landing page, cadastro mestre, RBAC por empresa e isolamento já implementados. A validação anterior (217 unitários e 41 cenários de integração) é histórica, não comprova este módulo. Nenhuma coleção comercial foi encontrada. Nenhum dado operacional será migrado ou provisionado automaticamente.

## Decisões

- Valores monetários são inteiros em centavos, BRL inicialmente. Percentuais usam pontos-base (2000 = 20%), arredondamento comercial para o centavo mais próximo, metade para cima, sem operações monetárias em ponto flutuante.
- Nenhum módulo comercial possui dependência obrigatória. A calculadora nunca acrescenta módulos. Recomendações não são contratação. Isso prevalece sobre os exemplos genéricos de inclusão automática de dependências do pedido.
- Produtos e categorias continuam sendo o cadastro mestre existente. Não haverá cópias por módulo.
- O catálogo inicial será uma ação administrativa explícita, não um seed de inicialização. Alterações comerciais geram versões imutáveis. Contratos e faturas guardam snapshots completos e não consultam preços atuais para recalcular o passado.
- Plataforma-base mantém autenticação, empresa, usuários, cadastro mestre e acesso à assinatura. Para compatibilizar a ausência de cargos fixos com os planos de entrada, cargos básicos criados pela empresa continuam disponíveis na base; CUSTOM_RBAC habilita recursos avançados. Nenhum perfil Caixa/Contador será recriado automaticamente.
- Ausência de assinatura não equivale a contratação ou teste gratuito. A ativação de bloqueios comerciais precisa preservar o acesso à base e à área de assinatura. Não atribuir contratos automaticamente a clientes existentes.
- Trial não se transforma em cobrança paga automaticamente. ACTIVE e TRIAL permitem uso somente na vigência; PENDING_PAYMENT e PAST_DUE somente dentro de tolerância explícita; CANCELED somente até o fim da vigência contratada; SUSPENDED e EXPIRED bloqueiam módulos pagos.
- Remover módulo preserva dados e permissões configuradas, mas torna essas permissões inefetivas. Recontratação restaura acesso conforme autorização atual. Sem exclusão ou desativação automática em downgrade.
- Painel global administra dados comerciais, nunca autoriza acesso operacional. OWNER simula e solicita alterações, não confirma pagamentos nem libera módulos.
- Faturas não são documentos fiscais. Pagamentos são confirmados manualmente por PLATFORM_ADMIN, com motivo/histórico e controle de versão. Não haverá gateway nesta etapa.

## Modelagem prevista

Catálogo comercial versionado (base, módulos e planos), promoções e cupons, assinatura única por tenant, faturas com itens/snapshot, solicitações de alteração e eventos comerciais. Índices únicos de código/versão, tenant da assinatura, competência da fatura e utilização de cupom. Atualizações concorrentes usam versão e transações onde houver múltiplos documentos. Coleções não são criadas no banco operacional durante QA.

## Matriz comercial

| Código | Mensal inicial | Permissões/recursos |
|---|---:|---|
| BASE | 4990 | empresa, usuários, produtos/categorias gerais, assinatura, cargos básicos |
| SALES | 3990 | vendas; dados fiscais exigem ACCOUNTING_FISCAL |
| INVENTORY | 3990 | estoque |
| PURCHASES | 2990 | compras e fornecedores |
| PRODUCTION | 4990 | produção e ficha técnica |
| EXPENSES | 2990 | despesas e contas a pagar |
| FINANCE | 5990 | receitas manuais e consolidação financeira |
| LANDING_PAGE | 3990 | configuração, publicação e consulta pública da vitrine |
| ACCOUNTING_FISCAL | 4990 | consulta/exportação fiscal |
| REPORTS | 2990 | relatórios gerenciais |
| DOCUMENTS | 1990 | biblioteca independente de documentos |
| CUSTOM_RBAC | 3990 | recursos avançados de cargos |
| ADVANCED_AUDIT | 3990 | consulta/exportação avançada de auditoria |

Planos iniciais: BASIC 7990/3 usuários; OPERATIONAL 13990/8; MANAGEMENT 21990/15; COMPLETE 31990/25. CUSTOM soma base e módulos únicos. Preços são sugestões para registros iniciais, não constantes utilizadas para recalcular contratos.

## Integração e segurança

Entitlements centralizados consultam assinatura/tenant; permissões do funcionário são outra camada. Nenhum total, desconto, tenant ou estado de pagamento recebido de usuário empresarial é autoridade. Endpoints empresariais derivam tenant da sessão; endpoints globais exigem PLATFORM_ADMIN ativo e sem tenant. Todos usam DTOs estritos, ObjectId validado, auditoria e proteção HTTP existentes.

Automações são habilitadas somente quando ambos os módulos estão contratados. Vendas sem INVENTORY não movimentam saldo; produção sem INVENTORY não movimenta insumos/produtos; vitrine sem INVENTORY usa disponibilidade manual/sob demanda. Integrações de compras e consolidação financeira precisam de origem única e transação/idempotência. O mecanismo atual de reserva de estoque em pedidos abertos exige adaptação e testes de regressão antes de declarar SALES + INVENTORY concluído.

## Sequência e aceite

1. Modelos, catálogo, planos, calculadora e descontos: verificar centavos, versões, deduplicação, elegibilidade e snapshots.
2. Assinaturas, entitlements e faturamento: verificar vigência, concorrência, limites e imutabilidade de pagamento.
3. Painel global e visão OWNER: integrar APIs, mensagens, confirmação e navegação.
4. Aplicar matriz aos módulos existentes e criar capacidades independentes ausentes, sem anunciar funcionalidades não implementadas.
5. Auditoria, testes unitários/HTTP/Mongo/browser, builds atuais e inspeção de bundles.

Testes com escrita exigem validação programática da URI exata `mongodb://127.0.0.1:27017/salgados_financeiro_test`, IDs únicos e manifesto. Remover somente documentos da própria execução e comprovar preservação dos anteriores. Não reutilizar resultados antigos como evidência nova.

## Pendências iniciais rastreáveis

Todos os itens comerciais acima começam pendentes. Em particular: compras/fornecedores autônomos, biblioteca documental independente, receitas/recebíveis manuais, estorno, recuperação transacional de vendas, limites concorrentes, cupons concorrentes, interfaces e testes combinatórios não podem ser considerados concluídos apenas pela existência do catálogo de módulos. A matriz final deve separar implementação de validação.
