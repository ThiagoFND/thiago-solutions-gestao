# Comparação de acessos na proposta

Ao calcular a proposta na área Plano e assinatura, o backend devolve as permissões atuais do solicitante e as previstas para o plano fechado ou conjunto personalizado de módulos. Usar a identidade validada, o catálogo central e a matriz comercial; não aceitar permissões do frontend. A área continua restrita aos proprietários autorizados.

Apresentar grupos por área, situação atual e proposta, totais mantidos, novos e retirados. Sem contrato válido, acesso atual vazio. Proposta pressupõe aprovação, assinatura vigente, empresa e usuário ativos; não altera contratos nem cargos. Permissões catalogadas não comprovam operações ainda não implementadas. Alterar escolhas invalida a comparação junto com o preço.

Validar primeira contratação, upgrade, downgrade, módulos alternativos Finance/Expenses, isolamento e ausência de ativação pela simulação. Testes com escrita somente na URI autorizada e preservando documentos anteriores.

## Implementado e validado

`POST /api/subscription/quote` acrescenta `accessComparison` à resposta: contagens atuais/propostas, novas/mantidas/retiradas e permissões com rótulos do catálogo central. Cálculo usa identidade atual revalidada e permissões configuradas OWNER/ADMIN (únicos papéis autorizados nessa área), antes da filtragem pelos módulos propostos. A resposta administrativa e os snapshots persistidos permanecem sem a comparação; trata-se de uma projeção de interface.

Frontend: grupos expansíveis por área com tabela Hoje/Proposta, contagens, aviso de perda de acesso e condições da contratação. Trocar seleção limpa preço e comparação; iniciar novo cálculo também limpa o resultado anterior. Sem promessa de ativar operações somente catalogadas, como estorno/desconto. Simulação não modifica assinatura, cargo ou permissão.

Arquivos novos: `apps/api/src/commerce/permission-preview.ts`, `permission-preview.spec.ts`, `apps/web/src/app/features/commerce/subscription-comparison.scss` e este documento. Alterados: `commerce.service.ts`, `commerce-api.service.ts`, `subscription.component.ts`, `subscription.component.html`, `scripts/commerce-integration.mjs` e handoff principal.

Validação atual (todos com saída 0):

- `npm test --prefix apps/api`: 266 aprovados, 0 falhos, 18 arquivos; log `docs/saas-qa/proposal-unit.log`.
- `npm run build --prefix apps/api`: aprovado; `docs/saas-qa/proposal-api-build.log`.
- `npm run build --prefix apps/web`: aprovado; `docs/saas-qa/proposal-web-build.log`. Avisos anteriores de orçamento SCSS institucional e CommonJS qrcode permanecem.
- `node scripts/commerce-integration.mjs`, COMMERCE_BROWSER=true, TEST_MONGODB_URI e MONGODB_URI exatamente `mongodb://127.0.0.1:27017/salgados_financeiro_test`: 35 aprovados, 0 falhos. Execução `1789740925489-8bb4140351`; log `docs/saas-qa/proposal-integration.log`; evidências e manifesto em `docs/tenancy-qa/1789740925489-8bb4140351/`.

Casos novos: primeira contratação sem acessos atuais, upgrade com Financeiro novo e Vendas mantido, downgrade removendo Vendas, ausência de ativação pela simulação, restrição às permissões configuradas e alternativa EXPENSES/FINANCE. Navegador confirma comparação e tabela, com ausência de overflow em 320/768/1440. Cleanup limitado aos documentos desta execução e preservação dos anteriores aprovados. Nenhum banco operacional alterado. Leitor de tela e dispositivos físicos não testados.
