## Portfólio profissional em andamento — 18/09/2026

Estado atual, arquivos, novas rotas, validações e pendências: [portfolio-profissional-handoff.md](portfolio-profissional-handoff.md). Despesas/Financeiro/Contábil separados; site e captação, jornada inicial e devolução com inspeção implementados com limites documentados. O pedido amplo de novos módulos **não está concluído**. Dados operacionais não foram alterados. Os registros históricos abaixo descrevem etapas anteriores.

## Proposta com comparacao de acessos - 18/09/2026

Calcular proposta agora mostra permissoes atuais e previstas, agrupadas por area, com novas/mantidas/retiradas. Calculo no backend sem ativar contrato ou alterar cargos. 266 unitarios e 35 cenarios de integracao/navegador aprovados; builds Nest/Angular aprovados. Detalhes: [proposta-comparacao-acessos.md](proposta-comparacao-acessos.md).

## Atualizacao: assinatura obrigatoria (18/09/2026)

A flag COMMERCIAL_ENTITLEMENTS_ENABLED nao libera mais acesso sem contrato. Sem assinatura valida, inclusive a base empresarial fica bloqueada; login/perfil e regularizacao da assinatura permanecem acessiveis. Esta decisao substitui a compatibilidade de rollout descrita historicamente abaixo. Base local consultada: 69 empresas, zero contratos e zero ofertas; nenhum contrato apagado. Validacao atual: 261 unitarios e 33 cenarios de integracao/navegador aprovados; builds Nest/Angular aprovados. Procedimento de primeira contratacao, arquivos e limitacoes: [assinatura-acesso-obrigatorio.md](assinatura-acesso-obrigatorio.md).

## 18/09/2026 - Painel global unificado

Aprovacoes e gestao comercial reunidas na mesma pagina administrativa, com layout responsivo e contexto de empresa. Rotas antigas preservadas. Build Angular aprovado; 33 cenarios de integracao/navegador aprovados, zero falhos na execucao final 1789739539197-2fa11b64c3. Banco operacional intocado. Detalhes, arquivos, comandos e limitacoes: [plataforma-painel-unificado.md](plataforma-painel-unificado.md). Esta entrega de interface nao encerra as pendencias SaaS documentadas abaixo.

# Passagem oficial — usuários e multitenancy

## Mais recente — núcleo comercial SaaS, 18/09/2026 (escopo parcial)

Implementados catálogo/preços versionados, planos/personalizado, calculadora/descontos/cupons, assinaturas/agendamento, quotas de usuários/produtos/categorias, cobranças manuais, solicitações, telas globais/OWNER e entitlements. Novas vendas comerciais usam transação com baixa na finalização; SALES e PRODUCTION isolados não movimentam estoque. Vitrine e imagens respeitam contratação e estoque. **Não ativado no banco/ambiente operacional:** `COMMERCIAL_ENTITLEMENTS_ENABLED` permanece uma ativação explícita; não há contratos ou seeds operacionais criados.

Validação atual: **256 unitários, 32 cenários comerciais HTTP/Mongo/Chrome e 41 cenários de regressão aprovados, zero falhas finais**. Builds NestJS/Angular aprovados; 35 bundles sem achados heurísticos. Execuções comerciais `1789736057746-ad3ce8399b` e regressão `1789735220054-5a5d096918` preservaram todos os 8779 documentos anteriores do banco autorizado. Inventário atualizado: 125 handlers protegidos conforme suas políticas.

**Não considerar o pedido integralmente concluído.** Faltam capacidades independentes de Compras/Documentos/Financeiro completo, algumas integrações, estorno, abas do cadastro mestre, limites adicionais e partes de gestão/comercialização. Antes de continuar, ler [especificação SaaS](saas-planos-assinaturas-spec.md), [handoff detalhado, endpoints, uso e pendências](saas-planos-assinaturas-handoff.md) e [evidências](saas-qa/results.json). Não repetir a base já validada nem ligar a flag global sem completar o procedimento de implantação e os critérios pendentes. Nenhum agente antigo foi retomado; a tentativa de adicionar arquiteto foi recusada por limite de threads, e o principal executou todo o trabalho.

## Último requisito aplicado — cargos exclusivamente da empresa

Removidos perfis fixos das opções. DTOs HTTP de aprovação/alteração agora exigem customRoleId e recusam role. MEMBER representa vínculo técnico sem permissões; novos vínculos e reatribuições usam somente capacidades do cargo da empresa. Não houve exclusão/migração no banco nem conflito contábil que a justificasse; registros anteriores permanecem até reatribuição explícita pelo proprietário. OWNER/plataforma protegidos. Build aprovado, 217 unitários e 41 cenários HTTP/Chrome aprovados (`1789731965906-e30596659c`), zero falhas, 32 bundles sem achados heurísticos. [Contrato vigente e evidências](usuarios-cargos-personalizados.md). O grupo de compatibilidade citado na entrega anterior abaixo foi removido por este pedido.

