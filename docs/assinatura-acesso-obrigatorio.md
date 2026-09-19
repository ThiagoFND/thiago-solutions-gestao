# Assinatura obrigatória — 18/09/2026

Pedido: empresas sem plano não podem operar; somente atribuição administrativa de contrato com status e vigência permitidos libera os recursos contratados.

Diagnóstico somente leitura: configuração local aponta para salgados_financeiro_test; 69 empresas, zero assinaturas, zero ofertas comerciais. Flag comercial ausente. Endpoints comerciais respondem 401 sem autenticação, confirmando existência. Não foi reproduzido erro 404 autenticado; ausência de contrato deve continuar sendo 200 com subscription=null. Nenhum contrato precisa ser removido nesta base.

Implementação prevista: retirar bypass comercial por variável de ambiente; publicar subscriptionAllowed na identidade; sem contrato válido mascarar todas as permissões internas, inclusive base; guard negar operação empresarial com código SUBSCRIPTION_REQUIRED. Preservar login, sessão, próprio perfil e consulta/simulação/solicitação de assinatura do proprietário, que não liberam acesso. PLATFORM_ADMIN permanece global. Contrato válido continua sujeito às permissões e aos módulos contratados.

Frontend deve orientar cadastro de catálogo ausente, distinguir assinatura ausente de erro de carregamento e encaminhar OWNER sem acesso para Plano e assinatura. Não criar planos, atribuir contratos ou apagar históricos silenciosamente. Preservar status/vigência já documentados (incluindo trial e tolerância explícita).

Validação: unitários, builds Nest/Angular e integração HTTP/Mongo/navegador exclusivamente na URI de teste autorizada; provar negação de base sem plano, liberação seletiva e bloqueio após suspensão, inclusive sessão já aberta. Preservar todos os documentos anteriores.

## Resultado

Implementado: autorização comercial obrigatória independentemente de flag; `subscriptionAllowed` calculado pelo servidor e incluído na identidade pública; guard com exceção explícita por metadata somente para área de regularização; capacidade de criação negada sem contrato; login OWNER sem plano direcionado à assinatura; tentativa de URL interna também direcionada à assinatura; menus sem permissões operacionais; sessão aberta atualiza menus e navegação por polling, enquanto backend revalida a cada requisição. Login/perfil/logout continuam disponíveis.

Administrador: estado Sem assinatura explica bloqueio e como contratar. Catálogo vazio apresenta Configurar planos e impede simulação inválida. Falha de consulta não é exibida como contrato inexistente; há mensagem e Atualizar contrato. Seletores de plano, ciclo e status possuem nomes acessíveis explícitos.

Arquivos: `apps/api/src/commerce/entitlements.service.ts`, `entitlements.service.spec.ts` (novo), `commerce.module.ts`; `apps/api/src/auth/{roles.guard,auth.service}.ts`; `apps/api/src/common/auth-user.ts`; `apps/api/src/tenants/tenant-access.service.ts`; `apps/web/src/app/core/{models,auth.service,auth.guard}.ts`; `apps/web/src/app/layout/shell.component.ts`; `apps/web/src/app/features/commerce/{platform-commerce.component.ts,platform-commerce.component.html,subscription.component.html}`; `apps/web/src/app/features/tenancy/platform.component.html`; `scripts/commerce-integration.mjs` e handoffs.

### Evidência atual

- `npm test --prefix apps/api`: **261 aprovados, 0 falhos**, 17 arquivos, saída 0. Variáveis TEST_MONGODB_URI e MONGODB_URI com URI exata autorizada. Log `docs/saas-qa/subscription-unit.log`. Tentativa anterior sem variável exclusiva foi corretamente recusada pela suíte de persistência; nenhuma escrita foi efetuada por essa recusa.
- `npm run build --prefix apps/api`: saída 0, `docs/saas-qa/subscription-backend-build.log`.
- `npm run build --prefix apps/web`: saída 0, `docs/saas-qa/subscription-frontend-build.log`.
- `COMMERCE_BROWSER=true` e `node scripts/commerce-integration.mjs` com ambas as URIs exatas: **33 aprovados, 0 falhos**, saída 0; execução final `1789740202534-6c15330ecc`. Log `docs/saas-qa/subscription-integration.log`; evidências/manifestos em `docs/tenancy-qa/1789740202534-6c15330ecc/`.

O teste configura a flag antiga como false e comprova que não contorna a proteção. Verifica produtos/categorias/usuários/cargos/vendas retornando 403 sem contrato, identidade sem permissões, consulta da assinatura com 200/null, perfil acessível, suspensão bloqueando a mesma sessão e ativação restaurando o contrato. Navegador cria a primeira assinatura Básico de uma empresa recém-aprovada, confirma acesso a produtos/vendas e negação do financeiro, verifica login sem plano e acesso direto a /produtos direcionados a /assinatura. Todos os registros anteriores foram preservados.

Durante ampliação do teste foram corrigidos labels dos seletores e redirecionamento da URL proibida (ia para perfil). Execuções intermediárias falhas constam das respectivas pastas do harness; resultado acima é o da versão final. Não houve limpeza de contratos existentes, seeds operacionais ou publicação externa. Persistem avisos anteriores de SCSS da landing institucional, qrcode CommonJS e Node não LTS.

### Uso e continuidade

Carregar a API atualizada (em desenvolvimento: `npm run dev` na raiz) e atualizar o navegador. Em Planos e módulos, preencher motivo e usar Cadastrar catálogo inicial sugerido, caso ainda vazio; trata-se de uma ação explícita administrativa. Selecionar empresa → Plano e cobranças → plano, status Ativa e datas válidas → Simular contratação → Confirmar contratação imediata. Alterar somente status requer contrato existente e não atribui plano. A aprovação cadastral de uma empresa não concede assinatura.

Todas as 69 empresas da base local consultada já estavam sem plano. Não foi necessário remover nada. Não foi consultada nem modificada outra base operacional. Processos antigos sem hot reload precisam ser reiniciados pelo operador; não foram interrompidos nesta execução.

Os testes históricos de catálogo/tenancy que dependiam de acesso sem contrato não foram repetidos; suas fixtures precisarão de contratos explícitos antes de nova validação. A flag false não deve ser usada para reintroduzir bypass. Pendências comerciais gerais do handoff anterior permanecem fora desta correção.
