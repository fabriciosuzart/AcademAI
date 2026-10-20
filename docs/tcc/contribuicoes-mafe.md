# AcademAI — Tasks da Mafê: o que foi feito e medido

**Responsável:** Maria Fernanda de Almeida Maneira — ingestão, dados e infraestrutura

**Base:** divisão de tarefas do grupo (26 tarefas, 7 da Mafê) e TCC_DOC_Rev11.docx

**Código:** branch `tasks-mafe-14102026`, PR #18 (fabriciosuzart/AcademAI)

## Como ler este documento

Cada task segue a mesma estrutura:

- **Pedido:** o texto da divisão de tarefas, sem alteração.
- **Status:** concluída, ou o que ainda falta.
- **O que foi feito:** decisões, código e testes.
- **O que foi medido:** números já levantados. Só entram aqui dados que não dependem da máquina (contagens, tamanhos, cálculos).
- **O que falta:** itens que dependem da sessão de testes no PC de referência (task 7 e roteiro no final).
- **Texto para o TCC:** trecho pronto para colar no lugar da marcação `[INSERIR DADOS AQUI]`. Onde aparecer `[MEDIR NA SESSÃO]`, o número sai da sessão de testes.

## Resumo

As tasks estão em ordem de urgência. A divisão de tarefas pede que o hardware (p.65 e p.66) seja fechado primeiro, porque as medições do Arthur dependem dele.

| Ordem | Task | Página | Status |
|---|---|---|---|
| 1 | Resolver a divergência de hardware | p.65 | Concluída |
| 2 | Confirmar o ambiente de hardware das medições | p.66 | Concluída |
| 3 | Corrigir o volume de dados dos testes | p.65 | Parcial: tempos e memória dependem da sessão |
| 4 | Definir os limites do Docling | p.17 | Concluída (falta só testar com um PDF real) |
| 5 | Justificar o chunk de 2.000 caracteres | p.17 | Parcial: taxa de acerto e tokens dependem da sessão |
| 6 | Informar a periodicidade e o local do backup | p.30 | Concluída (falta a validação do Fabrício) |
| 7 | Estimar a demanda mínima de referência | p.62 | Estimativa pronta; recalcular com o tempo medido |

---

## Task 1 — Divergência de hardware (p.65)

**Pedido:** "p.65: Resolver a divergência de hardware entre o texto e o artigo COBRIC 2026 (Ryzen 5 4600G, 32 GB, Windows 11, Node 24.19.0) e uniformizar o capítulo, RNF01, RNF02 e a Seção 3.4.1. (SS43)"

**Status:** concluída.

### O que foi feito

- **Divergência encontrada:** o TCC cita "Ryzen 5 2400G, 16 GB" em quatro lugares (RNF01, RNF02, Seção 3.4.1 e Seção 6.3). O artigo COBRIC cita Ryzen 5 4600G, 32 GB, Windows 11 e Node 24.19.0. O Quadro 20 cita Node 20 LTS, e o guia de instalação do projeto pedia Node 22.
- **Decisão da Mafê:** o PC do artigo COBRIC é o dela. Ele passa a ser o **ambiente de medição**, onde os números foram obtidos, e não um requisito.
- **Hardware mínimo funcional:** **8 GB de RAM**, conforme o teste feito no Apple M1 de 8 GB. Fica registrado que o sistema roda em outras máquinas e que o tempo de resposta depende do hardware.
- **Textos novos:** escritos para todos os pontos do TCC (abaixo).
- **Repositório:** o `INICIA_PROJETO.md` foi atualizado com Node 22 ou 24 e o mínimo de 8 GB.

### O que foi medido

Nada: esta task é de uniformização do texto.

### O que falta

Confirmar se o estudo de caso com os 6 usuários também rodou no 4600G. Se rodou em outra máquina, acrescentar uma frase na Seção 6.3 dizendo isso.

### Texto para o TCC

**Seção 6.3 — primeiro parágrafo (substitui o parágrafo inteiro):**

