# AcademAI — Contribuições da Mafê para o TCC

**Responsável:** Maria Fernanda de Almeida Maneira — ingestão, dados e infraestrutura

**Base:** TCC_DOC_Rev11.docx e divisão de tarefas do grupo

**Como usar:** cada tópico indica a página e a marcação `[INSERIR DADOS AQUI]` do TCC que ele
resolve, traz o **texto pronto para colar** e, depois, as notas de apoio (não colar).
Campos marcados **`[MEDIR NA SESSÃO]`** dependem da sessão de testes no PC de referência
(ver tópico 7).

| # | Tópico | TCC | Situação |
|---|---|---|---|
| 1 | Hardware: ambiente de medição × mínimo funcional | p.65, p.66 (SS43) | Texto pronto |
| 2 | Volume de dados dos testes | p.65 (SS45, SS43) | Texto pronto, números de tempo/memória na sessão |
| 3 | Limites do Docling | p.17 (SS20) | Texto pronto (código implementado) |
| 4 | Justificativa do chunk de 2.000 caracteres | p.17 (SS21) | Texto pronto, métricas de recuperação na sessão |
| 5 | Backup | p.30 (SS75) | Texto pronto (script implementado) — validar com o Fabrício |
| 6 | Demanda mínima de referência | p.62 (SS39) | Estimativa pronta, recalcular com os números da sessão |
| 7 | Roteiro da sessão de testes (com o Arthur) | p.65, p.67 | Checklist |

---

## 1. Hardware — ambiente de medição × hardware mínimo (p.65 e p.66)

**Resolve:** Seção 6.3, `[INSERIR DADOS AQUI: há divergência entre este hardware e o ambiente em que os
testes de desempenho foram executados segundo o artigo COBRIC 2026 ...]` e, na Tabela 1,
`[INSERIR DADOS AQUI: confirmar o ambiente de hardware em que as medições foram realizadas]`.

**Decisão:** os números de desempenho foram medidos no PC de uma integrante (o do artigo COBRIC). Esse
PC é o **ambiente de medição**, não um requisito. O **hardware mínimo funcional** é de **8 GB de RAM**,
com base no teste em Apple M1 de 8 GB. Os trechos abaixo substituem o "Ryzen 5 2400G, 16 GB" em todo
o documento.

### 1.1 Seção 6.3 — primeiro parágrafo (substitui o parágrafo inteiro)

> As medições de desempenho foram realizadas na estação de trabalho de uma das integrantes da equipe,
> com processador AMD Ryzen 5 4600G (6 núcleos, gráficos integrados, sem GPU dedicada), 32 GB de memória
> RAM e sistema operacional Windows 11, executando Node.js v24.19.0 e o modelo Llama 3.2 3B por meio do
> Ollama. Essa configuração é a mesma relatada no artigo apresentado pela equipe no COBRIC 2026 e
> corresponde a um computador pessoal de uso comum, e não a um servidor dedicado. O sistema também foi
> executado em arquitetura ARM, em um Apple Silicon M1 com 8 GB de memória unificada, configuração
> adotada como hardware mínimo funcional (Seção 3.4.1); nesse equipamento não foram feitas medições de
> desempenho, e os tempos de resposta tendem a ser maiores que os da Tabela 1.

### 1.2 Tabela 1 — linha "Fonte" (substitui a linha e o `[INSERIR DADOS AQUI]` que a acompanha)

> Fonte: os autores (2026), a partir das medições publicadas no artigo COBRIC 2026 da equipe, realizadas
> no ambiente descrito na Seção 6.3 (AMD Ryzen 5 4600G, 32 GB de RAM, Windows 11, Node.js v24.19.0).

### 1.3 Seção 3.3.1 — RNF01 (substitui a frase "Condição de teste: ...")

> Condição de teste: ambiente de medição descrito na Seção 6.3 (AMD Ryzen 5 4600G, 32 GB de RAM, sem GPU
> dedicada, Windows 11, Node.js v24.19.0), sem carga concorrente.

### 1.4 Seção 3.3.1 — RNF02 (substitui "no hardware de referência do estudo de caso (...)")

