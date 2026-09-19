# Vitrine pública e cargos por empresa

Contrato de 17/09/2026. Execução exclusivamente pelo agente principal, sequencial, conforme pedido atual. Este contrato substitui restrições históricas de delegação e permite limpar somente documentos identificados como criados pela própria execução de QA. Não autoriza acesso operacional.

Estado final desta execução: implementação local e validação atual registradas em [vitrine-validacao.md](vitrine-validacao.md), com 211 unitários e 35 cenários HTTP/navegador aprovados, builds atuais aprovados e limitações explícitas. As descrições de ausência abaixo representam o estado encontrado antes desta evolução. Uso em [vitrine-manual.md](vitrine-manual.md); políticas efetivas em [vitrine-permissoes.md](vitrine-permissoes.md).

## Estado encontrado

Lidos AGENTS.md; security-handoff/backend/permissions/mongodb; users-tenancy-spec/handoff; financeiro-contrato/manual; evolucao-operacional-contrato e sua validação mais recente. Inspecionados guards, TenantAccessService, todos controllers (76 handlers), UsersService, schemas User/Product, ProductsService, OrdersService, FinanceService, auditoria, AppModule, rotas/modelos/formulário Angular. As integrações existentes usam tenantId da sessão, versões de usuário/empresa, cookies HttpOnly, CSRF, limites, DTOs e auditoria. PLATFORM_ADMIN não acessa dados comerciais. OWNER/ADMIN possuem proteção de último proprietário. Produção com ficha e recebimento usam transações; vendas legadas usam reserva/compensação e lock, cuja limitação de crash permanece.

A raiz pública apresenta Thiago Solutions Digitais. Não existe vitrine por slug, entidade Category ou cargo personalizável. Produto usa categoria textual, origin, salesGroup e availabilityMode. Há 185 unitários e builds aprovados na entrega anterior; não são evidência desta evolução. Não repetir auditoria histórica. Angular não possui target unitário configurado; validar também por navegador real.

## Modelo e compatibilidade

- Category: tenantId, name/normalizedName, description/imageUrl/icon/color, active/published/archived, publicOrder/internalOrder, version, updatedById e timestamps. Unicidade por tenant/nome normalizado. Ordenação explícita com desempate por ID. Arquivar preserva vínculos; mover produtos exige destino ativo do mesmo tenant e transação. Exclusão física indisponível nesta evolução: arquivamento é o tratamento seguro inclusive para categorias sem produtos.
- Product: acrescentar categoryId, supplyMode obrigatório nos novos cadastros, descrições, unidade, imagens, publicação, destaque, ocultação manual, ordens, versão e ator. Categoria textual existente é snapshot de compatibilidade; novos writes obtêm nome pelo categoryId. Produtos antigos permanecem internos até vinculação explícita; não são publicados automaticamente. origin permanece classificação técnica de fabricação/revenda usada nas fichas; salesGroup deixa de organizar novas telas e não concede autorização.
- SupplyMode: CONTROLADO_POR_ESTOQUE, PRODUZIDO_SOB_DEMANDA, COMPRADO_SOB_DEMANDA. availabilityMode legado é espelho de compatibilidade controlado pelo servidor. Produzido/comprado determina origin correspondente quando sob demanda; estoque controlado permite ambas origens. Seleção de demanda ativa published, salvo ocultação manual explícita. Alterar campos públicos exige produtos.publicar além de editar/criar; ordenar exige produtos.ordenar.
- Disponibilidade efetiva: empresa ACTIVE + página publicada + categoria ativa/publicada/não arquivada + produto ativo/publicado/não ocultado. Estoque controlado acrescenta availableStock > 0. Sem estoque pode permanecer visível indisponível ou ser oculto por configuração. Demanda independe de saldo. Calcular em consulta, sem reescrever estado na reposição.
- LandingConfig: uma por tenant, slug global único lowercase alfanumérico/hífen, configuração visual/contactos/seções/SEO, published, versão e ator. Apenas empresa ACTIVE pode publicar ou ter consulta pública. Preview autenticado usa o mesmo DTO público, ignorando somente publicação da página. GET público não cria configurações nem categorias.
- CustomRole: tenantId, nome normalizado único, descrição, permissions allowlist, active/archived/version, histórico de snapshots permitidos. User.customRoleId opcional; ausência usa perfil legado. Cargo customizado substitui permissões legadas, nunca soma privilégios. OWNER/ADMIN e PLATFORM_ADMIN não recebem cargo customizado. Sem migração automática.

