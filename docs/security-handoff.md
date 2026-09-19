# Passagem oficial de segurança

## 1. Arquiteto — auditoria inicial, 2026-09-14

Estado: auditoria estática concluída; implementação e validação ainda pendentes. Nenhuma aplicação, teste, conexão ou escrita MongoDB executada. Única escrita desta etapa: este documento. O pedido atual substitui as limitações funcionais do contrato financeiro antigo. Um agente por vez; encerrar cada etapa antes da próxima. Não há `.git` disponível segundo inspeção do principal: histórico de commits não foi auditado e não se pode declarar remoção de segredos do histórico.

### Evidência e arquivos analisados

Leitura de `AGENTS.md`, `.codex/agents/arquiteto.toml`, `docs/financeiro-contrato.md`; inventário `rg --files apps/api/src apps/web/src/app`; leitura de `apps/api/src/auth/*.ts`, todos os sete controllers em `apps/api/src/*/*.controller.ts`, `main.ts`, `app.module.ts`, `common/enums.ts`, serviços users/products/orders/productions, schemas users/products/orders/productions, DTOs desses módulos e auth, `finance.dto.ts`, `finance.helpers.ts`, trechos de `finance.service.ts`, `seed/seed.service.ts`, `events/events.gateway.ts`. Front: `app.routes.ts`, `core/auth*.ts`, `core/socket.service.ts`, `layout/shell.component.html`, `features/home/home.component.ts`, environments. Infra: `docker-compose.yml`, `.gitignore`; somente nomes de variáveis de `.env`/`.env.example`, sem registrar valores. QA: início dos dois e2e, buscas nos scripts e specs.

Comandos utilizados: `Get-Content` dos arquivos acima; `rg --files` para inventário; `rg -l --hidden` com exclusões node_modules/dist/public/.angular procurando locais de JWT/Mongo/credenciais; `rg -n` para bootstrap, configurações e exclusões Mongo. Os comandos de leitura concluíram; última busca por `dropDatabase|deleteMany|deleteOne|dropCollection|.drop(|remove(` retornou código 1 (nenhuma ocorrência em scripts, testes e src nos padrões consultados). Nenhum teste foi executado (0); nenhum build (0). Resultado não comprova ausência de operações destrutivas por outras formas nem segurança do ambiente em execução.

### Autenticação, roles e sessão atuais

`POST /api/auth/login` público consulta e-mail, active e bcrypt; senha de usuários criada com bcrypt custo 12. Mensagem de erro é genérica, porém curto-circuito para usuário inexistente/inativo permite diferença temporal. JWT assinado por 12 horas; segredo tem fallback fixo em `auth.module.ts`. `JwtAuthGuard` global valida assinatura/expiração de Bearer, mas aceita claims sem reconsultar usuário ativo/role atual. `RolesGuard` global permite handlers sem metadata. Não há refresh, logout HTTP, revogação, recuperação de senha, rate limit ou auditoria geral.

Roles persistidas: ADMIN, CASHIER (CAIXA), KITCHEN (COZINHA). Preservar valores persistidos por compatibilidade e apresentar nomes portugueses na UI/documentação. Não migrar registros existentes.

Angular armazena JWT e usuário no localStorage; autenticação visual depende do usuário armazenado, interceptor anexa Bearer sem restringir destino e trata somente 401. Logout apenas local. Cookies de sessão não existem hoje.

### Matriz completa dos endpoints atuais e política alvo

Todos caminhos abaixo começam por `/api`. A=ADMIN, C=CASHIER/CAIXA, K=KITCHEN/COZINHA. Todos os 36 endpoints HTTP declarados foram inventariados. Exceto login público, JWT já é global. Coluna atual representa metadata real, não teste executado. Na política final, ausência de autenticação =>401 e role não autorizada =>403. ADMIN possui todos os escopos.

| Método | Caminho | Roles atuais | Política alvo / escopo |
|---|---|---|---|
| POST | /auth/login | público | público, limite rigoroso, cookie, origem validada |
| GET | /auth/me | qualquer JWT, sem Roles | A/C/K, somente usuário atual sanitizado |
| GET | /users | A | A, projeção sem hash/sessão, paginação |
| POST | /users | A | A, senha segura, auditoria |
| GET | /products | A/C/K | A completo; C somente catálogo ativo vendável; K projeção operacional sem preço/custo |
| POST | /products | A | A, auditoria |
| PATCH | /products/:id | A | A, ID validado, auditoria |
| GET | /productions/today | A/K | A/K, produção somente, paginação |
| POST | /productions | A/K | A/K, produto ativo válido, limites, autoria servidor |
| GET | /orders | A/C | A todos; C openedById=usuário atual, paginação |
| GET | /orders/:id | A/C | A todos; C somente próprio pedido |
| POST | /orders | A/C | A/C, autoria servidor, IDs de produtos ativos |
| PATCH | /orders/:id | A/C | A/C, C somente próprio e OPEN |
| POST | /orders/:id/finalize | A/C | A/C, C somente próprio e OPEN, pagamentos validados |
| POST | /orders/:id/cancel | A/C | A/C, C somente próprio e OPEN, motivo/auditoria |
| GET | /reports/daily | A | A, data real validada |
| GET | /finance/entries | A | A |
| GET | /finance/entries/:id | A | A |
| POST | /finance/entries | A | A |
| PATCH | /finance/entries/:id | A | A |
| POST | /finance/entries/:id/payment | A | A |
| PATCH | /finance/entries/:id/payment | A | A |
| POST | /finance/entries/:id/cancel | A | A |
| GET | /finance/entries/:id/history | A | A |
| GET | /finance/summary | A | A |
| GET | /finance/reports/monthly | A | A |
| GET | /finance/categories | A | A |
| POST | /finance/categories | A | A |
| PATCH | /finance/categories/:id | A | A |
| POST | /finance/categories/:id/deactivate | A | A |
| GET | /finance/recurrences | A | A |
| GET | /finance/recurrences/:id | A | A |
| POST | /finance/recurrences | A | A |
| PATCH | /finance/recurrences/:id | A | A |
| POST | /finance/recurrences/:id/generate | A | A |
| POST | /finance/recurrences/:id/deactivate | A | A |

