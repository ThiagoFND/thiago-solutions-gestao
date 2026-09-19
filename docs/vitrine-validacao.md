# Entrega e validação — vitrine e cargos

Data: 17/09/2026; ambiente local `D:\Projetos\salgados-mvp`. Somente o agente principal executou análise, implementação, integração, testes e documentação, sequencialmente. Nenhum agente anterior foi retomado. Não existe repositório Git nesta cópia; o inventário abaixo descreve os arquivos trabalhados, não um diff certificado por Git.

## Estado e decisões

A base já possuía empresas, tenantId derivado da sessão, OWNER/ADMIN operacionais, PLATFORM_ADMIN separado, cookies HttpOnly/CSRF, versionamento de sessões, rate limit, auditoria, financeiro, receitas, insumos, produção e vendas internas. Não havia categorias como entidade, vitrine por empresa nem RBAC personalizado. A leitura histórica foi reaproveitada; não se repetiu a auditoria completa anterior.

Implementados catálogo público projetado por allowlist, configuração isolada por tenant, categorias dinâmicas, produtos generalizados, três fornecimentos e disponibilidade calculada no backend. As rotas públicas novas são exclusivamente GET. A consulta não chama serviços de mutação de vendas. Busca literal, paginação, projeções e consultas em lote evitam consulta por produto. Sem cache compartilhado: alterações de estoque/publicação/suspensão são verificadas a cada consulta.

Modelos novos: `product_categories_v2`, `landing_configs_v2`, `custom_roles_v2`, `catalog_images_v2`. Categoria tem unicidade tenant/nome normalizado, ordens pública/interna independentes, status/publicação/arquivamento, versão e ator. Produto mantém campos antigos para compatibilidade e adiciona referência à categoria, fornecimento, descrições, imagens, publicação, ocultação, destaque e ordens. Não houve alteração em massa nem migração operacional. Produto legado sem versão aceita classificação explícita como versão zero. Arquivamento preserva vínculos.

Cargos personalizados substituem o template operacional; não acumulam permissões antigas. Catálogo central conhecido, subconjunto do ator, proteção de proprietários/plataforma, autoalteração negada, revogação por versão, transação com trava de associação e auditoria antes/depois. OWNER/ADMIN preservam poderes empresariais; PLATFORM_ADMIN continua global; CASHIER, KITCHEN e ACCOUNTANT têm templates compatíveis. Veja a [matriz completa](vitrine-permissoes.md).

Novos endpoints: categorias (listar/criar/editar/produtos/mover/ordenar), landing (ler/configurar/publicar/despublicar/prévia), catálogo público por slug, imagens (upload/privada/pública) e cargos (catálogo/listar/criar/editar/duplicar/atribuir/usuários/histórico). Os endpoints empresariais anteriores receberam políticas granulares; globais e sessão própria mantiveram políticas especiais. Total inventariado: **99 handlers**.

Índices definidos nos schemas: slug único global e configuração única por tenant; categoria tenant/nome único e ordens/status; produto tenant/categoria/publicação/ordens; cargo tenant/nome único; usuários tenant/customRoleId/status; imagens tenant/ID. Provisionamento aditivo de teste passou pelo harness. O CLI separado foi atualizado para conhecer os quatro modelos novos; sua sintaxe foi verificada, sem executá-lo nem provisionar ambiente operacional.

## Validação atual

| Execução | Resultado | Evidência |
|---|---|---|
| `npm test --prefix apps/api -- --no-file-parallelism` | Aprovado: 211 testes, 15 arquivos, zero falhas | [unit-final.log](vitrine-qa/unit-final.log) |
| `npm run build` | Aprovado: Angular, cópia da SPA e NestJS; exit 0 | [build-final.log](vitrine-qa/build-final.log) |
| `node scripts/catalog-rbac-integration.mjs`, `TENANCY_BROWSER=true` | Aprovado: 35 cenários, zero falhas; HTTP/Mongo e Chrome real | [integration-4.log](vitrine-qa/integration-4.log) |
| Inventário e negativas de autorização | Aprovado: 99 handlers; sem autenticação/sem permissão conforme política | [endpoint-matrix.json](tenancy-qa/1789696522866-c0f6966824/endpoint-matrix.json) |
| Scan dos bundles atuais | Aprovado: 31 arquivos JavaScript, zero achados nos padrões inspecionados | [bundle-scan.json](vitrine-qa/bundle-scan.json) |
| `node --check scripts/tenancy-storage.mjs` e script de integração | Aprovado: exit 0 | Comandos executados após inclusão dos modelos no provisionador |
| Unitários Angular | Não executado: projeto sem target unitário configurado | Cobertura de frontend feita em navegador |
| Suítes históricas completas de tenancy, operacional e migração | Não executadas nesta entrega | Não reutilizadas como comprovação atual |
| Implantação, bootstrap e banco operacional | Não executados | Fora da autorização de QA |

