> HISTORICO: o modulo de ponto foi removido por solicitacao do usuario em 18/09/2026. As referencias a ponto neste documento preservam apenas evidencias historicas, sem indicar disponibilidade ou trabalho pendente.

# Portfólio profissional — continuidade em 18/09/2026

**Escopo amplo ainda em execução. Não representa entrega completa do portfólio solicitado.** Especificação: [portfolio-profissional-spec.md](portfolio-profissional-spec.md). Novas rotinas não foram ativadas nem provisionadas no banco operacional.

## Implementado nesta sequência

- Painel global: pesquisa por nome/CNPJ, plano, estado da assinatura e situação da **última cobrança**; histórico comercial com nomes em português e paginação. Última cobrança paga não significa ausência de outras dívidas.
- Separação comercial: `EXPENSES` mantém os lançamentos de despesas existentes e as permissões históricas `financeiro.*`; `FINANCE` passa a proteger `tesouraria.*`, com contas, lançamentos manuais, liquidação, cancelamento de pendentes e transferências. Rotas Angular `/despesas` e `/financeiro` são distintas. Contratos existentes não recebem novos módulos automaticamente.
- Contábil (`ACCOUNTING_FISCAL` / `contabil.*`): contas contábeis, Diário com débitos/créditos equilibrados, estorno por lançamento inverso, balancete auxiliar, fechamento/reabertura de competência, obrigações manuais, importação classificada de origens e exportação CSV. Uma origem não é importada duas vezes. A correta distinção entre competência e pagamento continua responsabilidade da classificação contábil.
- Cadastro compartilhado de clientes/fornecedores (`business_parties_v2`), com referências por tenant. Produtos/categorias continuam nos cadastros existentes.
- Página pública: 23 serviços e sete composições setoriais, benefícios e estágio real, sem preços. Diagnóstico por regras explícitas; pacote somente por correspondência exata, caso contrário módulos ou análise individual. Não é IA generativa nem contratação automática.
- Captação: nome, telefone, e-mail, relato, consentimento, sugestão versionada, idempotência e fila persistida no mesmo documento. Painel global paginado, pesquisa e acompanhamento com versão. Nenhum dado de contato é público.
- Jornada (`TIME_CLOCK`): horário do servidor, referência, marcações imutáveis, sequência, antirrepetição, ajustes separados com revisão por outra pessoa, paginação e suspensão por assinatura. Localização isolada em coleção própria, somente endpoint global auditado. Empresa não recebe coordenadas nem precisão. Indisponibilidade de GPS não impede marcação. Não comprova presença física.
- Qualidade (`TRACEABILITY`): motivos por empresa, recebimento em quarentena, lote/validade/origem/local registrados, quatro avaliações obrigatórias, destino/prateleira e conclusão. Reprovação/vencimento impede reposição. Aprovação com INVENTORY ativo gera movimento e saldo na mesma transação; sem INVENTORY só registra avaliação. Contratação posterior não movimenta devoluções antigas. Aprovação concorrente não duplica saldo.

## Limitações que impedem considerar o pedido concluído

- CRM, Agenda/OS, projetos, contratos, logística, fidelidade, filiais, BI avançado e documentos/compras autônomos ainda precisam de implementação ou ampliação. Sua presença no site não equivale a módulo operacional entregue.
- Pacotes setoriais estão apresentados como composições propostas. Não foram inseridos como planos operacionais com preços inventados. Emissão fiscal exige integração/certificados/homologação; não há emissão real.
- Qualidade ainda não aloca saídas por lote, não automatiza vencimento do saldo restante, não gera recall, nem rastreia toda a cadeia produtiva. O campo prateleira registra o destino da devolução, não constitui endereçamento completo de armazém. Devolução não é cancelamento de venda nem reembolso.
- Jornada ainda não fornece comprovante legal assinado, AFD/AEJ, banco de horas, escalas, folha, atestados ou conformidade REP-P. Ajuste aprovado é evidência separada, não recalcula folha. Períodos consultados usam UTC; horários da tela usam o fuso do dispositivo.
- Financeiro ainda não tem conciliação bancária, estorno de liquidações ou integração automática completa com Vendas/Despesas. Contábil não transmite ECD/ECF/eSocial/Reinf/DCTFWeb, não calcula tributos nem substitui validação profissional. Não há classificação contábil automática presumida.
- Motivos de qualidade podem ser criados e ativados/desativados; edição de texto e arquivo geral de evidências ainda não existem.
- Cadastros compartilhados de terceiros precisam evoluir em edição, deduplicação e reutilização dos fornecedores históricos. Ainda não é comprovado um cadastro único de fornecedor em todos os módulos legados.
- Validação sob carga, leitor de tela, recuperação de falhas e homologação externa continuam pendentes. Testes aprovados não representam garantia de 100%.

## Comercial e permissões