Não existem endpoints HTTP separados para estoque, venda, exportação, configuração, recuperação de senha, auditoria geral, alteração/desativação de usuário ou correção/cancelamento de produção. Vendas/pagamentos são operações de pedidos. Não declarar essas capacidades existentes. Backend deve acrescentar logout e alteração/desativação de usuários para revogação/roles; documentar cada endpoint novo nesta matriz. Correção/cancelamento de produção: decisão conservadora é manter indisponível até operação compensatória segura, sem permitir edição/exclusão arbitrária; registrar limitação explicitamente.

Superfície adicional: Socket.IO namespace `/updates`, eventos `stock.updated`, `order.updated`, `production.created` com documentos completos, sem autenticação e CORS `*`. Guards HTTP não protegem gateway. Servir SPA pública não concede dados; não publicar arquivos privados no diretório static. `/api/qa-context` existe somente no launcher QA e deve continuar exclusivo de teste.

### Telas e rotas

`/login` pública; shell `/` authGuard, home redireciona por role; `/vendas` A/C; `/cozinha` A/K; `/dashboard`, `/produtos`, `/usuarios`, `/financeiro` A; wildcard redireciona home. Financeiro inclui resumo, contas/detalhes/histórico/pagamentos, categorias e recorrências. Menus respeitam mesmas roles. Pasta `features/teste` existe mas não está registrada nas rotas analisadas. Guard pai usa estado local e não verifica sessão remota; adicionar proteção nas navegações filhas/restauração assíncrona e tratamento de 403.

### MongoDB e classificação dos dados

Mongoose conecta via MONGODB_URI em AppModule, com fallback ao banco operacional. `.env` contém variáveis PORT/MONGODB_URI/JWT_SECRET/FRONTEND_URL/BUSINESS_UTC_OFFSET. Docker usa imagem mongo:8, volume persistente, porta `27017:27017`, sem autenticação/TLS configurados no compose. Estado do daemon real, edição, usuários/roles, bind, firewall, TLS e criptografia de volume NÃO verificados. Não conectar ao operacional para tentar comprovar.

Dados: hashes de senha; PII (nome/e-mail, autoria, identificadores/notas potencialmente pessoais); informações comerciais (preços, produção, estoque); dados financeiros (custos, despesas, fornecedor, meios e valores de pagamento). Schemas de pagamento não possuem PAN/CVV e não devem ganhar esses campos. HTTPS/TLS e criptografia de disco/backup são decisões ambientais; não criptografar preços/datas/IDs indiscriminadamente pois quebraria índices e consultas. Não há campo atual que justifique implantar CSFLE nesta etapa; edição e infraestrutura de chaves ainda precisam ser verificadas. Segredos devem ficar em ambiente/secret manager, hashes de sessão somente se sessão persistida for adotada.

### Locais de segredos e exposição

Valores nunca devem ser copiados para handoff/relatórios. Há segredo JWT fallback em auth.module; senha demonstrativa fixa usada pelo seed e reproduzida em testes/scripts/documentação; `.env` local com JWT e URI; `.env.example` precisa ser sanitizado. Busca indicou README, docs/financeiro-manual.md, docs/validacao-financeiro, scripts/finance-browser.test.mjs e start-finance-qa.mjs, e2e e auth como pontos a revisar. Variáveis de teste não são credenciais reais, mas fixtures devem ser geradas por execução. `.gitignore` cobre `.env` simples; ampliar variantes mantendo exemplo. Environments Angular analisados contêm somente URLs públicas; ausência de segredo no bundle ainda não comprovada. Nenhuma API key/certificado privado foi identificada na busca limitada; isso não equivale a varredura de histórico.

### Riscos e proteções encontrados

Críticos: WebSocket público transmite dados de todas áreas; seed automático cria contas previsíveis; JWT fallback. Altos: Mongo compose exposto sem auth declarada; ausência de escopo por identidade nos pedidos (get/update/finalize/cancel consultam somente ID); JWT de usuário desativado/role alterada continua válido; armazenamento localStorage e CORS refletido; ausência de rate limit; bootstrap toca usuários/produtos/categorias automaticamente.

Médios: DTOs fora financeiro sem vários máximos, arrays sem limite, path IDs sem pipe, query status/activeOnly/date sem DTO (risco de operadores via objetos em query conforme parser); produtos completos para todas roles; auditoria parcial; política permissiva para rota sem decorator; concorrência read/save de pedido permite disputa e estoque/produção alteram múltiplos documentos sem transação; HSTS default Helmet não condicionado explicitamente a HTTPS; configuração HTTP não reutilizada nos testes; paginação incompleta. Evidência: métodos OrdersService leem get(id) sem identidade e fazem save após mutações de estoque; ProductionsService incrementa estoque antes de criar produção/movimento.

