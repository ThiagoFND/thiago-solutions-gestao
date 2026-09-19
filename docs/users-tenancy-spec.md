# Usuários, empresas e administração da plataforma — especificação técnica

Data: 14/09/2026. Contrato oficial desta evolução, acompanhado por `users-tenancy-handoff.md`. Pedido atual e adendo de aprovação global prevalecem sobre o contrato financeiro antigo. O arquivo `especificacao_requisitos_usuarios.docx` tem extensão DOCX, mas contém texto UTF-8 legível, incluindo o adendo; não é um ZIP Office válido. Seu conteúdo foi lido integralmente.

## 1. Invariantes e critérios de aceitação

- Onboarding cria Tenant PENDING e User OWNER/PENDING na mesma transação. Nenhuma parte sobrevive a uma falha. Só aprovação por PLATFORM_ADMIN libera empresa e proprietário.
- Usuário operacional exige simultaneamente usuário ACTIVE, empresa ACTIVE, identidade/sessão vigente e role permitida. Estado nunca se confunde com role.
- Cada leitura, escrita, referência, agregação, contador e auditoria empresarial exige tenantId da identidade autenticada revalidada no servidor. Recurso de outra empresa responde 404 igual a inexistente; não fazer consulta global para distinguir. Caixa continua limitado aos próprios pedidos.
- PLATFORM_ADMIN tem tenantId null e somente poderes cadastrais globais; nenhum bypass para endpoints empresariais. OWNER/ADMIN nunca acessam endpoints globais.
- Não apagar usuários, empresas, históricos, coleções ou bancos; não executar seeds automáticas. Sem consulta/conexão operacional nesta tarefa. QA verifica URI exata antes de importar aplicação e preserva registros anteriores.
- CPF nunca em texto puro persistido, logs ou respostas. Hash de senha, chaves e cookies nunca em projeções. Criptografia e unicidade são verificadas no servidor e nos schemas.
- Critério de conclusão exige evidências reais de HTTP, browser, builds e preservação. Implementação com fluxos bloqueados por infraestrutura deve ser entregue como implementada com validação parcial, nunca pronta para produção.

## 2. Estados, roles e transições

`TenantStatus`: PENDING, ACTIVE, REJECTED, SUSPENDED. `UserStatus`: PENDING, ACTIVE, REJECTED, INACTIVE. Preservar enum ADMIN armazenado; equivalência OWNER aplica somente após vínculo explícito a tenant válido. Não há fallback que dê tenant a um usuário antigo durante login.

| Operação | Origem → destino | Autoridade / condições |
|---|---|---|
| Onboarding | inexistente → empresa PENDING + OWNER PENDING | público, validação e transação |
| Aprovar empresa | PENDING → ACTIVE; OWNER PENDING → ACTIVE | PLATFORM_ADMIN, atomicidade com auditoria |
| Recusar empresa | PENDING → REJECTED; OWNER → REJECTED | PLATFORM_ADMIN, motivo obrigatório |
| Suspender | ACTIVE → SUSPENDED | PLATFORM_ADMIN, motivo obrigatório e incrementar versão de sessões do tenant |
| Reativar empresa | SUSPENDED → ACTIVE | PLATFORM_ADMIN, motivo obrigatório, sessões antigas continuam revogadas |
| Solicitar acesso | inexistente → PENDING | somente empresa ACTIVE; role null, sem concessão implícita |
| Aprovar funcionário | PENDING → ACTIVE | OWNER/ADMIN escolhe CASHIER/KITCHEN/ACCOUNTANT obrigatoriamente |
| Recusar funcionário | PENDING → REJECTED | OWNER/ADMIN, motivo opcional |
| Inativar/bloquear | ACTIVE → INACTIVE | OWNER/ADMIN, revoga sessões imediatamente |
| Reativar funcionário | INACTIVE → ACTIVE | OWNER/ADMIN, role operacional já definida; nunca aprova PENDING por este caminho |
| Alterar role | ACTIVE/INACTIVE, role → CASHIER/KITCHEN/ACCOUNTANT | OWNER/ADMIN; sem promoção OWNER/ADMIN/PLATFORM_ADMIN |