> As medições de desempenho foram realizadas na estação de trabalho de uma das integrantes da equipe, com processador AMD Ryzen 5 4600G (6 núcleos, gráficos integrados, sem GPU dedicada), 32 GB de memória RAM e sistema operacional Windows 11, executando Node.js v24.19.0 e o modelo Llama 3.2 3B por meio do Ollama. Essa configuração é a mesma relatada no artigo apresentado pela equipe no COBRIC 2026 e corresponde a um computador pessoal de uso comum, e não a um servidor dedicado. O sistema também foi executado em arquitetura ARM, em um Apple Silicon M1 com 8 GB de memória unificada, configuração adotada como hardware mínimo funcional (Seção 3.4.1); nesse equipamento não foram feitas medições de desempenho, e os tempos de resposta tendem a ser maiores que os da Tabela 1.

**Seção 3.3.1 — RNF01 (substitui a frase "Condição de teste: ..."):**

> Condição de teste: ambiente de medição descrito na Seção 6.3 (AMD Ryzen 5 4600G, 32 GB de RAM, sem GPU dedicada, Windows 11, Node.js v24.19.0), sem carga concorrente.

**Seção 3.3.1 — RNF02 (substitui "no hardware de referência do estudo de caso (...)"):**

> no ambiente de medição descrito na Seção 6.3 (AMD Ryzen 5 4600G, 32 GB de RAM, sem GPU dedicada, modelo Llama 3.2 3B via Ollama). Em equipamentos com menos recursos, como o hardware mínimo funcional da Seção 3.4.1, o tempo de resposta tende a ser maior; com GPU dedicada de 6 GB de VRAM, tende a ser menor.

**Seção 3.4.1 — item de hardware (substitui o item inteiro):**

> • Hardware mínimo funcional: processador de 64 bits (x86-64 ou ARM), 8 GB de RAM, sem GPU dedicada e 50 GB de armazenamento livre, configuração em que o protótipo foi executado (Apple Silicon M1, 8 GB). O tempo de resposta do assistente depende do hardware: os valores da Seção 6.4 foram medidos em uma estação com AMD Ryzen 5 4600G e 32 GB de RAM (Seção 6.3). Hardware recomendado para melhor desempenho: GPU dedicada com 6 GB de VRAM.

**Quadro 20 — linha Backend:**

> Node.js 22 LTS ou 24 (medições em v24.19.0), Express

**Seção 3.4.2:** sem alteração, porque a premissa já remete ao hardware mínimo da Seção 3.4.1.

---

## Task 2 — Confirmar o ambiente de hardware das medições (p.66)

**Pedido:** "p.66: Confirmar o ambiente de hardware das medições (fazer junto com o item da p.65). (SS43)"

**Status:** concluída.

### O que foi feito

- **Confirmação:** a Mafê confirmou que as medições da Tabela 1, publicadas no artigo COBRIC, foram feitas no PC dela (Ryzen 5 4600G, 32 GB, Windows 11, Node 24.19.0).
- **Prova automática:** os scripts de medição criados nas tasks 3, 5 e 7 gravam no relatório a CPU, a RAM, o sistema operacional e as versões do Node, do Docling e do Ollama. Assim, as próximas medições já trazem o ambiente registrado, sem depender de anotação manual.

### O que foi medido

Nada: o ambiente foi confirmado pela dona da máquina.

### O que falta

Nada para o texto. Na sessão de testes, guardar os relatórios: eles servem de comprovação.

### Texto para o TCC

**Tabela 1 — linha "Fonte" (substitui a linha e a marcação que a acompanha):**

> Fonte: os autores (2026), a partir das medições publicadas no artigo COBRIC 2026 da equipe, realizadas no ambiente descrito na Seção 6.3 (AMD Ryzen 5 4600G, 32 GB de RAM, Windows 11, Node.js v24.19.0).

---

## Task 3 — Volume de dados dos testes (p.65)

**Pedido:** "p.65: Corrigir o volume de dados dos testes (o texto dizia "3 GB"): informar formatos, páginas, tamanho dos embeddings, tempo do Docling, tempo de indexação e memória. (SS45, SS43)"

**Status:** parcial. Formatos, tamanhos, fragmentos e tamanho dos embeddings estão levantados. Tempo do Docling, tempo de indexação e memória dependem da sessão de testes.

### O que foi feito