Já protegidos: bcrypt12; mensagem de login genérica; JWT verify; guards globais; ADMIN exclusivo no financeiro/users/reports e escrita products; cozinha/vendas separadas por role HTTP; ValidationPipe whitelist/forbidNonWhitelisted/transform no main; DTOs com enums e IDs de referências; pagamento só finaliza se soma confere e pedido OPEN; preços obtidos no servidor; reserva de estoque condicional; financeiro possui limites, datas reais, paginação até100, filtros construídos, histórico e concorrência por versão; list/create de usuários não devolvem hash; Helmet instalado; menus/rotas por role. Essas observações são estáticas, não resultados de testes.

### Decisões de implementação e contrato de integração

1. Preservar ADMIN/CASHIER/KITCHEN tecnicamente. Guards globais fail-closed: endpoint protegido precisa política explícita. Claims devem ser revalidados contra usuário ativo e role atual. IDs externos validar antes Mongo. C permanece limitado a próprios pedidos (openedById), inclusive busca/detalhe/histórico/mutações, A sem restrição. Recurso existente fora escopo =>403 sem conteúdo; desconhecido =>404. Nunca aceitar autoria/role do cliente.
2. Migrar autenticação para cookie HttpOnly, host-only, Path=/api, SameSite=Lax, Secure em produção, Max-Age alinhado a JWT curto (15min sugeridos). Decisão simples: sem refresh nesta versão; relogin após expiração, sem JWT em corpo/localStorage. Logout HTTP deve limpar cookie e invalidar sessão via versão/identificador revogável; backend define persistência com banco_mongodb antes de editar schemas. Não adicionar JWT_REFRESH_SECRET obrigatório se não existir refresh. Origin permitido + proteção CSRF nos métodos inseguros, inclusive login; nonce CSRF pode ser enviado ao cliente, jamais JWT/segredo. Documentar contrato final de obtenção/validação do nonce. Restringir envio de credenciais a API configurada. Sessão restaurada por /auth/me.
3. Fechar WebSocket: preferir remover integração de eventos e usar atualização HTTP autorizada se não houver tempo para autenticação/revalidação de sessão por conexão, salas por role/identidade e projeções seguras. Não deixar gateway público por compatibilidade.
4. Configuração obrigatória validada: JWT_SECRET forte sem fallback, MONGODB_URI sem fallback, origin explícito; produção exige credenciais Mongo e TLS/HTTPS conforme política. Seed geral e financeiro opt-in e bloqueado por padrão; nenhum bootstrap operacional nesta tarefa. Bootstrap inicial admin deve usar credencial externa explicitamente fornecida, jamais demo embutida.
5. HTTP: configurar Helmet/CSP para Angular real (evitar unsafe-eval; estilos conforme necessidade), frame-ancestors none, nosniff, referrer-policy, HSTS somente produção HTTPS; CORS allowlist sem wildcard/reflexão, credentials, métodos/headers explícitos; body limitado (64KiB sugeridos), profundidade máxima, rejeição de chaves `$`/`.` e prototype, erros sem stack/credencial. Reutilizar configuração nos e2e.
6. Rate limit configurável por ambiente, chave rota+IP e identidade quando autenticada; login também chave conta normalizada hash, sem revelar existência. Sugestão inicial por minuto: geral120, admin60, login5/IP mais limite por conta e atraso progressivo, logout10, criação pedido30, finalização/pagamento15. Login mais estrito. Armazenamento em memória implica limite por instância/reinício: documentar ou usar armazenamento compartilhado. Não confiar em X-Forwarded-For sem proxy confiável definido.
7. Auditoria estruturada append-only por aplicação: login sucesso/falha, logout, negações, usuários/roles, produtos, produção, pedidos/finalização/cancelamento/pagamentos e financeiro. Somente ator, ação, recurso, resultado, tempo, metadados permitidos; sem corpo bruto, senha/hash/token/URI. Endpoint de consulta A, paginado. Eventos persistidos somente no banco autorizado durante QA.
8. Equivalente ao RLS: autorização global + políticas de serviço + filtros de proprietário + projeções por role + referências permitidas. Usuário Mongo apenas banco necessário, sem root/admin global. Documentar provisionamento seguro sem executar createUser/roles no operacional. Índices não destrutivos; não syncIndexes/drop; avaliação de implantação e duplicatas separada. Índices de autoria+status/data para pedidos e sessão/auditoria conforme schema.

### Passagem sequencial e responsabilidades

Próximo: banco_mongodb lê este documento e inspeciona só schemas/conexão/infra. Responsabilidade proposta ampliada pelo pedido atual: todos schemas Mongo em apps/api/src, segurança de conexão em helper próprio (backend integra AppModule), docker-compose e documentação Mongo. Criar campos de revogação em User e schema auditoria se necessários; alinhar exports/nomes aqui. Não alterar serviços, auth, frontend; sem execução de provisionamento. Atualizar handoff com arquivos, decisões, pendências e checks.

Depois backend_nestjs: todos arquivos backend fora schemas entregues pelo banco; configuração/env examples/seeds/auth/guards/policies/DTOs/serviços/controllers/gateway. Registrar mudanças na API para frontend, e novos endpoints/matriz, limites reais e cookies. Transferência explícita de ownership se schema precisar ajuste após banco encerrar. Serviços de produção/pedidos precisam proteger concorrência sem excluir dados; detalhar qualquer limitação residual.

Depois frontend_angular: todo apps/web necessário, limitado a frontend; consumir contrato final cookie/CSRF e projeções, guards sessão real, menus/401/403 e remoção de socket se desligado. Não refazer auditoria.

