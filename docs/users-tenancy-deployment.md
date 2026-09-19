# Implantação persistente de usuários e empresas

## Estado e limites

Schemas apontam exclusivamente para as coleções v2 definidas na especificação. `autoIndex:false` e `autoCreate:false` em todos os modelos; não executar `syncIndexes`. Nenhum dado legado é associado implicitamente durante login. A API deve exigir `TENANCY_V2_ENABLED=true` e, em produção, manifesto concluído ou declaração explícita de instalação nova. Não alterar o `.env` operacional para habilitar esta evolução nesta tarefa.

MongoDB precisa suportar transações reais (replica set ou mongos). Não reconfigurar o daemon durante QA. Onboarding e decisões de empresa/membros devem verificar capacidade antes de escrever e retornar `TRANSACTIONS_REQUIRED`/503 quando standalone. Índices devem ser provisionados antes das transações. Guardas e serviços verificam tenant/status e usam `runValidators:true` em updates; validação Mongoose de documento não substitui validação de transições no serviço nem executa middleware de documento em `updateOne`.

## Chaves e recuperação do CPF

Configurar `CPF_ENCRYPTION_KEY` e `CPF_HASH_KEY`, ambas com 32 bytes aleatórios codificados em base64, independentes. Não registrar valores, não passar por argumentos de shell nem colocar no frontend/repositório. Helper falha se ausentes/inválidas/iguais. AES-256-GCM usa IV aleatório e AAD contendo o tenant; HMAC-SHA256 permite índice de duplicidade sem CPF em claro. Envelope versão `1`; recuperação exige o tenant correto. Rotação e suporte a múltiplas versões exigem procedimento futuro explícito, backup seguro das chaves antigas e revisão. Nenhum endpoint de recuperação de CPF completo foi criado.

## Diagnóstico e migração

Ferramenta: `node scripts/tenancy-storage.mjs [diagnose|dry-run|provision|apply]`. Padrão `diagnose`, somente leitura. Migração é `dry-run` até comando explícito `apply`. Todos os modos atualmente **rejeitam qualquer URI diferente do banco de teste autorizado**, antes de importar Mongoose. Não há dotenv implícito. O uso operacional futuro exige revisão explícita dessa trava, autorização separada e validação do relatório operacional; não basta reutilizar os comandos abaixo.

Pré-requisitos: dependências da API instaladas; para dry-run/provision/apply, build Nest atualizado com schemas v2 em `apps/api/dist`. O diagnóstico dispensa build e não importa a aplicação.

```powershell
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
node scripts/tenancy-storage.mjs diagnose
# TENANCY_MIGRATION_PLAN deve apontar para arquivo privado preparado pelo operador.
node scripts/tenancy-storage.mjs dry-run
```

Formato do plano privado: `runId` exclusivo (8..100 caracteres alfanuméricos, hífen ou underscore), `tenantId`, `ownerId` de ADMIN legado ativo, `counterId` estável caso contador orders inexista, `effectiveAt` ISO estável e `company:{cnpj,legalName,tradeName,corporateEmail,phone}` com dados reais. Não incluir senha ou CPF. A ferramenta não inventa proprietário nem credenciais. Não versionar esse arquivo. Dry-run fornece apenas contagens, nomes de coleções/índices, conflitos classificados e checksums; não imprime PII, URI, hashes de senha nem erros brutos do driver.

Antes de autorizar execução futura:

1. Fazer backup consistente de dados e backup separado das chaves; ensaiar restauração em ambiente isolado. Congelar tráfego para manter origem estável.
2. Revisar diagnóstico: referências ausentes, duplicidades normalizadas, vínculos preexistentes ou campos legados sensíveis impedem migração. Escolher corretamente a empresa padrão e ADMIN ativo. Grandes bases precisam revisão de consumo de memória: diagnóstico atual lê coleções integralmente para verificar relações e checksum.
3. Apresentar dry-run e obter autorização separada. `TENANCY_MIGRATION_APPROVAL` deve conter exatamente runId autorizado; `TENANCY_REVIEWED_CHECKSUM` deve conter o checksum revisado da origem.
4. Provisionar aditivamente com `provision` (cria 11 coleções de modelos, índices declarados e coleção de manifestos). Não remover índices antigos. Esse comando não insere credenciais/dados de aplicação.
5. Executar `apply` autorizado. Ele exige transações, relê checksum da origem no snapshot e usa apenas `$setOnInsert` no destino. Copia `_id` e relações, conserva originais, incrementa a versão de sessão de usuários copiados e mantém ADMIN. Contador novo usa o máximo entre contador legado e números de pedidos. Auditoria sem ator fica global; com ator fica na empresa padrão.
6. Verificar manifesto `tenancy_migrations_v2`: `_id=runId`, `completed:true`, tenantId, checksums e totais. Reexecução idêntica verifica fingerprints e conserva destino; divergência aborta. Não rodar novamente depois de tráfego v2 alterar destino.
7. Só depois habilitar a aplicação com a configuração explícita, validar login e manter backup/originais. Provisionamento/admin operacional, migração e configuração ambiental não foram executados nesta entrega.

