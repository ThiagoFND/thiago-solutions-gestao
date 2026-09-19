## Portfólio profissional em andamento — 18/09/2026

Estado atual, arquivos, novas rotas, validações e pendências: [portfolio-profissional-handoff.md](portfolio-profissional-handoff.md). Despesas/Financeiro/Contábil separados; site e captação, jornada inicial e devolução com inspeção implementados com limites documentados. O pedido amplo de novos módulos **não está concluído**. Dados operacionais não foram alterados. Os registros históricos abaixo descrevem etapas anteriores.

## Atualizacao: assinatura obrigatoria (18/09/2026)

A flag COMMERCIAL_ENTITLEMENTS_ENABLED nao libera mais acesso sem contrato. Sem assinatura valida, inclusive a base empresarial fica bloqueada; login/perfil e regularizacao da assinatura permanecem acessiveis. Esta decisao substitui a compatibilidade de rollout descrita historicamente abaixo. Base local consultada: 69 empresas, zero contratos e zero ofertas; nenhum contrato apagado. Validacao atual: 261 unitarios e 33 cenarios de integracao/navegador aprovados; builds Nest/Angular aprovados. Procedimento de primeira contratacao, arquivos e limitacoes: [assinatura-acesso-obrigatorio.md](assinatura-acesso-obrigatorio.md).

# Planos, assinaturas e entitlements — estado de continuidade

Data: 18/09/2026. **Implementação parcial; não representa encerramento do escopo SaaS solicitado.**

## Estado encontrado e compatibilidade

Foram consultados AGENTS.md, handoffs de segurança e usuários/tenancy, especificações de tenancy, financeiro, evolução operacional, vitrine/RBAC e cargos exclusivamente personalizados. Foram inspecionados AppModule, autenticação/guards, TenantAccess, schemas e serviços de usuários/cargos, produtos/categorias/vitrine/imagens, produção/estoque/vendas, rotas Angular, shell e painel de empresas. Não havia catálogo comercial, contratos ou faturamento de assinaturas.

A base de 217 unitários/41 cenários anteriormente documentada era evidência histórica. Foram executadas validações novas porque as integrações alteraram autorização e caminhos compartilhados. Não foi refeita uma auditoria geral dos módulos antigos.

Foi tentada uma revisão delimitada por um arquiteto, conforme a exceção no final do pedido. A ferramenta recusou a criação por limite de threads. Nenhum novo agente iniciou; nenhum agente antigo foi retomado. Toda análise, implementação e validação efetiva foi realizada pelo principal.

Não houve gravação, migração, seed, exclusão ou provisionamento no banco operacional. Os catálogos sugeridos **não foram cadastrados para os clientes reais**. Cargos fixos não foram reintroduzidos. Produtos/categorias continuam nas mesmas coleções, com os mesmos IDs.

## Implementado

- Catálogo administrativo de base, 12 módulos e planos, com versões imutáveis. Alterar preço não altera contratos existentes. Código/tipo comercial protegidos e módulos validados por allowlist.
- Inicialização explícita e idempotente das sugestões, pelo PLATFORM_ADMIN; não ocorre ao iniciar a API.
- Calculadora com centavos, deduplicação, pacotes fechados e personalizado, ciclo mensal/anual, descontos e razões de rejeição. Sem dependências comerciais automáticas.
- Descontos versionados percentual/pontos-base, fixo e gratuidade, período, número de cobranças, plano/módulo/empresa/ciclo elegíveis e combinação explícita.
- Cupons com período, desconto relacionado, limite global e por empresa. Resgate e assinatura na mesma transação; concorrência testada. Simulação não consome cupom.
- Assinatura única por tenant, snapshot, sete status, datas/tolerância, mudança explícita e alteração futura agendada. Trial não gera fatura nem se converte automaticamente.
- Entitlements centrais sem cache: consultados na identidade e revalidados no backend. Permissões indisponíveis são mascaradas, não apagadas dos cargos. OWNER não consegue concedê-las enquanto indisponíveis.
- Quotas concorrentes de usuários ativos, produtos e categorias. Downgrade preserva registros. Novas inclusões/ativações acima do limite retornam 403.
- Cobranças manuais com competência única por assinatura, snapshot de preços contratados, rascunho, abertura, pagamento, cancelamento e isenção. Correção de data/competência somente em rascunho com versão. Pagamento confirmado não pode ser editado/cancelado silenciosamente.
- Solicitações empresariais com paginação; decisão global auditada. Aprovação exige que o contrato correspondente já esteja aplicado. Solicitar não libera módulo.
- Painel global de métricas comerciais, catálogo/preços, descontos, cupons, assinatura, cobranças e histórico recente. Projeção de recorrência separada de pagamentos recebidos.
- Tela OWNER com contrato, limites/consumo, preço projetado segundo validade da promoção, comparação, simulador, cupons, cobranças e solicitações.
- Novas vendas no modo comercial utilizam transação e debitam estoque na finalização, somente se INVENTORY estiver contratado. SALES sozinho funciona sem estoque. Tentativa concorrente de finalizar duas vezes gera uma baixa.
- Produção sem INVENTORY registra a produção sem movimentar insumos ou saldo pronto. Replay sequencial por chave mantém o registro.
- Vitrine sem INVENTORY usa disponibilidade sem depender de saldo. Com INVENTORY respeita estoque e ocultação. Retirar LANDING_PAGE bloqueia página e imagens públicas, preservando os dados. Imagem de produto oculto por falta de estoque agora segue a mesma regra da vitrine.