Repetição de transição já concluída e concorrência incompatível =>409; não duplicar eventos. REJECTED não é reativado por endpoint genérico, nem libera nova solicitação com mesma identidade; revisão posterior fora do fluxo atual. Cadastro de novos proprietários fora onboarding não é exposto. É possível despromover proprietário somente se outro OWNER/ADMIN ACTIVE permanecer; contar ADMIN migrado como equivalente. Último OWNER ativo nunca pode perder role/status.

### Matriz

| Área | OWNER / ADMIN vinculado | CASHIER | KITCHEN | ACCOUNTANT | PLATFORM_ADMIN |
|---|---|---|---|---|---|
| Produtos operacionais GET | completo | ativos vendáveis/preço | ativos sem preço/custo/autoria | não | não |
| Produtos POST/PATCH | sim | não | não | não | não |
| Pedidos/vendas | todos tenant | próprios tenant | não | não | não |
| Produção/cozinha | sim | não | sim, projeção existente | não | não |
| Relatório diário de vendas | sim | não | não | não | não |
| Financeiro e relatório financeiro | sim | não | não | sim | não |
| Catálogo financeiro mínimo | sim | não | não | sim | não |
| Usuários/pendências/auditoria empresarial | sim | não | não | não | não |
| Cadastros/histórico global de empresas | não | não | não | não | sim |

PENDING pode autenticar para `/auth/me`, `/auth/request-status`, `/auth/logout` e tela de espera, sem operações. REJECTED/INACTIVE não obtêm nova sessão (401 genérico); se estado mudar com sessão vigente, versão revogada =>401. PENDING autenticado em operação =>403. Tenant suspenso impede nova sessão e invalida antigas. `/auth/me` de PENDING não devolve dados cadastrais completos da empresa nem outros usuários.

## 3. Modelo persistente e índices sem exclusão

Decisão: novas coleções versionadas, sem remover índices globais das coleções antigas. A aplicação usa somente v2 após configuração explícita; não fazer fallback para legado. Nomes de modelos/classes podem permanecer para reduzir mudanças nos módulos.

| Modelo | Coleção alvo |
|---|---|
| Tenant | tenants_v2 |
| User | users_v2 |
| Product | products_v2 |
| Order | orders_v2 |
| Counter | counters_v2 |
| Production | productions_v2 |
| StockMovement | stock_movements_v2 |
| FinancialCategory | categorias_financeiras_v2 |
| FinancialEntry | lancamentos_financeiros_v2 |
| FinancialRecurrence | recorrencias_financeiras_v2 |
| AuditEvent | security_audit_events_v2 |

Tenant: `_id`, cnpj normalizado único, legalName (2..200), tradeName (2..160), corporateEmail (máx254 normalizado), phone (10..15 dígitos), status, ownerId, sessionVersion inteiro >=0 interno, membershipVersion inteiro >=0 interno, createdAt/updatedAt, decisionHistory append-only `{action,actorId,occurredAt,reason?}`. Histórico cadastral não contém credenciais. Índices cnpj único; status/createdAt/_id.

User: preservar name/email/passwordHash/role/sessionVersion; acrescentar tenantId (ObjectId obrigatório para empresa, null exclusivamente plataforma), status, requestedAt, phone, jobDescription (2..500), cpfEncrypted (envelope select:false), cpfHash (select:false), cpfLastDigits (2 dígitos, interno), reviewedById/reviewedAt/rejectionReason. role pode ser null exclusivamente para PENDING/REJECTED de funcionário; OWNER PENDING permitido. `active` legado preservado durante migração como espelho `status === ACTIVE`, nunca autoridade. Rejeitar role de plataforma com tenant e role empresarial sem tenant em validação persistente. Índices únicos tenantId/email e tenantId/cpfHash parcial quando string; plataforma null/email naturalmente tem unicidade própria. Consultas tenantId/status/requestedAt/_id.

