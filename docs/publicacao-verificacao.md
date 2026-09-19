# Verificação para publicação pública

Data: 19/09/2026. Escopo: inspeção estática do diretório de trabalho para preparar publicação no GitHub. Esta revisão não certifica funcionamento, segurança integral ou implantação.

## Procedimento e resultados

| Comando/procedimento executado | Resultado |
| --- | --- |
| `Get-Content AGENTS.md`, `Get-Content docs/financeiro-contrato.md`, `Get-Content .codex/agents/qa_integracao.toml` | Instruções locais lidas; banco operacional não acessado. |
| `rg --files --hidden` com exclusões de dependências, builds e caches | Inventário inicial; saída extensa truncada, complementada por contagem programática. |
| `rg --files --hidden --no-ignore -g '!node_modules' -g '!.git' -g '!dist' -g '!.angular' -g '!coverage' -g '!public' -g '!.npm-cache'`, processado por Python | 1.397 arquivos no momento da inspeção; 920 em `docs`, incluindo 872 evidências em diretórios QA; 38 arquivos em `.qa-attachments`. As contagens são do diretório local, antes da seleção final para Git. |
| Python via `@' ... '@ \| python -`, leitura UTF-8 de arquivos textuais e expressões regulares | Zero correspondências para cabeçalho de chave privada, tokens GitHub, chave AWS no formato AKIA, JWT literal e URI MongoDB com usuário/senha. Busca genérica de atribuições de credenciais gerou 21 caminhos para triagem; isso inclui variáveis e fixtures, não 21 segredos confirmados. |
| `rg -l -i 'password\|senha\|jwt_secret\|cpf_encryption_key\|@gmail\|@hotmail' docs` com filtros Markdown | Triagem de referências a autenticação e dados pessoais sem imprimir valores. |
| Python: leitura das chaves superiores dos quatro JSON avulsos de `docs` e busca de campos pessoais/caminhos locais | Relatórios de ambiente e diagnóstico precisam ser excluídos da publicação. |
| `rg -l --hidden -i '[a-z0-9._%+-]+@(gmail\|hotmail\|outlook\|yahoo)\.[a-z.]+'` nos fontes/scripts/docs | Identificado destinatário pessoal fixo no módulo de portfólio e três documentos; encaminhado ao coordenador. |

Uma primeira expressão regular complementar em Python falhou por codificação do texto enviado pelo PowerShell (`PatternError: nothing to repeat`). A busca foi corrigida usando expressão ASCII e executada novamente com sucesso. Nenhum valor secreto foi reproduzido neste relatório.

## Conferência após inicialização do Git e compilação

`git ls-files --others --exclude-standard` retornou inicialmente 464 candidatos e, após a inclusão coordenada das cinco definições de agentes, **469 candidatos**. A varredura leu 468 arquivos como texto; um arquivo não foi tratado como texto. Os cinco grupos de assinaturas fortes descritos acima retornaram **zero correspondências** nesse conjunto. A seleção por nomes de arquivos sensíveis retornou apenas `.env.example` e `apps/api/.env.example`, ambos modelos publicáveis. O coordenador também verificou zero candidatos maiores que 50 MiB. Estas contagens antecedem o commit; não representam uma consulta ao conteúdo remoto.

