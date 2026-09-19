# Salvamento completo da vitrine — 18/09/2026

Relato: contatos, conteúdo/visibilidade e compartilhamento não permanecem salvos. Somente agente principal; documentos anteriores e fluxo atual lidos, sem repetir auditoria. Nenhuma escrita no cadastro informado pelo usuário.

Inspeção: DTO/schema/service contêm todos os campos citados e PUT versionado. Formulário envia o objeto completo; validação inválida impede envio com mensagem genérica distante do botão. Publicar/despublicar usa somente versão salva e substitui o formulário pela resposta, podendo descartar edição não salva. Antes de atribuir causa, reproduzir salvar/recarregar todos os campos em Chrome e verificar GET administrativo/público exclusivamente em fixtures próprias no banco autorizado.

Critérios: todos os campos válidos persistem após reload; valores false e seções vazias são mantidos; dados inválidos não são parcialmente salvos e recebem diagnóstico visível; publicação não descarta alterações pendentes sem aviso; erros e conflitos preservam formulário. Build e regressão atuais registrados após mudanças.

## Resultado

Não foi reproduzida falha de persistência no backend: antes da mudança, o teste completo de valores válidos aprovou gravação e reload dos contatos, redes sociais, seções vazias, flags false/true, textos e compartilhamento. A causa exata do fluxo do usuário permanece não confirmada sem sua resposta sobre a mensagem exibida. Dois defeitos de interação foram encontrados e corrigidos: validação genérica bloqueava todo o envio sem indicar claramente o campo; publicar/despublicar substituía edições pendentes por valores previamente persistidos.

Alterados `apps/web/src/app/features/catalog/landing-config.component.ts/html` e `admin.scss`: validação com identificação de telefone/WhatsApp/e-mail/links, listas de erros próximas dos controles de salvar, botão adicional **Salvar alterações** ao lado da publicação, indicador de alterações pendentes, bloqueio de publicação/despublicação enquanto houver edição não salva, preservação dos valores e bloqueio do editor durante carga/envio. Não houve alteração de schema, permissões, API ou dados da empresa do usuário.

Teste ampliado em `scripts/catalog-rbac-integration.mjs`: preencher cada campo citado, salvar por botão, recarregar, conferir valores/checkboxes no Angular e GETs privado/público; preços realmente omitidos; seções vazias mantidas. Outro cenário verifica que telefone inválido e rede sem HTTPS não enviam PUT, exibem erros específicos e mantêm edição; despublicar não descarta endereço pendente nem altera status.

Execuções sequenciais, URI exata validada antes de QA e gravação:

- Primeiro teste: 37 aprovados, 1 falha de seletor de teste (`[name]` de checkbox controlado por NgModel não corresponde a atributo DOM). Run `1789730131464-c7dd5d90e4`, log `vitrine-qa/config-save-before.log`. Seletor corrigido sem alteração de aplicação.
- Baseline corrigida: **38 aprovados, zero falhas**, run `1789730205062-3a42ee93df`, `vitrine-qa/config-save-baseline.log`. Confirma persistência original de campos válidos.
- `npm run build`: Angular/cópia/NestJS aprovados, `vitrine-qa/config-save-build.log`; avisos existentes continuam.
- `$env:CATALOG_BROWSER='true'; node scripts/catalog-rbac-integration.mjs`: **39 aprovados, zero falhas**, run `1789730344403-b34f9d2cf1`, `vitrine-qa/config-save-final.log`. Resultados, preservação e manifesto de limpeza por ID em `tenancy-qa/1789730344403-b34f9d2cf1/`. Sessões Chrome e API próprias encerradas.
- `node scripts/catalog-bundle-check.mjs`: bundles atuais inspecionados; relatório em `vitrine-qa/bundle-scan.json`. Unitários backend não repetidos: mudanças restritas à apresentação, com regressão HTTP/Chrome atual.

Instrução de uso: atualizar a página sem descartar edição importante, preencher contatos com os formatos indicados e usar **Salvar alterações** ou **Salvar configuração**. Publicar controla visibilidade e exige configuração já salva; não é substituto de salvar. Página já publicada recebe atualizações ao salvar, sem necessidade de despublicar/publicar novamente. Não é necessário preencher campos opcionais vazios.
