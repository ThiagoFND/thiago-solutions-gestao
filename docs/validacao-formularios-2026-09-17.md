# Validação de formulários — 17/09/2026

Resultado final: **14 verificações aprovadas, zero falhas**, build raiz aprovado. A execução final encerrou a aplicação QA e o navegador normalmente (exit 0).

Escopo: máscaras e limites CNPJ/CPF/telefone, valores financeiros, perfil com menu lateral, rótulos de usuários e ordem dos grupos de vendas. A documentação funcional está em [melhorias de usabilidade](usability-business-improvements.md) e no [README](../README.md).

## Execução

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
npm run build
node scripts/forms-browser-integration.mjs
```

O build raiz atualizado passou (Angular, cópia da SPA e Nest): [log](forms-qa/2026-09-17/build.log). Nas repetições, somente o script QA mudou; o mesmo build foi reaproveitado. `node --check scripts/forms-browser-integration.mjs` passou. O sandbox exige execução escalada para processos de compilação/navegador; a execução foi autorizada.

O [script](../scripts/forms-browser-integration.mjs) reutiliza o harness com URI literal, servidor próprio em `127.0.0.1:4329`, empresas/usuários exclusivos e comparação de fingerprints BSON dos documentos anteriores. Todas as gravações usaram o banco autorizado. Nenhum banco, coleção ou registro foi apagado/reinicializado. Cada execução encerra navegador e aplicação no `finally`.

## Cobertura

- CNPJ nos três formulários públicos: digitação com máscara progressiva, bloqueio de letras, limite de 14 dígitos e colagem. Login real com modelo mascarado.
- Solicitação de acesso e cadastro de empresa: resposta HTTP real 201 e payload com CNPJ/CPF/telefone somente em dígitos; CPF/telefone com máscara e limite; atributos maxlength dos campos textuais conferidos.
- Perfil de OWNER, CASHIER, empresa PENDING e PLATFORM_ADMIN: identidade correta, menu permitido, retorno à área adequada e recarga. Perfis pendente/plataforma permanecem na tela por 16 segundos, além de um ciclo de polling de 15 segundos, sem liberar dashboard.
- Usuários: rótulos Pendente/Ativo/Inativo/Recusado e filtros enviando enums corretos aos endpoints reais.
- Vendas: headings no DOM na ordem Salgados, Outros, Bebidas.
- Financeiro: rejeição de letras, colagens inválidas/ambíguas (`1.234,56`), excesso de casas/limite monetário preservando valor anterior; categoria pessoal inline selecionada automaticamente, rascunho mantido e `12,34` enviado como 1234 centavos. Quantidades com seis casas, valores de produção com ponto e limites inteiros de dia/parcelas.

## Limites

Colagem usa evento ClipboardEvent com dados e emula a inserção padrão apenas quando não cancelada, permitindo verificar valor e modelo sem depender da área de transferência do sistema. Os limites textuais foram conferidos via atributos HTML, sem preencher todos até o tamanho máximo. Não foram repetidas suítes HTTP gerais, unitários backend ou responsividade completa nesta alteração de frontend. Nenhum target Angular unitário está configurado. Permanecem avisos de Node 25 sem LTS e de APIs Mongoose depreciadas. Esta evidência se limita aos cenários descritos.

## Tentativas e sincronização

Execução final `1789667511138-fd76d6b3af`: **8266 documentos anteriores, todos inalterados, zero ausentes, zero alterados**, total final 8287 (21 novos retidos). [Resultados individuais](tenancy-qa/1789667511138-fd76d6b3af/forms-results.json), [preservação](tenancy-qa/1789667511138-fd76d6b3af/preservation.json), [log](forms-qa/2026-09-17/browser-final.log) e [captura](tenancy-qa/1789667511138-fd76d6b3af/forms.png). MongoDB reportou suporte a transações. Nenhum defeito de aplicação foi encontrado nos cenários executados.

A primeira execução (`1789642967139-44ff979592`) teve 13 aprovações e uma falha por leitura das opções antes de montar a rota lazy; foram preservados 8210/8210 documentos, total final 8231. [Log](forms-qa/2026-09-17/browser.log).

A segunda (`1789667419782-3d01e4b281`) confirmou os rótulos, mas o teste aguardava `/users` também para pendentes; o endpoint correto é `/users/requests`. Teve 13 aprovações e uma falha, com 8245/8245 documentos preservados. [Log](forms-qa/2026-09-17/browser-retry.log). Corrigidas somente as esperas/predicados do script, sem alteração da aplicação.
