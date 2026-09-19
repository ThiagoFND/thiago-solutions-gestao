# Correção da vitrine — imagens e navegação, 18/09/2026

Escopo: relato e screenshots `image/imageteste1.png`, `imageteste2.png`, `imageteste3.png`. Somente principal, sem agentes ou acesso operacional. Documentação de segurança e handoff já lida nesta sequência; estado vigente em vitrine-validacao.md.

Achados antes da alteração: âncoras relativas ao base href `/` redirecionam à apresentação da plataforma; template de destaque não renderiza imagem; galeria adicional depende indevidamente de descrição completa; erro de imagem principal esconde silenciosamente o elemento, deixando área vazia. A capa com inicial indica ausência de URL na resposta, não comprova erro no upload. Screenshots não revelam URL/status HTTP das imagens quebradas; endereço público solicitado para diagnóstico específico.

Contrato da correção: links Produtos/Sobre/Contato/identidade/Explorar devem manter rota e slug atuais e alcançar a seção correta, inclusive prévia. Seção desabilitada não deve ter link. Destaques devem mostrar imagem quando configurada; galeria independe de descrição. Erros devem ter indicação legível, sem requisição infinita nem substituição dos dados persistidos. Testes devem verificar decodificação real de imagem carregada, além de status HTTP, e navegação sem abandonar a empresa. Usar exclusivamente URI exata de QA, registrar/limpar somente fixtures da execução.

## Implementação e evidências

Alterados `public-catalog.component.ts/html/scss`: âncoras incluem a rota atual, navegação de produtos respeita seção habilitada, destaques renderizam imagens, galeria aceita imagens sem descrição e falhas deixam indicação legível. Corrigido também problema real encontrado pelo teste: imagem dentro do grid ultrapassava sua área e interceptava cliques/textos; agora fica posicionada dentro da caixa reservada.

`scripts/catalog-rbac-integration.mjs` ampliado: comparação exata dos bytes do upload com o GET público, naturalWidth/complete de logo, destaque, principal e galeria; clique e posição das seções Produtos/Sobre/Contato e CTA, preservando o slug. Imagem de fixture é PNG branco de 1 pixel (o espaço branco nos screenshots desse produto é esperado). Endpoints/API e persistência não foram alterados. O teste de clique na prévia não foi acrescentado nesta rodada; ela utiliza o mesmo gerador de links por rota.

Comandos sequenciais, com `TEST_MONGODB_URI` e `MONGODB_URI` exclusivamente iguais à URI autorizada:

- `npm run build`: primeira tentativa bloqueada por spawn EPERM, log `vitrine-qa/images-links-build.log`; reexecução autorizada aprovada. Build final aprovado em `vitrine-qa/images-links-build-2.log`; avisos preexistentes de Node ímpar/CommonJS e orçamento SCSS continuam (o CSS novo amplia o aviso do catálogo).
- `$env:CATALOG_BROWSER='true'; node scripts/catalog-rbac-integration.mjs`: primeira rodada 36 aprovados/1 falha, revelou sobreposição de imagem e clique interceptado; run `1789729351863-7691cd06e2`. Não foi um sucesso, evidência preservada.
- Depois da correção, mesma suíte: **37 aprovados, zero falhas**, run `1789729475901-bda4b196ba`, log `vitrine-qa/images-links-integration-2.log`. **8.731 anteriores intactos**, zero alterados/ausentes; **445 documentos próprios registrados e removidos**. Manifests/resultados/screenshots em `tenancy-qa/1789729475901-bda4b196ba/`. Chrome e API próprios encerrados pelo harness.
- `node scripts/catalog-bundle-check.mjs`: 31 bundles atuais, zero achados heurísticos. Screenshot desktop final inspecionado visualmente: card não tem texto encoberto.

Não se repetiram unitários backend, pois esta correção é de apresentação e os testes atuais de integração/navegador e build cobrem os caminhos alterados. Nenhum deploy, leitura ou escrita operacional foi feito. A causa específica de URLs quebradas da empresa nas capturas permanece não confirmada sem endereço público/diagnóstico de rede; o carregamento pelo upload local foi comprovado. Correções precisam ser implantadas no servidor publicado para aparecerem lá. Capa com inicial continua sendo fallback quando não há URL configurada; não foram inventadas nem inseridas fotos no cadastro da empresa.

Continuidade: esta correção atende o relato de imagens/navegação. Não encerra as pendências anteriores de paginação de cargos, metadados no servidor, operações comerciais ausentes ou suítes históricas.

## Diagnóstico com o endereço fornecido

GET somente leitura de `localhost:3000/api/public/companies/thiagoteste`: produto tem imagem principal e três adicionais; logo/capa vazios. GET da imagem na porta 4200 retorna 200 text/html (602 bytes); na porta 3000 retorna 200 image/png (247.227 bytes). Causa confirmada: URLs relativas `/api/public/images/...` ignoravam o apiUrl absoluto do ambiente de desenvolvimento. Correção especificada: resolver imagens locais contra apiUrl, preservar imagens externas HTTPS e produção de mesma origem; prévias autenticadas usam endpoint privado. Nenhuma modificação do cadastro ou configuração do servidor existente.

Correção implementada em `catalog-image-url.ts`, PublicCatalog TS/HTML e Products TS/HTML. Imagens locais usam o endereço da API; prévia de produto usa endpoint autenticado. Confirmado também `Cross-Origin-Resource-Policy: same-origin` da API: as imagens locais agora usam `crossorigin=use-credentials`, respeitando o CORS já permitido, sem afrouxar headers do backend. URLs externas mantêm comportamento anterior.

Validação específica: `node scripts/catalog-image-url-check.mjs` aprovou seis assertions (origens separadas, mesma origem, prévia, URL externa e vazio). `node scripts/catalog-local-readonly-check.mjs` abre somente a vitrine pública indicada, bloqueia métodos diferentes de GET/HEAD/OPTIONS, não inicia API nem conecta ao Mongo: **cinco imagens decodificadas e três links aprovados**; artefatos `vitrine-qa/thiagoteste-local.json`, `thiagoteste-local.png`, `thiagoteste-readonly.log`. A primeira tentativa antes de configurar CORS encontrou imagem invisível e falhou por timeout; não foi contada como aprovada. Nenhum cadastro da empresa foi alterado.

Build Angular/NestJS aprovado (`vitrine-qa/image-origin-build.log`); nova regressão HTTP/Chrome no banco exclusivamente de teste: **37 cenários aprovados, zero falhas**, run `1789729810892-e9b27102aa`, log `vitrine-qa/image-origin-integration.log`. Preservação e limpeza própria registradas no diretório da execução. Scan atual: 32 bundles, zero achados heurísticos. Os avisos de build anteriores persistem. Esse diagnóstico resolve a pendência específica das URLs quebradas registrada acima; logo/capa continuam vazios até configuração pelo usuário.
