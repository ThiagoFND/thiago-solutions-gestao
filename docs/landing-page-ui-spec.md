# Landing page — especificação de reestruturação visual

Data: 22/09/2026. Escopo fechado: a rota `/` do `apps/web`. Não altera API, schema,
permissão, rota nem regra de negócio. Substitui `ui-migracao-rivocode-spec.md`, descartado
em 22/09/2026 junto com a ideia de migrar o front para React.

## 1. Decisão

O `@rivocode/ui` é React 19 + Tailwind 4 e não tem distribuição Angular. Usá-lo exigiria
migrar o front inteiro. **Decidido: fica no Angular.** A biblioteca não entra.

O que entra é a **linguagem** do design system, não o código dele:

| Do DS | Como chega aqui |
|---|---|
| Camada 3 de tokens (os ~50 papéis de cor) | CSS custom properties declaradas no escopo da landing |
| A distinção preencher × ler (`bg-danger` × `text-danger-text`) | pares `--ts-<estado>` e `--ts-<estado>-text` |
| Escala de forma, sombra e tipografia | `--ts-radius-*`, `--ts-shadow-*`, `--ts-text-*` |
| O método de acabamento (`reference/method.md`) | as quatro passadas, aplicadas na revisão |
| A conferência de acessibilidade (`reference/a11y.md`) | o aceite da seção 6 |

O método e as convenções aplicados aqui vieram de `ds.rivocode.com.br` — `/convencoes.md`,
e o método de acabamento da skill do design system (`npx -y @rivocode/ui skill`, que escreve
`.claude/skills/rivocode-ui/`). As partes de método, layout, design e a11y independem de
framework e valem neste Angular; as de componente e de tema React não se aplicam, porque a
biblioteca não entra. A skill é opcional: nada nesta pasta depende dela em tempo de build.

## 2. Raio de alcance

**`src/styles.scss` não é tocado.** É folha global, minificada, e sustenta as 27 features do
painel. Todo token e toda regra nova vivem no `:host` dos dois componentes da landing.
Quebrar a landing não pode quebrar o `/vendas`.

Arquivos que mudam, e só eles:

```
apps/web/src/app/features/landing/
├── _ui.scss                   novo: tokens + primitivas compartilhadas
├── landing.component.html     reescrito
├── landing.component.scss     reescrito
├── solutions.component.html   reescrito
├── solutions.component.scss   reescrito
└── solutions.component.ts     estados de carregamento, erro e vazio
```

`landing.component.ts` não mudou: os imports do template continuam os mesmos.

**Um arquivo fora dessa pasta mudou**, e precisa de revisão consciente:
`apps/web/angular.json` teve o orçamento `anyComponentStyle` elevado de 6/10 kB para
13/18 kB. O limite antigo foi calibrado para as telas de CRUD do painel, e a landing, com
camada de token própria, fecha em ~14 kB. A alternativa era declarar os tokens no
`styles.scss` global, o que valeria para as 27 features e contraria a invariante acima.
O orçamento continua guardando contra CSS realmente descontrolado.

## 3. O defeito que existe hoje

A página tem **duas paletas**. `landing.component.scss` é roxo sobre navy (`#7663ed`,
`#14132e`). `solutions.component.scss`, que renderiza no meio da mesma página, é
verde-petróleo (`#203a40`, `#257262`, `#185d4e`, `#216454`), com anel de foco âmbar
(`#bc8622`) que não aparece em nenhum outro lugar do produto.

Não é escolha, é sobra de dois momentos diferentes. A unificação é metade do trabalho.

Contagem do que some: 38 cores literais no `landing.component.scss`, 21 no
`solutions.component.scss`. Todas viram token.

## 4. Direção

> Primeira visita de dono de pequeno negócio que não sabe qual módulo resolve o problema
> dele, com respiro e um gesto de movimento, para convencer e capturar o relato.

Decorre da frase: respiro largo entre seções e apertado dentro do controle, entrada
escalonada **uma vez** e só no hero, brilho de acento em **um** CTA, hierarquia de três tons
de texto, três valores de espaçamento.

## 5. Seções

| # | Seção | Conteúdo | Origem |
|---|---|---|---|
| 1 | Topbar | Serviços, Planos, Diagnóstico, Como funciona + Entrar/Acessar painel | estático + `auth.isAuthenticated()` |
| 2 | Hero | título, apoio, 2 CTAs, painel da operação | estático |
| 3 | Serviços | cartões com estado da entrega | `GET /public/solutions` → `services[]` |
| 4 | Combinações por segmento | pacotes por perfil de negócio | idem → `plans[]` |
| 5 | Planos contratáveis | composição + limite de usuários ativos | idem → `commercialPlans[]` |
| 6 | Como funciona | 3 passos numerados | estático |
| 7 | Diagnóstico | relato → recomendação → contato | `POST /public/solutions/recommend` e `/contact` |
| 8 | Rodapé | marca, frase, administração da plataforma | estático |

**Fora do escopo, por falta de dado verdadeiro:** fila de logos de clientes, números de
impacto e depoimentos. Número inventado tem tamanho inventado e o quebra-linha só aparece em
produção. Entram quando houver dado real (pendência D2).

### Estado do serviço, por tom