Ambiente observado: Node.js 25.8.0; npm 11.11.0 informado pelo coordenador. Em cada processo de compilação foram definidas explicitamente as variáveis:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27017/salgados_financeiro_test'
```

| Comando | Código de saída | Erros / avisos observados | Resultado resumido |
| --- | --- | --- | --- |
| `npm run build --prefix apps/api` | 0 | 0 erros; 0 avisos | `nest build` concluído. |
| `npm run build --prefix apps/web` — primeira tentativa restrita | 1 | 1 falha `spawn EPERM`; 1 aviso sobre Node ímpar sem LTS | O ambiente bloqueou subprocesso do compilador; não foi diagnosticado erro de código nesta tentativa. |
| `npm run build --prefix apps/web` — repetição com escalonamento autorizado | 0 | 0 erros; 2 avisos: Node ímpar sem LTS e dependência CommonJS `qrcode` | Bundle concluído em 7,923 s; saída em `apps/web/dist/web`; tamanho inicial 307,10 kB, transferência estimada 83,73 kB; 2 chunks iniciais e 48 lazy. |

Foram realizadas **3 tentativas de compilação**, com **2 compilações concluídas** (API e web). O comando raiz que copia a SPA para `apps/api/public` não foi executado. Nenhuma aplicação foi iniciada e nenhum teste foi executado. Os avisos do frontend permanecem registrados; o sucesso do build não equivale à aprovação funcional.

## Arquivos a preservar localmente e excluir do Git

- `apps/api/.env`: configuração local com segredos; exemplos `.env.example` devem permanecer sem valores operacionais.
- `.qa-attachments/`: anexos gerados em execuções locais; não são fontes do sistema.
- `docs/*-qa/` e `docs/validacao-financeiro/`: logs, capturas de tela, snapshots e identificadores de execuções anteriores. Não houve revisão visual individual das imagens.
- `docs/codex-doctor.json` e `docs/portfolio-validation-2026-09-18.json`: informações e caminhos locais.
- `docs/qa-catalogo-diagnostico-2026-09-18.json`: diagnóstico com campos de identificação de usuário/empresa.
- `docs/especificacao_requisitos_usuarios.docx`: documento binário cujo conteúdo e metadados não foram auditados nesta revisão.
- `.npm-cache/`, `node_modules/`, `dist/`, `.angular/`, `coverage/`, `apps/api/public/` e `*.tsbuildinfo`: dependências, caches e saídas geradas, dispensáveis no código publicado.

Padrões preventivos adicionais: `.env`, `.env.*` com exceção explícita para `.env.example`; `*.pem`, `*.key`, `*.p12`, `*.pfx`; diretórios de uploads, storage, backups e dumps. Ignorar um caminho preserva seus arquivos locais. Esta etapa não autoriza apagar dados.

## Achados encaminhados

`apps/api/src/portfolio/portfolio.module.ts` e os documentos `docs/portfolio-entrega-2026-09-18.md`, `docs/portfolio-profissional-handoff.md` e `docs/portfolio-profissional-spec.md` contêm destinatário pessoal fixo. O coordenador identificou que esse contato integra a funcionalidade existente de leads e determinou preservá-lo, sem mudanças funcionais nesta publicação. O endereço não é credencial; permanece a limitação de que ficará visível nos fontes/documentos públicos. Não foram detectadas senhas pessoais nos Markdown avulsos pelas expressões examinadas.

Os testes e harnesses possuem senhas sintéticas, chaves geradas com `randomBytes`, endereços de exemplo e variáveis obtidas do ambiente. São distintos de credenciais operacionais. O endereço em `apps/api/src/common/business-validation.spec.ts` participa de fixture de validação e não foi tratado como credencial real. `scripts/create-platform-admin.mjs` obtém os dados do administrador pelo ambiente; `scripts/verify-test-platform-login.mjs` lê credenciais externas, sem necessidade de publicá-las.

## Limitações

- Testes executados nesta revisão: **0**. Tentativas de build: **3**, sendo **2 concluídas**. Aplicações iniciadas: **0**. Acessos e escritas no MongoDB: **0**.
- Logs históricos não foram considerados evidência de aprovação atual. O trabalho trata da seleção segura dos arquivos para publicação.
- Varreduras por padrões não provam ausência de todos os segredos. Não houve análise de entropia, revisão individual de binários/imagens ou validação de direitos de uso das imagens.
- A seleção permitida pelo `.gitignore` foi conferida antes do commit. Os arquivos efetivamente adicionados, commit remoto e visibilidade pública devem ser verificados pelo coordenador após integrar as alterações.