## Mais recente — galeria e cargos no seletor de Usuários, 18/09/2026

Somente principal, sequencial. Galeria compacta implementada com miniaturas, setas, teclado e gesto horizontal; removidas imagens adicionais empilhadas. A vitrine real thiagoteste retornou 404 na tentativa somente leitura; não foi republicada pelo agente. [Galeria e validação](vitrine-galeria.md).

Corrigido Usuários: lista cargos ativos da empresa, preserva perfis legados em grupo separado e aprova pendente diretamente com customRoleId em transação, sem concessão provisória de poderes. Backend protege tenant, cargo desativado, subconjunto, proprietário e self; revoga sessões e registra histórico. Nenhuma migração. [Contrato, arquivos e instruções](usuarios-cargos-personalizados.md).

Build atual aprovado, 211 unitários/15 arquivos aprovados, 41 cenários HTTP/Chrome aprovados/zero falhas (`1789731440207-4fb4c87cef`), 32 bundles sem achados heurísticos. Todas as escritas de QA na URI literal autorizada, com preservação dos anteriores e limpeza somente dos registros próprios por ID. Logs e manifestos nos documentos vinculados. Não declarar resolvidas as outras pendências da lista ampla (SSR, paginação de cargos, testes históricos, estorno/desconto, crash safety, carga ou infraestrutura).

## Retomada — salvar contatos, conteúdo e compartilhamento da vitrine, 18/09/2026

Somente principal. Relato de campos não salvos: baseline com Chrome confirmou que todos persistem quando válidos (38 cenários aprovados). Corrigida UX que escondia o motivo da validação e permitia publicar/despublicar descartando edição pendente. Agora há erro específico próximo do botão, salvar junto à publicação, indicador de edição e proteção contra descarte. Alterados LandingConfig TS/HTML, admin.scss e regressão. API/schema/cadastro do usuário intocados. Build aprovado; rodada final `1789730344403-b34f9d2cf1` com 39 cenários aprovados/zero falhas, preservação e limpeza própria registradas. [Diagnóstico, comandos e limites](vitrine-salvamento-configuracao.md). Não alegar falha de persistência backend reproduzida nem todas as pendências anteriores concluídas.

## Correção mais recente — imagens e âncoras da vitrine, 18/09/2026

Complemento com URL do usuário: `localhost:4200/empresa/thiagoteste` carregava imagens relativas na porta 4200 (HTML), enquanto API/PNG ficam na 3000. Corrigido resolvedor por environment.apiUrl e uso de CORS com credenciais somente para assets locais, inclusive prévia privada do produto. Verificação pública estritamente somente leitura no endereço informado aprovou cinco imagens e três links, sem modificar cadastro nem iniciar API. Build atual aprovado; seis assertions de URL; regressão QA `1789729810892-e9b27102aa` com 37 aprovados/zero falhas e preservação de anteriores; 32 bundles sem achados heurísticos. Detalhes no relatório abaixo. Logo e capa dessa empresa estão vazios, não são uploads perdidos.

Somente principal. Inspecionados `image/imageteste1.png`, `imageteste2.png`, `imageteste3.png`. Corrigidos links que voltavam à raiz por causa do base href, fotos ausentes nos destaques, galeria dependente de descrição e sobreposição da foto ao texto/ações do produto. Imagens que falham passam a ter indicação. Alterações somente frontend e regressão; sem implantação nem acesso operacional. Manual corrigido para a variável efetiva `CATALOG_BROWSER=true`.

Build atual aprovado; 37 cenários HTTP/Chrome aprovados, zero falhas, run `1789729475901-bda4b196ba`; 8.731 documentos anteriores intactos, 445 próprios registrados/limpos; 31 bundles sem achados heurísticos. Rodada inicial revelou a sobreposição e teve uma falha, preservada no relatório. Diagnóstico específico das fotos do servidor publicado depende do endereço público solicitado. [Contrato, arquivos, comandos e limites](vitrine-correcao-imagens-links.md). Pendências da entrega anterior não foram declaradas encerradas.

## Retomada mais recente — vitrine e RBAC, 17/09/2026

Instrução atual do usuário: **somente agente principal, sequencial, sem criar ou retomar agentes**. Isso substitui a ordem histórica de especialistas registrada abaixo. Esta evolução implementou vitrine por slug somente leitura, categorias dinâmicas, produtos com três fornecimentos e disponibilidade efetiva, upload de imagens, configuração/prévia/publicação/link/QR, cargos personalizados e autorização granular nos 99 handlers atuais. Nenhuma migração, seed ou escrita operacional foi executada. Compatibilidade dos perfis e produtos antigos mantida sem publicação automática.

