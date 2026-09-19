# Thiago Solutions Digitais

A multi-company management platform built with **Angular, NestJS, and MongoDB**. The project started as an MVP for producing and selling savory snacks and grew to bring together operations, expenses, treasury management, customer relationships, and subscription management.

Each company maintains its own data, users, roles, and settings. Access depends on company status, a valid subscription, subscribed modules, and permissions for individual actions. The platform administrator has a separate area for approvals and commercial management.

**Project status:** active development, with modules at different stages of maturity. The presence of a screen or endpoint does not imply complete coverage or production readiness. Reports in `docs/` are dated records; this README revision was based on code inspection and does not represent a new test run.

## Contents

- [Features](#features)
- [Architecture and technologies](#architecture-and-technologies)
- [Local setup](#local-setup)
- [Configuration](#configuration)
- [First access](#first-access)
- [Commands and validation](#commands-and-validation)
- [Business rules and security](#business-rules-and-security)
- [Limitations](#limitations)
- [Documentation and contributing](#documentation-and-contributing)

## Features

| Area | Available capabilities |
| --- | --- |
| Companies and users | Company registration and approval, access requests, membership, custom roles, and permissions for individual actions. |
| Products and storefront | Categories per company, manufactured/resale products, images, availability based on stock or made-to-order supply, and a public storefront at `/empresa/:slug`. |
| Sales and production | Orders, payments, production records, stock movements, and real-time updates. |
| Inventory and quality | Ingredients, production recipes, receipts, stock adjustments, and returns with assessment and disposition. |
| Expenses | Operating/personal expenses, production costs, categories, recurring entries, payments from personal/business funds (PF/PJ), private supporting documents, and history. |
| Finance | Treasury accounts, receivables/payables, settlements, and integration with billing from other modules. |
| Accounting | Chart of accounts, balanced journal entries, general ledger, supplementary statements, period closing, and obligations. |
| Master data and CRM | Shared contacts, customers/suppliers, opportunities, and sales follow-up. |
| Services and contracts | Scheduling/service orders, customer contracts, amendments, and explicitly triggered billing. |
| Loyalty | Programs, enrollment, point recording, expiration, redemption, and reversal. |
| Projects | Projects, scope, teams, tasks, dependencies, review, comments, and manually recorded hours. |
| Purchasing | Supplier orders, approval, partial receipts, and conditional integrations with inventory and treasury. |
| Logistics | Orders, shipments, routes/stops, dispatch, delivery attempts, receipt confirmation, and returns. |
| BI | Internal metrics, external CSV data sources, targets, filters, and exports. |
| Documents and branches | Private files with versioning and sharing; branch records, managers, and members. |
| Commercial platform | Versioned offers and pricing, plans, modules, discounts, coupons, subscriptions, quotas, manual billing, and requests. |
| Company website | Solution descriptions, module recommendations, and sales contact requests. |

The storefront does not offer public checkout. Subscriptions control which capabilities a company can use; the catalog should not be interpreted as a guarantee that every module is fully implemented.

In the current navigation, **Expenses** corresponds to `/despesas`, **Finance** to `/financeiro`, and **Accounting** to `/contabil`. Older documents may use “Financeiro” for the expenses area. The time clock feature has been removed; historical references do not represent a current capability.

## Architecture and technologies

| Layer | Technology |
| --- | --- |
| Frontend | Angular 22, standalone components, lazy-loaded routes, TypeScript, and SCSS |
| API | NestJS 12, Node.js, Express, DTO validation, and domain modules |
| Persistence | MongoDB, Mongoose 9, v2 collections, and explicitly provisioned indexes |
| Sessions | JWT in an HttpOnly cookie, CSRF protection, and backend authorization |
| Events | Socket.IO |
| Testing | Vitest, Node.js scripts, and browser testing with Playwright Core/Chrome |

```text
apps/
  api/
    src/
      auth/ tenants/ users/ roles/   Identity and authorization
      commerce/                     Plans, subscriptions, and billing
      products/ catalog/            Products and storefront
      orders/ productions/ inventory/
      finance/ business/            Expenses, treasury, and accounting
      crm/ service-orders/ contracts/ loyalty/
      projects/ purchases/ logistics/ bi/
      documents/ branches/ portfolio/ audit/ events/
  web/
    src/app/
      core/                         Sessions, models, and HTTP clients
      layout/                       Navigation and page layout
      features/                     Screens by domain
scripts/                            QA, diagnostics, and provisioning
docs/                               Contracts, manuals, and reports
```

The API uses the `/api` prefix. The root build compiles the frontend, copies the SPA to `apps/api/public`, and compiles NestJS. The server can serve both the frontend and API from the same origin. The monorepo has three npm installations with their own lockfiles; it does not use npm workspaces.

## Local setup

The examples below use **PowerShell**, run from the root of a clone or copy of this repository. On other systems, adapt the environment variable syntax.

Prerequisites:

- Node.js 24 and npm; the packages declare Angular 22 and NestJS 12.
- MongoDB available at `127.0.0.1:27017`.
- **A replica set or mongos for transactional workflows**, including registration/approval and commercial mutations. Standalone MongoDB does not support full validation of these workflows.
- A local Chrome installation for suites that include browser testing; `playwright-core` does not install a browser automatically.

Every local QA application and every test write must use only:

```text
mongodb://127.0.0.1:27017/salgados_financeiro_test
```

Preserve existing data, including fixtures from previous runs. Do not delete databases, collections, or records, reset volumes, or use `syncIndexes` to remove indexes. The operational database `salgados_mvp` is outside the scope of this procedure.

### 1. Install and build

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

`npm ci` uses the versions in the lockfiles. The existing `npm run install:all` command is an alternative that installs dependencies for both applications with `npm install`.

### 2. Exercise the isolated application

After building, with transactional MongoDB available and both database variables above set:

```powershell
$env:COMMERCE_BROWSER='true'
npm run test:commerce
```

The commercial suite uses a temporary API at `http://127.0.0.1:4341`, provisions collections/indexes additively, creates unique test identities, runs scenarios, and shuts down the application. The harness supplies its own temporary secrets and records the preservation of existing documents. Data created during the run remains in the database. Fixture credentials are not default accounts for manual use.

Set `COMMERCE_BROWSER='false'` to skip the browser portion. Suites that require transactions may fail on a standalone instance; record this as an environment limitation without switching to another database. Do not stop other people's services to free ports, and run suites that write data sequentially.

### 3. Use the interface manually

Manual use requires persistent configuration, provisioned collections/indexes, and an explicitly created first administrator. Follow [User and company deployment](docs/users-tenancy-deployment.md) and [Mandatory subscriptions](docs/assinatura-acesso-obrigatorio.md) before starting.

The `apps/api/.env.example` file is a template without credentials. Copy it to `apps/api/.env` only if that file does not already exist, then fill in the fields described below. Configure the same test URI there and keep both database variables explicitly set in the terminal.

```powershell
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:MONGODB_URI=$env:TEST_MONGODB_URI
$env:LEAD_EMAIL_ENABLED='false'
npm run dev
```

The development frontend is available at `http://localhost:4200` and the API at `http://localhost:3000/api`. The browser's origin must be authorized in `FRONTEND_URL`. The `dev` script exposes the Angular server on `0.0.0.0`; account for this when choosing a local network.

The existing `docker-compose.yml` starts MongoDB with authentication and a persistent volume, but **does not configure a replica set or provision accounts automatically**. It does not replace the transactional prerequisites. Do not start it on a port already used by local MongoDB.

## Configuration

Configure secrets only on the server, using environment variables or an untracked local file. Never put keys in Angular, the README, screenshots, or command arguments.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Required; in these examples and in QA, it must exactly match the test URI above. The current code has no operational database fallback. |
| `TEST_MONGODB_URI` | Safety check for QA scripts; requires the same exact URI. |
| `MONGODB_USER` / `MONGODB_PASSWORD` | Optional local credentials, supplied together. Production requires authentication. |
| `MONGODB_TLS` / `MONGODB_TLS_CA_FILE` | TLS and a CA certificate when needed. Production requires TLS. |
| `JWT_SECRET` | A random secret of at least 32 bytes; there is no default value. |
| `CPF_ENCRYPTION_KEY` | 32 random bytes encoded in base64 for encryption. |
| `CPF_HASH_KEY` | Another 32 random bytes encoded in base64, independent of the encryption key. |
| `TENANCY_V2_ENABLED` | Must be `true` after preparing v2 storage. The example starts with it disabled. |
| `TENANCY_NEW_INSTALLATION` | Explicit declaration of a new installation; does not replace provisioning. Production requires this declaration or a completed migration manifest. |
| `FRONTEND_URL` | Exact HTTP(S) origins separated by commas; locally: `http://localhost:4200,http://127.0.0.1:4200`. |
| `NODE_ENV` / `PORT` | Runtime environment and API port; the default port is `3000`. |
| `HTTPS_ENABLED` | Must be `true` in production, with HTTPS origins and TLS termination configured. |
| `BUSINESS_UTC_OFFSET` | Configurable time offset for rules that use it; example: `-03:00`. |
| `RATE_LIMIT_*` | Request limits by group; see `.env.example` and the security configuration. |
| `ATTACHMENT_STORAGE_DIR` | Private attachment directory; in QA, the harness separates files by run. |
| `LEAD_EMAIL_ENABLED` | Enables sending sales contact emails; keep it `false` during manual QA. |
| `RESEND_API_KEY` / `LEAD_EMAIL_FROM` | Optional email transport configuration, with a verified sender. |
| `CHROME_PATH` | Chrome executable path for browser scripts that support this option. |

CPF keys must be stored persistently and securely; generating new ones on every restart prevents recovery of data encrypted with the previous keys. `JWT_REFRESH_SECRET` is not used. The old `COMMERCIAL_ENTITLEMENTS_ENABLED` flag does not disable the subscription requirement in the current code.

## First access

There is no default username or password, and the API does not automatically create the initial administrator.

1. Prepare v2 collections and indexes additively. The `tenancy-storage.mjs`, `commerce-storage.mjs`, and `portfolio-storage.mjs` scripts have different scopes and are restricted to the test database; review their modes before applying changes.
2. Create the first `PLATFORM_ADMIN` with `scripts/create-platform-admin.mjs`, following the [provisioning procedure](docs/users-tenancy-deployment.md). It requires transactional MongoDB and input supplied through environment variables.
3. Open `/plataforma/login` and sign in with an email and password. The `/plataforma/empresas` dashboard brings together global administration.
4. Register a company at `/cadastrar-empresa`. The company/owner await approval. Employees use `/solicitar-acesso` and receive a role upon approval.
5. Prepare offers and a valid subscription for the company. Approving registration does not automatically subscribe the company to modules.
6. Company login at `/login` uses CNPJ, email, and password. Without a valid subscription, company operations are blocked, while the routes needed to access the profile and resolve the subscription remain available.

Custom roles define allowed actions; `OWNER` and `PLATFORM_ADMIN` retain their own responsibilities. Legacy roles exist for compatibility, but do not replace the current permission and module configuration.

## Commands and validation

Run commands from the repository root. For every test, keep `TEST_MONGODB_URI` and `MONGODB_URI` set to the exclusive URI specified above.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Runs the API and Angular in development after configuration/provisioning. |
| `npm run build` | Builds Angular, copies the SPA, and builds NestJS. |
| `npm run build --prefix apps/api` | Compiles only the API. |
| `npm run build --prefix apps/web` | Compiles the frontend and checks templates. |
| `npm test` | Runs the API's Vitest suite. |
| `npm run test:watch --prefix apps/api` | Runs Vitest in watch mode. |
| `npm run lint --prefix apps/api` | Performs static analysis with Oxlint. |
| `npm run test:commerce` | Runs commercial integration scenarios, with optional browser testing. |
| `npm run test:catalog` | Runs catalog, storefront, and permission scenarios. |
| `npm run test:tenancy` | Runs user and company isolation scenarios. |
| `npm run test:migration` | Runs migration diagnostics/dry-run; requires a legacy fixture and does not apply a migration. |
| `npm run commerce:diagnose` | Diagnoses commercial storage without applying changes. |
| `node scripts/portfolio-storage.mjs --diagnose` | Diagnoses portfolio models after the API build. |
| `node scripts/security-bundle-scan.mjs` | Performs a heuristic scan of compiled bundles. |
| `npm run start:prod` | Runs the compiled API; does not provision the database or set the production environment. |

There are also dedicated scripts such as `crm-integration.mjs`, `projects-integration.mjs`, `purchases-integration.mjs`, `documents-integration.mjs`, and `branches-integration.mjs`. Check each suite's requirements before running it. Older tests may need fixtures compatible with current product, permission, and subscription rules.

The Angular script `npm test --prefix apps/web` exists, but `angular.json` has no `test` target. It therefore does not constitute a configured Angular test suite. The API's `test:e2e` and `test:finance` aliases point to the multitenancy integration suite.

Validation should record commands, exit codes, passed/failed/blocked test counts, and limitations. A successful build does not replace integration tests. Results in older documents do not prove that the current checkout has passed again. Reports produced by the harness may contain fixture data and should be reviewed before publication.

## Business rules and security

- Company data is scoped to the authenticated tenant and checked on the server. Hiding a menu item is not an authorization boundary.
- Sessions use HttpOnly cookies and a CSRF token; the client obtains the token from `/api/auth/csrf` before mutations. The backend also checks origins and session revocation.
- Monetary values are represented as integer cents. Expenses use calendar dates and monthly accounting periods; reports distinguish expected, paid, pending, overdue, and canceled amounts.
- Financial payments, corrections, and cancellations preserve history. Paid entries cannot be edited through the normal edit flow; corrections require confirmation and a reason.
- Recurring financial entries are generated explicitly for an accounting period. Repeating generation must not duplicate the same occurrence.
- Recording an expense or cost does not move stock on its own. Receipts, production, and other integrations have their own operations.
- New sales under the commercial model deduct stock on finalization when the inventory module is included in the subscription. Legacy orders may retain the previous reservation policy; do not apply a single rule indiscriminately to both.
- Made-to-order products may remain available without finished stock; production-controlled products follow availability rules.
- Schemas require explicit collection/index provisioning. Starting the API must not be used as a way to migrate or seed operational data.
- Publishing the code on GitHub does not deploy the application, database, domain, or server.

## Limitations

The system is evolving. In particular:

- It does not issue NFC-e/NF-e or submit ECD/ECF. Queries, exports, and supplementary statements are not equivalent to official tax integrations.
- Subscription and contract billing include manual operations; there is no promise of a payment gateway or automatic payment renewal.
- Loyalty does not automatically award points for every sale. Projects does not offer Gantt charts, a timer, or hourly billing.
- Logistics does not provide public tracking, route optimization, external shipping integration, or offline operation.
- BI is scoped to data sources/CSV and defined metrics, without a general-purpose formula builder or automatic branch consolidation.
- Documents does not integrate external antivirus, OCR, or electronic signatures.
- Email configuration depends on external credentials; acceptance by the provider does not prove delivery.
- The rate limiter operates per process; multiple instances require a shared solution.
- The current Compose file does not provide a complete installation on its own. Operational provisioning scripts require their own review before any deployment outside the authorized test database.

## Documentation and contributing

| Document | Subject |
| --- | --- |
| [Users and deployment](docs/users-tenancy-deployment.md) | Keys, transactions, the first administrator, and migration. |
| [Custom roles](docs/usuarios-cargos-personalizados.md) | Permission model. |
| [Mandatory subscriptions](docs/assinatura-acesso-obrigatorio.md) | Subscribing and blocking access without a subscription. |
| [Commercial SaaS](docs/saas-planos-assinaturas-spec.md) | Plans, pricing, commercial contracts, and quotas. |
| [Storefront manual](docs/vitrine-manual.md) | Public catalog, categories, and availability. |
| [Financial manual](docs/financeiro-manual.md) | Using expenses, payments, and recurring entries. |
| [Financial contract](docs/financeiro-contrato.md) | Rules and endpoints; historical sections have been supplemented by later changes. |
| [Operations management](docs/gestao-operacional-manual.md) | Ingredients, recipes, and production workflow. |
| [Portfolio expansion](docs/portfolio-ampliacao-2026-09-18.md) | Scope, integrations, and limitations of newer modules. |
| [Backend security](docs/security-backend.md) | HTTP controls, sessions, and authorization. |
| [MongoDB security](docs/security-mongodb.md) | Configuration and persistence. |
| [Project instructions](AGENTS.md) | Responsibilities, data preservation, and QA rules. |
| [Publication verification](docs/publicacao-verificacao.md) | Commands, results, and limitations recorded for this publication. |

To contribute, describe the problem, keep the scope of the change clear, and run the relevant checks against the authorized database. Do not include `.env`, credentials, dumps, private attachments, personal data, or unreviewed reports. Schema changes must preserve records and address indexes/provisioning explicitly.

Agent responsibilities are defined in `.codex/agents/`. These are work definitions, not evidence of active processes or completed validations.

**License:** no open-source license has been declared for the project; the API package is marked `UNLICENSED`. Making the repository public does not replace granting a license.
