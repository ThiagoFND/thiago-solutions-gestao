# Matriz de autorização da vitrine e gestão

Contrato implementado e validado na execução `1789696522866-c0f6966824`. Todos caminhos têm prefixo /api. Ausência de sessão: 401; sessão sem permissão: 403; recurso de outro tenant: 404. Todas mutações exigem Origin/CSRF. Permissões separadas por `+` são cumulativas. Plataforma não recebe permissões empresariais. O inventário exato dos 99 handlers, extraído do build atual e exercitado via HTTP, está em [endpoint-matrix.json](tenancy-qa/1789696522866-c0f6966824/endpoint-matrix.json).

| Método | Caminho | Política |
|---|---|---|
| GET | /auth/csrf | Público, nonce limitado |
| POST | /auth/login | Público, credenciais empresariais |
| POST | /auth/platform-login | Público, credenciais globais |
| POST | /auth/onboarding | Público, validação e limite |
| POST | /auth/company-lookup | Público, resposta mínima |
| POST | /auth/access-requests | Público, solicitação pendente |
| GET | /auth/me | Sessão própria |
| GET | /auth/request-status | Sessão empresarial própria |
| POST | /auth/logout | Sessão própria |
| GET | /users/me/profile | Sessão própria |
| PATCH | /users/me/profile | Negado explicitamente |
| GET | /users | usuarios.visualizar |
| GET | /users/requests | usuarios.visualizar |
| GET | /users/pending-count | usuarios.visualizar |
| GET | /users/:id | usuarios.visualizar |
| POST | /users/:id/approve | usuarios.aprovar + cargos.atribuir + subconjunto |
| POST | /users/:id/reject | usuarios.aprovar |
| PATCH | /users/:id/role | usuarios.alterar_cargo + cargos.atribuir + subconjunto |
| PATCH | /users/:id/status | usuarios.visualizar + usuarios.ativar ou usuarios.inativar conforme payload |
| GET | /platform/tenants | PLATFORM_ADMIN global |
| GET | /platform/tenants/:id | PLATFORM_ADMIN global |
| GET | /platform/tenants/:id/history | PLATFORM_ADMIN global |
| POST | /platform/tenants/:id/approve | PLATFORM_ADMIN global |
| POST | /platform/tenants/:id/reject | PLATFORM_ADMIN global |
| POST | /platform/tenants/:id/suspend | PLATFORM_ADMIN global |
| POST | /platform/tenants/:id/reactivate | PLATFORM_ADMIN global |
| GET | /products | produtos.visualizar; projeção por capacidade |
| POST | /products | produtos.criar; publicar/ordenar quando aplicável |
| PATCH | /products/:id | produtos.editar; publicar/ordenar/arquivar quando aplicável |
| POST | /products/:id/purchases | estoque.movimentar |
| GET | /productions/today | producao.visualizar |
| POST | /productions | producao.registrar |
| GET | /orders | vendas.visualizar; escopo próprio para não proprietários |
| GET | /orders/:id | vendas.visualizar; escopo próprio |
| POST | /orders | vendas.criar |
| PATCH | /orders/:id | vendas.editar |
| POST | /orders/:id/finalize | vendas.finalizar |
| POST | /orders/:id/cancel | vendas.cancelar |
| GET | /reports/daily | relatorios.visualizar |
| GET | /reports/overview | relatorios.visualizar + financeiro.visualizar |
| GET | /inventory/ingredients | estoque.visualizar |
| POST | /inventory/ingredients | estoque.movimentar |
| GET | /inventory/purchases | estoque.visualizar + financeiro.visualizar |
| POST | /inventory/receipts | estoque.movimentar + financeiro.visualizar |
| GET | /inventory/recipes/:productId | producao.visualizar |
| GET | /inventory/recipes/:productId/cost | producao.visualizar |
| PUT | /inventory/recipes/:productId | producao.editar |
| GET | /finance/products | financeiro.visualizar |
| GET | /finance/entries | financeiro.visualizar |
| GET | /finance/entries/:id | financeiro.visualizar |
| POST | /finance/entries | financeiro.criar |
| PATCH | /finance/entries/:id | financeiro.editar |
| POST | /finance/entries/:id/payment | financeiro.pagar |
| PATCH | /finance/entries/:id/payment | financeiro.pagar + financeiro.editar |
| POST | /finance/entries/:id/cancel | financeiro.cancelar |
| GET | /finance/entries/:id/history | financeiro.visualizar |
| GET | /finance/summary | financeiro.visualizar |
| GET | /finance/reports/monthly | financeiro.visualizar |
| GET | /finance/categories | financeiro.visualizar |
| POST | /finance/categories | financeiro.criar |
| PATCH | /finance/categories/:id | financeiro.editar |
| POST | /finance/categories/:id/deactivate | financeiro.editar |
| GET | /finance/recurrences | financeiro.visualizar |
| GET | /finance/recurrences/:id | financeiro.visualizar |
| POST | /finance/recurrences | financeiro.criar |
| PATCH | /finance/recurrences/:id | financeiro.editar |
| POST | /finance/recurrences/:id/generate | financeiro.criar |
| POST | /finance/recurrences/:id/deactivate | financeiro.editar |
| GET | /finance/sales | vendas_fiscais.visualizar |
| GET | /finance/sales/:id | vendas_fiscais.visualizar |
| GET | /finance/sales-export | vendas_fiscais.exportar |
| GET | /finance/entries/:id/attachments | financeiro.visualizar |
| POST | /finance/entries/:id/attachments | financeiro.editar |
| GET | /finance/entries/:id/attachments/:attachmentId/download | financeiro.visualizar |
| POST | /finance/entries/:id/attachments/:attachmentId/remove | financeiro.editar |
| GET | /audit | auditoria.visualizar |
| GET | /categories | categorias.visualizar |
| POST | /categories | categorias.criar |
| PATCH | /categories/:id | categorias.editar; publicar/ordenar/arquivar por campo |
| GET | /categories/:id/products | categorias.visualizar + produtos.visualizar |
| POST | /categories/:id/move-products | categorias.editar + produtos.editar |
| POST | /categories/:id/order | categorias.ordenar; versão e direção validadas |
| POST | /catalog-images | empresa.configurar; MIME real, 2 MiB, tenant da sessão |
| GET | /catalog-images/:id | Sessão empresarial ativa; serviço exige mesmo tenant |
| GET | /public/images/:id | Público somente leitura; empresa ativa, página publicada e referência pública |
| GET | /landing | landing_page.visualizar |
| PUT | /landing | landing_page.configurar |
| POST | /landing/publish | landing_page.publicar |
| POST | /landing/unpublish | landing_page.despublicar |
| GET | /landing/preview | landing_page.visualizar |
| GET | /public/companies/:slug | Público somente leitura, empresa ativa/página publicada |
| GET | /roles/permissions | cargos.visualizar; catálogo limitado às capacidades do ator |
| GET | /roles | cargos.visualizar |
| POST | /roles | cargos.criar + subconjunto |
| PATCH | /roles/:id | cargos.editar; cargos.arquivar para arquivamento |
| POST | /roles/:id/duplicate | cargos.criar + subconjunto |
| GET | /roles/:id/users | cargos.visualizar + usuarios.visualizar |
| GET | /roles/:id/history | cargos.visualizar |
| POST | /roles/:id/assign/:userId | cargos.atribuir + usuarios.alterar_cargo + subconjunto |