Evidência atual: 211 unitários/15 arquivos aprovados; 35 cenários HTTP/Mongo/Chrome aprovados, zero falhas; Angular e NestJS compilados com sucesso; 31 bundles inspecionados sem achados heurísticos. Rodada `1789696522866-c0f6966824`: 8.692 documentos anteriores intactos; 443 próprios registrados e removidos por ID. Toda aplicação de QA usou a URI literal autorizada. Último OWNER concorrente, revogação, isolamento, ficha/insumos/produção com rollback e telas em 320/768/1440 foram exercitados. A porta de QA desta suíte é 4337.

Detalhes de arquivos, decisões, comandos, falhas anteriores e limitações: [relatório de entrega](vitrine-validacao.md). Contrato: [especificação](vitrine-rbac-spec.md). Endpoint por endpoint: [matriz](vitrine-permissoes.md). Execução e operação: [manual](vitrine-manual.md). Não repetir a auditoria histórica nem tratar esta entrega como implantação operacional.

Pendências: paginação além dos 100 registros na interface de membros/histórico de cargos, metadados sociais renderizados no servidor, adaptação de fixtures antigos de QA e avisos de tamanho/CommonJS. Operações inexistentes como estorno/desconto/inventário possuem permissões catalogadas, mas não foram implementadas. Unitários Angular não possuem target; houve teste em Chrome real. Rodada intermediária detectou alteração externa em documento preexistente: foi registrada sem restaurar ou apagar dados alheios; a rodada final preservou integralmente o snapshot. Não ocultar esse histórico.

Este arquivo é o ponto único de passagem sequencial. Ler antes de trabalhar; acrescentar achados/decisões/arquivos/testes/resultados/riscos/instruções, sem repetir a arquitetura ou auditoria anterior. Ordem exclusiva: arquiteto → banco_mongodb → backend_nestjs → frontend_angular → qa_integracao → principal. Encerrar especialista antes de iniciar o seguinte. Documento técnico: [users-tenancy-spec.md](users-tenancy-spec.md).

## 1. Arquiteto — concluído em 14/09/2026

Escopo concluído: especificação técnica e este handoff; nenhuma aplicação alterada. Achado de formato: arquivo `.docx` (16.886 bytes) é texto UTF-8 com pedido completo e adendo PLATFORM_ADMIN. Tentativa de ZipFile.OpenRead falhou com ausência do diretório central; leitura integral por Get-Content UTF8 sucedeu. Não há bloqueio de conteúdo.

Leituras: AGENTS.md; .codex/agents/arquiteto.toml; docs/financeiro-contrato.md; docs/security-handoff.md (especialmente seções5–7 finais); docs/security-backend.md; docs/security-permissions.md; especificacao_requisitos_usuarios.docx; common/enums.ts e auth-user.ts; users/user.schema.ts; orders/counter.schema.ts; auth/jwt-auth.guard.ts,auth.service.ts,roles.guard.ts; reports/reports.service.ts; inventário rg --files API/web/agentes e busca index/unique/collection em schemas. Saída inicial extensa foi truncada/encoding incorreto; relidas conclusões e contratos relevantes em UTF8. Não foi repetida auditoria de segurança nem executada validação antiga.

Evidências que justificam mudanças: User email tem unique global; Order number unique global; Counter key unique global; categoria índices globais type/normalizedName e seedKey. RolesGuard faz bypass ADMIN universal, que deve desaparecer para proteger plataforma. AuthUser atual só contém sub/name/email/role; JWT guard só verifica active/sessionVersion; ReportsService.daily consulta pedidos e produções sem tenant. Os40 handlers da matriz anterior são base para expansão, não contagem final nova. Segurança anterior já possui47 unitários/182 e2e/27 browser aprovados; são evidências antigas, não testes desta etapa.

Decisões fechadas para não reanalisar:

- Adendo prevalece: empresa e OWNER PENDING, aprovação global atômica; plataforma tenantId null sem acesso empresarial.
- Novas coleções v2 explicitamente nomeadas na especificação permitem índices compostos sem drop e preservam originais. Aplicação não usa fallback legado. Migração futura copia com mesmos IDs e manifesto, sem sobrescrever existentes. Guard de implantação impede ativação silenciosa em instalação antiga.
- Transações reais obrigatórias para onboarding/decisões globais/membros. Principal concordou: não reconfigurar daemon; standalone503 antes de escrita, QA positivo transacional bloqueado se ambiente não suportar. Não substituir atomicidade por compensação de delete ou mocks.
- Tenant.membershipVersion serializa decisões de membros e contagem de último OWNER. Tenant.sessionVersion invalida sessões em massa na suspensão e impede ressurreição na reativação.
- ADMIN preservado apenas como OWNER empresarial após migração explícita. PENDING funcionário tem role null; não adivinhar role pelo cargo. Endpoints nunca promovem OWNER/ADMIN/PLATFORM_ADMIN.
- Login empresarial exige CNPJ/email/senha; plataforma endpoint separado. CPF AES-GCM+HMAC chaves distintas em env; respostas apenas máscara. ACCOUNTANT usa catálogo financeiro mínimo `/finance/products`, não produtos operacionais.
- Polling15s autenticado reaproveitado; tela de espera sem shell operacional. Menus globais e empresariais separados.

Arquivos criados: docs/users-tenancy-spec.md; docs/users-tenancy-handoff.md. Nenhum outro arquivo criado/alterado pelo arquiteto. Comandos: Get-Content (contratos/fonte/UTF8), rg --files, rg -n índices, Get-Item DOCX, tentativa ZipFile e fallback texto; apply_patch dos dois documentos. Resultados: leituras concluídas com limitação de saída inicial corrigida, DOCX falso identificado e conteúdo recuperado. Testes0, builds0, aplicações0, conexões Mongo0, gravações Mongo0. Especificação não equivale implementação.

### Próximo: banco_mongodb

Ler especificação uma vez e implementar SOMENTE todos schemas empresariais/Tenant/índices, enums de estado/role necessários, helper CPF/documentos, scripts diagnóstico/migração dry-run e documentação de implantação. Ownership ampliado pelo pedido atual para schemas de toda API, não só financeiro. Pode editar common/enums.ts para roles/status; backend assume depois. Não alterar serviços/controllers/DTOs/frontend. Não conectar operacional nem reconfigurar Mongo, não iniciar apps/testes neste passo sem necessidade real. Validar com unitários de schemas/helpers justificados e URI teste configurada mesmo sem conexão.

Use nomes coleções/campos/exports da especificação; deixe claro paths de helpers e assinaturas para backend. Scripts não apagam, não sobrescrevem registros, não executam migração automática; dry-run padrão e comando de aplicação exige autorização futura. Preservar coleções/índices antigos via v2. Documentar provisionamento aditivo e guard de implantação, transações obrigatórias, variáveis CPF sem valores. Acrescentar seção2 com arquivos e contagens de testes, riscos e contrato final antes de encerrar.

### Depois: backend_nestjs

Consumir entrega Mongo e implementar restante API/serviços/DTOs/guard/session/tenant/plataforma/HTTP/CLI primeiro admin, sem reauditar segurança antiga. Remover bypass ADMIN global e caminhos antigos de atribuição irrestrita de usuário. Todas consultas e referências recebem tenant do usuário; auditar agregações/contador/financeiro e disponibilidade produtos. Registrar contrato final endpoints/retornos, limites e comandos. Ajuste de schema após etapa Mongo exige transferência pelo principal, nunca edição concorrente.

### Depois: frontend_angular

Ler contrato FINAL backend deste handoff; ownership somente apps/web. Implementar fluxos seção7, adaptação envelope usuários, CNPJ login, estados sessão e plataforma, polling e catálogo financeiro mínimo. Registrar build e limites; não alegar navegação real sem browser.

### Depois: qa_integracao e principal

Ler todas entregas, implementar/executar plano seção9 com URI exata antes de importar aplicação; snapshots e fixtures por execução, índices aditivos, nada de reset ou alteração de contador legado. Constatar capacidade transacional sem reconfigurar servidor; testes bloqueados explicitamente distintos de pass/skip. QA só scripts/testes/docs, reporta bugs ao principal para coordenação sequencial. Principal integra e resolve ajustes, executa verificações necessárias sem repetir builds/testes inalterados já comprovados, documenta resultados completos e autorizações ainda necessárias (migração/provisionamento/admin operacional), sem declarar produção pronta.

## 2. banco_mongodb — concluído em 14/09/2026

### Achados e decisões implementadas

Lidos handoff/spec oficiais, AGENTS.md, configuração banco_mongodb, contrato financeiro antigo e schemas existentes. Arquitetura não repetida. Ownership ampliado pelo principal para todos schemas, enums comuns, helpers de documentos/CPF e ferramentas de persistência. Coleções v2 implementadas literalmente conforme seção3 da spec; modelos/class names mantidos. `tenantId` obrigatório/imutável nos oito modelos comerciais; User aceita null exclusivamente plataforma. Tenant/status/roles separados, ADMIN preservado. Todos índices comerciais começam por tenantId; únicos email/CPF/pedido/contador/categoria/seed/ocorrência compostos. `autoIndex:false` e `autoCreate:false`, sem TTL/drop/syncIndexes. Backend ainda precisa consumir esses contratos; aplicação completa não validada nesta etapa.