- **"3 GB" corrigido:** o valor estava errado. O acervo do estudo de caso são os 4 arquivos de `backend/documents/`, que somam 7,7 KB. Os 5 fragmentos batem com o artigo COBRIC.
- **Formatos:** os 4 documentos são Markdown. Por isso não passaram pelo Docling, que só converte PDF e DOCX.
- **Script `npm run medir`:** mede, por arquivo, o formato, as páginas, o tamanho, o tempo do Docling e o número de fragmentos. No total, mede o tempo de indexação, o tamanho dos vetores e do `vector_cache.json`, a memória do backend e o pico de memória do Docling.
- **Isolamento:** o script não altera o acervo nem o índice do sistema.
- **Teste:** ele foi rodado de ponta a ponta com um modelo de embeddings simulado, porque o ambiente em que o código foi preparado não acessa o site que hospeda o modelo real.

### O que foi medido

Dados que não dependem do hardware:

| Documento | Formato | Tamanho | Caracteres (após limpeza) | Fragmentos de 2.000 |
|---|---|---|---|---|
| 01-sobre-o-laboratorio.md | MD | 2,0 KB | 1.937 | 1 |
| 02-regras-de-uso.md | MD | 1,6 KB | 1.586 | 1 |
| 03-equipamentos.md | MD | 1,5 KB | 1.511 | 1 |
| 04-como-agendar.md | MD | 2,6 KB | 2.559 | 2 |
| **Total** | 4 × MD | **7,7 KB** | **7.593** | **5** |

| Item | Valor |
|---|---|
| Páginas | Não se aplica (Markdown não tem páginas) |
| Dimensões do embedding | 384 por fragmento |
| Tamanho dos embeddings em memória | 5 × 384 × 4 bytes = 7.680 bytes (≈ 7,5 KB) |

### O que falta (sessão de testes)

| Item pedido | Comando |
|---|---|
| Tamanho do `vector_cache.json` | `npm run medir` |
| Tempo de indexação | `npm run medir` |
| Memória do backend no carregamento | `npm run medir` |
| Tempo do Docling e páginas (com 1 ou 2 PDFs/DOCX reais do laboratório) | `npm run medir -- --pasta <pasta>` |
| Pico de memória do Docling | `npm run medir -- --pasta <pasta>` |

### Texto para o TCC

**Seção 6.3 — substitui a última frase do 2º parágrafo e a marcação:**

> O repositório de conhecimento foi alimentado com quatro documentos institucionais em formato Markdown, elaborados pela equipe a partir das informações do laboratório — apresentação do espaço e dos perfis de acesso, regras de uso, lista de equipamentos e passo a passo de agendamento —, que somam 7,7 KB e 7.593 caracteres após a limpeza de linhas em branco. A segmentação em fragmentos de até 2.000 caracteres resultou em cinco fragmentos indexados, cada um representado por um vetor de 384 dimensões, o que ocupa cerca de 7,5 KB em memória (ponto flutuante de 32 bits) e `[MEDIR NA SESSÃO]` KB no arquivo de índice `vector_cache.json`. Por estarem em Markdown, esses documentos não passaram pela conversão do Docling, que se aplica apenas a PDF e DOCX. Para estimar o custo dessa etapa, foram convertidos à parte `[MEDIR NA SESSÃO: n]` documentos em PDF/DOCX, totalizando `[MEDIR NA SESSÃO]` páginas, com tempo de conversão de `[MEDIR NA SESSÃO]` s e pico de memória do processo de conversão de `[MEDIR NA SESSÃO]` MB. A indexação dos cinco fragmentos levou `[MEDIR NA SESSÃO]` ms, após o carregamento do modelo de embeddings, e o processo do backend atingiu `[MEDIR NA SESSÃO]` MB de memória durante o carregamento.

**Nota (não colar):** o TCC descreve os documentos como "manuais de equipamentos, normas de uso e materiais de apoio". Os arquivos reais são os quatro acima. Ajustar a frase se o grupo concordar.

---

## Task 4 — Limites do Docling (p.17)

**Pedido:** "p.17: Definir os limites do Docling: OCR, tabelas, imagens, metadados, rejeição de documentos com falha e logs de ingestão. (SS20)"

**Status:** concluída. Os limites foram definidos e implementados no código. Falta só uma conversão real de PDF no PC.

