# Seguranca backend e contrato de integracao

Implementado em 2026-09-14; validacao HTTP/Mongo real pertence a etapa QA. Matriz integral: [security-permissions.md](security-permissions.md). Protecao Mongo e provisionamento: [security-mongodb.md](security-mongodb.md).

## Sessao e frontend

1. `GET /api/auth/csrf` com `withCredentials: true` devolve `{csrfToken}`. Armazenar nonce somente em memoria; o cookie `salgados_csrf` e HttpOnly. Reutiliza nonce existente valido, permitindo abas concorrentes.
2. Todos POST/PATCH, inclusive login, enviam `X-CSRF-Token` e credenciais somente ao destino da API configurada. O browser fornece Origin. Backend exige correspondencia exata com FRONTEND_URL; chamadas sem Origin sao rejeitadas. Nenhum envio Bearer e aceito.
3. `POST /api/auth/login` com `{email,password}` retorna `{user:{sub,name,email,role}}`. O JWT nunca aparece no JSON. `GET /api/auth/me` retorna diretamente `{sub,name,email,role}` para restauracao assincrona da sessao.
4. `POST /api/auth/logout` com corpo vazio retorna `{success:true}`, incrementa sessionVersion do usuario e limpa os dois cookies. Revoga TODAS as sessoes desse usuario. Mudanca de usuario por ADMIN tambem incrementa a versao; guard reconsulta active/role/version em toda requisicao.
5. Cookies `salgados_session` e `salgados_csrf`: HttpOnly=true, Secure=true em NODE_ENV=production, SameSite=Lax, Path=/api, Max-Age=900 segundos, sem Domain. JWT HS256 tem issuer=salgados-api, audience=salgados-web e exp=15min. Nao existe refresh; expirar requer login. Remover tokens/usuario persistidos no localStorage. Nonce CSRF nao e segredo de autenticacao.
6. Tratar 401 limpando sessao local e indo ao login; 403 informa falta de permissao, sem exposicao de dados; 429 informa aguardar. Em CSRF expirado, buscar novo nonce antes de nova tentativa deliberada do usuario, sem repetir venda automaticamente.
7. SameSite=Lax supoe frontend/API no mesmo site. Publicacao cross-site nao faz parte deste fluxo: preferir reverse proxy e API no mesmo site. Nunca reduzir a politica automaticamente.

## Respostas e atualizacao

`GET /users`, `/products`, `/orders` e `/productions/today` continuam retornando arrays; agora aceitam page e limit (defaults1/100, max100). UI deve percorrer paginas quando precisar catalogo/lista completa; pagina final tem menos de limit itens. Financeiro e audit usam envelope `{items,total,page,limit,totalPages}`. Orders aceita somente status adicional; products somente activeOnly boolean estrito adicional; reports/daily somente date real YYYY-MM-DD.

Produtos ADMIN completos. CASHIER recebe `_id,name,category,priceCents,availableStock,availabilityMode,active,imageUrl` somente de produtos ativos; KITCHEN recebe `_id,name,category,availableStock,minimumStock,availabilityMode,active` somente ativos. Cozinha nunca recebe precos, custos ou usuarios. Producao GET/POST retorna somente `_id,productId,productName,quantity,createdAt`. Criacao de usuario retorna `_id,id,name,email,role,active`; listagem usa `_id,name,email,role,active`.

WebSocket foi desligado (sem decorator/gateway Socket.IO ativo). Remover cliente Socket.IO e adotar polling HTTP somente nas telas permitidas, sugerido a cada 15s e apos mutacoes; cancelar ao sair/deslogar. Nao consultar modulos administrativos ao renderizar caixa/cozinha.

Novo `PATCH /users/:id`: campos opcionais name,email,password,role,active. Senha12..72 caracteres e <=72 bytes UTF-8, bcrypt12. Impede que ADMIN remova o proprio acesso; nao exclui usuarios. Auditoria GET `/audit` exclusiva ADMIN. Producao permanece append-only; nao existe correcao/cancelamento exposto.

## Limites e HTTP

Janelas fixas de60s; cada rota/metodo tem contador por IP e, quando autenticada, outro por usuario. Login tambem conta hash SHA256 do email normalizado entre IPs. Limite preautenticacao adicional por IP/rota vale inclusive em 401. Variaveis: RATE_LIMIT_GENERAL=120, ADMIN=60, LOGIN=5, LOGOUT=10, ORDER_CREATE=30, PAYMENT=15 (todas prefixadas RATE_LIMIT_). PAYMENT cobre finalize e payment POST/PATCH. Login tem bloqueio progressivo por conta de500ms ate60s apos falhas, bcrypt dummy para usuario inexistente e mensagem generica. Excesso =>429. Valores de ambiente validados1..10000.

Contadores/bloqueios ficam em memoria por instancia e reiniciam com processo. Antes de escalar horizontalmente, implantar armazenamento compartilhado ou limitador central; controles por IP nao confiam em X-Forwarded-For e trust proxy permanece desativado. Atrás de proxy, provisionar limitador/trust proxy com enderecos confiaveis, sem habilitar confianca irrestrita.

