# Painel unificado da plataforma

## Especificação — 18/09/2026

Reutilizar as aprovações de empresas e os serviços comerciais existentes em uma única página, exclusiva do PLATFORM_ADMIN. Não alterar contratos, permissões, endpoints ou dados operacionais.

Navegação única: resumo, empresas e aprovações, planos e módulos, descontos, cupons, assinaturas e cobranças. Desktop com barra lateral; celular com navegação que se reorganiza sem rolagem horizontal da página. Uma empresa selecionada identifica o contexto das operações comerciais. Os links anteriores /plataforma/empresas e /plataforma/comercial?tenant= continuam funcionando.

Preservar confirmação, motivo, validações, paginação, auditoria e proteção das rotas. Mudanças de empresa devem limpar proposta, cobranças e campos do contrato anterior; respostas atrasadas não podem substituir o contexto atual. Exibir estados em português, foco visível, labels e mensagens acessíveis.

Validação: build Angular atual e fluxo de navegador das aprovações e gestão comercial, incluindo larguras 320, 768 e 1440. Testes com escrita usam somente a URI autorizada, com verificação programática e preservação dos registros anteriores. Não repetir a auditoria do backend.

O acionamento do agente UX/UI foi bloqueado pelo limite de agentes da sessão. Revisão e implementação realizadas pelo principal.

## Entrega e validação

Implementado no PlatformComponent: shell único, menu lateral responsivo, resumo comercial integrado, aprovação e contexto da empresa. PlatformCommerceComponent é reutilizado como componente filho, preservando seus formulários, serviços e confirmações. A rota antiga comercial abre o mesmo painel, incluindo links com tenant. Não há novos endpoints ou mudanças de autorização. A tela empresarial do OWNER mantém seus estilos.

Arquivos alterados: `apps/web/src/app/app.routes.ts`, `features/tenancy/platform.component.{ts,html,scss}`, `features/commerce/platform-commerce.component.{ts,html}` (ambos sob apps/web/src/app), `scripts/commerce-integration.mjs`. Criados: `features/commerce/platform-commerce.scss` e este documento. Handoff principal atualizado.

Comandos finais:

- `npm run build --prefix apps/web`: saída 0; log `docs/saas-qa/platform-ui-build.log`.
- `node scripts/commerce-integration.mjs`, com TEST_MONGODB_URI e MONGODB_URI iguais a `mongodb://127.0.0.1:27017/salgados_financeiro_test` e COMMERCE_BROWSER=true: saída 0; **33 aprovados, 0 falhos**; log `docs/saas-qa/platform-ui-tests.log`.

Execução final: `1789739539197-2fa11b64c3`, evidências e manifestos em `docs/tenancy-qa/1789739539197-2fa11b64c3/`. Inclui criação de plano pelo formulário, link comercial antigo com tenant, faturamento existente, aprovação de empresa e acesso a contratação na mesma URL, troca para empresa sem contrato sem exibir fatura anterior, regressão da visão OWNER, ausência de exceções JS, preservação dos documentos anteriores. Larguras verificadas: 320, 768 e 1440. Capturas desktop/mobile inspecionadas visualmente na execução anterior aprovada; capturas finais também produzidas.

Primeira execução: 31 aprovados e 2 falhos por atualização do componente filho ao mudar seção; corrigido com marcação explícita para atualização Angular. Log inicial preservado em `docs/saas-qa/platform-ui-tests-initial.log`. Após correção, duas execuções consecutivas com 33 aprovados.

Avisos existentes: orçamento SCSS da landing institucional, dependência CommonJS qrcode, Node 25 não LTS e deprecações Mongoose. Backend não alterado; build Nest e suíte unitária completa não repetidos nesta entrega. Não realizados testes com leitor de tela nem dispositivos físicos. Banco operacional não utilizado. Artefatos do Angular gerados; publicação externa/cópia para API pública não executada.

Uso: entrar como administrador em `/plataforma/login`; abrir `/plataforma/empresas`. Em Empresas e aprovações, selecionar status e Detalhes, registrar a decisão. Plano e cobranças abre o contrato da empresa no mesmo painel. Os demais itens do menu acessam catálogo, descontos e cupons sem trocar de página.