### O que foi feito

| Limite pedido | Como ficou no sistema | Arquivo |
|---|---|---|
| OCR | Ligado para PDF digitalizado, em português e inglês (com EasyOCR). Páginas com texto digital usam o texto do próprio PDF. | `backend/converter.py` |
| Tabelas | Reconhecidas pelo modelo de tabelas do Docling e exportadas como tabelas Markdown | `backend/converter.py` |
| Imagens | Não são descritas nem salvas; viram o marcador `<!-- image -->` | `backend/converter.py` |
| Metadados | Só os de origem: nome do arquivo, tipo, hash e nº de páginas, mais data de envio e administrador (no log). Título, autor e data internos não são extraídos. | `converter.py` e `server.js` |
| Rejeição de documento com falha | Conversão que falha, fica parcial ou não tem texto é recusada e **não é indexada** (RN14). Também são recusados: formato fora de PDF/DOCX/MD/TXT, arquivo acima de 50 MB, mais de 500 páginas e mais de 300 s de conversão. O arquivo enviado é apagado. | `server.js` (`/api/train`) |
| Logs de ingestão | Todo envio gera `INGESTAO_OK` ou `INGESTAO_FALHA` na trilha de auditoria (Painel → Logs), com formato, páginas, tabelas, imagens, fragmentos, tempo e motivo da recusa | `server.js` |

- **API do Docling:** os nomes usados no código foram conferidos no código-fonte do Docling 2.140.
- **Formatos MD e TXT:** passaram a ser aceitos explicitamente. Já são texto, então vão direto para a indexação.

### O que foi medido (testes feitos)

| Envio | Resultado | Sobrou arquivo? | Log |
|---|---|---|---|
| Arquivo `.exe` | Recusado (400): formato não aceito | Não | `INGESTAO_FALHA` |
| `.md` vazio | Recusado (422): sem texto aproveitável | Não | `INGESTAO_FALHA` |
| PDF sem Docling instalado | Recusado (422): "Docling não instalado" | Não | `INGESTAO_FALHA` |
| Arquivo acima de 50 MB | Recusado (413) | Não | `INGESTAO_FALHA` |
| `.md` válido | Indexado (1 fragmento) e depois removido pela tela | — | `INGESTAO_OK` |

### O que falta (sessão de testes)

- Instalar o Docling com `pip install "docling[easyocr]"`.
- Enviar um PDF real pela tela **Treinamento IA** e conferir no log as páginas, as tabelas e o tempo.

### Texto para o TCC

**Seção 2.2 — substitui a marcação, logo após "Os demais limites do processamento são descritos a seguir.":**

> (i) Documentos digitalizados: o reconhecimento óptico de caracteres (OCR) do Docling permanece ativo, com os idiomas português e inglês quando o motor EasyOCR está instalado; páginas que já contêm texto digital têm esse texto aproveitado diretamente. (ii) Tabelas: são reconhecidas pelo modelo de estrutura de tabelas do Docling e exportadas como tabelas Markdown, preservando linhas e colunas; contudo, a segmentação posterior por número de caracteres pode dividir uma tabela longa entre fragmentos. (iii) Imagens: não são descritas nem armazenadas; cada figura é substituída por um marcador no texto, de modo que o conteúdo exclusivamente visual, como diagramas e fotografias técnicas, não é recuperável pelo assistente. (iv) Metadados: são registrados apenas os metadados de origem — nome do arquivo, tipo, identificador (hash) e número de páginas —, além da data de envio e do administrador responsável; título, autor e data internos ao arquivo não são extraídos. (v) Falhas: documentos cuja conversão falha (inclusive por excederem 500 páginas), termina de forma parcial (por exemplo, ao exceder o tempo limite de 300 s) ou não produz texto aproveitável são recusados e não são indexados (RN14); o arquivo enviado e qualquer resultado intermediário são descartados, e o administrador recebe o motivo da recusa. (vi) Registro: cada envio, aceito ou recusado, é registrado na trilha de auditoria do sistema (eventos INGESTAO_OK e INGESTAO_FALHA), com formato, páginas, tabelas, imagens, número de fragmentos, tempo de conversão e, em caso de recusa, o motivo, consultável pelo administrador no painel de logs (RF30). Além de PDF e DOCX, o sistema aceita arquivos MD e TXT, que já estão em texto e seguem diretamente para a indexação.