Todos modelos empresariais recebem tenantId obrigatório. Prefixar índices de consulta com tenantId; únicos: Order tenantId/number; Counter tenantId/key; categoria tenantId/type/normalizedName e tenantId/seedKey parcial; lançamento tenantId/recurrenceId/occurrenceKey parcial. Novos registros jamais usam contador global `orders` da coleção antiga. Sem índice TTL que elimine histórico. Criação de índices aditiva por comando explícito; `autoIndex=false`, `autoCreate=false`, não syncIndexes.

AuditEvent: tenantId null apenas para ações globais/pré-autenticação; targetTenantId opcional para evento global referente a uma empresa; enums de actorRole ampliados; reasonCode sanitizado. Para ações de aprovação/rejeição/suspensão, gravar auditoria na mesma transação da alteração, sem duplicar interceptor. Consulta OWNER fixa tenantId próprio; plataforma consulta somente eventos globais `tenantId:null` e histórico cadastral, nunca auditoria comercial. Razão livre limitada fica no histórico cadastral/usuário, sem corpo HTTP bruto no log.

Sessões continuam JWT em cookie, sem coleção nova obrigatória: claims `sub`, `version`, `tenantId`, `tenantVersion`; fontes autoritativas são User.sessionVersion e Tenant.sessionVersion reconsultadas. JWT tenant deve coincidir com usuário; plataforma exige null. Troca de role/inativação/logout incrementa versão de usuário. Suspender incrementa versão de tenant no mesmo update de status; isso revoga todas sessões em uma gravação, inclusive após reativação. Se forem introduzidas sessões persistidas, tenantId obrigatório nas empresariais, null na plataforma e nenhum TTL/exclusão automática nesta etapa.

## 4. Atomicidade e concorrência

Usar `connection.transaction`/`session.withTransaction` com todos reads/writes participantes recebendo session, incluindo auditoria. Onboarding, aprovação/recusa global e alterações de membros usam transações reais. Não implementar compensação por exclusão. Rollback transacional de inserts não é exclusão de registros previamente persistidos.

Mongo standalone não suporta esse requisito. Detectar capacidade por hello (`setName` ou mongos) antes da primeira escrita transacional; retornar 503 com código `TRANSACTIONS_REQUIRED` quando indisponível. Nunca salvar empresa primeiro e proprietário depois em standalone. Não reconfigurar daemon existente, replica set ou portas nesta tarefa. Principal confirmou essa decisão: se ambiente QA for standalone, comprovar falha sem resíduos e registrar testes positivos transacionais como bloqueados, complementados por unitários; não chamar mocks de integração real.

Todas decisões de membros devem atualizar `Tenant.membershipVersion` dentro da transação antes de contar OWNER/ADMIN ACTIVE e alterar User. Assim operações concorrentes disputam o mesmo documento e retry transacional relê o estado: evita write skew do último proprietário. A simples contagem seguida de update em usuários distintos não é suficiente. Validar status ACTIVE do tenant no update condicional; suspensão disputa o mesmo documento. Nas demais operações, revalidar estado/tenant no serviço antes de operar; requisições iniciadas após suspensão não podem passar por cache antigo. Preservar proteções de lock/versão/estoque existentes; risco de crash multidocumento operacional permanece identificado até conversão específica, não confundir com atomicidade obrigatória do onboarding.

## 5. Validação, CPF e autenticação

Aceitar documentos digitados com máscara ou somente dígitos, rejeitar caracteres arbitrários; normalizar CPF para 11 e CNPJ numérico para14 dígitos; rejeitar sequências repetidas e validar ambos dígitos verificadores no servidor e schema. Não consultar serviços externos. Suporte a eventual outro formato de CNPJ deve ser mudança explícita e validada; não aceitar formato sem algoritmo.