> no ambiente de medição descrito na Seção 6.3 (AMD Ryzen 5 4600G, 32 GB de RAM, sem GPU dedicada, modelo
> Llama 3.2 3B via Ollama). Em equipamentos com menos recursos, como o hardware mínimo funcional da Seção
> 3.4.1, o tempo de resposta tende a ser maior; com GPU dedicada de 6 GB de VRAM, tende a ser menor.

### 1.5 Seção 3.4.1 — item de hardware (substitui o item inteiro)

> • Hardware mínimo funcional: processador de 64 bits (x86-64 ou ARM), 8 GB de RAM, sem GPU dedicada e
> 50 GB de armazenamento livre, configuração em que o protótipo foi executado (Apple Silicon M1, 8 GB). O
> tempo de resposta do assistente depende do hardware: os valores da Seção 6.4 foram medidos em uma
> estação com AMD Ryzen 5 4600G e 32 GB de RAM (Seção 6.3). Hardware recomendado para melhor desempenho:
> GPU dedicada com 6 GB de VRAM.

### 1.6 Quadro 20 (Stack) — linha Backend

> Node.js 22 LTS ou 24 (medições em v24.19.0), Express

### 1.7 Seção 3.4.2 — premissa do servidor

Sem alteração: já remete ao hardware mínimo da Seção 3.4.1.

**Notas (não colar):**
- `INICIA_PROJETO.md` foi atualizado com Node 22/24 e o mínimo de 8 GB.
- Conferir no texto se o estudo de caso com os 6 usuários também foi feito no 4600G. Se foi em outra
  máquina, a Seção 6.3 precisa dizer isso em uma frase.

---

## 2. Volume de dados dos testes (p.65)

**Resolve:** Seção 6.3, segundo parágrafo, `[INSERIR DADOS AQUI: a versão anterior mencionava
"aproximadamente 3 GB de conteúdo" ...]`.

### Texto (substitui a última frase do 2º parágrafo da Seção 6.3 e a marcação)

> O repositório de conhecimento foi alimentado com quatro documentos institucionais em formato Markdown,
> elaborados pela equipe a partir das informações do laboratório — apresentação do espaço e dos perfis de
> acesso, regras de uso, lista de equipamentos e passo a passo de agendamento —, que somam 7,7 KB e
> 7.593 caracteres após a limpeza de linhas em branco. A segmentação em fragmentos de até 2.000
> caracteres resultou em cinco fragmentos indexados, cada um representado por um vetor de 384 dimensões,
> o que ocupa cerca de 7,5 KB em memória (ponto flutuante de 32 bits) e `[MEDIR NA SESSÃO]` KB no arquivo
> de índice `vector_cache.json`. Por estarem em Markdown, esses documentos não passaram pela conversão do
> Docling, que se aplica apenas a PDF e DOCX. Para estimar o custo dessa etapa, foram convertidos à parte
> `[MEDIR NA SESSÃO: n]` documentos em PDF/DOCX, totalizando `[MEDIR NA SESSÃO]` páginas, com tempo de
> conversão de `[MEDIR NA SESSÃO]` s e pico de memória do processo de conversão de `[MEDIR NA SESSÃO]` MB.
> A indexação dos cinco fragmentos levou `[MEDIR NA SESSÃO]` ms, após o carregamento do modelo de
> embeddings, e o processo do backend atingiu `[MEDIR NA SESSÃO]` MB de memória durante o carregamento.

**Dados já levantados (independem do hardware):**

| Documento | Tamanho | Caracteres (após limpeza) | Fragmentos de 2.000 |
|---|---|---|---|
| 01-sobre-o-laboratorio.md | 2,0 KB | 1.937 | 1 |
| 02-regras-de-uso.md | 1,6 KB | 1.586 | 1 |
| 03-equipamentos.md | 1,5 KB | 1.511 | 1 |
| 04-como-agendar.md | 2,6 KB | 2.559 | 2 |
| **Total** | **7,7 KB** | **7.593** | **5** |

Vetores: 5 × 384 dimensões × 4 bytes = 7.680 bytes (≈ 7,5 KB).