## Ativação controlada — importante

`COMMERCIAL_ENTITLEMENTS_ENABLED=true` ativa o comportamento comercial de autorização, quotas e novas vendas. Ausente/false mantém a compatibilidade operacional anterior. **Não foi ativado no ambiente operacional.**

Esta proteção temporária impede que um hot reload bloqueie todas as empresas existentes antes de provisionar contratos e validar os módulos independentes. Não trate a flag desligada como proteção comercial ativa. O estado atual não está aprovado para vender todas as capacidades anunciadas no catálogo.

Com a flag ligada e sem assinatura, a base continua acessível, mas módulos pagos são negados. A aplicação continua verificando usuário ativo, empresa ativa, permissões e tenant. O acesso à assinatura é restrito a OWNER/ADMIN de compatibilidade; não foi acrescentada uma permissão delegável específica para funcionários.

Nenhum serviço comercial faz seed de inicialização. Mutações comerciais verificam os índices únicos obrigatórios e retornam 503 se a estrutura não estiver provisionada. MongoDB precisa suportar transações. A implantação operacional de coleções/índices/contratos continua pendente de procedimento autorizado; o script fornecido recusa banco diferente do teste.

## Modelo de dados

| Coleção | Função e índice relevante |
|---|---|
| commercial_offer_versions_v2 | Base/módulo/plano; unique código + versão; preços mensais/anuais, módulos, limites, responsável/motivo |
| commercial_discount_versions_v2 | Promoções versionadas; unique código + versão |
| commercial_subscriptions_v2 | Unique tenantId; snapshot, promoções congeladas, status/datas, alteração agendada; versão comercial e trava de quota separadas |
| commercial_invoices_v2 | Unique assinatura + competência; itens/snapshot, vencimento, estado, confirmação e versão |
| commercial_events_v2 | Histórico comercial por tenant/data; ator, motivo e estados permitidos |
| commercial_requests_v2 | Solicitações por tenant/status/data; proposta, decisão e versão |
| commercial_coupons_v2 | Código único; validade/limites/contador/versionamento |
| commercial_coupon_redemptions_v2 | Unique cupom + tenant + versão da assinatura; comprova uso |

Snapshots monetários são construídos no servidor a partir de registros oficiais. Campos Mixed armazenam somente essas estruturas internas, nunca request bodies arbitrários. DTOs proíbem campos extras, valores fracionários em centavos, códigos inválidos e tenant/preços manipulados em rotas empresariais.

`orders_v2.stockPolicy=AT_FINALIZATION` identifica o novo fluxo transacional. Registros antigos sem esse marcador conservam seu fluxo de reservas anterior; não houve migração. `StockMovementType.SALE` registra a baixa na finalização. Isso não implementa estorno.

## Sugestões comerciais cadastráveis

