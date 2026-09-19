# Melhorias de usabilidade e negócio

## Ajustes de formulários solicitados em 17/09/2026

- Login empresarial, cadastro de empresa e solicitação de acesso: CNPJ numérico com máscara progressiva e limite de 14 dígitos. CPF da solicitação limitado a 11 dígitos, com máscara; telefone limitado a 11 dígitos. Campos de texto mantêm os limites do contrato da API.
- Financeiro: campos de valores e quantidades impedem letras na digitação e colagem, preservando separador decimal e os limites de precisão. Descrições continuam aceitando texto.
- Vendas: grupos apresentados na ordem Salgados, Outros e Bebidas.
- Meu perfil: preservar o menu lateral e as informações da sessão, sem conceder acesso operacional a sessões pendentes ou da plataforma.
- Usuários: status apresentados em português, mantendo os valores técnicos enviados à API.

Validação desta rodada: build raiz aprovado e 14/14 verificações de navegador/integração aprovadas; 8266 documentos anteriores preservados. Comandos, tentativas e limites no [relatório de formulários de 17/09/2026](validacao-formularios-2026-09-17.md). As evidências históricas abaixo pertencem às respectivas execuções.

Especificação de 16/09/2026. Execução sequencial exclusivamente pelo principal. Complementa os contratos de segurança e multitenancy; em conflito, este pedido prevalece. Evidências antigas não contam como testes desta implementação. Sem Git disponível: inventário explícito no handoff.

## Regras e critérios de aceitação

Backend é autoridade, rejeita campos desconhecidos, tipos incorretos, null indevido, IDs inválidos, datas inexistentes e valores fora de limites. Frontend antecipa erros em português, mantém labels, foco e colagem acessíveis. Nenhum segredo ou confirmação de senha é persistido. Tenant vem da sessão revalidada.

Perfil próprio é somente leitura nesta versão, inclusive OWNER. OWNER tentando alterar a própria identidade por endpoints de membros recebe 403 auditado antes de qualquer mutação. Proteção transacional do último OWNER continua válida. Plataforma vê apenas o próprio perfil e cadastro global permitido.

Compras são lançamentos financeiros com classificação explícita (despesa operacional, custo de produção, compra de insumo ou recorrente), descrição livre do item dentro de uma categoria reutilizável. Compra paga hoje é aceita; vencimento não precisa ser futuro. Competência mensal existente é preservada, com data de competência opcional adicional. Pagamento inicial integral é validado antes da gravação e registrado no histórico. Fornecedor, quantidade/unidade e anexos são opcionais; quantidade e unidade devem ser informadas juntas.

Anexos privados ficam em armazenamento local fora da pasta pública; documentos Mongo guardam só metadados. PDF/XML/JPEG/PNG/WEBP são permitidos após extensão e conteúdo concordantes, limite padrão 5 MiB/arquivo e 5 anexos ativos/lançamento (configuráveis). XML sem DTD/entidades e nunca renderizado. Nome físico aleatório; download autenticado com disposition attachment e nosniff. Remoção lógica auditada preserva registros e arquivos nesta etapa; retenção física futura exige política/autorização. Interface de armazenamento permite trocar o provedor.

Produtos têm origin PRODUCED ou PURCHASED_FOR_RESALE e salesGroup SNACKS, BEVERAGES ou OTHER. Bebida de revenda não recebe produção; entrada de compra é operação de estoque própria. Reserva/baixa de venda e ON_DEMAND permanecem. Alterações de classificação não reescrevem pedidos antigos; itens novos recebem snapshot do grupo/origem. Registros legados não classificados exigem diagnóstico, sem adivinhar que bebida é salgado.

Vendas para emissão fiscal é consulta/exportação somente leitura de OWNER/ADMIN/ACCOUNTANT no tenant atual; caixa e cozinha não acessam. Não emite notas. Filtros e exportação usam a mesma política, ordenação permitida e paginação. CSV protege células contra fórmulas e tem limite explícito. Sem campo fiscal existente, informar “não integrado”.

## Matriz central de validação