**Notas (não colar):**
- O "3 GB" estava errado: o acervo inteiro tem 7,7 KB. Os 5 fragmentos batem com o artigo COBRIC.
- O texto atual da 6.3 descreve os documentos como "manuais de equipamentos, normas de uso e materiais de
  apoio". Os arquivos reais (`backend/documents/`) são os quatro acima; ajustar a frase se o grupo
  concordar.
- Os campos `[MEDIR NA SESSÃO]` saem de `npm run medir` (tópico 7).

---

## 3. Limites do Docling (p.17)

**Resolve:** Seção 2.2, `[INSERIR DADOS AQUI: informar (i) se PDFs digitalizados são tratados com OCR;
(ii) ...; (vi) se há registro (logs) da ingestão]`.

### Texto (substitui a marcação, logo após "Os demais limites do processamento são descritos a seguir.")

> (i) Documentos digitalizados: o reconhecimento óptico de caracteres (OCR) do Docling permanece ativo,
> com os idiomas português e inglês quando o motor EasyOCR está instalado; páginas que já contêm texto
> digital têm esse texto aproveitado diretamente. (ii) Tabelas: são reconhecidas pelo modelo de estrutura
> de tabelas do Docling e exportadas como tabelas Markdown, preservando linhas e colunas; contudo, a
> segmentação posterior por número de caracteres pode dividir uma tabela longa entre fragmentos. (iii)
> Imagens: não são descritas nem armazenadas; cada figura é substituída por um marcador no texto, de modo
> que o conteúdo exclusivamente visual, como diagramas e fotografias técnicas, não é recuperável pelo
> assistente. (iv) Metadados: são registrados apenas os metadados de origem — nome do arquivo, tipo,
> identificador (hash) e número de páginas —, além da data de envio e do administrador responsável;
> título, autor e data internos ao arquivo não são extraídos. (v) Falhas: documentos cuja conversão
> falha (inclusive por excederem 500 páginas), termina de forma parcial (por exemplo, ao exceder o tempo
> limite de 300 s) ou não produz texto aproveitável são recusados e não são indexados (RN14); o arquivo enviado e
> qualquer resultado intermediário são descartados, e o administrador recebe o motivo da recusa. (vi)
> Registro: cada envio, aceito ou recusado, é registrado na trilha de auditoria do sistema (eventos
> INGESTAO_OK e INGESTAO_FALHA), com formato, páginas, tabelas, imagens, número de fragmentos, tempo de
> conversão e, em caso de recusa, o motivo, consultável pelo administrador no painel de logs (RF30). Além
> de PDF e DOCX, o sistema aceita arquivos MD e TXT, que já estão em texto e seguem diretamente para a
> indexação.

**Onde está no código:**
- `backend/converter.py`: OCR, tabelas, imagens, limites (50 MB, 500 páginas, 300 s), recusa de conversão
  falha/parcial/vazia, metadados de origem, pico de memória.
- `backend/server.js`, rota `POST /api/train`: formatos aceitos, recusa sem indexar, limpeza de
  `uploads/` e `documents/`, logs `INGESTAO_OK`/`INGESTAO_FALHA`.
- Testado: formato .exe (recusado, 400), arquivo vazio (422), PDF sem Docling instalado (422),
  arquivo > 50 MB (413), MD válido (indexado e registrado). Em todos os casos de recusa nada sobra em
  `uploads/` nem em `documents/`.

**Notas (não colar):**
- O texto do TCC (Seção 1.6.1) fala só em PDF e DOCX; o sistema também aceita MD e TXT (a base inicial é
  MD). A última frase do texto acima resolve isso; se preferirem, ajustar a 1.6.1.
- Instalação recomendada: `pip install "docling[easyocr]"`. Sem o EasyOCR o Docling escolhe outro motor
  de OCR (na versão atual, RapidOCR), com pior suporte a português.

---

## 4. Justificativa do chunk de 2.000 caracteres (p.17)

**Resolve:** Seção 2.2, `[INSERIR DADOS AQUI: apresentar os dados das simulações que sustentam a escolha
de 2.000 caracteres ...]`.

### Texto (substitui a marcação)