| Oferta | Mensal | Usuários ativos |
|---|---:|---:|
| Plataforma-base | R$ 49,90 | 3 na sugestão inicial |
| Básico | R$ 79,90 | 3 |
| Operacional | R$ 139,90 | 8 |
| Gestão | R$ 219,90 | 15 |
| Completo | R$ 319,90 | 25 |
| Personalizado | Base + módulos únicos | Limites da versão da base |

Módulos: SALES 39,90; INVENTORY 39,90; PURCHASES 29,90; PRODUCTION 49,90; EXPENSES 29,90; FINANCE 59,90; LANDING_PAGE 39,90; ACCOUNTING_FISCAL 49,90; REPORTS 29,90; DOCUMENTS 19,90; CUSTOM_RBAC 39,90; ADVANCED_AUDIT 39,90. Todos em BRL/mês; persistidos em centavos. Os preços são sugestões de inicialização, não preços fixos da regra de negócio.

Plano fechado usa seu próprio preço, não a soma dos módulos. Personalizado inclui base uma vez. Sem preço anual específico, usa 12 mensalidades. Novas versões exigem versão anterior e motivo.

## Cálculo, descontos e vigência

- Percentual: pontos-base, 2000 = 20%. Cálculo inteiro com BigInt e arredondamento metade para cima. Alocação proporcional nos itens, resíduo no último, preservando exatamente a soma.
- Exemplo testado: 4990 + 3990 + 3990 + 2990 = 15960; 20% = 3192; total 12768. Depois da promoção: 15960.
- Ordem de combinação estável pelo código. Não combina por padrão; todos os descontos envolvidos precisam autorizar combinação. Não duplica desconto direto com cupom do mesmo desconto.
- Valor fixo acima do subtotal elegível é rejeitado. FREE concede gratuidade explícita. FREE com maxCycles=1 representa primeira cobrança gratuita; maxCycles=N representa N cobranças gratuitas.
- Desconto sobre módulo funciona no personalizado. Um pacote fechado não é artificialmente repartido: desconto específico de módulo sem item correspondente é rejeitado.
- Datas têm fim exclusivo. O preço de novas faturas é calculado a partir dos preços contratados e promoções congeladas, considerando vencimento e número da cobrança. A alteração posterior do catálogo não é utilizada.
- Criar um rascunho consome um número de cobrança promocional. Cancelar não devolve automaticamente esse número; ajuste dessa política permanece pendente.
- ACTIVE/TRIAL: início inclusivo, fim exclusivo. PENDING_PAYMENT/PAST_DUE: exigem graceUntil explícito. CANCELED preserva acesso até fim contratado. SUSPENDED/EXPIRED bloqueiam.
- Alteração agendada guarda preço e módulos novos sem substituir o contrato antecipadamente. A policy calcula o estado efetivo na data. Consultas não escrevem. Geração administrativa de fatura materializa uma alteração vencida em transação e registra evento.
- Alterar somente o status cancela um agendamento pendente. Confirmar pagamento não renova automaticamente a vigência nem libera módulos; a decisão administrativa de assinatura continua explícita.

## Matriz de entitlements e autorização

| Permissões | Contratação necessária |
|---|---|
| empresa.*, usuarios.*, produtos.*, categorias.*, cargos.* | Base; cargos básicos da empresa mantidos para compatibilidade |
| vendas.* | SALES |
| estoque.* | INVENTORY |
| producao.* | PRODUCTION |
| financeiro.* | EXPENSES ou FINANCE, conforme o módulo financeiro existente |
| landing_page.* | LANDING_PAGE |
| vendas_fiscais.* | ACCOUNTING_FISCAL |
| relatorios.* | REPORTS |
| auditoria.* | ADVANCED_AUDIT |

A contratação não concede permissão individual. PLATFORM_ADMIN continua sem tenant e não ganha acesso a vendas/financeiro/produção do cliente. Recursos sem módulo mapeado permanecem na base; novos controllers precisam ampliar esta matriz antes de publicação. PURCHASES/DOCUMENTS ainda não possuem fluxos independentes correspondentes, e a diferenciação premium de CUSTOM_RBAC permanece pendente.

## Endpoints comerciais

Prefixo `/api`. Todos globais exigem PLATFORM_ADMIN ativo, sem tenant; rotas empresariais exigem OWNER/ADMIN ativo, empresa ativa e tenant derivado da sessão.