CPF: AES-256-GCM com IV aleatório12bytes, tag16bytes, ciphertext e keyVersion; AAD tenantId para impedir transplante. `CPF_ENCRYPTION_KEY` e `CPF_HASH_KEY` independentes em ambiente, 32bytes base64, validação de configuração sem imprimir valores. HMAC-SHA256 do CPF normalizado para duplicidade (SHA simples é vulnerável à enumeração de CPFs). Índice tenantId/cpfHash. Resposta cpfMasked `***.***.***-XX`; jamais ciphertext/hash. Disponibilizar helper de descriptografia para recuperação administrativa autorizada futura, sem endpoint público/genérico de CPF completo. Rotação requer processo explícito e backup de versões de chaves; perda de chave impede recuperação.

Senhas bcrypt12, mínimo12 caracteres, máximo72bytes UTF-8; confirmação deve coincidir, nunca persistir/retornar. Nome2..120; email trim/lowercase máximo254; rejeitar todos campos inesperados e objetos/operadores via DTO e segurança HTTP existente. IDs24hex; path malformado400. Strings de pesquisa escapadas, paginação page>=1 e limit1..100; ordenação estável `_id` como desempate. Rejeitar null em campos obrigatórios.

Login empresarial `{cnpj,email,password}` obrigatório; nunca procurar email global nem escolher primeira empresa. Login de plataforma por endpoint separado `{email,password}`, consulta tenantId null e role PLATFORM_ADMIN explicitamente. Mesmo e-mail pode pertencer a empresas distintas. Endpoints públicos não aceitam role/status/tenantId. Usuário legado sem tenant/status não autentica até migração explícita. Login errado, rejeitado, inativo, empresa inexistente/suspensa:401 genérico com bcrypt dummy/proteção temporal existente. Consulta pública de CNPJ fornece apenas disponibilidade de solicitação, sem dados do proprietário.

Preservar cookies salgados_session/salgados_csrf HttpOnly, host-only, Path=/api, SameSite=Lax, 900s, Secure em produção; token JWT nunca em corpo/browser storage. CSRF + Origin obrigatório em POST/PATCH inclusive públicos; CORS restrito e Helmet existentes. Limites por60s/IP/rota e identidade: onboarding3, lookup10, solicitação5, login empresarial5, login plataforma3, administração global30; variáveis configuráveis validadas. Login também limita hash de contexto cnpj+email ou plataforma+email entre IPs. Armazenamento em memória continua limitado por instância, exigir solução compartilhada antes de escala.

## 6. Contrato HTTP

Prefixo `/api`. Todas mutações exigem CSRF/Origin. Códigos comuns:400 validação,401 sem sessão/credencial inválida/revogada,403 identidade sem permissão/status,404 recurso inexistente ou de outro tenant,409 duplicidade/transição/concorrência,429 limite,503 transações indisponíveis. Sucessos GET/PATCH200 e POST201, salvo login/logout200. Paginação nova `{items,total,page,limit,totalPages}`. Backend registra qualquer ajuste deste contrato no handoff antes de frontend começar.