## Autorização e concorrência

Catálogo central backend com permissões módulo/ação solicitadas, nomes amigáveis e sensibilidade. OWNER/ADMIN preservam poderes empresariais, plataforma possui nenhum. Perfis operacionais recebem templates compatíveis. Guard global nega endpoint sem política; endpoints empresariais declaram permissões explícitas. Serviços revalidam sessão/tenant/permissões antes de operar, incluindo chamadas transacionais. Nenhuma permissão enviada pelo cliente é autoridade. Endpoints globais e perfil próprio preservam políticas especiais.

Cargo exige subconjunto das permissões atuais do ator, tanto na criação/edição quanto atribuição; usuário não altera cargo próprio nem proprietário/plataforma. Atribuição/alteração/desativação de cargo incrementa versões das sessões afetadas, na mesma transação da auditoria. membershipVersion serializa alterações de membros e cargos. Último proprietário permanece protegido. Arquivar/desativar cargo em uso mantém vínculo e remove acesso, revogando sessões; remoção de vínculo exige substituição explícita segura, sem ressuscitar privilégios legados acidentalmente.

## APIs e exposição

Internas: /categories (CRUD lógico, ordenação, produtos, movimento); /products ampliado; /landing (configuração, publicação, preview); /roles (catálogo, CRUD lógico, duplicação, membros, atribuição, histórico). Públicas: somente GET /public/companies/:slug e recursos estritamente públicos associados. Nenhum controller público chama mutações de vendas. Vendas continuam /orders, autenticadas; snapshot inclui categoria e fornecimento além de nome/preço/quantidade/ator. Visibilidade pública não interfere na autorização de venda interna.

DTO público allowlist: identidade pública, configuração permitida, categorias e cards de produto, chaves públicas opacas quando necessárias para filtros. Não expor tenantId, estoque exato, custos, fornecedor, autoria, financeiro, auditoria ou controles internos. Busca literal limitada, paginação bounded, consultas em lote. Sem cache servidor inicialmente: suspensão/estoque/publicação consultados em cada requisição. Cache-Control no-store preservado.

Imagens aceitas somente por fluxo validado ou URLs HTTPS permitidas; upload exige limite, assinatura real, nomes aleatórios, tenant e resposta segura. Não aceitar SVG/HTML executável nem buscar URL remotamente no servidor. QR deve codificar o link real, gerado localmente sem serviço externo. Temas usam cores de paleta com contraste e conteúdo textual escapado pelo Angular.

## Interface

/empresa/:slug é vitrine responsiva sem controles de compra: apresentação, pesquisa, categorias, destaques, cards, dados públicos e contatos. Configurador interno oferece salvar, preview, publicar/despublicar, copiar link e QR. Categorias têm ordens pública/interna e botões acessíveis subir/descer. Produtos oferecem categoria, fornecimento, publicação, destaque, imagem, preview e salvar visível. Cargos agrupam permissões, permitem selecionar grupo/individual, explicam sensíveis e resumem antes de salvar. Menus/rotas/ações usam permissões da sessão; backend continua autoridade.

## Validação e limites

Toda aplicação de QA valida URI literal mongodb://127.0.0.1:27017/salgados_financeiro_test antes de imports/escritas. IDs e segredos aleatórios; registrar manifesto dos documentos próprios, preservar snapshot prévio e remover exclusivamente documentos próprios após QA. Nunca apagar coleção/banco, resetar dados, executar seeds/migrações operacionais ou parar serviços do usuário.

Testar disponibilidade e reversibilidade; isolamento/IDOR; public DTO; slug/status/publicação; ordenação; fornecimento; histórico de venda; permissões desconhecidas/proibidas, subconjunto, último OWNER, self-change, revogação e auditoria; DTO/upload/CSRF/cookies/rate-limit; browser em 320/768/1440, formulários e menus. Executar unitários atuais, integração real e builds atuais; registrar pass/fail/bloqueado/não executado sem somar reexecuções. Índices só aditivos no banco de teste. Não executar provisão operacional. Entrega somente concluída após critérios do pedido comprovados; pendências devem permanecer explícitas.