**Nota (não colar):** a Seção 1.6.1 fala só em PDF e DOCX. A última frase do texto acima resolve isso; se preferirem, ajustar a 1.6.1.

---

## Task 5 — Justificativa do chunk de 2.000 caracteres (p.17)

**Pedido:** "p.17: Justificar o chunk de 2.000 caracteres com dados de simulação ou citação. (SS21)"

**Status:** parcial. A citação e a parte da simulação que não depende do modelo estão prontas. A taxa de acerto da busca e a contagem de tokens dependem da sessão.

### O que foi feito

- **Simulação:** script `npm run simular-chunk`. Ele corta o acervo em 500, 1.000, 1.500, 2.000 e 3.000 caracteres, do mesmo jeito que o sistema faz, e faz **20 perguntas** típicas de usuários (`backend/scripts/perguntas-chunk.json`).
- **Gabarito:** cada pergunta traz o trecho exato do documento que a responde.
- **Métricas:**
  - % de respostas cortadas ao meio pelo corte fixo;
  - acerto na 1ª posição e entre os 4 fragmentos recuperados;
  - MRR;
  - caracteres enviados ao LLM;
  - tokens por fragmento;
  - % de fragmentos acima de 256 tokens.
- **Citação:** Wang et al. (EMNLP 2024), Tabela 3. Entre fragmentos de 128 a 2.048 tokens, o de 512 teve a melhor fidelidade (97,59%) e a melhor relevância (97,41%). Com 2.048 tokens, a fidelidade caiu para 80,37%.
- **Ponto de atenção:** o cartão do modelo all-MiniLM-L6-v2 informa que ele corta, por padrão, entradas acima de 256 *word pieces*. Um fragmento de 2.000 caracteres provavelmente passa disso, então o final dele pesa pouco ou nada na busca. Isso entrou no texto como limitação.
- **Constante única:** o tamanho do chunk virou uma constante só no código (`CHUNK_SIZE` em `backend/rag.js`).

### O que foi medido

Parte que não depende do modelo nem do hardware (`npm run simular-chunk -- --sem-modelo`, 20 perguntas, acervo do estudo de caso):

| Tamanho (caracteres) | Fragmentos gerados | Respostas cortadas ao meio (de 20) |
|---|---|---|
| 250 | 33 | 20% |
| 500 | 18 | 5% |
| 750 | 13 | 5% |
| 1.000 | 9 | 0% |
| 1.500 | 8 | 0% |
| 2.000 | 5 | 0% |
| 3.000 | 4 | 0% |

**Leitura:**
- A partir de 1.000 caracteres, nenhuma resposta é dividida entre fragmentos.
- Abaixo disso, o corte fixo começa a separar a resposta da pergunta.
- 2.000 caracteres preserva todas as respostas com apenas 5 fragmentos.

### O que falta (sessão de testes)

- Rodar `npm run simular-chunk` no PC (o modelo de embeddings baixa sozinho na primeira vez).
- Copiar as colunas de acerto, MRR, contexto e tokens.
- **Se** outro tamanho sair claramente melhor que 2.000, o texto muda de "justificativa" para "limitação + trabalho futuro". Mudar o valor no sistema exigiria refazer as medições.

### Texto para o TCC

**Seção 2.2 — substitui a marcação:**

> Para verificar essa escolha, foi realizada uma simulação com o próprio acervo do estudo de caso, comparando fragmentos de 500, 1.000, 1.500, 2.000 e 3.000 caracteres. Para cada tamanho, o acervo foi segmentado da mesma forma que no sistema, e vinte perguntas típicas de usuários, cada uma associada ao trecho do documento que a responde, foram submetidas à recuperação por similaridade de cosseno com os quatro fragmentos mais próximos. Avaliaram-se a proporção de respostas divididas entre dois fragmentos pelo corte fixo, a taxa de acerto (presença do trecho correto entre os quatro fragmentos recuperados) e o volume de texto enviado ao modelo de linguagem. Os resultados são apresentados na Tabela X.

**Tabela X – Simulação do tamanho de fragmento**

