> HISTORICO: o modulo de ponto foi removido por solicitacao do usuario em 18/09/2026. As referencias a ponto neste documento preservam apenas evidencias historicas, sem indicar disponibilidade ou trabalho pendente.

# Jornada e adequação REP-P — 18/09/2026

O pedido abrange controle operacional e conformidade REP-P. A entrega operacional não autoriza declarar o produto um REP-P conforme. Este documento registra lacunas concretas; não é atestado técnico nem parecer jurídico. Testes funcionais serão registrados separadamente pelo QA.

## Alterações operacionais desta etapa

- Substituir a referência técnica visível por duração diária calculada no servidor, descontando intervalos, distinguindo períodos fechados, em andamento e inconsistências. Preservar identificadores e registros originais.
- Permitir pesquisa da equipe por nome, CPF completo validado e período; CPF deve ser consultado por hash, limitado à empresa, sem expor documento, hash ou envelope criptográfico na resposta.
- Separar visualizar, gerenciar ajustes e exportar. Somente OWNER delega essas permissões. Registrar o próprio ponto continua disponível aos membros ativos com módulo contratado.
- Disponibilizar registros auxiliares próprios das últimas 48 horas. Acesso da equipe continua reservado ao owner e seus delegados. Geolocalização mantém a regra preexistente de consulta exclusiva da administração da plataforma.
- Exportação CSV é auxiliar: não constitui AFD, AEJ ou espelho legal. Ajustes ficam separados das marcações originais.
- Gestor autorizado pode propor ajuste para funcionário da mesma empresa, com autoria separada do beneficiário. O proprietário pode analisar esse ajuste; o beneficiário continua impedido de aprovar o próprio ajuste. Não se exige segundo gestor para uma solicitação do proprietário referente a outra pessoa.
- A seleção para ajuste pesquisa pessoas independentemente de marcações, inclusive funcionários ativos ou inativos para tratamento histórico. O endpoint exige visualizar e gerenciar e retorna somente identificador e nome.

## Matriz de conformidade e impedimentos

| Requisito | Situação e trabalho necessário |
| --- | --- |
| Registro do programa no INPI | Evidência não fornecida. Obter registro e identidade do desenvolvedor; não gerar número fictício. |
| Comprovante eletrônico do trabalhador | Disponibilidade própria é parte funcional. Faltam documento completo e assinatura PAdES ICP-Brasil do desenvolvedor; recibo auxiliar não cumpre essa exigência. |
| Atestado Técnico e Termo de Responsabilidade | Faltam documento do produto e assinaturas dos responsáveis legal e técnico. Não emitir declaração de conformidade enquanto requisitos não forem demonstrados. |
| AFD | Falta gerador oficial, assinatura CAdES destacada e validação independente. CSV operacional não é substituto. |
| NSR e integridade | UUID existente não é NSR. Implementar sequência transacional por estabelecimento e eventos de cadastro/relógio/disponibilidade; não atribuir retrospectivamente uma falsa origem REP-P aos registros antigos. |
| ARP | Verificar e demonstrar armazenamento redundante, disponibilidade, recuperação e preservação dos registros na infraestrutura de implantação. Banco local de QA não demonstra esses requisitos. |
| Relógio | A interface pode acompanhar o servidor. Faltam sincronismo e monitoramento efetivos da Hora Legal Brasileira, inclusive evidência de desvio. |
| Tratamento e AEJ | Faltam vínculos, horários contratuais, classificação das marcações, ausências/compensações quando aplicáveis, gerador AEJ, assinatura e validação. Total cronológico não é cálculo trabalhista completo. |
| Espelho legal | Faltam consolidação trabalhista e relatório com conteúdo regulamentar. Não chamar CSV de espelho legal. |
| Marcações fiéis | Preservar originais e idempotência. Sequências inconsistentes devem ser registradas e sinalizadas para tratamento, não bloqueadas por exigência de sequência. |

O acesso do trabalhador ao próprio comprovante independe de autorização; deve haver extração de pelo menos 48 horas. NSR é sequencial por estabelecimento. INPI, assinaturas e atestado precisam de evidências externas reais. Fonte: [FAQ oficial do MTE, especialmente itens 40–45](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP).

O AFD publicado no portal oficial usa versão 004, registros ordenados por NSR, ISO-8859-1 e CRLF. Registro 7 de REP-P inclui CPF, instante da marcação e gravação, coletor, indicador online/offline e hash SHA-256 encadeado. Cabeçalho identifica estabelecimento, desenvolvedor e INPI; rodapé totaliza registros. A linha final referencia assinatura destacada. Fonte: [leiaute oficial AFD](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-fonte-de-dados-afd.pdf).

O AEJ publicado usa versão 002, ISO-8859-1, CRLF e campos delimitados por barra vertical. Contempla REPs, vínculos, horários contratuais, marcações originais/incluídas/desconsideradas, motivos, ausências/banco de horas e identificação do PTRP, além de totalizadores e assinatura. Fonte: [leiaute oficial AEJ](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-eletronico-de-jornada-aej.pdf).

Consulta em 18/09/2026: [portal oficial REP](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/rep), cuja página indica atualização em 31/07/2026. Isso é data da página, não prova de alteração normativa nessa data. A leitura integral do PDF compilado da Portaria falhou no navegador de pesquisa; as regras de relógio/ARP devem ser conferidas no Anexo IX vigente durante a validação final. Os leiautes e o FAQ foram efetivamente abertos.

## Próxima entrega necessária para conformidade integral

1. Confirmar documentação INPI, identidade do desenvolvedor, responsáveis e integração segura de assinatura (nenhuma chave privada deve ser enviada pelo chat).
2. Implementar armazenamento legal de eventos e sequência por estabelecimento, com plano explícito para preservar o legado auxiliar.
3. Integrar relógio monitorado e infraestrutura redundante; testar recuperação, concorrência e integridade.
4. Implementar documentos, tratamento e arquivos oficiais; validar amostras e assinaturas com ferramenta independente e emitir atestados somente após comprovação.

Não foram autorizados registros externos, contratação de certificado ou declarações assinadas em nome de terceiros. Nada disso foi realizado. A implementação operacional não elimina as pendências de código e infraestrutura acima.

## Limite de escala observado

A apuração operacional lê o histórico completo das pessoas filtradas até o instante da consulta para preservar contexto anterior e fechamentos posteriores ao período. Isso evita totalizar apenas a página, mas consome memória proporcional ao histórico; a ordenação e exportação também ocorrem em memória. Não houve ensaio de carga de longa duração. Antes de alta escala, implementar leitura contextual por cursor/agregação e índices específicos, sem truncar registros silenciosamente, e validar os casos de virada de período novamente.