CPF: validação de ambos dígitos, criptografia AES-256-GCM com IV aleatório12bytes/tag16bytes, AAD com tenant, HMAC-SHA256 com chave independente, envelope versão1; campos internos select:false e proteção toJSON adicional. Variáveis obrigatórias CPF_ENCRYPTION_KEY/CPF_HASH_KEY base64 de32bytes, sem valores no código/docs. Função decrypt existe só como helper; não há endpoint que revele CPF. Razões de decisões globais obrigatórias no schema quando rejeita/suspende/reativa.

Migração/diagnóstico em um CLI de modos explícitos. Trava URI exata antes de import/conexão, sem dotenv. Diagnóstico lê somente; dry-run prepara/valida documentos Mongoose, referências, duplicatas, checksums de origem/destino e fingerprints. Apply exige plano, runId aprovado, checksum revisado, transações e provisionamento prévio; relê origem no snapshot, copia IDs/históricos via somente $setOnInsert, preserva originais, registra manifesto concluído. Contradição de destino aborta, repetição idêntica conserva documentos. Ferramenta permanece deliberadamente incapaz de conectar operacional: uso futuro requer revisão da trava e autorização separada após relatório operacional. Nenhum apply/provision foi executado.

### Arquivos analisados / criados / alterados

Analisados: arquivos de passagem/contrato acima; todos schemas de users/products/orders/productions/audit/finance, common/enums.ts, package.json API, vitest.config.ts e teste financeiro de schemas.

Criados:

- apps/api/src/common/brazil-documents.ts
- apps/api/src/common/cpf-crypto.ts
- apps/api/src/tenants/tenant.schema.ts
- apps/api/src/tenants/tenancy-persistence.spec.ts
- scripts/tenancy-storage.mjs
- docs/users-tenancy-deployment.md

Alterados:

- apps/api/src/common/enums.ts
- apps/api/src/users/user.schema.ts
- apps/api/src/products/product.schema.ts
- apps/api/src/orders/order.schema.ts e counter.schema.ts
- apps/api/src/productions/production.schema.ts e stock-movement.schema.ts
- apps/api/src/audit/audit-event.schema.ts
- apps/api/src/finance/schemas/financial-category.schema.ts, financial-entry.schema.ts, financial-recurrence.schema.ts
- apps/api/src/finance/schemas/financial-schemas.spec.ts (fixture com tenantId obrigatório)
- docs/users-tenancy-handoff.md

Nenhum serviço/controller/DTO/frontend/.env alterado. git diff --stat não disponível: diretório não é repositório Git; inventário acima deriva das escritas explícitas. Busca rg com wildcard literal Windows falhou uma vez e foi substituída por leitura de paths explícitos.

### Verificação executada e resultados

Ambiente configurado/verificado antes do comando Vitest: TEST_MONGODB_URI exatamente mongodb://127.0.0.1:27017/salgados_financeiro_test. Testes de schema não conectam Mongo.

1. `npm test --prefix apps/api -- src/tenants/tenancy-persistence.spec.ts`: primeira tentativa falhou no startup Vite com spawn EPERM do sandbox, sem testes. Reexecução escalada autorizada: **1 arquivo,30 testes aprovados**, duração5,97s. Cobre CPF/CNPJ inválidos/objetos, AES/HMAC/tenant AAD/chaves, usuário plataforma vs tenant, status/role, ADMIN, máscaras/projeção, motivos e índices compostos dos oito modelos.
2. `npm test --prefix apps/api -- src/finance/schemas/financial-schemas.spec.ts`: **1 arquivo,12 testes aprovados**, duração598ms, repetição justificada por tenantId obrigatório e fixture alterada. Warning Mongoose de depreciação validateSync, sem falha.
3. `node --check scripts/tenancy-storage.mjs`: exit0, sintaxe válida.
4. `node scripts/tenancy-storage.mjs diagnose` com URI exata: exit0, **1 conexão somente leitura ao banco de teste**, zero escritas. Origens: users92, products32, orders43, counters1, productions16, stockmovements89, categorias47, lançamentos163, recorrências25, auditoria1366 = **1874 documentos lidos**. Todos destinos v2 com contagem0 naquele momento;0 conflitos e0 referências ausentes;92 usuários sem tenant;29 ADMIN ativos/0 inativos. Não imprimir PII/URI/credenciais no relatório. Esses são dados de teste, não diagnóstico do operacional.