Depois qa_integracao: revisar diff/arquivo de passagem e somente mudanças; testes reais e builds. Configurar exclusivamente `mongodb://127.0.0.1:27017/salgados_financeiro_test` antes de importar/criar aplicação. Não usar credenciais reais/fixas existentes; IDs/e-mails aleatórios por execução, preservar dados prévios. E2e atuais têm guard exato de URI e não apresentaram chamadas de exclusão na busca, porém dependem de seed/login demonstrativo e configuração própria incompleta: corrigir antes de executar. Nenhuma limpeza nem drop; não iniciar API operacional; não parar processos do usuário. Contar pass/fail/skip por suíte e registrar logs/caminhos. Cobrir matriz de TODOS endpoints, autenticação, adulteração/expiração/revogação, IDOR com dois caixas, projeções, extras/operadores/profundidade/IDs/datas/limites, 429, cookies/CSRF/CORS/headers, WebSocket fechado, bundle sem segredos. Cobrir ADMIN em cada módulo; cozinha proibida vendas/financeiro e caixa proibido cozinha/financeiro/users. Fonte do setup HTTP deve ser a mesma usada em produção.

Principal integra após QA: não afirmar implantação de Mongo auth/TLS/HTTPS ou rotação real realizada; listar pendências ambientais e qualquer capacidade ainda indisponível. Builds/testes finais após correções, sem repetir a auditoria completa.

### Limitações da etapa e fontes fornecidas pelo principal

Não houve análise dinâmica, verificação de Mongo instalado, pentest, auditoria de dependências remotas, bundle compilado ou histórico git. Não é aprovação de segurança. Referências oficiais consultadas pelo principal: https://docs.nestjs.com/security/rate-limiting ; https://www.mongodb.com/docs/v8.0/administration/security-checklist/ ; https://www.mongodb.com/docs/manual/core/security-encryption-at-rest/ .

## 2. Banco MongoDB ? conclu?do em arquivos; implanta??o ambiental pendente

Resumo: schemas financeiros j? tinham dinheiro inteiro/datas reais e unicidade parcial; schemas operacionais precisavam limites e defesa contra campos inesperados. N?o houve conex?o Mongo, escrita de dados, provisionamento, migra??o, restart, drop/delete/syncIndexes ou build geral. Somente um especialista ativo nesta etapa.

Arquivos analisados: documento de passagem, AGENTS.md, docs/financeiro-contrato.md, .codex/agents/banco_mongodb.toml, apps/api/package.json, docker-compose.yml e schemas abaixo. Uma leitura inicial tentou caminhos users/schemas etc inexistentes; corrigida pelo invent?rio rg, sem altera??o.

Arquivos alterados: apps/api/src/users/user.schema.ts; products/product.schema.ts; orders/order.schema.ts e counter.schema.ts; productions/production.schema.ts e stock-movement.schema.ts; finance/schemas/financial-category.schema.ts, financial-entry.schema.ts, financial-recurrence.schema.ts, financial-shared.schema.ts; docker-compose.yml; este handoff. Arquivos criados: apps/api/src/common/mongodb.config.ts, mongodb.config.spec.ts; apps/api/src/audit/audit-event.schema.ts; docs/security-mongodb.md.

Decis?es/contrato de integra??o:
- Export buildMongoOptions(env: NodeJS.ProcessEnv = process.env): MongooseModuleOptions do common/mongodb.config.ts. Backend integrar em AppModule ap?s carregar ConfigModule/env. URI obrigat?ria com banco expl?cito e sem bancos internos; modo teste/TEST_MONGODB_URI fixados na URI autorizada. Produ??o exige credenciais e TLS sem flags inseguras. MONGODB_USER/PASSWORD em par; TLS_CA_FILE opcional. autoIndex=false e autoCreate=false; QA dever? criar ?ndices de maneira aditiva no banco de teste antes de depender de unicidade; produ??o exige provisionamento externo. N?o foi habilitado sanitizeFilter global: filtros internos com operadores leg?timos seriam embrulhados; backend deve rejeitar operadores do cliente e construir allowlists, usando trusted se optar por sanitizeFilter.
- User.passwordHash agora select:false e exige formato bcrypt custo >=12 ou Argon2id; par?metros reais do Argon2 s?o responsabilidade do hasher. Login selecionar +passwordHash +sessionVersion explicitamente; respostas p?blicas nunca usar documento cru. sessionVersion n?mero inteiro >=0 default0 select:false. JWT guard selecionar +sessionVersion; registros antigos ausentes devem significar 0 sem migra??o em massa. Logout e mudan?as de senha/role/active incrementar vers?o no servidor. User e Order usam optimisticConcurrency para save (__v); n?o protege sozinho estoque/fluxos multidocumento.
- Todos schemas receberam strict:'throw'; operacionais receberam limites de nomes/quantidades/dinheiro/arrays (100 itens e 10 pagamentos), inteiros seguros, URL http(s)/caminho local e cancelReason limitado. Arrays vazios de pedidos abertos continuam permitidos. Novos ?ndices de consulta orders autoria/status/tempo, orders tempo e production tempo; ?ndices ?nicos antigos preservados. Sem ?ndice TTL. FinancialHistoryEvent before/after Mixed preexistentes exigem snapshots allowlist no servi?o.
- Exports AuditEvent, AuditEventDocument, AuditEventSchema em audit/audit-event.schema.ts, cole??o security_audit_events. Campos: occurredAt default Date.now, actorId? ObjectId, actorRole? ADMIN/CASHIER/KITCHEN, action obrigat?rio slug lowercase (pontos/_/-), outcome obrigat?rio success/failure/denied, resourceType? slug, resourceId? ObjectId, reasonCode? c?digo (sem texto livre), subjectHash? SHA256 hexadecimal. Todos immutable; sem payload/meta livre, senha/token/IP bruto. Backend cadastrar modelo/m?dulo/servi?o e mapear eventos; endpoint consulta ADMIN deve paginar. Imutabilidade de schema n?o ? permiss?o Mongo append-only.
- Compose --auth, bind publicado 127.0.0.1 e volume preservado. N?O iniciado: provisionar usu?rio externamente antes de ativar auth em volume existente. docs/security-mongodb.md detalha custom role por cole??o sem remove/drop/gest?o, implanta??o de ?ndices por usu?rio distinto, TLS, firewall, criptografia e limita??es. Nome de usu?rio root/admin rejeitado pelo helper, mas roles efetivas dependem de administrador do ambiente.