| Método/caminho | Autenticação/role | Entrada | Saída |
|---|---|---|---|
| GET /auth/csrf | público | — | `{csrfToken}` |
| POST /auth/onboarding | público | `{company:{cnpj,legalName,tradeName,corporateEmail,phone},owner:{name,email,password,passwordConfirmation}}` | `{tenantId,status:'PENDING',message}` sem cookie operacional |
| POST /auth/company-lookup | público | `{cnpj}` | `{acceptingRequests:true}` ou404 genérico indisponível |
| POST /auth/access-requests | público | `{cnpj,name,email,cpf,phone,jobDescription,password,passwordConfirmation}` | `{status:'PENDING',message}` |
| POST /auth/login | público | `{cnpj,email,password}` | `{user}` e cookie, admite PENDING |
| POST /auth/platform-login | público | `{email,password}` | `{user}` plataforma e cookie |
| GET /auth/me | sessão, inclusive PENDING/plataforma | — | `{sub,name,email,role,status,tenantId,tenantStatus}` |
| GET /auth/request-status | sessão empresarial inclusive PENDING | — | `{status,tenantStatus,message}` próprios |
| POST /auth/logout | qualquer sessão válida | `{}` | `{success:true}` revoga usuário |
| GET /users/requests | OWNER/ADMIN ACTIVE | page,limit | página nome/email/cpfMasked/phone/jobDescription/requestedAt/_id |
| GET /users/pending-count | OWNER/ADMIN ACTIVE | — | `{count}` tenant atual |
| POST /users/:id/approve | OWNER/ADMIN ACTIVE | `{role:CASHIER\|KITCHEN\|ACCOUNTANT}` | usuário sanitizado |
| POST /users/:id/reject | OWNER/ADMIN ACTIVE | `{reason?}` máximo500 | usuário sanitizado |
| GET /users | OWNER/ADMIN ACTIVE | page,limit,status? default ACTIVE | página usuários sanitizados, aceita filtro INACTIVE/REJECTED |
| GET /users/:id | OWNER/ADMIN ACTIVE | ID | usuário sanitizado com cpfMasked |
| PATCH /users/:id/role | OWNER/ADMIN ACTIVE | `{role:CASHIER\|KITCHEN\|ACCOUNTANT}` | usuário sanitizado e sessões revogadas |
| PATCH /users/:id/status | OWNER/ADMIN ACTIVE | `{status:ACTIVE\|INACTIVE}` | usuário sanitizado e sessões revogadas |
| GET /platform/tenants | PLATFORM_ADMIN ACTIVE | page,limit,status? default PENDING | página cadastros empresariais |
| GET /platform/tenants/:id | PLATFORM_ADMIN ACTIVE | ID | cadastro + owner `{name,email,status}` e histórico; sem CPF/hash |
| POST /platform/tenants/:id/approve | PLATFORM_ADMIN ACTIVE | `{}` | empresa ACTIVE |
| POST /platform/tenants/:id/reject | PLATFORM_ADMIN ACTIVE | `{reason}` 3..500 | empresa REJECTED |
| POST /platform/tenants/:id/suspend | PLATFORM_ADMIN ACTIVE | `{reason}` 3..500 | empresa SUSPENDED |
| POST /platform/tenants/:id/reactivate | PLATFORM_ADMIN ACTIVE | `{reason}` 3..500 | empresa ACTIVE |
| GET /platform/tenants/:id/history | PLATFORM_ADMIN ACTIVE | page,limit | página histórico cadastral |
| GET /finance/products | OWNER/ADMIN/ACCOUNTANT ACTIVE | page,limit | página `_id,name,active` somente produtos tenant, sem estoque/preço |

Todos endpoints operacionais existentes em `security-permissions.md` permanecem com caminhos/corpos, mas adicionam status/tenant ao guard E serviços. Financeiro passa a OWNER/ADMIN/ACCOUNTANT; `/reports/daily` só OWNER/ADMIN, sem ACCOUNTANT. `GET /audit` só OWNER/ADMIN com filtro tenant próprio. Listas operacionais existentes podem manter arrays paginados; usuários passam a envelope e frontend deve adaptar. Remover bypass universal ADMIN em RolesGuard. Remover criação administrativa antiga `POST /users` e PATCH genérico que permitam contornar solicitação/escolha de role/status: responder405/404 e documentar remoção; usar endpoints explícitos acima. Não manter caminho alternativo de promoção de proprietário/plataforma.

## 7. Fluxos Angular