Os 35 são cenários agregados (25 HTTP/dados/segurança, 8 navegador, limpeza e preservação), não 35 assertions individuais. Não somar subtestes focados aos 211. A execução atual é `1789696522866-c0f6966824`; resultados individuais em [catalog-results.json](tenancy-qa/1789696522866-c0f6966824/catalog-results.json).

Cobertura real: slug/duplicidade/publicação/empresa pendente e suspensa; três fornecimentos, saldo/reposição/produção, ocultação manual, ordenação e arquivamento; categorias/produtos/imagens entre tenants; DTO/mass assignment/ObjectId/XSS; públicos sem campos internos e sem compra; vendas internas e snapshots; cargos/subconjunto/desconhecidas/PLATFORM_ADMIN/self/OWNER/revogação/histórico; cookies/CSRF/CORS/headers/rate limit; receipt/ficha/produção e rollback injetado; disputa simultânea pelo último OWNER. As requisições simultâneas desse último teste exercitam concorrência da aplicação, não execução de agentes em paralelo.

Navegador: leitura pública, pesquisa, ausência de compra, criação de categoria/produto com botão, QR/link/prévia, criação e atribuição real de cargo, navegação restrita, falha/retry e texto malicioso sem execução. Telas públicas e quatro administrativas verificadas em 320, 768 e 1440px. Inspeção visual adicional dos screenshots público mobile/desktop e Produtos desktop: legíveis, composição adaptada e formulário com salvar visível. Screenshots estão no diretório da execução. QR foi gerado localmente e exibido; não houve decodificação independente por scanner físico.

## Preservação dos dados e tentativas anteriores

A URI foi conferida programaticamente antes de iniciar aplicação e escrever: exclusivamente `mongodb://127.0.0.1:27017/salgados_financeiro_test`. Credenciais de fixtures aleatórias, sem senhas demonstrativas. Na rodada final: **8.692 documentos anteriores intactos, zero alterados/ausentes; 443 documentos próprios registrados e removidos individualmente**. Manifestos: [created-documents.json](tenancy-qa/1789696522866-c0f6966824/created-documents.json), [cleanup.json](tenancy-qa/1789696522866-c0f6966824/cleanup.json) e [preservation.json](tenancy-qa/1789696522866-c0f6966824/preservation.json). Nenhum banco/coleção foi apagado ou reinicializado.

Falhas históricas desta implementação foram preservadas:

- Primeiros builds: tipos nullable/Symbol corrigidos; primeiros unitários: expectativas antigas de DTO e mocks de permissões corrigidos. Não são resultados aprovados anteriores à correção.
- Integração 1 (`1789695400430-fcf0aaf5ac`): 20 aprovados, uma expectativa incorreta de status corrigida; 8.688 anteriores intactos, 120 próprios limpos.
- Integração 2 (`1789695639282-ccc1e99cd1`): 26 aprovados, duas falhas (seletor e preservação). Um dos 8.689 documentos anteriores mudou e surgiram eventos globais de login/logout fora do registro de criações do processo de QA. Inspeção somente leitura encontrou atividade também após fechamento da API de QA, compatível com outro fluxo usando o banco compartilhado. Não se atribui autoria com certeza nem se declara essa rodada preservada. Dados externos não foram revertidos/removidos; serviços externos não foram interrompidos. O novo harness passou a usar a porta 4337 e a registrar diferenças por ID.
- Integração 3 (`1789695924303-4dd4b2249c`): 29 aprovados, uma falha revelou acento corrompido em label de produto; texto corrigido em UTF-8. Documentos anteriores preservados.
- Integração 4: 35 aprovados, zero falhas, preservação integral descrita acima. Todas as aplicações/browser abertos pelo harness foram fechados.

## Limitações e pendências reais