Testes/checks executados: comando PowerShell definiu MONGODB_URI e TEST_MONGODB_URI exclusivamente como mongodb://127.0.0.1:27017/salgados_financeiro_test; `npm test --prefix apps/api -- src/common/mongodb.config.spec.ts src/finance/schemas/financial-schemas.spec.ts`. Primeira tentativa bloqueada spawn EPERM antes de testes; repetida com escalada aprovada. Resultado: 2 arquivos aprovados, 17 testes aprovados, 0 falhas/skip, 15.90s, exit0. Ambos puramente em mem?ria, 0 conex?es/0 grava??es Mongo. Avisos: vite-tsconfig-paths redundante e validateSync deprecated para Mongoose10. Testes cobrem helper (5) e regress?o financeira (12); n?o comprovam valida??o de todos novos schemas operacionais nem integra??o HTTP. QA completa os testes. N?o foi executado tsc/build nesta etapa.

Pend?ncias para backend: integrar helper; sele??o expl?cita hash/vers?o; proje??es por role; runValidators nos updates, limites tamb?m em $inc e controle de concorr?ncia/estoque; snapshots financeiros allowlist; auditar com contrato acima; desligar seeds padr?o; .env.example documentar vari?veis novas sem segredos. Pend?ncias QA/ambiente: criar ?ndices aditivamente no teste, autentica??o/TLS/roles/edi??o Mongo reais n?o verificados, criptografia em repouso n?o implantada. Nenhuma declara??o de seguran?a do daemon atual. Consulte docs/security-mongodb.md antes de implanta??o.


## 3. Backend NestJS - implementado; QA dinamico pendente

Resumo: implementadas as decisoes anteriores sem nova auditoria geral. Matriz completa dos **40 endpoints (38 sessao + 2 publicos)** em docs/security-permissions.md. Contrato frontend, configuracoes e limitacoes detalhados em docs/security-backend.md; estes documentos fazem parte desta passagem.

Arquivos analisados: handoff, AGENTS.md, financeiro-contrato.md; auth/users/orders/products/productions/controllers/services/DTOs, reports.controller/service, app.module/main, events, seed, finance.module/controller/DTO/service e testes de servico, schemas User/Order/Product/Production/StockMovement/AuditEvent, helper Mongo, package/vitest config, .gitignore e apps/api/.env.example. Nao houve leitura de valores do .env, conexao Mongo ou inicializacao de API.

Arquivos alterados/criados: apps/api/src/auth/{auth.controller,auth.module,auth.service,jwt-auth.guard,roles.guard,security.guard}.ts e auth/dto/login.dto.ts; users/{users.controller,users.service}.ts e users/dto/create-user.dto.ts; products/{products.controller,products.service}.ts e products/dto/product.dto.ts; orders/{orders.controller,orders.service,order.schema}.ts e orders/dto/order.dto.ts; productions/{productions.controller,productions.service,productions.service.spec}.ts e productions/dto/create-production.dto.ts; reports/reports.controller.ts; finance/finance.service.ts; app.module.ts; main.ts; events/events.gateway.ts; seed/seed.service.ts; audit/{audit.module,audit.service}.ts; common/{security.config,security-http,security.interceptor,security.spec,endpoint-policy.spec,query.dto}.ts; .gitignore; .env.example; apps/api/.env.example; docs/security-backend.md; docs/security-permissions.md; este handoff.

Decisoes: cookie HttpOnly 15min sem refresh/Bearer; nonce CSRF GET publico + header em todo POST/PATCH + Origin obrigatorio; logout revoga todas sessoes por sessionVersion. Reconsulta active/role/versao. Guards globais fail-closed, autoria pedido no servidor e escopo caixa proprio; projecoes de catalogo/cozinha; rate IP/rota/usuario e conta login; validacoes gerais/DTOs; CORS/Helmet/erros/body configurados em helper reutilizavel por QA; auditoria persistida saneada; nenhuma seed automatica; websocket removido. Mongo helper integrado. Ownership transferido explicitamente pelo principal para ajuste indispensavel de Order schema: mutationLocked interno e limite de pagamento1e12, sem alteracao de banco.

Contrato imediato frontend: GET /api/auth/csrf credentials retorna {csrfToken}; nonce em memoria; enviar X-CSRF-Token em POST/PATCH e withCredentials somente a API. POST login retorna {user}; GET me retorna usuario direto; POST logout corpo vazio retorna {success:true}. JWT nunca JSON/localStorage. Cookies salgados_session/salgados_csrf, HttpOnly, SameSite=Lax, Path=/api, MaxAge900s, Secure producao, host-only. Listas operacionais continuam arrays, agora page/limit<=100; percorrer paginas quando necessario. K products nao possui priceCents; producao GET/POST sem autoria. Remover Socket.IO e usar polling HTTP autorizado, sugerido15s. Novo PATCH users/:id para edicao/desativacao/roles com revogacao; GET audit ADMIN paginado. Detalhes em security-backend.md.

