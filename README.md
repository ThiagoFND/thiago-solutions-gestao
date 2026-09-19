# Thiago Solutions Digitais

Plataforma de gestão multiempresa desenvolvida em **Angular, NestJS e MongoDB**. O projeto começou como um MVP para produção e venda de salgados e evoluiu para reunir operações, despesas, tesouraria, relacionamento com clientes e gestão comercial de assinaturas.

Cada empresa mantém seus próprios dados, usuários, cargos e configurações. O acesso combina situação da empresa, assinatura vigente, módulos contratados e permissões por ação. O administrador da plataforma possui uma área separada para aprovações e gestão comercial.

**Estado do projeto:** desenvolvimento ativo, com módulos em diferentes estágios de maturidade. A existência de uma tela ou endpoint não significa cobertura completa nem prontidão para produção. Os relatórios em `docs/` são registros datados; esta revisão do README foi baseada na leitura do código e não representa uma nova execução de testes.

## Conteúdo

- [Funcionalidades](#funcionalidades)
- [Arquitetura e tecnologias](#arquitetura-e-tecnologias)
- [Preparação local](#preparação-local)
- [Configuração](#configuração)
- [Primeiro acesso](#primeiro-acesso)
- [Comandos e validação](#comandos-e-validação)
- [Regras de negócio e segurança](#regras-de-negócio-e-segurança)
- [Limitações](#limitações)
- [Documentação e contribuição](#documentação-e-contribuição)

## Funcionalidades

| Área | Capacidades presentes |
| --- | --- |
| Empresas e usuários | Cadastro e aprovação de empresas, solicitação de acesso, membros, cargos personalizados e permissões por ação. |
| Produtos e vitrine | Categorias por empresa, produtos de fabricação própria/revenda, imagens, disponibilidade por estoque ou sob demanda e vitrine pública em `/empresa/:slug`. |
| Vendas e produção | Pedidos, pagamentos, registros de produção, movimentações de estoque e atualização em tempo real. |
| Estoque e qualidade | Insumos, fichas técnicas, recebimentos, ajustes de estoque e devoluções com avaliação e destino. |
| Despesas | Despesas operacionais/pessoais, custos de produção, categorias, recorrências, pagamentos PF/PJ, comprovantes privados e histórico. |
| Financeiro | Contas de tesouraria, recebíveis/pagáveis, baixas e integração com cobranças de outros módulos. |
| Contábil | Plano de contas, lançamentos equilibrados, razão, demonstrativos auxiliares, fechamentos e obrigações. |
| Cadastros e CRM | Contatos centrais, clientes/fornecedores, oportunidades e acompanhamento comercial. |
| Serviços e contratos | Agenda/ordens de serviço, contratos de clientes, aditivos e geração explícita de cobranças. |
| Fidelidade | Programas, adesões, registro de pontos, validade, resgate e estorno. |
| Projetos | Projetos, escopo, equipe, tarefas, dependências, revisão, comentários e horas registradas manualmente. |
| Compras | Pedidos a fornecedores, aprovação, recebimentos parciais e integrações condicionais com estoque e tesouraria. |
| Logística | Ordens, remessas, rotas/paradas, despacho, tentativas, confirmação de recebimento e retorno. |
| BI | Indicadores internos, fontes externas via CSV, metas, filtros e exportação. |
| Documentos e filiais | Arquivos privados versionados e compartilhados; cadastro de unidades, responsáveis e membros. |
| Plataforma comercial | Ofertas e preços versionados, planos, módulos, descontos, cupons, assinaturas, quotas, cobranças manuais e solicitações. |
| Site institucional | Apresentação de soluções, recomendação de módulos e solicitação de contato comercial. |

A vitrine não oferece checkout público. A contratação comercial controla quais capacidades uma empresa pode utilizar; o catálogo não deve ser interpretado como garantia de implementação integral de cada módulo.

Na navegação atual, **Despesas** corresponde a `/despesas`, **Financeiro** a `/financeiro` e **Contábil** a `/contabil`. Documentos antigos podem usar “Financeiro” para a área de despesas. A funcionalidade de registro de ponto foi removida; referências históricas não representam uma capacidade atual.

## Arquitetura e tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | Angular 22, componentes standalone, rotas lazy, TypeScript e SCSS |
| API | NestJS 12, Node.js, Express, validação de DTOs e módulos por domínio |
| Persistência | MongoDB, Mongoose 9, coleções v2 e índices explícitos |
| Sessão | JWT em cookie HttpOnly, proteção CSRF e autorização no backend |
| Eventos | Socket.IO |
| Testes | Vitest, scripts Node.js e navegação com Playwright Core/Chrome |

```text
apps/
  api/
    src/
      auth/ tenants/ users/ roles/   Identidade e autorização
      commerce/                     Planos, assinaturas e cobranças
      products/ catalog/            Produtos e vitrine
      orders/ productions/ inventory/
      finance/ business/            Despesas, tesouraria e contábil
      crm/ service-orders/ contracts/ loyalty/
      projects/ purchases/ logistics/ bi/
      documents/ branches/ portfolio/ audit/ events/
  web/
    src/app/
      core/                         Sessão, modelos e clientes HTTP
      layout/                       Navegação e estrutura visual
      features/                     Telas por domínio
scripts/                            QA, diagnósticos e provisionamento
docs/                               Contratos, manuais e relatórios
```

A API usa o prefixo `/api`. O build raiz compila a interface, copia a SPA para `apps/api/public` e compila o NestJS. O servidor pode servir interface e API na mesma origem. O monorepo possui três instalações npm e seus respectivos lockfiles; não usa npm workspaces.

## Preparação local

Os exemplos abaixo usam **PowerShell**, executados na raiz de um clone ou cópia deste repositório. Em outros sistemas, adapte a sintaxe das variáveis de ambiente.

Pré-requisitos:

- Node.js 24 e npm; os pacotes declaram Angular 22 e NestJS 12.
- MongoDB disponível em `127.0.0.1:27017`.
- **Replica set ou mongos para fluxos transacionais**, incluindo cadastro/aprovação e mutações comerciais. MongoDB standalone não permite validar esses fluxos integralmente.
- Chrome local para as suítes que incluem navegador; `playwright-core` não instala um navegador automaticamente.

Toda aplicação local de QA e toda escrita de teste devem utilizar exclusivamente:

```text
mongodb://127.0.0.1:27017/salgados_financeiro_test
```

Preserve dados anteriores, inclusive fixtures de execuções passadas. Não apague bancos, coleções ou registros, não reinicialize volumes e não use `syncIndexes` para remover índices. O banco operacional `salgados_mvp` não faz parte deste procedimento.

### 1. Instalar e compilar

```powershell
git clone https://github.com/ThiagoFND/thiago-solutions-gestao.git
cd thiago-solutions-gestao
npm ci
npm ci --prefix apps/api
npm ci --prefix apps/web
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:MONGODB_URI=$env:TEST_MONGODB_URI
$env:LEAD_EMAIL_ENABLED='false'
npm run build
npm test
```

`npm ci` utiliza as versões dos lockfiles. `npm run install:all` é uma alternativa existente para instalar as dependências dos dois aplicativos com `npm install`.

### 2. Exercitar a aplicação isolada

Após o build, com MongoDB transacional disponível e as duas variáveis de banco acima definidas:

```powershell
$env:COMMERCE_BROWSER='true'
npm run test:commerce
```

A suíte comercial usa uma API temporária em `http://127.0.0.1:4341`, provisiona coleções/índices aditivamente, cria identidades exclusivas de teste, executa cenários e encerra a aplicação. O harness fornece segredos temporários próprios e registra a preservação dos documentos anteriores. Os dados criados pela execução permanecem no banco. Credenciais de fixture não são contas padrão para uso manual.

Defina `COMMERCE_BROWSER='false'` para executar sem a parte de navegador. Suítes que exigem transações podem falhar em standalone; isso deve ser registrado como limitação do ambiente, sem substituir o banco autorizado. Não encerre serviços de outras pessoas para liberar portas e execute suítes com escrita sequencialmente.

### 3. Usar a interface manualmente

O uso manual requer configuração persistente, coleções/índices provisionados e primeiro administrador criado explicitamente. Siga [Implantação de usuários e empresas](docs/users-tenancy-deployment.md) e [Assinatura obrigatória](docs/assinatura-acesso-obrigatorio.md) antes de iniciar.

O arquivo `apps/api/.env.example` é um modelo sem credenciais. Copie-o para `apps/api/.env` somente se esse arquivo ainda não existir e preencha os campos descritos abaixo. Configure nele a mesma URI de teste e mantenha as duas variáveis de banco explícitas no terminal.

```powershell
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:MONGODB_URI=$env:TEST_MONGODB_URI
$env:LEAD_EMAIL_ENABLED='false'
npm run dev
```

A interface de desenvolvimento fica em `http://localhost:4200` e a API em `http://localhost:3000/api`. A origem usada no navegador precisa estar autorizada em `FRONTEND_URL`. O script `dev` expõe o servidor Angular em `0.0.0.0`; considere isso ao escolher a rede local.

O `docker-compose.yml` existente inicia MongoDB com autenticação e volume persistente, mas **não configura replica set nem provisiona contas automaticamente**. Ele não substitui os pré-requisitos transacionais. Não o inicie sobre uma porta já utilizada pelo MongoDB local.

## Configuração

Configure segredos somente no servidor, usando ambiente ou arquivo local não versionado. Nunca coloque chaves no Angular, no README, em capturas de tela ou nos argumentos de comandos.

| Variável | Uso |
| --- | --- |
| `MONGODB_URI` | Obrigatória; nos exemplos e em QA, exatamente a URI de teste acima. Não há fallback operacional no código atual. |
| `TEST_MONGODB_URI` | Trava dos scripts de QA; exige a mesma URI exata. |
| `MONGODB_USER` / `MONGODB_PASSWORD` | Credenciais opcionais locais, fornecidas em conjunto. Produção exige autenticação. |
| `MONGODB_TLS` / `MONGODB_TLS_CA_FILE` | TLS e certificado de CA quando necessário. Produção exige TLS. |
| `JWT_SECRET` | Segredo aleatório com pelo menos 32 bytes; não há valor padrão. |
| `CPF_ENCRYPTION_KEY` | 32 bytes aleatórios codificados em base64 para criptografia. |
| `CPF_HASH_KEY` | Outros 32 bytes aleatórios em base64, independentes da chave de criptografia. |
| `TENANCY_V2_ENABLED` | Deve ser `true` após preparar o armazenamento v2. O exemplo começa desabilitado. |
| `TENANCY_NEW_INSTALLATION` | Declaração explícita de instalação nova; não substitui provisionamento. Produção exige essa declaração ou manifesto de migração concluída. |
| `FRONTEND_URL` | Origens HTTP(S) exatas separadas por vírgula; local: `http://localhost:4200,http://127.0.0.1:4200`. |
| `NODE_ENV` / `PORT` | Ambiente de execução e porta da API; porta padrão `3000`. |
| `HTTPS_ENABLED` | Deve ser `true` em produção, com origens HTTPS e terminação TLS configurada. |
| `BUSINESS_UTC_OFFSET` | Deslocamento de horário configurável para regras que o utilizam; exemplo `-03:00`. |
| `RATE_LIMIT_*` | Limites de requisições por grupo; consulte o `.env.example` e a configuração de segurança. |
| `ATTACHMENT_STORAGE_DIR` | Diretório privado de anexos; em QA o harness separa arquivos por execução. |
| `LEAD_EMAIL_ENABLED` | Habilita envio de contatos comerciais; mantenha `false` em QA manual. |
| `RESEND_API_KEY` / `LEAD_EMAIL_FROM` | Configuração opcional do transporte de e-mail, com remetente validado. |
| `CHROME_PATH` | Caminho do Chrome para scripts de navegador que aceitam essa opção. |

As chaves de CPF devem ser guardadas de forma persistente e segura; gerar outras a cada reinício impede recuperar dados criptografados com as anteriores. `JWT_REFRESH_SECRET` não é utilizado. A antiga flag `COMMERCIAL_ENTITLEMENTS_ENABLED` não desabilita a exigência de assinatura no código atual.

## Primeiro acesso

Não existem usuário ou senha padrão e a API não cria automaticamente o administrador inicial.

1. Prepare coleções e índices v2 de forma aditiva. Os scripts `tenancy-storage.mjs`, `commerce-storage.mjs` e `portfolio-storage.mjs` possuem escopos diferentes e estão restritos ao banco de teste; consulte seus modos antes de aplicar mudanças.
2. Crie o primeiro `PLATFORM_ADMIN` com `scripts/create-platform-admin.mjs`, conforme o [procedimento de provisionamento](docs/users-tenancy-deployment.md). Ele exige MongoDB transacional e dados recebidos pelo ambiente.
3. Acesse `/plataforma/login` com e-mail e senha. O painel `/plataforma/empresas` concentra a administração global.
4. Cadastre uma empresa em `/cadastrar-empresa`. A empresa/proprietário aguardam aprovação. Funcionários usam `/solicitar-acesso` e recebem um cargo na aprovação.
5. Prepare ofertas e uma assinatura válida para a empresa. Aprovar cadastro não contrata módulos automaticamente.
6. O acesso empresarial em `/login` usa CNPJ, e-mail e senha. Sem assinatura válida, operações empresariais ficam bloqueadas, mantendo os caminhos necessários para perfil e regularização.

Cargos personalizados definem ações permitidas; `OWNER` e `PLATFORM_ADMIN` mantêm responsabilidades próprias. Papéis legados existem para compatibilidade, mas não substituem a configuração atual de permissões e módulos.

## Comandos e validação

Execute os comandos a partir da raiz. Para qualquer teste, mantenha `TEST_MONGODB_URI` e `MONGODB_URI` configuradas com a URI exclusiva indicada acima.

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | API e Angular em desenvolvimento, após configuração/provisionamento. |
| `npm run build` | Build Angular, cópia da SPA e build NestJS. |
| `npm run build --prefix apps/api` | Compila somente a API. |
| `npm run build --prefix apps/web` | Compila a interface e verifica templates. |
| `npm test` | Suíte Vitest da API. |
| `npm run test:watch --prefix apps/api` | Vitest em modo observação. |
| `npm run lint --prefix apps/api` | Análise estática com Oxlint. |
| `npm run test:commerce` | Integração comercial e opção de navegador. |
| `npm run test:catalog` | Cenários de catálogo, vitrine e permissões. |
| `npm run test:tenancy` | Cenários de usuários e isolamento entre empresas. |
| `npm run test:migration` | Diagnóstico/dry-run de migração; depende de fixture legada e não aplica migração. |
| `npm run commerce:diagnose` | Diagnóstico do armazenamento comercial, sem aplicação. |
| `node scripts/portfolio-storage.mjs --diagnose` | Diagnóstico dos modelos do portfólio, após build da API. |
| `node scripts/security-bundle-scan.mjs` | Varredura heurística dos bundles compilados. |
| `npm run start:prod` | Executa a API compilada; não provisiona banco nem define o ambiente de produção. |

Há também scripts específicos, como `crm-integration.mjs`, `projects-integration.mjs`, `purchases-integration.mjs`, `documents-integration.mjs` e `branches-integration.mjs`. Confira os requisitos de cada suíte antes de executar. Testes antigos podem precisar de fixtures compatíveis com as regras atuais de produto, permissões e assinatura.

O script Angular `npm test --prefix apps/web` existe, mas `angular.json` não possui target `test`. Portanto ele não constitui uma suíte Angular configurada. Os aliases `test:e2e` e `test:finance` da API apontam para a integração de multitenancy.

Uma validação deve registrar comando, código de saída, número de testes aprovados/falhos/bloqueados e limitações. Build aprovado não substitui testes de integração. Resultados de documentos antigos não comprovam que o checkout atual passou novamente. Relatórios produzidos pelo harness podem conter dados de fixtures e devem ser revisados antes de publicação.

## Regras de negócio e segurança

- Dados empresariais são escopados pelo tenant autenticado e verificados no servidor. Ocultar um item do menu não é a barreira de autorização.
- Sessões usam cookies HttpOnly e token CSRF; o cliente obtém o token em `/api/auth/csrf` antes de mutações. O backend também valida origens e revogação da sessão.
- Valores monetários são representados em centavos inteiros. Despesas usam datas civis e competência mensal; o relatório distingue previsto, pago, pendente, vencido e cancelado.
- Pagamentos, correções e cancelamentos financeiros preservam histórico. Conta paga não recebe edição comum; correção exige confirmação e justificativa.
- Recorrências financeiras são geradas explicitamente por competência. Repetir a geração não deve duplicar a mesma ocorrência.
- Registrar uma despesa ou custo não movimenta estoque por si só. Recebimentos, produção e outras integrações têm operações próprias.
- Novas vendas comerciais usam baixa de estoque na finalização quando o módulo de estoque está contratado. Pedidos legados podem conservar a política anterior de reserva; não aplique uma única regra indiscriminadamente a ambos.
- Produtos sob demanda podem permanecer disponíveis sem saldo pronto; produtos controlados por produção respeitam as regras de disponibilidade.
- Schemas usam provisionamento explícito de coleções/índices. A API não deve ser iniciada como forma de migrar ou semear dados operacionais.
- Publicar o código no GitHub não publica a aplicação, banco, domínio ou servidor.

## Limitações

O sistema está em evolução. Em particular:

- Não emite NFC-e/NF-e nem transmite ECD/ECF. Consultas, exportações e demonstrativos auxiliares não equivalem a integrações fiscais oficiais.
- Cobranças de assinaturas e contratos possuem operações manuais; não há promessa de gateway de pagamento ou renovação financeira automática.
- Fidelidade não pontua automaticamente todas as vendas. Projetos não oferece Gantt, cronômetro ou faturamento de horas.
- Logística não fornece rastreamento público, otimização de rotas, frete externo ou operação offline.
- BI tem escopo de fontes/CSV e indicadores definidos, sem construtor livre de fórmulas ou consolidação automática de filiais.
- Documentos não integra antivírus externo, OCR ou assinatura eletrônica.
- A configuração de e-mail depende de credenciais externas; aceite pelo provedor não comprova entrega.
- O limitador de requisições é por processo; múltiplas instâncias exigem solução compartilhada.
- O Compose atual não entrega sozinho uma instalação completa. Os scripts de provisionamento operacional precisam de revisão própria antes de qualquer implantação fora do banco autorizado de teste.

## Documentação e contribuição

| Documento | Assunto |
| --- | --- |
| [Usuários e implantação](docs/users-tenancy-deployment.md) | Chaves, transações, primeiro administrador e migração. |
| [Cargos personalizados](docs/usuarios-cargos-personalizados.md) | Modelo de permissões. |
| [Assinatura obrigatória](docs/assinatura-acesso-obrigatorio.md) | Contratação e bloqueio de acesso sem assinatura. |
| [Comercial SaaS](docs/saas-planos-assinaturas-spec.md) | Planos, preços, contratos comerciais e quotas. |
| [Manual da vitrine](docs/vitrine-manual.md) | Catálogo público, categorias e disponibilidade. |
| [Manual financeiro](docs/financeiro-manual.md) | Uso de despesas, pagamentos e recorrências. |
| [Contrato financeiro](docs/financeiro-contrato.md) | Regras e endpoints; partes históricas foram complementadas por evoluções posteriores. |
| [Gestão operacional](docs/gestao-operacional-manual.md) | Insumos, fichas e fluxo de produção. |
| [Ampliação do portfólio](docs/portfolio-ampliacao-2026-09-18.md) | Escopo, integrações e limites dos novos módulos. |
| [Segurança do backend](docs/security-backend.md) | Controles HTTP, sessão e autorização. |
| [Segurança MongoDB](docs/security-mongodb.md) | Configuração e persistência. |
| [Instruções do projeto](AGENTS.md) | Responsabilidades, preservação de dados e regras de QA. |
| [Verificação da publicação](docs/publicacao-verificacao.md) | Comandos, resultados e limitações registrados para esta publicação. |

Para contribuir, descreva o problema, mantenha o escopo da alteração claro e execute as verificações pertinentes no banco autorizado. Não inclua `.env`, credenciais, dumps, anexos privados, dados pessoais ou relatórios não revisados. Mudanças de schema devem preservar registros e tratar índices/provisionamento explicitamente.

As responsabilidades de agentes estão em `.codex/agents/`. São definições de trabalho, não comprovação de processos ativos ou validações executadas.

**Licença:** não há licença de código aberto declarada para o projeto; o pacote da API está marcado como `UNLICENSED`. A visibilidade pública do repositório não substitui a concessão de uma licença.