Total **42 testes aprovados /2 arquivos**,0 builds,0 apps iniciadas,0 conexões operacionais,0 escritas Mongo,0 exclusões. Não foi executado dry-run dependente de build/plano privado nem apply; não alegar migração/atomicidade real validada a partir desses unitários. Transações/capacidade ainda devem ser verificadas pelo backend/QA sem reconfigurar daemon.

### Contrato exato para backend (próximo agente)

Não reanalisar schemas: consumir `docs/users-tenancy-deployment.md`, seção Contrato para o backend. Exports:

- common/enums: UserRole (ADMIN mantido; OWNER/ACCOUNTANT/PLATFORM_ADMIN adicionados), UserStatus, TenantStatus.
- brazil-documents: normalizeCpf/normalizeCnpj(unknown):string lançam Error genérico; isValidCpf/isValidCnpj(unknown):boolean. Converter erros de normalização em400 nos DTOs/serviços.
- cpf-crypto: new CpfCrypto(env?); protect(cpf,tenantIdString) → {cpfEncrypted,cpfHash,cpfLastDigits}; hash(cpf), encrypt(cpf,tenant), decrypt(envelope,tenant); maskCpf(lastDigits?):string|null. Selecionar explicitamente +cpfLastDigits e gerar cpfMasked no serializer, sem expor campos do envelope/hash; bcrypt permanece responsabilidade backend.
- tenant.schema: Tenant/TenantDocument/TenantSchema, TenantDecision/TenantDecisionSchema. decisionHistory.action = approved/rejected/suspended/reactivated/migrated; actorId/occurredAt/reason. sessionVersion/membershipVersion select:false: selecionar explicitamente nas verificações ou incrementar atomicamente. Usar $push para histórico.
- User.role é UserRole|null e tenantId ObjectId|null; role null somente PENDING/REJECTED, status ACTIVE/INACTIVE exige role. active legado espelhado durante validate, nunca autoridade. Sessões continuam versões JWT sem coleção extra.
- AuditEvent tenantId null só contexto global/pré-auth e targetTenantId opcional; backend deve impor a semântica de contexto e transação. Updates Mongoose não executam middleware de documento: usar whitelist/runValidators:true e lógica de serviço para estado, coerência CPF/role/status e último OWNER.
- CLI provision depois de build final cria 11 coleções de modelos + manifesto e índices **aditivamente**, sem dados de aplicação. API deve desativar seeds antigos e não fazer fallback legado; exigir flag v2/manifesto ou declaração de instalação nova em produção.

Pendências/riscos: integração TypeScript com role nullable ainda cabe ao backend; todos serviços precisam tenant/status e referências; validação transacional/HTTP/browser só etapas seguintes. Script de diagnóstico carrega base em memória (revisar para bases grandes). Rotação CPF multi-key exige processo futuro. Provision/dry-run/apply ainda sem execução real, integração deve validar após build final e fixtures exclusivas, preservando dados. HTTPS/auth Mongo/TLS/backup/chaves reais/admin inicial operacional dependem ambiente/autorização; nenhuma credencial gerada.

## 3. Principal — retomada em 15/09/2026, backend integrado

Execução exclusivamente pelo principal, conforme instrução atual. Caminho solicitado D:\Downloads\salgados-mvp inexistente; cópia disponível D:\Projetos\salgados-mvp. Ponto encontrado: schemas, TenantAccessService, DTOs e LoginDto parcialmente adaptados; autenticação e serviços ainda legados. Sem nova auditoria geral, sem agentes, sem conexão operacional.

Implementados TenancyService/PlatformController, onboarding e solicitação com transação, decisões globais, gestão explícita de membros, trava membershipVersion/último OWNER, sessões com tenant/version revalidadas, roles sem bypass, filtros tenant nas operações/estoque/relatórios/financeiro/auditoria. FinanceService tem escopo por request e revalida identidade antes das consultas; catálogo financeiro mínimo disponível. TenantStatus inclui INACTIVE conforme pedido atual; reativação admite SUSPENDED/INACTIVE. Migração real não executada.

Contrato frontend: seção6 da spec implementada; POST /users e PATCH /users/:id retirados. Login empresarial exige cnpj; plataforma usa /auth/platform-login. Login/logout200. /auth/me retorna identidade sanitizada sem versões internas. Aprovação revoga sessão pendente: solicitar novo login. Usuários e empresas usam envelope paginado. Histórico /platform/tenants/:id/history. /finance/products envelope {_id,name,active}. OWNER/ADMIN operam próprio tenant; ACCOUNTANT só financeiro; plataforma só cadastro global. Cookies/CSRF preservados. Polling15s para contador e espera. Não expor CPF bruto após envio.