`TIME_CLOCK` e `TRACEABILITY` entram na allowlist técnica; não têm preço presumido. O administrador usa **Planos e módulos → Configurar preço de Jornada/Qualidade**, informa preço e motivo, salva uma versão, simula e atribui o contrato. Não foram adicionados silenciosamente ao plano Completo. Os 12 preços iniciais anteriores e snapshots antigos são preservados.

| Módulo | Prefixos | Rotas principais |
|---|---|---|
| EXPENSES | financeiro | `/api/finance/*`, tela `/despesas` |
| FINANCE | tesouraria | `/api/treasury/*`, tela `/financeiro` |
| ACCOUNTING_FISCAL | contabil, vendas_fiscais | `/api/accounting/*`, tela `/contabil` |
| TIME_CLOCK | ponto.registrar, ponto.gerenciar | `/api/time-clock/*`, `/jornada`, `/jornada/equipe` |
| TRACEABILITY | qualidade.visualizar/configurar/receber/inspecionar | `/api/quality/*`, `/qualidade` |
| Base autorizada | cadastros.visualizar/editar | `/api/parties`, `/cadastros` |

Além do módulo, todas as operações empresariais exigem sessão/usuário/empresa ativos, permissão e tenant. O catálogo de permissões de cargos filtra módulos contratados. A inspeção é a autorização explícita para repor automaticamente quando Estoque também está contratado; não gera permissão de ajuste manual geral.

Globais: `GET /api/platform/leads`, `POST /api/platform/leads/:id/status` e `GET /api/platform/time-clock?tenantId=...` exigem PLATFORM_ADMIN ativo. A consulta de localização é exceção expressamente pedida, não acesso geral às operações do cliente. Endpoint empresarial não aceita tenant como autoridade.

Públicos: `GET /api/public/solutions`, `POST /api/public/solutions/recommend`, `POST /api/public/solutions/contact`. Escrita pública somente de solicitação comercial, sem carrinho/pedido/checkout. Validação, CSRF, origem autorizada, limite por IP, honeypot e máximo de texto. O limitador em memória não substitui rate limit compartilhado em múltiplas instâncias.

## E-mail

Adaptador Resend isolado (`LeadEmailTransport`), destinatário fixo autorizado `thiagofernandess158@gmail.com`, texto simples, chave de idempotência, lease e até cinco tentativas. `ACCEPTED` significa aceite pelo provedor, não comprovação de entrega. Repetição automática cessa antes da janela de idempotência expirar; falhas permanecem visíveis no painel.

Requer configuração no servidor: `LEAD_EMAIL_ENABLED=true`, `RESEND_API_KEY`, `LEAD_EMAIL_FROM` com remetente/domínio validado. Nunca colocar chave no Angular ou em documentação. Envio real é desabilitado em `NODE_ENV=test`. O usuário foi consultado sobre provedor; sem credencial disponível, entrega externa **não executada/bloqueada**. Transporte pode ser substituído por outro provedor sem mudar o fluxo.

## Modelos e concorrência

Novas coleções: `business_parties_v2`, `treasury_accounts_v2`, `treasury_entries_v2`, `accounting_accounts_v2`, `accounting_journals_v2`, `accounting_closings_v2`, `accounting_obligations_v2`, `platform_leads_v2`, `time_clock_punches_v2`, `time_clock_locations_v2`, `time_clock_corrections_v2`, `quality_reasons_v2`, `quality_returns_v2`.

Schemas com `autoCreate:false`, `autoIndex:false`, DTOs e índices declarados. Escritas críticas recusam índices únicos ausentes. Não executar sincronização destrutiva de índices. Jornadas/devoluções reutilizam transações e serialização do tenant. Dinheiro em centavos, referências únicas por tenant; contas de partidas pertencem ao mesmo tenant. Chaves de envio do frontend financeiro são mantidas em retentativa na mesma instância da tela.

## Validação executada até esta atualização

- Backend: **297 testes aprovados, 22 arquivos, zero falhas**; código de saída 0.
- Comercial/financeiro/contábil + navegador: **42 aprovados, zero falhas**, execução `1789747357953-104b012e37`.
- Captação/site/painel: **11 aprovados, zero falhas**, `1789745695350-7744de0b1b`.
- Jornada: **11 aprovados, zero falhas**, `1789746169816-08f5470f85`.
- Qualidade: primeira execução **9 aprovados/1 falha de seletor acessível**; corrigida. Atual **10 aprovados/zero falhas**, `1789746802657-3e560c3a0b`.
- Builds atuais Nest e Angular **aprovados, exit 0**. Varredura heurística atual: **38 bundles, zero achados**, exit 0. Diagnóstico de armazenamento: **13 coleções, nenhum índice declarado ausente**, sem aplicação, exit 0. Removidos estilos da seção antiga e aviso de orçamento da landing; permanece aviso CommonJS de `qrcode`.
- Formulários de contas financeiras, recebíveis, contas contábeis e lançamento equilibrado também executados em Chrome, com larguras 320/768/1440. Testes intermediários falharam por seletor Angular e nome fixo de plano repetido em fixtures preservadas; corrigidos no teste, reexecução 42/42 passou. Isso não cobre todas as combinações de permissões e interações.
- API QA exclusiva em portas 4341/4343/4344/4345 e URI exata de teste. Novos scripts preservam inclusive seus próprios registros; manifestos `*-created-preserved.json`. Suíte comercial foi atualizada para não excluir seus registros. Testes anteriores da mesma sequência usavam limpeza somente dos próprios documentos; não repetir essa estratégia sob AGENTS atual.
- Uma tentativa unitária sem `TEST_MONGODB_URI` foi corretamente bloqueada pelo guard; reexecução configurada passou. Nenhuma escrita operacional.