Testes/comandos reais: npm run build --prefix apps/api passou em 3 execucoes, ultimo exit0 (~13.96s). npm test --prefix apps/api com MONGODB_URI e TEST_MONGODB_URI exatos mongodb://127.0.0.1:27017/salgados_financeiro_test: primeira tentativa EPERM antes de testes; repetida com escalada aprovada =>6 arquivos/46 testes aprovados. Apos ajustes finais, nova execucao =>**7 arquivos/47 testes aprovados, 0 falhas, 0 skips**, duration858ms, exit0. Os47 incluem os17 testes da etapa Mongo (nao somar repeticoes). Testes puramente em memoria/mocks, zero conexoes/escritas Mongo. Novo inventario por metadata confirma40 handlers com politica, publicos somente auth/csrf e auth/login. Avisos existentes vite-tsconfig-paths redundante e validateSync deprecated Mongoose10. E2E/build Angular/bundle nao executados nesta etapa.

Limitacoes/pendencias: QA precisa testar HTTP real todos endpoints, cookies/CSRF/CORS, adulteracao/expiracao/revogacao, IDOR, rate429, paginacao/projecoes, escrita so banco exato de teste e indices aditivos sem limpeza. Infra auth/TLS/firewall/HTTPS/roles/criptografia nao implantada. Limiter em memoria por instancia; producao multi-instancia exige coordenacao central. Bloqueio Mongo por pedido evita simultaneidade mas nao oferece transacao multidocumento; crash/compensacao incompleta de estoque exige reconciliacao (detalhado em security-backend.md). Lock pode persistir apos crash e requer inspecao antes de liberar. Auditoria geral apos commit nao e atomica com negocio; negacoes podem ficar sem evento se Mongo indisponivel. Producao permanece sem endpoint de correcao/cancelamento. Nenhum segredo real foi rotacionado; historico git indisponivel; fixtures antigas/documentacao fora backend serao tratados por QA/principal.

Instrucao proximo agente: ler esta secao e security-backend.md; implementar somente frontend conforme contrato, sem reaudar backend. APIs de teste devem usar configureSecurityHttp(app), criar Nest com bodyParser:false, definir URI de teste antes dos imports e fornecer segredo aleatorio/FRONTEND_URL. Sem seeds, fixtures precisam ser inseridas explicitamente com identificadores/credenciais novos; nunca excluir dados. Ao fim frontend encerra e QA assume.


## 4. Frontend Angular - implementado; navegacao real pendente QA

Resumo: aplicado contrato da etapa 3 sem repetir auditoria geral. Ownership ampliado pelo principal para apps/web inteiro e esta secao; nenhum backend alterado. Nenhuma API iniciada, conexao ou escrita Mongo realizada. Apenas este especialista ativo.

Arquivos analisados: AGENTS.md, docs/financeiro-contrato.md (contrato antigo subordinado ao atual), .codex/agents/frontend_angular.toml, este handoff/secao3, docs/security-backend.md; frontend core, rotas, shell, login, cozinha, vendas, dashboard e usuarios; apps/web/package.json e angular.json.

Arquivos alterados (prefixo apps/web/): src/app/core/auth.service.ts, auth.interceptor.ts, auth.guard.ts, api.service.ts, models.ts, socket.service.ts (agora comentario sem cliente); novo core/polling.service.ts; src/app/app.routes.ts; features/login/login.component.ts e .html; features/pos/pos.component.ts; features/kitchen/kitchen.component.ts e .html; features/users/users.component.ts e .html; layout/shell.component.ts, .html e .scss; src/environments/environment.ts e environment.development.ts; package.json e package-lock.json (removida dependencia direta socket.io-client; entradas transitivas antigas nao foram podadas sem necessidade de instalacao). Este handoff atualizado UTF-8, sem reescrever secoes anteriores. Build gerou dist/web.

Decisoes:
- Nenhum JWT no corpo esperado ou armazenamento browser. AuthService elimina access_token/auth_user legados no construtor (unico uso localStorage). Removidas credenciais demonstrativas preenchidas no login.
- Nonce CSRF somente memoria, obtido via GET /auth/csrf, compartilhando requisicao concorrente; POST/PATCH recebem X-CSRF-Token e withCredentials. Interceptor compara origin e fronteira de caminho da API com URL normalizada; nao anexa credenciais/nonce a terceiros; remove Authorization em chamadas API. Cookies continuam exclusivamente sob controle backend conforme secao3 (HttpOnly/Secure producao/Lax/Path=/api/900s).
- Guard pai, canActivateChild e guards de roles restauram /auth/me assincronamente antes da rota; nenhuma identidade persistida e confiada. Role negada redireciona para area permitida com aviso. Menus existentes correspondem ADMIN completo, CASHIER vendas, KITCHEN cozinha. Shell revalida sessao a cada60s (destruicao/logout cancelam), API401 limpa estado e redireciona login. 403 apresenta aviso e invalida nonce para proxima tentativa deliberada; 429 pede aguardar. Nao existe retry automatico de mutacoes. Logout chama POST servidor e so confirma saida apos sucesso; falha informa que sessao nao foi encerrada e permite tentar de novo.
- WebSocket desativado no cliente; polling15s somente ADMIN/CASHIER vendas ou ADMIN/KITCHEN cozinha, suspenso durante salvamento, encerrado por logout/destruicao. GETs dessas telas cancelam na destruicao. Atualizacao tambem apos mutacao. Nenhuma consulta financeira/usuarios feita por telas caixa/cozinha.
- Produtos, pedidos, usuarios e producoes percorrem arrays paginados com page/limit100 ate pagina curta. KitchenProduct omite preco/imagem; cozinha nao renderiza autoria. Production.createdByName e opcional apenas para report administrativo preexistente.
- Tela usuarios agora permite mudar role e ativar/desativar por PATCH /users/:id; impede controles de remover proprio acesso e backend continua autoridade. Senha de cadastro min12, max72bytes com TextEncoder; sem persistencia. Nao adicionada tela de auditoria ou cancelamento de producao inexistente no contrato.