| Tamanho (caracteres) | Fragmentos | Respostas cortadas | Acerto no 1º | Acerto entre os 4 | Contexto enviado ao LLM (caracteres) |
|---|---|---|---|---|---|
| 500 | 18 | 5% | `[MEDIR]` | `[MEDIR]` | `[MEDIR]` |
| 1.000 | 9 | 0% | `[MEDIR]` | `[MEDIR]` | `[MEDIR]` |
| 1.500 | 8 | 0% | `[MEDIR]` | `[MEDIR]` | `[MEDIR]` |
| 2.000 | 5 | 0% | `[MEDIR]` | `[MEDIR]` | `[MEDIR]` |
| 3.000 | 4 | 0% | `[MEDIR]` | `[MEDIR]` | `[MEDIR]` |

Fonte: os autores (2026).

> Fragmentos a partir de 1.000 caracteres preservaram integralmente todos os trechos de resposta, ao passo que, abaixo desse tamanho, parte das respostas foi dividida entre fragmentos — 5% em 500 e 20% em 250 caracteres. `[COMPLETAR COM A LEITURA DO ACERTO: ex.: "O tamanho de 2.000 caracteres obteve acerto de X% entre os quatro fragmentos, ..."]` O resultado é coerente com a avaliação comparativa de Wang et al. (2024), em que fragmentos de 512 tokens obtiveram os melhores índices de fidelidade (97,59%) e de relevância (97,41%) entre tamanhos de 128 a 2.048 tokens, enquanto o maior tamanho testado reduziu a fidelidade para 80,37%; em português, 2.000 caracteres correspondem a aproximadamente `[MEDIR NA SESSÃO]` tokens. Ressalta-se, contudo, que o modelo all-MiniLM-L6-v2 trunca, por padrão, entradas com mais de 256 *word pieces* (HUGGING FACE, [2026]); na simulação, `[MEDIR NA SESSÃO]`% dos fragmentos de 2.000 caracteres excederam esse limite, de modo que o final desses fragmentos contribui pouco ou nada para sua representação vetorial. Como o acervo do estudo de caso é pequeno (7.593 caracteres), esses resultados indicam a adequação do tamanho adotado nas condições avaliadas, mas não se generalizam para acervos maiores.

**Referência a incluir:**

> WANG, X. et al. Searching for Best Practices in Retrieval-Augmented Generation. In: CONFERENCE ON EMPIRICAL METHODS IN NATURAL LANGUAGE PROCESSING, 2024, Miami. **Proceedings [...]**. Miami: Association for Computational Linguistics, 2024. Disponível em: https://aclanthology.org/2024.emnlp-main.981/. Acesso em: 20 out. 2026.

**Nota (não colar):** a citação HUGGING FACE, [2026] já existe no TCC. Confirmar que ela aponta para o cartão do modelo `sentence-transformers/all-MiniLM-L6-v2`.

---

## Task 6 — Periodicidade e local do backup (p.30)

**Pedido:** "p.30: Informar a periodicidade do backup e o local de armazenamento das cópias. (SS75)"

**Status:** concluída. Falta o Fabrício validar com os prazos da LGPD (p.31), como pede a divisão de tarefas.

### O que foi feito

- **Política definida:**
  - **periodicidade:** diária;
  - **retenção:** mantém as 7 cópias diárias e as 4 semanais mais recentes;
  - **local:** pasta local fora da aplicação (`academai-backups` na pasta do usuário) e uma cópia semanal em outro disco ou servidor.
- **Script `npm run backup`:**
  - copia o banco com `VACUUM INTO`, que gera uma cópia íntegra mesmo com o sistema rodando, como exige o RNF24;
  - confere a cópia com `PRAGMA integrity_check`;
  - copia também o índice do RAG e os documentos;
  - grava um `manifest.json` com o SHA-256 de cada arquivo;
  - apaga as cópias mais antigas.
- **Guia (`INICIA_PROJETO.md`):** instruções para agendar a execução diária no Windows (Agendador de Tarefas) e no Linux/macOS (cron), e para restaurar.

### O que foi medido (testes feitos)