Hoje os quatro estados saem na mesma pílula cinza-esverdeada, o que desperdiça a informação.
Passam a usar os pares do DS, **sempre com a palavra junto** — cor nunca sozinha:

| Estado | Token | Texto |
|---|---|---|
| `AVAILABLE` | `success` | Disponível |
| `PARTIAL` | `info` | Disponível com escopo definido |
| `PLANNED` | `warning` | Em preparação |
| `EXTERNAL` | neutro | Requer integração externa |

## 6. Os quatro finais

`GET /public/solutions` sustenta três seções. Hoje só o caminho feliz existe: em erro a
mensagem aparece e as três seções somem inteiras, sem explicação e sem saída.

| Final | Hoje | Alvo |
|---|---|---|
| dados | ok | ok |
| carregando | nada | marca de lugar com a contagem real de cartões |
| erro | frase solta, seções somem | bloco com tom `danger`, ícone, causa provável e duas saídas |
| vazio | não tratado | mesmo bloco em tom neutro, com o caminho do diagnóstico |

Erro e vazio ocupam a mesma fatia da página, então usam **a mesma forma** (`.state`), só
mudando tom, ícone e texto. Duas formas diferentes para o mesmo lugar era o defeito da
primeira versão. O aviso de erro oferece tentar de novo **e** ir para o diagnóstico: o
formulário não depende do catálogo e continua funcionando com a API fora do ar.

O diagnóstico tem estados próprios: ocioso, analisando, recomendação exibida, enviando,
registrado, e os erros nomeados do servidor — 429 (limite por IP: 10 em `recommend`, 5 em
`contact`) e 409 (mesmo `requestId` com dados diferentes).

## 7. O que não pode se perder

O Angular atual acerta coisas que a reescrita precisa carregar inteiras:

- campo-armadilha `website` com `tabindex="-1"` e `autocomplete="off"`;
- `requestId` por `crypto.randomUUID()`, renovado a cada mudança de relato — é o que torna o
  `POST /contact` idempotente no servidor;
- consentimento explícito e aviso de privacidade acima do botão;
- aviso de não incluir senha, dado bancário ou dado pessoal de cliente no relato;
- relato de 30 a 4.000 caracteres; telefone só com dígitos;
- `prefers-reduced-motion` já respeitado globalmente pelo `styles.scss` — a entrada nova não
  pode escapar dessa regra.

## 8. Aceite

- [x] Uma paleta só na página inteira; nenhuma cor literal fora da declaração de token.
- [x] Os quatro finais nas três seções de catálogo.
- [x] Estado do serviço com tom **e** palavra.
- [x] Três valores de espaçamento, três tons de texto, uma ação primária por dobra.
- [x] `min-w-0` em todo item de grid ou flex com conteúdo largo.
- [x] Teclado do início ao fim, foco visível em toda parada, um `h1` e sem salto de nível.
- [x] Menu de celular alcançável — hoje os links somem abaixo de 760px sem substituto.
- [x] `styles.scss` intocado (confirmado por `git status`), e todo seletor novo vive no
      `:host` dos dois componentes da landing.
- [ ] Regressão visual em `/vendas`, `/financeiro` e `/dashboard` **não verificada**: as três
      exigem sessão autenticada. O risco é baixo por construção — nenhuma folha global mudou —,
      mas a conferência continua devida.
- [x] `ng build` limpo.
- [ ] **Formulário NÃO validado ponta a ponta.** O envio grava um `PlatformLead`, e nenhuma
      API foi iniciada nesta entrega. A verificação usou um servidor estático com o catálogo
      real lido de `portfolio.catalog.ts` e a resposta simulada — nenhuma conexão com
      MongoDB. Os caminhos de rede exercitados foram carregamento, erro (503) e vazio.
      `POST /recommend` e `POST /contact` seguem sem execução real. Ver seção 9.

## 9. Banco

`AGENTS.md` vale integralmente, e tem um ponto fácil de passar batido: **a landing grava.**
`POST /public/solutions/contact` cria um `PlatformLead`. Validar o diagnóstico ponta a ponta
é escrita, não leitura.

- Validação aponta exclusivamente para `mongodb://127.0.0.1:27017/salgados_financeiro_test`.
- Conferir a URI **antes** de subir a API, nunca depois.
- `requestId` exclusivo por execução — a UI já garante por `crypto.randomUUID()`.
- Não apagar lead, coleção ou banco; não reinicializar; preservar registros anteriores.
- Nada aponta para `salgados_mvp` sem explicação e confirmação explícita.
- `GET /public/solutions` e `POST /recommend` são somente leitura e podem ser exercitados.

## 10. Pendências

| # | Pendência | Bloqueia |
|---|---|---|
| D1 | O violeta `#7560d5` é a marca definitiva? | o valor do token de acento, não a estrutura |
| D2 | Existem números de impacto e depoimentos reais? | as duas seções de prova social |
| D6 | Os valores do painel do hero são de exemplo. Confirmar antes de publicar, ou trocar por captura real. | publicação |
| D7 | O orçamento de CSS por componente subiu para 13/18 kB (seção 2). Confirmar. | nada |

Nenhuma bloqueia a entrega. D1 e D2 são troca de valor e adição de seção.
