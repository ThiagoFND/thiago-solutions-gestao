# Matriz de permissoes HTTP

Implementacao backend: 2026-09-14. Prefixo de todos os caminhos: `/api`.
A = ADMIN; C = CASHIER (CAIXA); K = KITCHEN (COZINHA).
Sem cookie de sessao valido: 401 em todos endpoints protegidos. Role sem permissao: 403.
ADMIN tem todas as politicas declaradas; handler sem politica explicita e negado inclusive ao ADMIN.
Todos POST/PATCH exigem Origin permitido e X-CSRF-Token, inclusive login.

| Metodo | Caminho | Roles | Escopo e projecao |
|---|---|---|---|
| GET | /auth/csrf | Publico | Nonce CSRF, sem credencial de sessao |
| POST | /auth/login | Publico | Credenciais validadas; usuario proprio; JWT somente em cookie |
| GET | /auth/me | A C K | sub/name/email/role do usuario atual |
| POST | /auth/logout | A C K | Revoga todas as sessoes do proprio usuario |
| GET | /users | A | Lista paginada sem hash/sessionVersion |
| POST | /users | A | Criacao com bcrypt12, sem eco de senha |
| PATCH | /users/:id | A | Nome/email/senha/role/active; revoga sessoes; nao permite remover proprio acesso admin |
| GET | /products | A C K | A completo; C catalogo ativo com preco/saldo; K ativo sem preco/custo/autoria |
| POST | /products | A | Cadastro validado |
| PATCH | /products/:id | A | Cadastro validado, sem escrita direta no estoque |
| GET | /productions/today | A K | Producao de hoje; ID/produto/nome/quantidade/data |
| POST | /productions | A K | Produto ativo, quantidade limitada, autoria servidor |
| GET | /orders | A C | C somente openedById atual; A todos; status/paginacao |
| GET | /orders/:id | A C | C somente proprio; fora escopo 403, inexistente 404 |
| POST | /orders | A C | Autoria servidor, produtos ativos e preco servidor |
| PATCH | /orders/:id | A C | Proprio C/todos A, somente OPEN, bloqueio atomico |
| POST | /orders/:id/finalize | A C | Proprio C/todos A, OPEN, soma pagamentos exata |
| POST | /orders/:id/cancel | A C | Proprio C/todos A, OPEN, motivo e compensacao estoque |
| GET | /reports/daily | A | Data civil real; relatorio administrativo |
| GET | /finance/entries | A | Filtros allowlist e paginacao |
| GET | /finance/entries/:id | A | Detalhe financeiro |
| POST | /finance/entries | A | Referencias/categoria/tipo validados |
| PATCH | /finance/entries/:id | A | Controle de versao/status |
| POST | /finance/entries/:id/payment | A | Pagamento integral e historico atomico |
| PATCH | /finance/entries/:id/payment | A | Correcao confirmada e motivo |
| POST | /finance/entries/:id/cancel | A | Somente pendente, motivo |
| GET | /finance/entries/:id/history | A | Historico paginado |
| GET | /finance/summary | A | Mes/ano validados |
| GET | /finance/reports/monthly | A | Mes/ano validados |
| GET | /finance/categories | A | Filtros allowlist e paginacao |
| POST | /finance/categories | A | Categoria validada |
| PATCH | /finance/categories/:id | A | Regras de referencia |
| POST | /finance/categories/:id/deactivate | A | Desativa, sem excluir |
| GET | /finance/recurrences | A | Filtros allowlist e paginacao |
| GET | /finance/recurrences/:id | A | Detalhe financeiro |
| POST | /finance/recurrences | A | Template e primeira geracao |
| PATCH | /finance/recurrences/:id | A | Versao, regras de calendario |
| POST | /finance/recurrences/:id/generate | A | Competencia valida; indice unico/idempotencia |
| POST | /finance/recurrences/:id/deactivate | A | Desativa, sem excluir |
| GET | /audit | A | Eventos saneados, paginacao |

Total: 40 handlers HTTP, 38 protegidos por sessao e 2 publicos limitados.
`endpoint-policy.spec.ts` verifica as politicas e a contagem por metadata; QA precisa comprovar respostas HTTP.
Socket.IO `/updates` removido: EventsGateway agora e provider sem decorator WebSocket; seus emissores sao inertes. Atualizacao pela SPA deve usar polling HTTP autorizado.
Nao ha endpoints DELETE, exportacao, reset, senha esquecida, refresh, configuracoes ou edicao/cancelamento de producao. Producao permanece append-only; correcao compensatoria exige futura regra auditavel, nao acesso direto a documentos.