Comandos/resultados:
1. `npm run build --prefix apps/web`: primeira tentativa spawn EPERM, nenhum build concluido. Repetido fora sandbox com aprovacao: revelou 4 erros TS de overload do Observable interceptor/atribuicao de producao; corrigidos, mais template cozinha ajustado. Build final mesmo comando exit0 em6.250s, bundle inicial296.50kB (transferencia estimada78.67kB), 13 bundles JavaScript. Aviso ambiente Node25.8.0 nao-LTS, sem erros ou avisos Angular finais.
2. `rg -n "socket.io|SocketService|socketUrl|accessToken|localStorage|Bearer|Admin@123" apps/web/src apps/web/package.json`: unico resultado localStorage.removeItem de legado; nenhum uso ativo Socket/Bearer/token persistido/credencial demo.
3. Varredura Python regex em13 bundles dist/web/browser: 0 arquivos com Mongo URI, chave privada PEM, JWT_SECRET, senha demo antiga, localStorage.setItem ou socket.io-client. Heuristica, nao prova ausencia universal de segredos.
4. `git diff --stat -- apps/web` indisponivel: diretorio nao e repositorio git. Inventario acima registrado manualmente.

Pendencias/instrucoes QA: build aprovado nao equivale navegacao. Nenhum teste unitario Angular/e2e/browser executado nesta etapa; angular.json nao possui target test. Usar harness QA e browser real com API exclusivamente salgados_financeiro_test e fixtures novas. Verificar login vazio, cookie/CSRF, refresh pagina protegida, URLs manuais por role, abas/logout/expiracao, POST sem retry, 403/429, roles/active em usuarios, cozinha sem autoria/preco, pedidos por caixa e pagina>100, polling encerra ao navegar/logout. Verificar interceptor nao envia credenciais a destino fora API. Volume muito alto causa varias requisicoes de paginacao por ciclo e pode atingir429; UI possui aviso, nao pagina virtual. Chamadas GET preexistentes em varios componentes ainda nao tem loading/error local detalhado, tratamento de seguranca fica no interceptor global. Nenhuma garantia de atomicidade de mutacoes backend adicionada pelo cliente. Principal/QA podem remover entradas extraneous remanescentes do lock em manutencao; cliente Socket nao entra no bundle.


## 5. QA integracao ? executado 14/09/2026

Etapa anterior marcada pendente fica substitu?da por este registro. Relat?rio oficial detalhado: [security-qa/security-20260914-a/report.md](security-qa/security-20260914-a/report.md). Foram lidos handoff, AGENTS.md, contrato antigo (pedido atual prevalece), security-backend.md e security-permissions.md; analisados somente testes/scripts legados e contratos necess?rios de auth/DTOs/contador/setup.

Resultados:47/47 unit?rios,175/175 e2e em4 su?tes,27/27 Chrome headless, builds Angular/Nest sucesso, scan16 arquivos bundle0 achados (1 valor secreto local comparado sem eco). Nenhum defeito de aplica??o confirmado. Falhas intermedi?rias de infraestrutura/fixtures/seletor documentadas e corrigidas nos testes; n?o ocultadas. Limita??es completas e distin??o entre matriz de pol?ticas (400/404 positivos n?o s?o sucesso de neg?cio) e endpoints com payloads v?lidos est?o no relat?rio.

Somente Mongo teste exato; seed desabilitado, fixtures aleat?rias, ?ndices aditivos. Nenhum reset/delete/drop/consulta operacional. Snapshot estrito passed:false preservado porque contador orders passou2->28 (+26); hash completo original comprova valor inicial.133 documentos antigos inalterados,0 removidos, businessRecordsPreserved=true. Aplica??es QA e Chrome encerrados; node5112 preexistente preservado.

Ownership: testes apps/api/test e scripts QA/docs somente; aplica??o n?o alterada. Arquivos alterados/criados listados no relat?rio. Decis?o: usar setup HTTP real e cookie/CSRF; mocks somente su?te isolada atributos HTTP produ??o sem Mongo. Scripts legados n?o usam mais credenciais demonstrativas; browser financeiro legado n?o foi executado.

Pend?ncias ambientais: Mongo auth/TLS/custom role/bind, HTTPS real, criptografia, limita??o distribu?da e consist?ncia standalone. N?o testados: fronteiras HTTP dos limites al?m login, multitab/poll stop/interceptor403 em tela, role-change espec?fico, carga/crash e testes unit?rios Angular sem target. Principal integra e faz rodada final sem apagar fixtures; conferir relat?rio antes afirmar escopo de aprova??o. Nenhum outro agente foi criado/ativado por QA.

## 6. Integração final — executada em 14/09/2026

Relatório final vigente: [security-qa/security-final-20260914-b/report.md](security-qa/security-final-20260914-b/report.md). Ele complementa a etapa 5 e substitui suas pendências de teste de mudança de role e fronteiras dos seis grupos de rate limit. As demais limitações estão separadas no relatório entre não testados e riscos restantes.

O principal leu o handoff completo, matriz, relatório do QA e somente os testes/scripts e contratos necessários. Especialista QA encerrado antes dos ajustes finais. Nenhuma nova auditoria ou reimplementação da aplicação; nenhum conflito de escritores. Sem repositório Git, o inventário de arquivos é explícito nas etapas e no relatório.