| Teste | Resultado |
|---|---|
| 3 execuções seguidas, com limite de 2 cópias diárias | A cópia mais antiga foi apagada; ficaram as 2 mais recentes |
| Cópia semanal | Criada uma vez na semana (2026-S43) e não repetida nas execuções seguintes |
| Cópia externa | Criada junto com a semanal |
| Integridade do banco copiado | `integrity_check = ok`, com os 6 usuários presentes |
| Destino inválido | O script para com erro e código de saída 1 (o agendador registra a falha) |

### O que falta

Validação do Fabrício (LGPD, p.31):
- Com 7 diárias + 4 semanais, um dado apagado no sistema continua nos backups por até **cerca de 5 semanas**. O prazo de retenção (RNF27) precisa levar isso em conta.
- As cópias contêm dados pessoais, então o local externo precisa de acesso restrito.
- O backup não é criptografado. Se o grupo quiser, isso vira uma frase de limitação.

### Texto para o TCC

**Seção 3.3.6 — RNF24 (substitui a marcação no fim do requisito):**

> O backup é diário e inclui o banco de dados, o índice vetorial (`vector_cache.json`) e o acervo de documentos convertidos. A cópia do banco é feita pelo comando `VACUUM INTO` do SQLite, que gera uma cópia consistente com o serviço em execução, e é verificada por `PRAGMA integrity_check`; cada cópia registra o resumo criptográfico (SHA-256) de seus arquivos. São mantidas as sete cópias diárias mais recentes e quatro cópias semanais em diretório local do servidor, fora da pasta da aplicação, e a cópia semanal é replicada para uma mídia ou servidor de armazenamento distinto da máquina que hospeda o sistema, definido pela instituição. O procedimento é executado pelo comando `npm run backup`, agendado no sistema operacional, e a restauração consiste em substituir os arquivos com o serviço parado.

---

## Task 7 — Demanda mínima de referência (p.62)

**Pedido:** "p.62: Estimar a demanda mínima de referência (10, 100, 1.000 ou 10.000 usuários, e simultâneos) e o hardware correspondente. (SS39)"

**Status:** estimativa pronta. Recalcular com o tempo de resposta medido na sessão.

### O que foi feito

- **Base do cálculo:** o protótipo nunca foi testado com carga simultânea, então a demanda foi **estimada por cálculo de fila** (modelo M/M/1). O ponto de partida é o tempo mediano de resposta completa da Tabela 1 (1,65 s), já que o Ollama, na configuração padrão, responde uma pergunta por vez.
- **Hipóteses (declaradas no texto):**
  - cada usuário em conversa faz cerca de 1 pergunta por minuto;
  - a fração de usuários conversando ao mesmo tempo cai com o tamanho da base: 20%, 10%, 5% e 2,5%.
- **Script `npm run carga-chat`:** dispara 1, 2, 4 e 8 perguntas ao mesmo tempo e mede o tempo até o primeiro trecho e até a resposta completa. Ele confirma (ou corrige) a hipótese da fila com números reais. Foi testado com um Ollama simulado.

### O que foi medido (cálculo)

**Fórmulas:**
- ocupação do modelo: ρ = (usuários simultâneos ÷ 60) × tempo de atendimento;
- tempo médio de resposta: W = tempo de atendimento ÷ (1 − ρ).

| Cadastrados | Simultâneos | Tempo de atendimento | Ocupação (ρ) | Tempo médio de resposta |
|---|---|---|---|---|
| 10 | 2 | 1,65 s (sem GPU) | 0,055 | 1,75 s |
| 100 | 10 | 1,65 s (sem GPU) | 0,275 | 2,28 s |
| 1.000 | 50 | 1,65 s (sem GPU) | 1,375 | fila cresce sem limite |
| 1.000 | 50 | 0,4 s (com GPU)* | 0,333 | 0,60 s |
| 10.000 | 250 | 0,4 s (1 GPU)* | 1,667 | fila cresce sem limite |
| 10.000 | 250 | 0,4 s (3 instâncias)* | 0,556 por instância | 0,90 s |

\* 0,4 s com GPU é uma hipótese, a confirmar experimentalmente.

### O que falta (sessão de testes)

- Rodar `npm run carga-chat` com o backend e o Ollama ligados.
- Trocar 1,65 s pelo tempo medido com 1 pergunta e conferir as linhas de 2, 4 e 8.
- Anotar o valor de `OLLAMA_NUM_PARALLEL`, se tiver sido alterado.