Comandos e logs em `docs/saas-qa/portfolio-*.log`, `time-clock-integration.log`, `quality-integration.log`; relatórios por execução em `docs/tenancy-qa/<run>/`.

```powershell
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:MONGODB_URI=$env:TEST_MONGODB_URI
npm test --prefix apps/api
npm run build --prefix apps/api
npm run build --prefix apps/web
$env:PORTFOLIO_BROWSER='true'
node scripts/portfolio-storage.mjs --diagnose
node scripts/portfolio-integration.mjs
node scripts/time-clock-integration.mjs
node scripts/quality-integration.mjs
$env:COMMERCE_BROWSER='true'
node scripts/commerce-integration.mjs
```

Não iniciar API QA com configuração operacional. Para uso local, verificar configuração e estrutura antes de `npm run start:dev --prefix apps/api` e `npm start --prefix apps/web`; processos existentes não foram reiniciados.

## Arquivos principais

Criados: `apps/api/src/business/*`, `apps/api/src/portfolio/*`, `apps/api/src/workforce/*`, `apps/api/src/inventory/quality.module.ts`, `quality.spec.ts`; `apps/web/src/app/features/business/*`, `features/workforce/*`, `features/inventory/quality.component.*`, `features/landing/solutions.component.*`, `features/commerce/leads.component.ts`, `commercial-labels.ts`; scripts de captação/jornada/qualidade, `scripts/portfolio-storage.mjs` e especificação/handoff deste portfólio.

Alterados: AppModule, catálogo de permissões, regras/defaults comerciais e teste de comparação, catálogo de cargos, DTO/serviço de tenants; rotas/auth/menu Angular, landing, painel de empresas/comercial, cliente TenancyApi, título de Despesas, suíte comercial. Preservadas implementações anteriores e snapshots. Não há repositório Git neste diretório para gerar diff confiável.

## Próxima continuidade

Concluir validação/documentação desta etapa; avançar no núcleo compartilhado e nos módulos ainda ausentes, um fluxo integrado por vez. Antes de prometer rastreabilidade, projetar alocação de lotes nas saídas/reservas e recalls. Antes de vender jornada como ponto legal, completar requisitos do MTE. Não transformar descrição comercial em alegação de implementação. Fontes oficiais e decisões iniciais estão na especificação.


## Instruções de uso e próximas validações

1. Admin: Planos e módulos permite configurar Jornada/Qualidade com preço explícito. Se já houver versão, o botão abre a oferta existente. Simular/confirmar o contrato e definir vigência; isso não altera outras empresas.
2. OWNER: Cargos e permissões atribui `ponto.registrar` para marcação e `ponto.gerenciar` para análise. Permissões só aparecem com o módulo contratado. O revisor não aprova a própria solicitação.
3. Jornada: acessar Minha jornada, ler o aviso e marcar Entrada/Intervalo/Retorno/Saída. Admin seleciona a empresa em Empresas e usa Registros de jornada para consultar coordenadas. A empresa usa Jornada da equipe sem coordenadas.
4. Qualidade: cadastrar motivo; registrar devolução em quarentena; abrir Preencher avaliação; preencher resultado e evidência em cada critério, destino e conclusão. Com Estoque, a aprovação repõe o saldo; sem ele, registra somente a avaliação.
5. Site: descrever o problema, revisar a sugestão, preencher contato e autorização. Admin consulta Interessados e registra acompanhamento. Sem provedor configurado, o contato permanece na fila e não há afirmação de e-mail enviado.
6. Armazenamento: `portfolio-storage.mjs` tem diagnose/dry-run/apply idempotente **restrito ao banco de teste**. Nenhum desses modos aceita o operacional. Não executado `--apply` nesta validação; os índices de QA foram criados pelo harness autorizado.

Restam ampliar testes de cargos restritos, consultas globais de localização em navegador, falhas de rede/reload, carga, retenção de dados pessoais e os módulos listados como pendentes. Nenhum teste real de entrega de e-mail ou integração fiscal foi executado.
