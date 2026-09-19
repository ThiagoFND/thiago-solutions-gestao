> HISTORICO: o modulo de ponto foi removido por solicitacao do usuario em 18/09/2026. As referencias a ponto neste documento preservam apenas evidencias historicas, sem indicar disponibilidade ou trabalho pendente.

# QA — Bater ponto para dono e todos os funcionários — 18/09/2026

## Regra validada e resultado

**26 testes unitários e 8 blocos de integração aprovados**, com dois fluxos reais Chrome (OWNER e MEMBER com cargo personalizado sem permissões). API compilada e build Angular aprovados.

Com empresa/usuário ativos e contrato permitindo `TIME_CLOCK`, registrar a própria jornada é uma permissão basal: não exige concessão no cargo personalizado. Gestão da equipe continua separada. Esta regra atual substitui a afirmação dos relatórios anteriores de que cargo personalizado precisa conceder `ponto.registrar`.

## Isolamento

Aplicação QA exclusiva em `http://127.0.0.1:4347`, usando apenas `mongodb://127.0.0.1:27017/salgados_financeiro_test`. `NODE_ENV=test` definido pelo harness e `LEAD_EMAIL_ENABLED=false`. Nenhuma aplicação QA operacional foi iniciada, nenhum banco foi apagado/reinicializado. Usuários/empresa/cargo/contrato e demais fixtures possuem identificador exclusivo da execução. Modificações de estado atingiram somente essas novas fixtures.

Execução `1789754532433-84f7a8fa7c`: **10.176 documentos anteriores intactos, 0 alterados, 0 ausentes; 81 novos preservados; total 10.257**. API QA encerrada; verificação TCP da porta 4347 retornou `ECONNREFUSED`/`QA_PORT_CLOSED`.

## Comandos

Prefixo PowerShell:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:TEST_MONGODB_URI=$env:MONGODB_URI
$env:LEAD_EMAIL_ENABLED='false'
```

| Comando | Resultado |
| --- | --- |
| `node node_modules/typescript/bin/tsc -p tsconfig.build.json --incremental false` em `apps/api` | Exit 0; API emitida sem limpeza do diretório. |
| `npm test --prefix apps/api -- src/workforce src/tenants/time-clock-identity.spec.ts` | 2 arquivos, 26 testes aprovados: 17 de identidade e 9 de jornada; 726 ms. |
| `npm run build --prefix apps/web` | Exit 0; 3,153 s; bundle inicial 305,69 kB; `main-IBNIMILI.js`. |
| `node scripts/time-clock-members-integration.mjs` | Exit 0; 8 blocos aprovados, 0 falhas. |

Vitest/Angular/Chrome receberam permissão de subprocessos necessária no ambiente. Avisos existentes Node 25, `qrcode` CommonJS, Vite e Mongoose não impediram os resultados.

## Cobertura real

1. OWNER, MEMBER simples e MEMBER com cargo personalizado de permissões vazias recebem 403 ao tentar registrar sem contrato.
2. Com `TIME_CLOCK` ativo, os seis cargos empresariais OWNER, ADMIN, MEMBER, CASHIER, KITCHEN e ACCOUNTANT recebem permissão de registrar. MEMBER simples e quatro cargos não usados no navegador registram via API. MEMBER simples e personalizado recebem 403 para gestão e ajustes da equipe; OWNER acessa equipe.
3. OWNER faz login no Chrome, vê exatamente um link Bater ponto como segundo item do menu (após Meu perfil), acessa, aceita o aviso de localização e registra Entrada. Banco confirma uma marcação própria.
4. MEMBER com cargo personalizado `permissions: []` executa o mesmo fluxo real, sem link de gestão. Banco confirma uma marcação própria. Em ambos os fluxos, tamanhos 320/1440 px não apresentaram overflow da página, nem erros JavaScript.
5. Administrador global recebe 403; usuário inativado após login recebe 401; usuário pendente não recebe a permissão e recebe 403 ao tentar registrar.
6. Contrato suspenso remove a permissão e rejeita registros OWNER/MEMBER personalizado com 403.
7. Contrato com estado EXPIRED remove a permissão e rejeita registros OWNER/MEMBER personalizado com 403.
8. Preservação integral dos documentos anteriores verificada por hashes.

Os testes unitários adicionais exercitam identidade com cargo personalizado ativo/inativo/arquivado sem concessão de ponto, empresa pendente/suspensa, usuário pendente/inativo, contrato não permitido ou sem módulo e administrador global. A permissão não é duplicada e nenhum cargo funcionário recebe gestão adicional.

## Evidências

- [Resultados](tenancy-qa/1789754532433-84f7a8fa7c/time-clock-members-results.json)
- [Preservação](tenancy-qa/1789754532433-84f7a8fa7c/preservation.json)
- [OWNER no navegador](tenancy-qa/1789754532433-84f7a8fa7c/time-clock-owner.png)
- [MEMBER personalizado no navegador](tenancy-qa/1789754532433-84f7a8fa7c/time-clock-custom-member.png)

## Sincronização estática executada pelo principal

Após o build, o principal confirmou cópia de `apps/web/dist/web/browser` para `apps/api/public` com `cpSync(source,target,{recursive:true,force:true})`, caminhos absolutos verificados dentro do workspace: **43 entradas de primeiro nível copiadas, 0 excluídas**. Nenhum `rm`/delete e nenhum reinício da API foi executado.

Verificação pública reportada pelo principal: `GET http://localhost:3000/` HTTP 200; HTML servido idêntico ao build (`indexMatchesBuild:true`), SHA-256 `cd5767ad7aad37ac3a8ed64b46361b2ff4e1f9303dc985734c0f62914c5c3c5d`; script `main-IBNIMILI.js`. O processo existente foi identificado como Node/Nest watch, mas seu banco efetivo não foi comprovado; nenhuma chamada autenticada operacional foi usada para esta verificação.

## Limitações

Chrome usou geolocalização simulada (0,0), não GPS físico. Estado EXPIRED foi definido explicitamente pelo endpoint de status, não por aguardar passagem de tempo. Dados ficaram preservados no banco de teste, inclusive contrato final expirado. A validação funcional do backend ocorreu na instância QA compilada; cópia estática e modo watch do processo existente não equivalem a validar a regra nova numa sessão operacional do usuário. Não foi alterado contrato operacional ou política de cargos anteriores.