## Primeiro administrador de plataforma

O comando separado `node scripts/create-platform-admin.mjs` não é importado pela API e não cria usuários automaticamente na inicialização. Nesta entrega, exige `TEST_MONGODB_URI` e `MONGODB_URI` iguais a `mongodb://127.0.0.1:27017/salgados_financeiro_test`; uso operacional permanece indisponível pela trava de URI.

Recebe `PLATFORM_ADMIN_NAME`, `PLATFORM_ADMIN_EMAIL` e `PLATFORM_ADMIN_PASSWORD` pelo ambiente, além de `TENANCY_BOOTSTRAP_CONFIRM=CREATE_FIRST_PLATFORM_ADMIN`. Não passar senha por argumento de shell nem registrar os valores. Exige senha de pelo menos 12 caracteres e no máximo 72 bytes, build atualizado, coleções/índices previamente provisionados e MongoDB transacional.

Em uma transação, verifica ausência de PLATFORM_ADMIN, insere o marcador exclusivo `first-platform-admin-v1` em `tenancy_migrations_v2`, cria um usuário ACTIVE com tenantId null e senha bcrypt12, e registra `platform.bootstrap` na auditoria. O marcador serializa tentativas concorrentes. Recusa administrador já existente e standalone antes de qualquer escrita. Esse comando não foi executado nesta retomada; criação bem-sucedida e concorrência do bootstrap permanecem sem validação real.

## Contrato para o backend

- `common/enums.ts`: UserRole mantém ADMIN e adiciona OWNER/ACCOUNTANT/PLATFORM_ADMIN; UserStatus e TenantStatus separados.
- `common/brazil-documents.ts`: `normalizeCpf(unknown):string`, `normalizeCnpj(unknown):string` lançam Error genérico; `isValidCpf/isValidCnpj(unknown):boolean`. DTO/serviço deve converter erro em 400. Formatos aceitos: dígitos ou máscara convencional exata.
- `common/cpf-crypto.ts`: `new CpfCrypto(env?)`; `protect(cpf, tenantIdString)` retorna `{cpfEncrypted,cpfHash,cpfLastDigits}`; `hash(cpf)`, `encrypt(cpf,tenant)`, `decrypt(envelope,tenant)`. `maskCpf(lastDigits?):string|null`. Consultas de usuários precisam `.select('+cpfLastDigits')` para máscara; nunca expor campos internos por spread/lean sem projeção.
- `tenants/tenant.schema.ts`: Tenant/TenantDocument/TenantSchema; histórico `action` usa `approved|rejected|suspended|reactivated|migrated`, `actorId`, `occurredAt`, reason exigido para rejeição/suspensão/reativação. Serviço deve fazer `$push`, nunca substituir histórico.
- User.role agora `UserRole|null`, tenantId `Types.ObjectId|null`. Só plataforma aceita tenant nulo; ACTIVE/INACTIVE exigem role. `active` é espelho legado, sem autoridade. Campos CPF `select:false`; `toJSON` remove segredos como proteção adicional, mas lean exige serializer.
- Tenant.sessionVersion e membershipVersion são `select:false`: backend deve selecioná-los explicitamente ou incrementar atomicamente. Operações de membros serializam pelo documento Tenant dentro da transação antes da contagem do último OWNER/ADMIN.
- AuditEvent tem tenantId nullable e targetTenantId opcional. Serviço define explicitamente contexto global/empresarial e nunca fornece bypass global a ADMIN. Auditoria de decisões participa da transação.
- Não há coleção de sessões: revogação continua por versões do usuário e tenant no JWT revalidado em cada requisição.

## Administrador adicional no banco de teste

Para acesso manual de QA quando ja existem administradores e o MongoDB local e standalone, `scripts/add-test-platform-admin.mjs` e um procedimento separado do bootstrap operacional. Exige `MONGODB_URI` e `TEST_MONGODB_URI` iguais a `mongodb://127.0.0.1:27017/salgados_financeiro_test` e `TENANCY_BOOTSTRAP_CONFIRM=ADD_TEST_PLATFORM_ADMIN`. Recebe uma linha JSON por stdin com `name`, `email` e `password`; nunca coloque a senha em argumentos de shell ou arquivos versionados.

O comando exige o indice unico tenantId/email existente e recusa alterar uma identidade preexistente. Valida os documentos, cria a conta INACTIVE, registra auditoria e somente depois ativa a conta. Essas etapas nao sao uma transacao: se ocorrer falha parcial, os registros sao preservados e o erro exige revisao; nao ha limpeza automatica nem sobrescrita na repeticao. O procedimento nao serve para producao e nao modifica o bootstrap do primeiro administrador.

Validacao do acesso: `scripts/verify-test-platform-login.mjs` recebe uma linha JSON por stdin com `email` e `password`, inicia API temporaria exclusivamente no banco autorizado, verifica CSRF, login, sessao e listagem de empresas, e encerra a API. O login bem-sucedido gera auditoria. A tela para acesso manual e `/plataforma/login`, sem CNPJ.