| Método | Caminho | Finalidade |
|---|---|---|
| GET | platform/commerce/dashboard | Métricas/projeções/pendências comerciais |
| GET | platform/commerce/catalog | Catálogo corrente |
| POST | platform/commerce/catalog/initialize | Criar sugestões ausentes, explicitamente |
| POST | platform/commerce/catalog/versions | Criar oferta ou nova versão |
| GET / POST | platform/commerce/discounts / discounts/versions | Consultar/criar versões de desconto |
| GET / POST | platform/commerce/coupons | Paginar/configurar cupons |
| GET / POST | platform/commerce/tenants/:tenant/subscription | Consultar/contratar ou alterar explicitamente |
| POST | platform/commerce/tenants/:tenant/quote | Simular com preços oficiais |
| POST | platform/commerce/tenants/:tenant/schedule | Agendar mudança futura |
| POST | platform/commerce/tenants/:tenant/status | Alterar status, reativar/cancelar/suspender |
| GET / POST | platform/commerce/tenants/:tenant/invoices | Paginar/gerar rascunho |
| POST | platform/commerce/tenants/:tenant/invoices/:id/status | Abrir/pagar/cancelar/isentar |
| POST | platform/commerce/tenants/:tenant/invoices/:id/edit | Corrigir rascunho com versão |
| GET | platform/commerce/tenants/:tenant/history | Histórico paginado no servidor |
| GET | platform/commerce/tenants/:tenant/requests | Solicitações da empresa |
| POST | platform/commerce/tenants/:tenant/requests/:id/decision | Registrar decisão administrativa |
| GET | subscription | Contrato/limites/uso/preço vigente do próprio tenant |
| GET | subscription/catalog | Ofertas comercialmente disponíveis |
| POST | subscription/quote | Simulação, sem contratar ou consumir cupom |
| GET | subscription/invoices | Cobranças do tenant paginadas |
| GET / POST | subscription/requests | Consultar/enviar solicitação |

São 26 handlers adicionais. O inventário atual de 125 handlers inclui os 99 anteriores; a regressão HTTP verificou autenticação e autorização de todos. A matriz detalhada está no artefato `docs/tenancy-qa/1789735220054-5a5d096918/endpoint-matrix.json`.

## Instruções de uso

1. Gere os artefatos com `npm run build` na raiz. O comando compila Angular, copia os artefatos para a API e compila NestJS. Desenvolvimento: `npm run dev`, usando a configuração própria já existente; nunca usar a configuração operacional para QA.
2. Entre pelo login da plataforma com uma conta global existente. Em Empresas, abra **Gestão comercial**. Uma empresa tem o link **Plano e cobranças**, com tenant selecionado.
3. Com armazenamento provisionado, catálogo vazio oferece **Cadastrar catálogo inicial sugerido**. Exige motivo e confirmação. Não cria assinaturas.
4. Em **Planos e módulos**, crie plano ou edite oferta. Preencha preço em reais, módulos e limites; salve nova versão. A UI mostra versão e disponibilidade para novas vendas.
5. Em **Descontos**, cadastre tipo, valor, período e duração. Em **Cupons promocionais**, associe o desconto e configure limites/validade. O formulário inicial de desconto usa subtotal; escopos mais avançados já são aceitos pela API, mas ainda não possuem toda a edição visual.
6. Em **Assinaturas e cobranças**, escolha plano/ciclo/módulos e códigos promocionais, simule, informe datas e motivo, confirme. Para mudança futura, marque agendamento e informe início futuro. Cupons não são aceitos em agendamento nesta versão.
7. Para cobrança, informe competência e vencimento, gere rascunho, abra a cobrança e confirme pagamento real com forma/motivo. Não existe gateway ou emissão fiscal. A correção de rascunho está disponível pela API; o formulário dedicado permanece pendente.
8. OWNER acessa **Plano e assinatura** no menu. Pode simular e solicitar, sem alterar status/preço/limites. A decisão aparece em Solicitações.
9. Em QA com a flag comercial ligada, atribua apenas SALES: `/orders` deve funcionar, `/finance/entries` deve retornar 403. Sem assinatura, `/products` e `/subscription` permanecem acessíveis ao OWNER; `/orders` retorna 403. Suspender deve bloquear módulos na requisição seguinte.

