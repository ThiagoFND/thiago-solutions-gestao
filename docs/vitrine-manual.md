# Vitrine pública e cargos — uso e validação

Implementação local em 17/09/2026. Consulte [especificação](vitrine-rbac-spec.md), [matriz de endpoints](vitrine-permissoes.md) e [resultados e limitações](vitrine-validacao.md). Não houve implantação nem gravação no banco operacional.

## Operação

1. Entre em uma empresa ativa com OWNER ou permissões equivalentes. A plataforma administra empresas, mas não configura seu catálogo pelo login global.
2. Em **Categorias**, informe nome e descrição, mantenha ativa e marque publicação quando desejado. Salve. Ordens pública e interna são independentes; use os campos ou os botões para subir/descer. Categorias com produtos podem ser arquivadas ou ter todos os produtos movidos para outra categoria da mesma empresa; o histórico é preservado.
3. Em **Produtos**, selecione categoria e forma de fornecimento; preencha nome, origem, preço e unidade. Configure descrições, imagens, destaque, publicação e ordens. Clique **Salvar produto**. A prévia do card fica no formulário. Cadastros antigos continuam internos até classificação explícita; não houve migração ou publicação automática dos antigos.
4. Para produto sob demanda, selecione **Produzido sob demanda** ou **Comprado sob demanda**. A origem e a publicação são ajustadas ao salvar. Saldo zero não o impede de aparecer. **Ocultar manualmente** prevalece; desmarcar restaura a elegibilidade sem apagar histórico. A categoria e a página também precisam estar publicadas e ativas.
5. Em **Vitrine pública**, configure slug, nome público, textos, tema, logo/capa, contatos, horários, seções e política de produtos sem estoque. Salve, abra a prévia e publique. Copie o link `/empresa/slug` ou baixe o QR Code. Despublicar mantém toda a configuração. A prévia ignora somente a publicação da página, não a dos produtos e categorias.
6. Em **Cargos e permissões**, crie nome e descrição, selecione ações por módulo, confira o resumo e salve. Somente permissões que o ator possui são concedíveis. É possível duplicar, desativar e arquivar, consultar usuários e histórico e atribuir a um usuário elegível. Para substituir a vinculação, atribua outro cargo criado pela empresa. Não existem perfis operacionais fixos para selecionar; crie um cargo antes de aprovar novos usuários. Alterações críticas invalidam sessões; os afetados precisam entrar novamente.
7. Vendas continuam exclusivamente na tela interna **Vendas**. A vitrine não possui carrinho, pedido, reserva, checkout nem pagamento. Publicar um produto não concede permissão de venda.

Permissões mínimas práticas: para preencher todos os campos do formulário de produto, conceda leitura de produtos/categorias, criar/editar, publicar e ordenar; arquivar é necessário ao desativar. Upload requer `empresa.configurar`. Os formulários removem do payload campos de publicação/ordenação/arquivamento não autorizados. Selecionar fornecimento sob demanda exige também `produtos.publicar`, pois essa operação habilita a publicação automaticamente. Não ampliar poderes automaticamente para contornar um 403.

## Disponibilidade

| Estado | Resultado público |
|---|---|
| Empresa não ativa ou página despublicada | Página indisponível |
| Categoria inativa, arquivada ou não publicada | Produtos não exibidos |
| Produto inativo, não publicado ou ocultado manualmente | Produto não exibido |
| Controlado por estoque, saldo vendável positivo | Disponível |
| Controlado por estoque, saldo zero | Indisponível ou oculto conforme configuração |
| Produzido/comprado sob demanda, inclusive saldo zero | Disponível se as demais condições permitirem |

Reposição e produção restauram disponibilidade por cálculo do servidor. O navegador não informa saldo público nem decide disponibilidade. O estoque interno de itens sob demanda pode refletir obrigações negativas da regra de vendas existente; isso não expõe quantidade ao visitante.

## Execução segura de QA

Pré-requisitos: dependências instaladas, MongoDB local com suporte a transações, Chrome instalado para navegador. Não alterar um MongoDB operacional nem seus serviços para atender QA. Configurações de implantação/chaves estão em `users-tenancy-deployment.md`; não usar senha demonstrativa.

Na raiz, PowerShell:

```powershell
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:MONGODB_URI=$env:TEST_MONGODB_URI
if ($env:TEST_MONGODB_URI -cne 'mongodb://127.0.0.1:27017/salgados_financeiro_test') { throw 'URI recusada' }
npm run build
npm test --prefix apps/api -- --no-file-parallelism
$env:CATALOG_BROWSER='true'
npm run test:catalog
node scripts/catalog-bundle-check.mjs
```

O harness também valida a URI antes de carregar a aplicação e escrever, gera credenciais aleatórias, provisiona índices aditivamente, serve API/SPA em `http://127.0.0.1:4337` e fecha seus próprios processos. `CHROME_PATH` permite indicar Chrome. Não encerre servidores de outras pessoas para liberar a porta. O teste abre a aplicação automaticamente e gera screenshots; as empresas temporárias são removidas ao fim. Para uso interativo persistente, utilize a configuração de desenvolvimento previamente aprovada, sem executar seeds ou bootstrap operacional nesta validação.

`npm run dev` é o comando de desenvolvimento existente; depende da configuração privada válida da aplicação e deve ser executado somente após conferir seu destino Mongo. Não execute `start:prod`, migração ou bootstrap como parte de QA. O CLI `tenancy-storage.mjs` mantém a trava exclusiva do banco de testes; seus novos schemas foram registrados para provisionamento aditivo, mas esse comando não foi executado nesta entrega.

As suítes históricas `test:tenancy`, `test:migration`, usabilidade e operacional não foram reexecutadas nesta entrega. Alguns fixtures antigos de produto ainda usam categoria textual e precisam ser adaptados ao novo DTO antes de voltarem a servir como regressão atual. Não confundir seus logs antigos com esta validação.

## Conferência manual

Abra o link público em janela sem login: pesquise e filtre, confira a ordem e teste celular. Não deve haver saldo exato, custo, tenant, equipe ou controles de compra. Cadastre os três fornecimentos; confirme a transição de saldo e o efeito da ocultação. Suspenda/despublique somente uma empresa própria de teste. Entre com um cargo restrito e verifique menus e negação HTTP mesmo com requisição manipulada. Edite esse cargo e confira a invalidação da sessão antiga.