> Para verificar essa escolha, foi realizada uma simulação com o próprio acervo do estudo de caso,
> comparando fragmentos de 500, 1.000, 1.500, 2.000 e 3.000 caracteres. Para cada tamanho, o acervo foi
> segmentado da mesma forma que no sistema, e vinte perguntas típicas de usuários, cada uma associada ao
> trecho do documento que a responde, foram submetidas à recuperação por similaridade de cosseno com os
> quatro fragmentos mais próximos. Avaliaram-se a proporção de respostas divididas entre dois fragmentos
> pelo corte fixo, a taxa de acerto (presença do trecho correto entre os quatro fragmentos recuperados) e
> o volume de texto enviado ao modelo de linguagem. Os resultados são apresentados na Tabela X.
>
> **Tabela X – Simulação do tamanho de fragmento**
>
> | Tamanho (caracteres) | Fragmentos | Respostas cortadas | Acerto no 1º | Acerto entre os 4 | Contexto enviado ao LLM (caracteres) |
> |---|---|---|---|---|---|
> | 500 | 18 | 5% | `[MEDIR]` | `[MEDIR]` | `[MEDIR]` |
> | 1.000 | 9 | 0% | `[MEDIR]` | `[MEDIR]` | `[MEDIR]` |
> | 1.500 | 8 | 0% | `[MEDIR]` | `[MEDIR]` | `[MEDIR]` |
> | 2.000 | 5 | 0% | `[MEDIR]` | `[MEDIR]` | `[MEDIR]` |
> | 3.000 | 4 | 0% | `[MEDIR]` | `[MEDIR]` | `[MEDIR]` |
>
> Fonte: os autores (2026).
>
> Fragmentos a partir de 1.000 caracteres preservaram integralmente todos os trechos de resposta, ao
> passo que, abaixo desse tamanho, parte das respostas foi dividida entre fragmentos — 5% em 500 e 20% em
> 250 caracteres. `[COMPLETAR COM A LEITURA DO ACERTO: ex.: "O tamanho de 2.000 caracteres obteve acerto
> de X% entre os quatro fragmentos, ..."]` O resultado é coerente com a avaliação comparativa de Wang et
> al. (2024), em que fragmentos de 512 tokens obtiveram os melhores índices de fidelidade (97,59%) e de
> relevância (97,41%) entre tamanhos de 128 a 2.048 tokens, enquanto o maior tamanho testado reduziu a
> fidelidade para 80,37%; em português, 2.000 caracteres correspondem a aproximadamente
> `[MEDIR NA SESSÃO]` tokens. Ressalta-se, contudo, que o modelo all-MiniLM-L6-v2 trunca, por padrão,
> entradas com mais de 256 *word pieces* (HUGGING FACE, [2026]); na simulação, `[MEDIR NA SESSÃO]`% dos
> fragmentos de 2.000 caracteres excederam esse limite, de modo que o final desses fragmentos contribui
> pouco ou nada para sua representação vetorial. Como o acervo do estudo de caso é pequeno (7.593
> caracteres), esses resultados indicam a adequação do tamanho adotado nas condições avaliadas, mas não
> se generalizam para acervos maiores.

**Referência a incluir:**

> WANG, X. et al. Searching for Best Practices in Retrieval-Augmented Generation. In: CONFERENCE ON
> EMPIRICAL METHODS IN NATURAL LANGUAGE PROCESSING, 2024, Miami. **Proceedings [...]**. Miami:
> Association for Computational Linguistics, 2024. Disponível em:
> https://aclanthology.org/2024.emnlp-main.981/. Acesso em: 20 out. 2026.

(A citação `HUGGING FACE, [2026]` já existe no TCC; confirmar que aponta para o cartão do modelo
`sentence-transformers/all-MiniLM-L6-v2`.)

**Dados já levantados (independem do hardware)** — `npm run simular-chunk -- --sem-modelo`:

| Tamanho | 250 | 500 | 750 | 1.000 | 1.500 | 2.000 | 3.000 |
|---|---|---|---|---|---|---|---|
| Fragmentos | 33 | 18 | 13 | 9 | 8 | 5 | 4 |
| Respostas cortadas (de 20) | 20% | 5% | 5% | 0% | 0% | 0% | 0% |