## Validação e reprodução segura

PowerShell, raiz do projeto:

```powershell
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:MONGODB_URI=$env:TEST_MONGODB_URI
npm test --prefix apps/api
npm run build --prefix apps/api
npm run build --prefix apps/web
$env:COMMERCE_BROWSER='true'
node scripts/commerce-integration.mjs
node scripts/commerce-storage.mjs --diagnose
node scripts/commerce-storage.mjs --dry-run
node scripts/catalog-bundle-check.mjs
```

O harness inicia uma API própria em 4341, segredos aleatórios apenas em memória e guard de URI antes de importar/iniciar. Registra IDs criados, remove somente esses documentos e compara fingerprints dos anteriores. O teste de regressão existente usa 4337, com `COMMERCIAL_ENTITLEMENTS_ENABLED=false`, para comprovar compatibilidade; o comercial força true e testa bloqueios reais. Chrome instalado é necessário para o modo navegador. Nenhum teste positivo é declarado em MongoDB sem transações.

`commerce-storage.mjs` é diagnose/dry-run por padrão. `--apply` é aditivo/idempotente e aceita **somente o banco autorizado de teste**. Não há script operacional executável nesta entrega. Não adaptar a URI para produção sem um procedimento de implantação revisado.

## Pendências reais e limites de aceite

- **Não concluído:** PURCHASES independente (fornecedores/compras/recebimentos); DOCUMENTS independente; FINANCE completo com receitas/recebíveis manuais e fluxo de caixa; integrações PURCHASES+INVENTORY, PURCHASES+EXPENSES, SALES+FINANCE e EXPENSES+FINANCE conforme todo o pedido.
- **Parcial:** INVENTORY independente ainda não tem a tela completa de saídas/ajustes/inventário; produção sem estoque registra volume, mas ficha técnica autônoma/rendimento/perdas e cenários concorrentes de replay precisam de ampliação. Produção com estoque mantém os caminhos antigos, incluindo limitações de recuperação do caminho sem receita.
- **Não concluído:** estorno/desconto operacional das vendas. As permissões e OrderStatus.REFUNDED já existiam, mas não implementam o fluxo. Pedidos antigos mantêm reserva; recuperação de interrupções nessa compatibilidade continua pendente. Não confundir a transação nova validada com cobertura dos pedidos antigos.
- **Parcial:** cadastro mestre único foi preservado; tipo serviço/SKU/código de barras e tela única com abas por módulo não foram implementados nesta etapa.
- **Parcial:** assinatura/quotas funcionam, mas limites de armazenamento e landingPages só estão modelados. O limite técnico anterior de 100 categorias ainda existe. A política comercial para empresas sem contrato/limites da base e a implantação dos contratos existentes precisam ser concluídas antes da ativação global.
- **Parcial:** CUSTOM_RBAC consta no catálogo, mas cargos básicos continuam na base e ainda falta delimitar recursos avançados cobrados. Relatório básico incluído nos planos de entrada precisa ser separado do entitlement REPORTS gerencial.
- **Parcial:** descontos diretos não possuem contadores globais/por empresa; cupons possuem. Faltam revogação futura de uma promoção contratada, comunicação pendente de reajuste, regras completas de desconto por módulo em pacote fechado e política de reposição de ciclos em cancelamento de rascunho.
- **Parcial:** painel global não tem todos os filtros comerciais de empresas, rankings/top módulos/planos, paginação completa da fila no dashboard ou navegação visual de todo histórico. OWNER ainda não tem acesso delegado por permissão específica. Menus filtram permissões na sessão; atualização visual de sessão já aberta após mudança comercial precisa de refinamento, embora o backend negue imediatamente.
- **Parcial:** calendário de trial configurável global com sugestão persistida de 14 dias, aprovação de trial e encerramento dedicado não foram implementados; existe contratação administrativa TRIAL com datas explícitas.
- **Parcial:** exportações comerciais, política completa de correções após pagamento e abstração de gateway ainda não implementadas. Integração futura deve ter adapter de provedor, idempotência de webhook, assinatura de mensagem e reconciliação; nenhuma credencial/gateway foi utilizado.
- **Não executado:** matriz completa de cada módulo isolado e todas as combinações do pedido, carga, recuperação após encerramento real de processo, leitor de tela, backup/restauração, múltiplas instâncias e implantação operacional. Testes aprovados comprovam somente os cenários registrados.
- **Avisos existentes:** SCSS da landing institucional 6,83 kB para orçamento de 6 kB; qrcode CommonJS; Node 25 não LTS; avisos de depreciação Mongoose/Vite. Não foram silenciados como se fossem otimizações resolvidas.