- Não declarar todo o escopo sem pendências. A vitrine, categorias, fornecimentos, RBAC, autorização e seus fluxos administrativos estão implementados e validados localmente; implantação operacional não foi feita.
- Metadados de compartilhamento são atualizados no Angular. Renderização no servidor/prerender para robôs sociais sem JavaScript não foi implementada.
- Permissões previstas para desconto, estorno, exportações gerais, inventário e cancelamento/edição de produção confirmada não criam essas operações, ausentes na base. Não são funcionalidades entregues; `producao.editar` permite ficha técnica.
- Lista administrativa de usuários/histórico de um cargo mostra os primeiros 100; endpoints possuem paginação, mas controles adicionais de paginação nessa tela permanecem pendentes. Categorias limitadas a 100 por empresa; produtos públicos usam páginas de 24, máximo 100 por consulta; imagens até 500 por empresa e 2 MiB por arquivo.
- Upload valida assinatura MIME e restringe PNG/JPEG/WEBP, mas não inclui antivírus ou reencodificação completa. Imagens de produtos publicados podem continuar acessíveis diretamente quando apenas o saldo zero os oculta da listagem; ocultação manual, despublicação e suspensão bloqueiam a referência pública. Não usar imagens de catálogo para conteúdo privado.
- QR não foi lido por dispositivo físico; acessibilidade não recebeu auditoria especializada com leitor de tela; não houve carga, múltiplos servidores, HTTPS real ou infraestrutura de produção. Scan de bundles é heurístico, não prova universal de ausência de segredos.
- Build mantém avisos de SCSS: apresentação inicial 6,83 kB (831 bytes sobre orçamento), catálogo público 6,05 kB (48 bytes sobre orçamento), e otimização CommonJS do `qrcode`. Nenhum falhou o build.
- Scripts históricos de QA ainda contêm fixtures no contrato antigo de produto e precisam atualização antes de serem reexecutados. Não confundir a nova regressão direcionada com execução de todas as suítes históricas.
- Limitação preexistente de reservas/compensação de vendas e produção sem ficha frente a crash de processo não foi reescrita. Fluxo de ficha/insumos transacional e rollback foram exercitados.

## Arquivos e continuidade

Criados no backend: `auth/permissions.ts`, `auth/permissions.spec.ts`; `roles/custom-role.schema.ts`, `roles.dto.ts`, `roles.service.ts`, `roles.module.ts`; `catalog/category.schema.ts`, `catalog.dto.ts`, `categories.service.ts`, `categories.controller.ts`, `availability.ts`, `availability.spec.ts`, `landing.schema.ts`, `landing.dto.ts`, `landing.service.ts`, `catalog.module.ts`, `images.module.ts`, `image-references.ts` (todos sob `apps/api/src`).

Alterados no backend: AppModule; auth (service/guard), AuthUser/enums; TenantAccess service/module; schemas e serviços de usuários/produtos/vendas; DTO de produto; projeção de membros da tenancy; auditoria/schema/service; security.guard/exception filter; controllers de produtos, produção, pedidos, relatórios, inventário, usuários, financeiro, fiscal e anexos; testes de contrato/negócio/política/membership. Os caminhos exatos dos controllers e suas políticas estão no inventário de endpoints e na matriz.

Criados no frontend: diretório `apps/web/src/app/features/catalog/` com CatalogApi, PublicCatalog, Categories, LandingConfig, Roles, ImageUpload, templates e estilos; `apps/web/src/app/core/permission.directive.ts`. Alterados: app.routes, core auth/api/models/guards/polling; shell; produtos TS/HTML; POS; produção; usuários; financeiro e inventário; `apps/web/package.json` e lock para QR local.

Scripts criados: `scripts/catalog-rbac-integration.mjs`, `scripts/catalog-bundle-check.mjs`. Alterados: `scripts/tenancy-qa-harness.mjs`, `scripts/tenancy-storage.mjs`, `package.json` (alias `test:catalog`). Documentos criados: `vitrine-rbac-spec.md`, `vitrine-permissoes.md`, `vitrine-manual.md`, este relatório e evidências em `vitrine-qa/` e nas quatro execuções `tenancy-qa/`. Atualizados README e handoff principal. Artefatos compilados Angular e API foram regenerados pelo build.

Leitura de base: AGENTS, security-handoff/backend/permissions/mongodb, users-tenancy-spec/handoff, documentos financeiros, evolucao-operacional-contrato e relatório mais recente. Inspeção técnica: controllers/guards, serviços de tenant/usuário/produto/venda/financeiro, schemas, frontend/rotas/menus/formulários e scripts de QA. Não repetir essa auditoria na continuidade sem mudança que a justifique.

Próxima continuidade: paginação administrativa restante, metadados renderizados no servidor se compartilhamento sem JS for exigido, atualização dos fixtures históricos e redução dos avisos de build. Não executar migração ou provisionamento operacional sem autorização específica. [Manual com comandos e fluxos](vitrine-manual.md).