**Notas (não colar):**
- As colunas de acerto e os tokens precisam do modelo de embeddings, que não pôde ser baixado no ambiente
  em que este documento foi preparado. Rodar `npm run simular-chunk` no PC (tópico 7) e copiar a tabela
  de `docs/medicoes/chunk-<data>.md`.
- **Atenção:** se a simulação mostrar outro tamanho claramente melhor que 2.000, o texto muda de
  "justificar" para "limitação + trabalho futuro". O valor é uma constante só (`CHUNK_SIZE` em
  `backend/rag.js`), mas mudar exigiria refazer as medições do TCC.
- O limite de 256 *word pieces* é real e merece ficar no texto: hoje o fragmento de 2.000 caracteres é
  maior que o que o modelo de embeddings considera por padrão.

---

## 5. Backup (p.30)

**Resolve:** Seção 3.3.6, RNF24, `[INSERIR DADOS AQUI: periodicidade do backup e local de armazenamento
das cópias]`.

### Texto (substitui a marcação no fim do RNF24)

> O backup é diário e inclui o banco de dados, o índice vetorial (`vector_cache.json`) e o acervo de
> documentos convertidos. A cópia do banco é feita pelo comando `VACUUM INTO` do SQLite, que gera uma
> cópia consistente com o serviço em execução, e é verificada por `PRAGMA integrity_check`; cada cópia
> registra o resumo criptográfico (SHA-256) de seus arquivos. São mantidas as sete cópias diárias mais
> recentes e quatro cópias semanais em diretório local do servidor, fora da pasta da aplicação, e a
> cópia semanal é replicada para uma mídia ou servidor de armazenamento distinto da máquina que hospeda o
> sistema, definido pela instituição. O procedimento é executado pelo comando `npm run backup`, agendado
> no sistema operacional, e a restauração consiste em substituir os arquivos com o serviço parado.

**Onde está no código:** `backend/scripts/backup.js` (`npm run backup`). Agendamento no Windows/Linux e
restauração em `INICIA_PROJETO.md`, seção "Backup".
Testado: 3 execuções seguidas com limite de 2 diárias — rotação apagou a mais antiga, cópia semanal e
externa criadas uma vez por semana, banco copiado com `integrity_check = ok` e os 6 usuários presentes.

**Para o Fabrício validar (LGPD, p.31):**
- Com 7 diárias + 4 semanais, um dado apagado no sistema continua existindo nas cópias por até **cerca de
  5 semanas**. O prazo de retenção do RNF27 precisa considerar isso (ou o texto da LGPD precisa dizer que
  os backups são sobrescritos nesse prazo).
- As cópias contêm dados pessoais (usuários, reservas, logs): o local externo precisa de acesso restrito.
- O backup não é criptografado; se o grupo quiser, isso vira uma frase de limitação ou trabalho futuro.

---

## 6. Demanda mínima de referência (p.62)

**Resolve:** Seção 5.6, `[INSERIR DADOS AQUI: estimar a demanda mínima de referência para a implantação
(ex.: 10, 100, 1.000 ou 10.000 usuários cadastrados e o número de usuários simultâneos) e a configuração
de hardware correspondente]`.

### Texto (substitui a marcação)