Alterações: teste HTTP de mudança de role e revogação; nova suíte de seis fronteiras de rate limit; anulação de credenciais Mongo herdadas nos helpers; identificador obrigatório por execução nos relatórios de navegador/scan/preservação; verificação estrita da exceção do contador. Arquivos: apps/api/test/security.e2e-spec.ts, security-rate.e2e-spec.ts, security-harness.ts; scripts/start-finance-qa.mjs, security-browser.test.mjs, security-preservation-report.mjs, security-bundle-scan.mjs; este handoff e relatório final. Builds públicos regenerados. Nenhum código de aplicação modificado na retomada.

Resultados finais: **182/182 e2e (5 suítes), 47/47 unitários (7 suítes), 27/27 Chrome headless; builds Angular e NestJS exit 0**. Sem falhas ou skips nos testes finais. EPERM do sandbox nas tentativas iniciais foi resolvido com repetição aprovada; logs preservados. Nenhuma falha de aplicação confirmada. Matriz de 40 endpoints coberta por políticas e fluxos positivos complementares; 401/403, três roles, isolamento entre dois caixas, sessão, validação, cookies/CSRF/CORS e seis grupos de rate limit verificados. Não contar 400/404 de payload vazio como sucesso funcional: distinção detalhada no relatório.

Preservação: URI exata de teste em toda escrita; nenhum acesso ao operacional nem reset/exclusão. **1.402 documentos preexistentes inalterados, zero removidos**; somente contador orders 28→43 (+15) por 15 pedidos novos. Snapshot estrito mantém passed:false; análise comprovada por hash e delta retorna businessRecordsPreserved:true. Fixtures novas foram preservadas. API e Chrome encerrados; sem listener final em 4317.

Scan final: 16 arquivos e 1 valor local conhecido comparado sem exposição, zero achados. Resultado heurístico, sem garantia absoluta de ausência de segredos. HTTPS/Mongo efetivamente seguros, limitação distribuída, atomicidade de estoque/auditoria, recuperação de locks e demais itens ambientais continuam pendentes. Não há aprovação irrestrita de produção.

Comandos, logs, contagens por coleção, arquivos, falhas intermediárias, não testados e riscos constam no relatório final. Trabalho autorizado de QA e builds concluído; implantação operacional não executada.

## 7. Conferência documental da retomada — 14/09/2026

O especialista qa_integracao, único especialista delegado nesta retomada, conferiu as evidências existentes por solicitação do principal. As etapas de arquitetura, MongoDB, backend, frontend, QA e integração final estão registradas acima como concluídas em seus respectivos escopos; os estados antigos de QA pendente foram substituídos pelas seções 5 e 6. Agentes configurados em disco não foram tratados como processos ativos. Nenhum novo agente foi criado por QA.

Comandos de leitura executados com sucesso: `Get-Content` de `AGENTS.md`, `.codex/agents/qa_integracao.toml`, `docs/financeiro-contrato.md`, deste handoff e do relatório final; `rg --files docs/security-qa/security-final-20260914-b`; `Get-Content -Encoding UTF8` dos quatro logs `*-escalated.log` (trechos finais, e início do build), `browser/results.json`, `bundle-scan.json`, `preservation.json` e `preservation-analysis.json`; `rg -n 'Test Files|Tests |security-rate|security.e2e|role|429'` no log e2e final. A primeira saída extensa foi truncada e teve interpretação de encoding inadequada no terminal; os registros finais relevantes foram relidos explicitamente em UTF-8. Nenhuma nova auditoria de código foi realizada.

Resultados confirmados nos artefatos da rodada `security-final-20260914-b`: 7 suítes/47 testes unitários aprovados; 5 suítes/182 testes e2e aprovados; 27 resultados de navegador aprovados e zero falhas, concordantes entre log e JSON. O log de build registra conclusão Angular, bundle inicial 296,50 kB, cópia para o servidor e invocação de `nest build` sem erro registrado; o exit 0 de ambos os builds consta no relatório final e na seção 6, pois o stdout preservado não imprime o código de saída. A varredura registrada contém 16 arquivos, 1 valor local comparado e zero achados. A análise de preservação registra 1.402 documentos anteriores inalterados e nenhuma remoção, com única alteração no contador orders 28→43, correspondente aos 15 pedidos adicionados. O snapshot estrito continua `passed:false` e a análise separada `businessRecordsPreserved:true`; essa distinção permanece válida e explícita.

Não foi encontrada divergência entre as contagens finais e suas evidências. Não há execução final de QA/build pendente identificada nesses registros. Para respeitar a instrução de retomar somente pendências, nesta conferência foram executados **0 testes, 0 builds, 0 aplicações e 0 conexões MongoDB**, sem qualquer escrita, exclusão ou reinicialização de banco; somente esta seção foi acrescentada. Os resultados acima pertencem à rodada final já concluída, não a uma nova execução.

Permanecem os limites do relatório final: infraestrutura HTTPS/Mongo/TLS/permissões/criptografia não validada operacionalmente; ausência de ensaios de carga, crash, múltiplas instâncias e algumas explorações de navegador; Angular sem target unitário; histórico Git e auditoria de dependências indisponíveis/não executados; scan heurístico sem garantia absoluta. Limitação distribuída, atomicidade de estoque/auditoria, recuperação de locks e operação compensatória de produção continuam riscos ou capacidades pendentes, sem equivaler a testes finais esquecidos. Esta conferência documental não comprova o estado atual de serviços ou banco e não concede aprovação irrestrita de produção.