- `/login`: CNPJ/email/senha, links para `/cadastrar-empresa`, `/solicitar-acesso`, `/plataforma/login`. Formulários públicos não pré-preenchem credenciais.
- `/cadastrar-empresa`: duas seções empresa/proprietário, confirmação de senha; sucesso informa aprovação da plataforma pendente e direciona login. Erros e loading, proteção contra duplo envio.
- `/solicitar-acesso`: campos completos, CPF somente memória do formulário; sucesso orienta login para acompanhar; limpar senha/CPF após submissão.
- `/aguardando-aprovacao`: texto solicitado literalmente, estado próprio via polling15s, logout; nenhum shell/menu operacional. Quando aprovado, restaurar `/auth/me` e navegar pela role. Token PENDING deve ser renovado por novo login caso aprovação revogue versão; UI informa situação sem loop.
- Shell empresarial somente ACTIVE/tenant ACTIVE: OWNER/ADMIN home administrativa; CASHIER vendas; KITCHEN cozinha; ACCOUNTANT financeiro. `/usuarios` com áreas pendentes e usuários ativos/inativos, aprovação exige seleção inicialmente vazia, recusa com confirmação, status/role com feedback e confirmação de bloqueio.
- Badge vermelho de pendências para OWNER/ADMIN, texto acessível; polling15s autenticado usando serviço existente, suspender em aba oculta, cancelar logout/destruição e não sobrepor requests. Após aprovação/recusa atualizar lista e count. Nunca WebSocket público.
- `/plataforma/login` e `/plataforma/empresas`: guard exclusivamente PLATFORM_ADMIN, lista/filtros/detalhe, ações confirmadas, motivo obrigatório quando exigido, histórico paginado. Menu separado, sem links para áreas empresariais.
- Guards aguardam `/auth/me` antes de rota pai/filha e refresh; confiam apenas resposta atual backend.401 limpa identidade e leva login adequado;403 mostra erro e redireciona área permitida. Não armazenar identidade/CPF/JWT em localStorage. Componentes novos sempre TS/HTML/SCSS separados. Contador usa `/finance/products` no seletor de custo, nunca `/products` operacional.

## 8. Dados existentes, implantação e administrador inicial

Preparar diagnóstico read-only e migração com dry-run padrão, sem conexão operacional nesta tarefa. Scripts devem rejeitar URI não exata autorizada durante QA, sem imprimir URI/segredos. Dry-run informa somente contagens, coleções/índices, referências ausentes, duplicatas normalizadas, usuários sem vínculo, ADMIN ativos/inativos e plano de tenant; PII mascarada. Nada de hash/senha/CPF no relatório.

Migração futura: backup consistente de banco e chaves, ensaio de restauração, manutenção sem tráfego, CNPJ/dados reais da empresa padrão fornecidos por operador e autorização separada após relatório. Copiar registros antigos para coleções v2 preservando `_id`/relações/históricos e acrescentando tenantId; não modificar nem remover originais. ADMIN mantém valor ADMIN e equivalência OWNER quando ACTIVE; active legado determina ACTIVE/INACTIVE. Tenant padrão ACTIVE só no procedimento autorizado, não por bootstrap público. Counters de destino inicializados a max(numero antigo,contador legado) do tenant, sem atualizar contador antigo. Auditoria com ator empresarial é associada ao tenant padrão; pré-auth sem ator permanece global explicitamente. Conflitos de referências/duplicatas interrompem antes da escrita.

Manifesto/versionamento de migração com runId e checksum da origem (sem exportar valores sensíveis), mapeamento de coleções e alvo. Reexecução verifica destino com fingerprint; skip se idêntico, aborta se diferente; usar somente `$setOnInsert` e jamais sobrescrever documento existente. Registrar conclusão e totais. Sem delete/drop/syncIndexes/credenciais padrão. Código de aplicação exige `TENANCY_V2_ENABLED=true` explícito; em produção adicionalmente validar manifesto de migração concluído ou declaração explícita de instalação nova. Isso evita apresentar silenciosamente o operacional como vazio. Não ativar essa configuração no .env operacional local nesta tarefa.