> Como o protótipo não foi submetido a carga concorrente, a demanda suportada foi estimada a partir do
> tempo de resposta medido. O Ollama processa as gerações de forma sequencial na configuração padrão,
> de modo que perguntas simultâneas formam uma fila e o tempo de espera cresce com a ocupação do modelo.
> Adotando-se o tempo mediano de resposta completa de 1,65 s (Tabela 1) como tempo de atendimento, e
> supondo que cada usuário em conversa envie, em média, uma pergunta por minuto, a ocupação do modelo é
> ρ = U × 1,65 / 60, em que U é o número de usuários conversando ao mesmo tempo, e o tempo médio até a
> resposta é aproximadamente 1,65 / (1 − ρ) s, segundo o modelo de fila M/M/1. A Tabela Y apresenta a
> estimativa para diferentes portes de implantação, com proporções de usuários simultâneos decrescentes
> com o tamanho da base.
>
> **Tabela Y – Estimativa de demanda e hardware correspondente**
>
> | Usuários cadastrados | Simultâneos no chat (hipótese) | Ocupação do modelo (ρ) | Tempo médio de resposta estimado | Hardware correspondente |
> |---|---|---|---|---|
> | 10 | 2 (20%) | 0,06 | ≈ 1,8 s | Hardware mínimo funcional (8 GB de RAM, sem GPU) |
> | 100 | 10 (10%) | 0,28 | ≈ 2,3 s | Estação equivalente à de medição (6 núcleos, 16–32 GB de RAM, sem GPU) |
> | 1.000 | 50 (5%) | 1,38 sem GPU — saturado | indefinido sem GPU; ≈ 0,6 s com GPU* | Servidor com GPU dedicada (≥ 8 GB de VRAM), 32 GB de RAM e PostgreSQL |
> | 10.000 | 250 (2,5%) | 1,7 com uma GPU* — saturado | ≈ 0,9 s com 3 instâncias de inferência* | Vários servidores de inferência com GPU, balanceador de carga, PostgreSQL e índice vetorial dedicado |
>
> \* Supondo tempo de atendimento de 0,4 s com GPU dedicada, valor a ser confirmado experimentalmente.
>
> Fonte: os autores (2026).
>
> Assim, a configuração avaliada atende, com folga, a demanda de referência de um laboratório como o do
> estudo de caso — da ordem de 100 usuários cadastrados e até 10 conversando simultaneamente —, enquanto
> implantações a partir de mil usuários exigem GPU dedicada e, a partir de dez mil, distribuição da
> inferência entre várias máquinas e substituição do SQLite por um SGBD cliente-servidor, cenário que
> extrapola o escopo do protótipo. Trata-se de estimativa analítica, que deve ser confirmada por testes
> de carga.

**Como os números foram calculados (não colar):**
- λ = U / 60 perguntas por segundo; S = 1,65 s; ρ = λ·S; W = S / (1 − ρ) (M/M/1).
- 10 → ρ = 2×1,65/60 = 0,055 → W = 1,75 s. 100 → ρ = 0,275 → W = 2,28 s.
- 1.000 sem GPU → ρ = 1,375 (fila cresce sem limite). Com GPU (S = 0,4 s) → ρ = 0,33 → W = 0,6 s.
- 10.000 com uma GPU → ρ = 250×0,4/60 = 1,67. Com 3 instâncias → ρ = 0,56 por instância → W = 0,4/0,44 ≈ 0,9 s.
- **Depois da sessão:** trocar S = 1,65 s pelo valor medido por `npm run carga-chat` (linha com 1
  pergunta simultânea) e conferir a hipótese de fila com as linhas de 2, 4 e 8. Se o Ollama estiver com
  `OLLAMA_NUM_PARALLEL` > 1, a fila cresce mais devagar — anotar o valor usado.
- As proporções de simultâneos e "1 pergunta por minuto" são hipóteses declaradas; o texto já diz isso.

---

## 7. Roteiro da sessão de testes (Mafê + Arthur)

Fazer **uma sessão só** no PC de referência (Ryzen 5 4600G, 32 GB, Windows 11). Os resultados servem para
a p.65 (Mafê) e a p.67 (Arthur).

1. Atualizar o projeto (`git pull`) e, em `backend/`: `npm install`.
2. `pip install "docling[easyocr]"` (uma vez; a primeira conversão baixa modelos).
3. Separar 1 ou 2 PDFs/DOCX reais do laboratório (manual de equipamento, regulamento) numa pasta.
4. Fechar outros programas pesados. Anotar se o notebook/PC está na tomada.
5. `npm run medir` → acervo do estudo de caso (tópico 2).
6. `npm run medir -- --pasta <pasta com os PDFs>` → tempo do Docling e memória (tópico 2).
7. `npm run simular-chunk` → tabela do tópico 4.
8. Subir `node server.js` e o Ollama; `npm run carga-chat` → tópico 6 (e tempos de resposta para o Arthur).
9. Os relatórios ficam em `docs/medicoes/`. Fazer commit deles ou enviar os `.json` para preencher os
   campos `[MEDIR NA SESSÃO]` deste documento.

Cada relatório já traz CPU, RAM, sistema, versões do Node, do Docling e do Ollama — isso é a prova do
ambiente de medição pedida na p.66.