As permissões para funções ainda inexistentes (estorno, desconto, exportação geral, inventário e cancelamento de produção) estão catalogadas, mas não implementam essas operações. `producao.editar` protege a ficha técnica existente, não a edição de uma produção confirmada. Não há endpoint público para criar venda. A presença de uma permissão no catálogo não cria um endpoint.

Templates: OWNER/ADMIN todas empresariais; CASHIER leitura de produtos/categorias e vendas próprias; KITCHEN produtos/categorias, produção e estoque de insumos em leitura; ACCOUNTANT financeiro e dados fiscais. Cargo personalizado substitui template operacional. PLATFORM_ADMIN somente rotas globais e sessão própria. OWNER/ADMIN não podem ser promovidos/rebaixados pelo fluxo de cargos personalizados; proteção existente do último proprietário permanece.

Complemento vigente de 18/09: aprovar e alterar cargo por `/users/:id/approve` e `/users/:id/role` exigem `customRoleId`; `role` e atribuições de perfis fixos são recusados. Mesmas permissões da matriz, com revalidação transacional do tenant/estado/subconjunto e proteção de proprietário. Novos vínculos usam MEMBER sem capacidades implícitas; templates anteriores servem somente aos registros históricos ainda não reatribuídos. A tela Usuários consulta `/roles` usando `cargos.visualizar`; não concede essa permissão automaticamente. Evidências em [usuarios-cargos-personalizados.md](usuarios-cargos-personalizados.md).