Primeiro PLATFORM_ADMIN: comando administrativo local separado do bootstrap, email/nome/senha fortes recebidos por variáveis de ambiente/prompt seguro (não argumento de shell), tenantId null, ACTIVE, bcrypt12 e auditoria. Não executado operacionalmente nesta tarefa. Exigir URI explícita, confirmação administrativa específica no comando e abortar se administrador já existe; não converter usuário empresarial. Exemplo documental usa nomes de variáveis, nunca senha/chave demonstrativa. QA pode criar administrador aleatório no banco autorizado via fixture.

## 9. Plano de testes e evidências exigidas

Não repetir segurança anterior sem mudança: aqui auth/roles/queries/schemas mudam, justificando regressão direcionada. Harness configura e valida URI literal `mongodb://127.0.0.1:27017/salgados_financeiro_test` antes dos imports, credenciais/chaves aleatórias e seeds desativadas. Índices v2 apenas aditivos. Snapshot anterior deve provar todos documentos prévios inalterados e nenhum removido; somente fixtures desta execução podem mudar. Cada execução usa IDs/CNPJ/CPF/emails únicos e válidos.

1. Unitários: CPF/CNPJ válidos/inválidos/repetidos/máscara, política senha/limites, criptografia roundtrip/tag/AAD, ausência de plaintext, matriz de status/role, guard sem política, transições/último OWNER/versões, construção de filtros/relatórios.
2. Integração Mongo/HTTP: duas empresas e perfis distintos, onboarding atômico (falha induzida depois de insert Tenant e antes User/auditoria), dupla solicitação concorrente, aprovação/recusa e histórico, role obrigatória e proibida, inativação/revogação/troca role, disputa último OWNER, suspensão/relogin/reactivação não ressuscita sessões antigas, global sem acesso comercial e empresas sem acesso global.
3. HTTP segurança: PENDING bloqueado em TODOS handlers operacionais,401/403/404 opacos, CNPJ inexistente, objetos/operadores/unknown/null, CSRF/cookies/CORS, limites públicos/plataforma, página2/total/busca por tenant, referências cross-tenant em financeiro/produção/pedidos, contadores independentes com mesmo número, email/categoria iguais entre empresas, auditoria e notificações isoladas.
4. Browser real: onboarding, espera, aprovação global, solicitação funcionário, badge muda sem refresh, aprovar com seleção obrigatória, recusar, alteração role/inativação refletida, URLs manuais/refresh cada role, ACCOUNTANT sem operações, isolamento duas empresas, erros/loading, encerramento polling/logout.
5. Regressão real: venda/reserva/liberação/finalização, produção/estoque, categorias/contas/pagamento/recorrência/relatório e isolamento entre caixas do mesmo tenant. Front bundle varrer CPF de fixtures e chaves/senhas conhecidas sem eco, JWT/URI e armazenamento indevido; scan é heurístico.
6. Builds Nest/Angular, unitários e integrações após alterações; principal reaproveita logs QA se não houver mudanças posteriores. Registrar comandos, exit code, suites/tests pass/fail/skip, versões, tempo, limitações, navegador e paths dos artefatos. Se Mongo standalone, teste real503/zero resíduos obrigatório, positivos transacionais explicitamente bloqueados; mocks adicionais não suprem essa evidência.

## 10. Riscos e itens externos

Transações exigem replica set/mongos e não serão provisionadas modificando daemon existente. HTTPS, Mongo autenticado/TLS/privilégios, backups e custódia/rotação das chaves são condições ambientais; limitação distribuída e crash do fluxo operacional permanecem riscos existentes. Sessões precisam revalidar estado sem cache para revogação. Troca de coleções requer migração autorizada antes de disponibilizar dados antigos. Não apresentar implementação como produção pronta nem esconder cobertura bloqueada. Nenhum segredo ou URI real em logs/documentação/bundle.