| Campo | Obrigatoriedade / tipo / limites | Normalização / validação cruzada / feedback |
|---|---|---|
| CNPJ | obrigatório empresa/login empresarial, string 14 dígitos | máscara permitida, dígitos verificadores, sem repetidos, unicidade global de empresa; mostrar mascarado no perfil |
| CPF | obrigatório solicitação, string 11 dígitos | dígitos verificadores, unicidade por tenant, criptografia + HMAC existentes, resposta mascarada |
| Nome | obrigatório, string 2–120 | trim, sem caracteres de controle, não restringir nomes legítimos |
| Razão social | obrigatória, 2–200 | trim, sem controles |
| Nome fantasia | obrigatório, 2–160 | trim, sem controles |
| Telefone | obrigatório empresa/solicitação; opcional legado perfil | 10 ou 11 dígitos; máscara brasileira; rejeitar letras, normalizar pontuação permitida; “Informe o DDD e um telefone válido com 10 ou 11 dígitos” |
| E-mail | obrigatório, máximo 254 | retirar espaços, lowercase, local@domínio com extensão; sem lista fechada nem consulta externa; duplicidade tenant/email |
| Senha | obrigatória cadastro, 12–72 caracteres e até 72 bytes UTF-8 | não aceitar espaços nas pontas/demonstrativas; bcrypt12; não alterar silenciosamente |
| Confirmação | obrigatória junto de nova senha | igualdade backend/frontend; “As senhas informadas não são iguais.”; nunca armazenar |
| Descrição / cargo | lançamento 3–200; cargo 2–500 | trim; obrigatório; sem controles |
| Observação / motivo | notas opcionais até 2000; motivos 3–500 quando obrigatórios | trim; sem HTML interpretado |
| Valores | centavos inteiros, 0–10^12 para preço; 1–10^12 financeiro | sem negativos/NaN/infinito; soma de pagamentos igual ao total |
| Quantidades | produto/produção 1–10^6 inteiros; insumos >0 até 10^6, até 6 casas | unidade obrigatória quando quantidade; estoque mínimo 0–10^6 |
| Datas | datas civis reais YYYY-MM-DD, competência YYYY-MM | intervalo ordenado; compra/competência/pagamento coerentes; pagamento não futuro; vencimento passado/hoje permitido |
| Produtos | nome 2–120, categoria 2–80, enums tipados, ID 24hex | trim; URLs http(s) ou relativas seguras; sem escrita direta no saldo |
| Categorias | nome 2–100 + tipo financeiro | unicidade normalizada por tenant/tipo; tipo compatível com lançamento |
| Pagamentos | enum método/origem, centavos positivos e data real | integral; correção exige confirmação/motivo; até 10 pagamentos/pedido |
| Despesas / custos / compras | descrição/categoria/tipo/natureza/valor/competência obrigatórios | vencimento opcional para compra; fornecedor até160, quantidade/unidade opcionais; pago ou pendente |
| Anexos | opcionais, limite configurável padrão5 ×5MiB | extensão/MIME/conteúdo concordantes; tenant/ID validados; sem HTML/JS/executável/DTD; nome servidor |
| Filtros / arrays | page>=1, limit1–100; IDs 24hex, enums fechados | unknown rejeitado, busca limitada/escapada, limites existentes de itens e corpo mantidos |

## Superfícies afetadas

Endpoints existentes: auth/onboarding, auth/access-requests, auth/login, auth/platform-login; users/:id/role e status; products GET/POST/PATCH; productions POST; orders criação e consulta; finance/entries criação/edição/filtros e pagamentos. Novos: GET /users/me/profile; GET/PATCH /users/me/profile (PATCH nega alterações nesta versão); POST /products/:id/purchases; GET /finance/sales e /finance/sales/:id e /finance/sales-export; GET/POST /finance/entries/:id/attachments; GET /finance/entries/:id/attachments/:attachmentId/download; POST /finance/entries/:id/attachments/:attachmentId/remove. Prefixo /api, mutações com CSRF/Origin existentes.

Schemas: User/Tenant (telefone/e-mail), Product (origin/salesGroup), OrderItem (snapshot classificação), FinancialEntry (purchaseDate/competenceDate/entryKind/quantity/unit), metadados de anexo em coleção própria tenant-scoped; StockMovement mantém trilha de entrada por compra. Sem exclusões/índices destrutivos.

Telas: login, cadastros públicos, meu-perfil, usuários, financeiro (compra/anexos/vendas fiscais), produtos, cozinha, vendas por Salgados/Bebidas/Outros; shell e estilos compartilhados, dashboard e estados gerais. Layout 320px a desktop, alvos44px, foco visível, motion reduzido, tabelas roláveis localmente, mensagens role alert/status.

## Migração e implantação

Diagnóstico e dry-run padrão, idempotente: contar ausências/valores inválidos e conflitos; classificação de produtos depende de plano explícito por ID, sem classificar bebidas por suposição. Apply separado exige plano revisado e autorização posterior; não executar nesta entrega. Não tocar histórico. Novas leituras usam OTHER para grupo ausente e não liberam cozinha para origem indefinida. Preparar backup consistente de banco, chaves CPF e arquivos privados, testar restauração antes de manutenção/migração. Não alterar .env operacional. Índices novos somente aditivos.

## Matriz de testes e evidências

| Camada | Casos necessários |
|---|---|
| Validação unitária | telefones10/11, curtos/longos/letras/máscara; e-mails comuns/corporativos/incompletos; senha desigual/pontas/bytes; datas, IDs, centavos, extras |
| Perfil/segurança HTTP | perfil mascarado; OWNER self role/status/PATCH direto403 + auditoria; último OWNER; duas empresas; permissões todas roles |
| Financeiro HTTP | Frango em Insumos hoje, pago hoje, pendências de custo/despesa, filtro, histórico, anexos válidos/inválidos/grande/cross-tenant |
| Estoque/pedidos HTTP | produzido entra cozinha, revenda bloqueada, compra incrementa, venda reserva/baixa, ON_DEMAND, grupo no snapshot |
| Fiscal HTTP | contador leitura/paginação/filtros/detalhe/CSV, IDOR, caixa/cozinha negados, nenhuma emissão |
| Browser real | confirmação/telefone, perfil, produto por botão e sem Enter, grupos, financeiro/anexos/fiscal, fluxos320/768/1440px e teclado |
| Final | testes completos uma vez após direcionados, builds Nest/Angular, scan heurístico de bundle, snapshots de preservação |

Toda aplicação/escrita de teste deve validar programaticamente igualdade literal da URI com `mongodb://127.0.0.1:27017/salgados_financeiro_test` antes de conectar/importar a aplicação; fixtures exclusivas, sem limpeza. A URI sem parâmetros segue a instrução atual de retomada e prevalece sobre a configuração anterior. Registrar resultados reais e bloqueios, sem confundir build com navegação. Pendências de infraestrutura antigas permanecem até evidência nova específica.