`configureSecurityHttp(app)` e o setup compartilhado com QA. Criar Nest com `{bodyParser:false}`. ValidationPipe global whitelist/forbidNonWhitelisted/forbidUnknownValues/transform, sem implicit conversion. JSON/urlencoded64KiB, arrays<=100, profundidade<=8; chaves `$`, `.`, prototype/constructor/__proto__ rejeitadas. DTOs/pipes validam IDs de24hex, enums, limites, datas e campos extras. Filtros Mongo sao construidos pelo servidor, sem concatenacao bruta; strings de busca financeiras escapadas. Todas ordenacoes sao fixas; nenhum sort arbitrario.

CORS usa somente FRONTEND_URL explicitos, credentials=true, GET/POST/PATCH/OPTIONS, Content-Type/X-CSRF-Token; origem indevida403 inclusive em preflight. Helmet: default-src/script-src self; estilos self+unsafe-inline para Angular; img self/data/https; connect self+origens configuradas; object-src none; base-uri self; frame-ancestors none; nosniff; referrer-policy no-referrer; X-Frame-Options SAMEORIGIN adicional (CSP e mais restritiva); HSTS31536000/includeSubDomains somente producao com HTTPS_ENABLED=true. API Cache-Control:no-store. Erros5xx sem stack/driver/credencial; validationError nao inclui target/value.

## Auditoria e isolamento

Auditoria geral em security_audit_events: login sucesso/falha, logout, limites login, negacoes401/403/429 e mutacoes de users/products/productions/orders/finance. Acao deriva da rota declarada e verbo (ex.: orders.finalize.post, users.patch); identidade vem do guard; recurso e ID permitidos. Nenhum corpo, headers, senha, hash de senha, JWT, URI ou dados de cartao persistidos. Email de tentativa vira SHA256 somente. Financeiro mantem tambem historico atomico de snapshots allowlist.

Sucesso de mutacao e auditado apos a gravacao de negocio; isso nao e transacao conjunta. Falha da auditoria pode produzir500 apos commit, portanto cliente nao deve repetir operacoes automaticamente. Negacao HTTP continua negada se auditoria estiver indisponivel (o evento pode faltar). Implantacao exige monitoramento externo de disponibilidade e retencao/protecao da colecao. Permissao Mongo append-only depende da custom role documentada, nao somente de immutable no schema.

Equivalente a RLS: guards globais fail-closed + politica por endpoint + escopo de servico de pedidos pelo openedById da identidade atual + projecoes por role + validacao de referencias. CAIXA nao altera autoria nem troca ID para outro caixa. ADMIN tem escopo total; COZINHA nunca chama pedidos/financeiro. IDs fora escopo de pedido retornam403; inexistentes404. Nenhum endpoint DELETE.

## Concorrencia e limites residuais concretos

Order.mutationLocked e interno/select:false, adquirido por update atomico condicional a OPEN e nao-bloqueado; update/finalize/cancel sao serializados inclusive entre instancias, com optimisticConcurrency no save. Crash pode deixar pedido bloqueado: exigir reconciliacao administrativa externa, nao expirar automaticamente um lock com operacao possivelmente incompleta. Lock nao aparece nas respostas. Schema payment.amountCents alinhado ao limite monetario1e12 (ajuste coordenado apos encerramento do agente Mongo).

Estoque reservado condicionalmente; quantidades agregadas/total inteiro seguro validados antes de escrita; saldo sob demanda tem piso, producao tem teto operacional1milhao. Falha de criacao de pedido compensa reserva, falha de edicao tenta restaurar itens, falha de movimento tenta compensar saldo, falha de criacao de producao compensa incremento. Cancelamento persiste CANCELED antes de liberar itens, impedindo dupla liberacao por repeticao.

Nao ha transacao multidocumento no Mongo standalone. Queda de processo/rede entre estoque, pedido/producao e movimentos, falha na propria compensacao ou insertMany parcial ainda exigem reconciliacao. Cancelamento com liberacao parcial fica cancelado; nao repetir liberacao sem verificar movimentos. Nao foi implantado replica set, migracao de dados ou recuperador automatico. Esse risco de consistencia precisa ser resolvido antes de prometer atomicidade integral de estoque em producao.

## Segredos e ambiente

JWT_SECRET sem fallback, minimo32bytes; MONGODB_URI sem fallback; FRONTEND_URL obrigatorio. Exemplos raiz e apps/api sem valores reais; .gitignore cobre .env e variantes, com excecao .env.example, e chaves privadas usuais. SeedService agora inerte e fora AppModule; FinanceService.onModuleInit nao grava nada. Provisionar primeiro ADMIN externamente com senha aleatoria/bcrypt12, sem credencial embutida. Nenhuma rotacao real ou limpeza de historico git foi realizada. Arquivo .env local existente nao foi alterado.

Nao se armazenam PAN/CVV; somente metodo/valor de pagamento. HTTPS, Mongo autenticado/TLS/custom role, firewall/bind, indices aditivos, criptografia de disco/backups e secret manager dependem de ambiente. Nao se implementou CSFLE sem verificar edicao/infra, nem criptografia indiscriminada de campos consultados. Nao houve conexao ou escrita Mongo nesta etapa.