### Texto para o TCC

**Seção 5.6 — substitui a marcação:**

> Como o protótipo não foi submetido a carga concorrente, a demanda suportada foi estimada a partir do tempo de resposta medido. O Ollama processa as gerações de forma sequencial na configuração padrão, de modo que perguntas simultâneas formam uma fila e o tempo de espera cresce com a ocupação do modelo. Adotando-se o tempo mediano de resposta completa de 1,65 s (Tabela 1) como tempo de atendimento, e supondo que cada usuário em conversa envie, em média, uma pergunta por minuto, a ocupação do modelo é ρ = U × 1,65 / 60, em que U é o número de usuários conversando ao mesmo tempo, e o tempo médio até a resposta é aproximadamente 1,65 / (1 − ρ) s, segundo o modelo de fila M/M/1. A Tabela Y apresenta a estimativa para diferentes portes de implantação, com proporções de usuários simultâneos decrescentes com o tamanho da base.

**Tabela Y – Estimativa de demanda e hardware correspondente**

| Usuários cadastrados | Simultâneos no chat (hipótese) | Ocupação do modelo (ρ) | Tempo médio de resposta estimado | Hardware correspondente |
|---|---|---|---|---|
| 10 | 2 (20%) | 0,06 | ≈ 1,8 s | Hardware mínimo funcional (8 GB de RAM, sem GPU) |
| 100 | 10 (10%) | 0,28 | ≈ 2,3 s | Estação equivalente à de medição (6 núcleos, 16–32 GB de RAM, sem GPU) |
| 1.000 | 50 (5%) | 1,38 sem GPU — saturado | ≈ 0,6 s com GPU* | Servidor com GPU dedicada (≥ 8 GB de VRAM), 32 GB de RAM e PostgreSQL |
| 10.000 | 250 (2,5%) | 1,7 com uma GPU* — saturado | ≈ 0,9 s com 3 instâncias de inferência* | Vários servidores de inferência com GPU, balanceador de carga, PostgreSQL e índice vetorial dedicado |

\* Supondo tempo de atendimento de 0,4 s com GPU dedicada, valor a ser confirmado experimentalmente.

Fonte: os autores (2026).

> Assim, a configuração avaliada atende, com folga, a demanda de referência de um laboratório como o do estudo de caso — da ordem de 100 usuários cadastrados e até 10 conversando simultaneamente —, enquanto implantações a partir de mil usuários exigem GPU dedicada e, a partir de dez mil, distribuição da inferência entre várias máquinas e substituição do SQLite por um SGBD cliente-servidor, cenário que extrapola o escopo do protótipo. Trata-se de estimativa analítica, que deve ser confirmada por testes de carga.

---

## Roteiro da sessão de testes (Mafê + Arthur)

A divisão de tarefas sugere uma sessão única: os tempos do Docling, da indexação e da memória servem para a p.65 (Mafê) e a p.67 (Arthur). Fazer no PC de referência (Ryzen 5 4600G, 32 GB, Windows 11).

1. Atualizar o projeto (`git pull`) e, dentro de `backend/`, rodar `npm install`.
2. Instalar o Docling uma vez com `pip install "docling[easyocr]"`. A primeira conversão baixa os modelos dele.
3. Separar 1 ou 2 PDFs/DOCX reais do laboratório (manual de equipamento, regulamento) numa pasta.
4. Fechar programas pesados e deixar o PC na tomada.
5. Rodar `npm run medir`: acervo do estudo de caso (task 3).
6. Rodar `npm run medir -- --pasta <pasta com os PDFs>`: tempo e memória do Docling (tasks 3 e 4).
7. Rodar `npm run simular-chunk`: tabela da task 5.
8. Ligar o `node server.js` e o Ollama e rodar `npm run carga-chat`: task 7, e também tempos de resposta para o Arthur.
9. Enviar um PDF pela tela **Treinamento IA** e conferir o log em **Painel → Logs** (task 4).
10. Os relatórios ficam em `docs/medicoes/`, com o ambiente da máquina registrado (task 2). Use-os para preencher os campos `[MEDIR NA SESSÃO]`.