Arquivos nesta camada: auth/{auth.controller,auth.service,jwt-auth.guard,roles.guard,security.guard,auth.module}; users/{users.controller,users.service}; tenants/{tenancy.service,platform.controller,tenancy-access.spec}; common/{enums,security.interceptor}; products,orders,productions,reports controllers/services; finance controller/service; audit module/service.

Comandos/resultados: npm run build --prefix apps/api inicialmente5 erros de tipagem nullable no financeiro, corrigidos; segundo build exit0. TEST_MONGODB_URI validada literalmente antes de npm test --prefix apps/api -- --no-file-parallelism src/tenants/tenancy-access.spec.ts src/tenants/tenancy-persistence.spec.ts: primeira inicialização spawn EPERM; reexecução com escalada exit0,2 arquivos/51 testes aprovados,15,70s. Nenhuma conexão/escrita Mongo nesses unitários. Testes legados ainda precisam adaptação ao novo contrato; HTTP/browser, preservação, builds finais e entrega permanecem pendentes.

## 4. Principal — Angular e integração em andamento

Angular implementado: cadastro empresa/proprietário, solicitação com CPF, consulta de disponibilidade, espera, login empresarial/plataforma, painel global com decisões/histórico, gestão de membros/paginação/escolha obrigatória de role, badge de pendências e polling15s sem sobreposição nas novas telas, guards e menus por status/role, catálogo financeiro mínimo. TS/HTML/SCSS separados. npm run build --prefix apps/web: tentativa sandbox spawn EPERM; escalada exit0,298,07kB inicial/78,99kB estimados transferidos. Aviso Node25 não-LTS. Navegação real ainda pendente.

Integração scripts/tenancy-qa-harness.mjs e tenancy-integration.mjs valida URI antes de imports/conexão/escritas; snapshots BSON/fingerprints anteriores; fixtures únicas; provisionamento exclusivamente aditivo no banco de teste; API com ambiente teste e chaves aleatórias. Nenhum seed, exclusão ou banco operacional. Mongo encontrado standalone: positivos transacionais bloqueados,503 e ausência de resíduos testados.

Defeito real encontrado: @Prop({type:Types.ObjectId}) era convertido em Mixed pelo stack instalado, causando filtros inconsistentes, auditoria invisível e logout sem revogação. Corrigidos todos campos referência para MongooseSchema.Types.ObjectId, incluindo schemas anteriores. Primeira rodada1789523471008-d25f143dbd:332 pass/6 fail/5 bloqueados,1874 documentos anteriores preservados. Segunda rodada1789523551691-7825d53a43:337 pass/1 fail/5 bloqueados,2524 anteriores preservados; build precedente teve import duplicado, portanto esta rodada não serve como build final. Falha remanescente: referência inválida consumia contador antes da validação; agora referências de pedido validadas antes da primeira escrita. Imports Connection de tipo e DTO vazio de aprovação também corrigidos após execução real. Dados gerados por rodadas com falha preservados integralmente.

## 5. Principal e qa_integracao — retomada e consolidação em 16/09/2026

Relatório consolidado com comandos e limites: [QA de 16/09/2026](tenancy-qa/resume-20260916-report.md). A aplicação e o navegador de QA foram fechados; o processo terminou com exit 0 e a porta 4329 recusou conexão na verificação posterior.

Retomado o estado local em D:\Projetos\salgados-mvp, sem repositório Git disponível. O handoff estava anterior às últimas evidências: unitários de 15/09 aprovaram 113 testes em 10 arquivos; a integração posterior teve 405 aprovados, uma falha de seletor do teste de badge e seis bloqueados. A correção do seletor já existia, com dois testes focados aprovados. Esses resultados históricos foram preservados.

Nesta retomada foi instanciado somente o agente nomeado qa_integracao, responsável exclusivo por scripts/testes/relatório. O principal integrou documentação (README, deployment e este handoff). Nenhuma mudança no código da aplicação foi necessária. QA ampliou a negativa de transações para sete decisões administrativas com payloads válidos e comparação dos documentos envolvidos; o caso anterior de suspensão enviava motivo inválido e verificava 400, sem exercitar a indisponibilidade transacional.

Resultados novos:

- Build NestJS: exit 0, `tenancy-qa/resume-20260916-api-build.log`.
- Build Angular: tentativa sandbox bloqueada por spawn EPERM; reexecução escalada exit 0, `tenancy-qa/resume-20260916-web-build-escalated.log`. Bundle inicial 298,07 kB; transferência estimada 78,92 kB.
- Integração HTTP/Mongo e Chrome real: execução `1789557320491-87d7ec5466`, exit 0, **406 verificações aprovadas, zero falhas, seis cenários bloqueados**; 339 verificações HTTP/outras e 67 de navegador. Inventário de 58 handlers. Log `tenancy-qa/resume-20260916-integration.log`; resultados, screenshots e preservação no diretório da execução.
- Snapshot: **5.266 de 5.266 documentos anteriores intactos**, zero removidos/alterados; total final 5.961. Os 695 documentos adicionais são fixtures/auditoria desta rodada e foram mantidos.

Evidências reaproveitadas, sem alegar nova execução: 113 unitários aprovados em `tenancy-qa/final-20260915-unit.log`; diagnóstico/dry-run `migration-1789524002723-a0e11ced`, exit 0, plano de 1.875 documentos, zero conflitos/referências ausentes, 4.564 documentos preservados naquela execução. Migração não foi aplicada.

README atualizado para login por CNPJ, perfis empresariais/plataforma, ausência de credenciais padrão e QA atual com `TENANCY_BROWSER=true`. Deployment documenta o CLI separado do primeiro administrador, suas entradas e as três escritas transacionais previstas. Comandos de inspeção do principal: Get-Content UTF8, rg --files, Get-ChildItem; git status indisponível por ausência de repositório. Escritas documentais via apply_patch; nenhum teste adicional pelo principal após QA.

Limites pendentes naquela execução: MongoDB continuava standalone, sem reconfiguração. Os positivos de onboarding/decisões de empresa/membros e concorrência transacional não foram validados. O ramo transacional da suíte ainda precisa ampliar injeção de falha/rollback e disputa simultânea do último OWNER; a checagem do único OWNER não substitui concorrência. Bootstrap do primeiro PLATFORM_ADMIN, aplicação/reexecução da migração e implantação operacional permanecem sem validação real. Toda aplicação de QA e toda escrita Mongo daquela retomada usou somente `mongodb://127.0.0.1:27017/salgados_financeiro_test`; não houve conexão operacional, reset ou exclusão de dados. Não declarar produção pronta nem repetir a suíte inalterada como forma de resolver o bloqueio transacional.

## 6. Retomada das melhorias de usabilidade — 16/09/2026

O ponto mais recente estava nos scripts `usability-*` e na especificação `usability-business-improvements.md`. A rodada anterior `1789585312334-5bfd43f5ed` tinha 66 verificações aprovadas e duas falhas de overflow na tabela de produtos (320/768px). Seus artefatos foram preservados. A evidência dessa rodada já indicava suporte transacional; a descrição standalone acima corresponde apenas à execução histórica.

Agentes efetivamente acionados nesta retomada: frontend_angular, para HTML/SCSS da tela de produtos; backend_nestjs, para configuração Mongo e casos negativos associados; qa_integracao, para scripts, testes e relatório. O principal integrou README, especificação e este handoff. Ownership ampliado explicitamente para essas tarefas; sem reconfiguração do daemon, alteração de .env, migração aplicada ou exclusão de dados.

A tabela recebeu contêiner de rolagem local com foco e identificação acessíveis. Os guards de QA foram alinhados à URI literal atual `mongodb://127.0.0.1:27017/salgados_financeiro_test`, sem parâmetros. Build completo Angular/cópia da SPA/NestJS aprovado. Testes direcionados: 44 aprovados; suíte unitária completa: 153 aprovados em 11 arquivos (os direcionados são subconjunto, não somar). Usabilidade HTTP/Chrome: 70 verificações aprovadas, incluindo rolagem por teclado e acesso às ações em 320/768px. Scan heurístico de 19 bundles sem achados. Run `1789598899698-31ea6cd3b4`: 6.498 documentos anteriores intactos; total final 6.592, zero ausentes ou alterados.

Regressão de usuários/empresas com Chrome: 417 verificações aprovadas, zero falhas e zero grupos bloqueados; run `1789599001436-642e7c5177`, 7.319 documentos anteriores intactos. A rodada precedente teve sete expectativas obsoletas de perfil/self-status corrigidas no teste; seus registros foram preservados. O suporte transacional foi observado nesta execução, sem reconfiguração pelo agente. Zero grupos bloqueados não significa cobertura completa: injeção de falha/rollback e concorrência do último OWNER continuam sem execução.

Comandos, demais resultados de regressão e limitações estão no [relatório desta retomada](usability-qa-resume-20260916.md). Diagnóstico/dry-run de usabilidade: 26 produtos, 14 sem classificação, 17 conflitos de e-mail; plano vazio e zero alterações aplicadas. Não representa migração validada nem autorização operacional. Não há repositório Git disponível nesta cópia; inventários de arquivos e logs substituem alegações de diff/commit.