Não ligar a flag em produção como se todos os critérios de conclusão estivessem satisfeitos. Continuar pelas capacidades independentes ausentes e pela matriz de aceite, preservando as implementações já testadas.

## Resultados registrados

| Validação | Estado | Resultado / saída |
|---|---|---|
| Unitários backend | Aprovada | 256/256; 16 arquivos; exit 0; `docs/saas-qa/unit.log` |
| Comercial HTTP/Mongo/Chrome | Aprovada | 32/32 cenários; exit 0; execução `1789736057746-ad3ce8399b` |
| Regressão vitrine/RBAC/autorização | Aprovada | 41/41 cenários; exit 0; execução `1789735220054-5a5d096918` |
| NestJS atual | Aprovada | exit 0; `backend-build.log` |
| Angular atual | Aprovada com avisos | exit 0; `frontend-build.log`; avisos existentes explicitados acima |
| Bundles atuais | Aprovada no escopo heurístico | 35 arquivos; zero achados; `bundle-scan.json` |
| Storage diagnose/dry-run | Aprovada | exit 0; zero índices comerciais ausentes no banco de teste |
| Storage apply idempotente sobre estrutura existente | Aprovada em teste | exit 0; nenhuma escrita de documento, remoção de índice ou acesso operacional |
| Unitários Angular | Não executada | Projeto não possui target unitário configurado; não confundir testes Chrome com esse target |
| Matriz completa de módulos/combinações | Pendente | Somente cenários registrados foram executados |
| Implantação operacional | Não executada | Flag/configuração operacional, índices e registros comerciais não alterados |

A execução comercial final registrou/removou 124 documentos próprios e preservou 8779/8779 anteriores, zero alterados/ausentes. A regressão registrou/removeu 567 próprios e preservou os mesmos 8779 anteriores. Manifests, resultados e screenshots estão nos diretórios das execuções. O teste usa identificadores e segredos aleatórios; não há senhas demonstrativas.

Houve falhas intermediárias corrigidas: import ESM de Connection, tipagem Mongoose, expectativa de login 201 em vez de 200 e execução unitária inicialmente sem a URI exigida. Essa primeira execução foi barrada pela proteção de configuração (226 testes passaram e uma suíte não iniciou); a repetição correta passou 256. Tentativas sandbox de Vitest/Angular deram EPERM e foram repetidas com escalonamento autorizado. Não há falhas finais desses comandos; isso não elimina as pendências de escopo.

## Inventário de arquivos

Criados: `apps/api/src/commerce/{commerce.domain.ts,commerce.domain.spec.ts,commerce.defaults.ts,commerce.schemas.ts,commerce.dto.ts,commerce.service.ts,commerce.module.ts,entitlements.service.ts}`; `apps/api/src/orders/modular-orders.service.ts`; `apps/web/src/app/features/commerce/{commerce-api.service.ts,subscription.component.ts,subscription.component.html,platform-commerce.component.ts,platform-commerce.component.html,commerce.scss}`; `scripts/{commerce-integration.mjs,commerce-storage.mjs}`; esta especificação/handoff e artefatos `docs/saas-qa`/execuções identificadas em `docs/tenancy-qa`.

Alterados: AppModule; TenantAccessModule/Service; AuthUser, AuthService, RolesGuard; enum de movimentos; ProductsService, CategoriesService, LandingService e ImagesService; UsersService; ProductionsService e teste; OrdersModule/Service/Schema; testes de tenancy, membership, security e endpoint-policy; modelos/rotas/shell Angular; POS; painel de empresas; inventário do script catalog-rbac-integration; package.json (atalhos de QA comercial); handoff principal.

Não há repositório Git disponível para produzir diff confiável; a lista foi registrada a partir das operações desta implementação. Artefatos gerados de build não são prova de implantação.
