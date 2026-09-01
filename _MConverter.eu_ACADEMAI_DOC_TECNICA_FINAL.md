**UNIVERSIDADE SANTA CECÍLIA**

**ENGENHARIA DE COMPUTAÇÃO**

**ARTHUR SILLES FERNANDES**

**FABRICIO SUZART ANDRADE**

**JULIANA PALLIN DE AMORIM**

**MARIA FERNANDA DE ALMEIDA MANEIRA**

**ACADEMAI**

**SANTOS SP**

**2026**

**ARTHUR SILLES FERNANDES**

**FABRICIO SUZART ANDRADE**

**JULIANA PALLIN DE AMORIM**

**MARIA FERNANDA DE ALMEIDA MANEIRA**

ACADEMAI

> Trabalho de Conclusão de Curso apresentado como exigência parcial para obtenção do título de Bacharel em Engenharia de Computação à Universidade Santa Cecília, sob orientação do Professor Sergio Schina de Andrade e coorientação do Professor Luis Fernando Pompeo Ferrara.

**SANTOS SP**

**2026**

ARTHUR SILLES FERNANDES

FABRICIO SUZART ANDRADE

JULIANA PALLIN DE AMORIM

MARIA FERNANDA DE ALMEIDA MANEIRA

**ACADEMAI**

Trabalho de Conclusão de Curso apresentado como exigência parcial para obtenção do título de Bacharel em Engenharia de Computação à Universidade Santa Cecília.

Data da aprovação: \_\_\_\_/\_\_\_\_/\_\_\_\_

Banca Examinadora

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Prof.(a) Ms./Dr.(a)

Orientador(a)

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Prof.(a) Ms./Dr.(a)

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**RESUMO**

Este trabalho apresenta o desenvolvimento de um assistente inteligente open source destinado à gestão de agendamentos de recursos e ao acesso ao conhecimento institucional em ambientes acadêmicos. O sistema foi projetado para execução local, evitando o envio de *prompts*, documentos institucionais e registros de reserva a provedores externos de IA. Essa decisão arquitetural reduz a superfície de exposição dos dados, embora a proteção efetiva dependa de autenticação, autorização, controle de acesso e segurança da infraestrutura local. A arquitetura integra um *Large Language Model*, o Llama 3.2 na variante de 3 bilhões de parâmetros, executado por meio do Ollama, com a técnica de *Retrieval-Augmented Generation* para especialização do assistente no acervo documental da instituição. Os documentos são convertidos para o formato Markdown pela ferramenta Docling, segmentados em fragmentos de 2.000 caracteres e representados vetorialmente pelo modelo all-MiniLM-L6-v2, com busca por similaridade de cosseno em tempo de inferência. A persistência dos agendamentos é gerenciada pelo banco de dados SQLite, integrado ao modelo de linguagem por meio de um mecanismo de chamadas de ferramentas inspirado no *Model Context Protocol* (MCP), que viabiliza a consulta, inclusão e cancelamento de reservas diretamente no fluxo conversacional. A interação por voz é suportada pelo modelo Whisper na variante base para reconhecimento de fala e pela Web Speech API para síntese de fala, ampliando o alcance do sistema para usuários com diferentes necessidades de acessibilidade. O estudo de caso, conduzido em contexto similar ao Fab Lab, laboratório de fabricação avançada da universidade, validou o sistema com seis usuários, demonstrando sua capacidade de conduzir agendamentos de forma conversacional e responder a consultas institucionais com baixa incidência de alucinações. Os resultados indicam que a solução atende aos objetivos propostos nos limites das condições avaliadas, com potencial de expansão para ambientes de maior escala mediante substituição do modelo de linguagem por variantes de maior capacidade.

**Palavras-chave:** Inteligência Artificial; Assistente Conversacional; *Retrieval-Augmented Generation*; *Model Context Protocol*; Reconhecimento de fala; Síntese de fala.

**ABSTRACT**

This work presents the development of an open-source intelligent assistant aimed at resource booking management and access to institutional knowledge in academic environments. The system was designed for local execution, avoiding the transmission of prompts, institutional documents, and booking records to external AI providers. This architectural decision reduces the data exposure surface, although effective protection depends on authentication, authorization, access control, and the security of the local infrastructure. The architecture integrates a Large Language Model, Llama 3.2 in its 3-billion-parameter variant, executed through Ollama, with the Retrieval-Augmented Generation (RAG) technique to specialize the assistant on the institution\'s document repository. The documents are converted into Markdown format using the Docling tool, segmented into 2,000-character chunks, and represented as vectors by the all-MiniLM-L6-v2 model, utilizing cosine similarity search at inference time. The persistence of bookings is managed by an SQLite database, integrated into the language model via a tool-calling mechanism inspired by the Model Context Protocol (MCP), which enables querying, adding, and canceling reservations directly within the conversational flow. Voice interaction is supported by the Whisper model (base variant) for speech recognition and the Web Speech API for speech synthesis, broadening the system\'s reach for users with varying accessibility needs. The case study, conducted in a context similar to the Fab Lab---the university\'s advanced fabrication laboratory---validated the system with six users, demonstrating its capacity to handle bookings conversationally and respond to institutional queries with a low incidence of hallucinations. The results indicate that the solution meets the proposed objectives within the boundaries of the evaluated conditions, showing potential for expansion into larger-scale environments by replacing the language model with higher-capacity variants.

**Keywords: Artificial Intelligence; Conversational Assistant; Retrieval-Augmented Generation; Model Context Protocol; Speech recognition; Speech synthesis.**

**SUMÁRIO**

[1 INTRODUÇÃO [6](#introdução)](#introdução)

[1.1 Definição do Problema [6](#definição-do-problema)](#definição-do-problema)

[1.2 Proposta de Contribuição [7](#proposta-de-contribuição)](#proposta-de-contribuição)

[1.3 Visão Geral [8](#visão-geral)](#visão-geral)

[1.4 Objetivos [8](#objetivos)](#objetivos)

[1.4.1 Objetivo Geral [8](#objetivo-geral)](#objetivo-geral)

[**1.4.2 Objetivos Específicos** [9](#_Toc231753880)](#_Toc231753880)

[1.5 Estrutura do Trabalho [10](#estrutura-do-trabalho)](#estrutura-do-trabalho)

[2 PÚBLICO-ALVO E PERFIS DE USUÁRIO [10](#público-alvo-e-perfis-de-usuário)](#público-alvo-e-perfis-de-usuário)

[2.1 Perfis [10](#perfis)](#perfis)

[2.2 Matriz de Permissões [11](#matriz-de-permissões)](#matriz-de-permissões)

[3 ESCOPO [11](#escopo)](#escopo)

[3.1 Incluso [12](#incluso)](#incluso)

[3.2 Excluído [12](#excluído)](#excluído)

[4 Requisitos Funcionais [13](#requisitos-funcionais)](#requisitos-funcionais)

[4.1 Autenticação e Usuários [13](#autenticação-e-usuários)](#autenticação-e-usuários)

[4.2 Gestão de Recursos [14](#gestão-de-recursos)](#gestão-de-recursos)

[4.3 Reservas [14](#reservas)](#reservas)

[4.4 Assistente de IA [15](#assistente-de-ia)](#assistente-de-ia)

[4.5 Acessibilidade [16](#acessibilidade)](#acessibilidade)

[4.6 Painel Administrativo [16](#painel-administrativo)](#painel-administrativo)

[5 Requisitos não funcionais [16](#requisitos-não-funcionais)](#requisitos-não-funcionais)

[5.1 Desempenho [16](#desempenho)](#desempenho)

[5.2 Segurança [17](#segurança)](#segurança)

[5.3 Acessibilidade [17](#acessibilidade-1)](#acessibilidade-1)

[5.4 Usabilidade [18](#usabilidade)](#usabilidade)

[5.5 Manutenção [18](#manutenção)](#manutenção)

[5.6 Portabilidade [18](#portabilidade)](#portabilidade)

[5.7 Privacidade [18](#privacidade)](#privacidade)

[5.8 Disponibilidade [19](#disponibilidade)](#disponibilidade)

[6 Restrições e premissas [19](#restrições-e-premissas)](#restrições-e-premissas)

[6.1 Restrições Técnicas [19](#restrições-técnicas)](#restrições-técnicas)

[6.2 Premissas [20](#premissas)](#premissas)

[7 STACK TECNOLÓGICO [20](#stack-tecnológico)](#stack-tecnológico)

[8 CASOS DE USO [21](#casos-de-uso)](#casos-de-uso)

[8.1 Atores [21](#atores)](#atores)

[8.2 Visão Geral dos Casos de Uso [22](#visão-geral-dos-casos-de-uso)](#visão-geral-dos-casos-de-uso)

[8.3 Casos de Uso Expandidos [23](#casos-de-uso-expandidos)](#casos-de-uso-expandidos)

[8.3.1 UC01 -- Cadastrar Usuário [23](#uc01-cadastrar-usuário)](#uc01-cadastrar-usuário)

[8.3.2 UC02 -- Autenticar Usuário (Login) [24](#uc02-autenticar-usuário-login)](#uc02-autenticar-usuário-login)

[8.3.3 UC03 -- Recuperar Senha [24](#uc03-recuperar-senha)](#uc03-recuperar-senha)

[8.3.4 UC04 -- Gerenciar Contas de Usuário [25](#uc04-gerenciar-contas-de-usuário)](#uc04-gerenciar-contas-de-usuário)

[8.3.5 UC05 -- Gerenciar Recursos do Laboratório [26](#uc05-gerenciar-recursos-do-laboratório)](#uc05-gerenciar-recursos-do-laboratório)

[8.3.6 UC06 -- Consultar Disponibilidade de Recursos [26](#uc06-consultar-disponibilidade-de-recursos)](#uc06-consultar-disponibilidade-de-recursos)

[8.3.7 UC07 -- Solicitar Reserva de Recurso [27](#uc07-solicitar-reserva-de-recurso)](#uc07-solicitar-reserva-de-recurso)

[8.3.8 UC08 -- Aprovar ou Rejeitar Reserva [28](#uc08-aprovar-ou-rejeitar-reserva)](#uc08-aprovar-ou-rejeitar-reserva)

[8.3.9 UC09 -- Cancelar Reserva [28](#uc09-cancelar-reserva)](#uc09-cancelar-reserva)

[8.3.10 UC10 -- Consultar Histórico de Reservas [29](#uc10-consultar-histórico-de-reservas)](#uc10-consultar-histórico-de-reservas)

[8.3.11 UC11 -- Interagir com Assistente de IA [29](#uc11-interagir-com-assistente-de-ia)](#uc11-interagir-com-assistente-de-ia)

[8.3.12 UC12 -- Realizar Reserva via Chat com IA [30](#uc12-realizar-reserva-via-chat-com-ia)](#uc12-realizar-reserva-via-chat-com-ia)

[8.3.13 UC13 -- Navegar pelo Sistema por Voz [31](#uc13-navegar-pelo-sistema-por-voz)](#uc13-navegar-pelo-sistema-por-voz)

[8.3.14 UC14 -- Visualizar Painel Administrativo [32](#uc14-visualizar-painel-administrativo)](#uc14-visualizar-painel-administrativo)

[8.3.15 UC15 -- Aprovar Reservas pelo Painel [32](#uc15-aprovar-reservas-pelo-painel)](#uc15-aprovar-reservas-pelo-painel)

[8.4 Matriz de Rastreabilidade RF x UC x RN [33](#matriz-de-rastreabilidade-rf-x-uc-x-rn)](#matriz-de-rastreabilidade-rf-x-uc-x-rn)

[9 regras de negócio [34](#regras-de-negócio)](#regras-de-negócio)

[10 DIAGRAMA DO MODELO CONCEITUAL [36](#diagrama-do-modelo-conceitual)](#diagrama-do-modelo-conceitual)

[11 DIAGRAMA DE OBJETOS [37](#diagrama-de-objetos)](#diagrama-de-objetos)

[12 DIAGRAMA DE SEQUÊNCIA [38](#diagrama-de-sequência)](#diagrama-de-sequência)

[REFERÊNCIAS [42](#referências)](#referências)

# INTRODUÇÃO

Nos últimos anos, o surgimento e popularização dos assistentes conversacionais de inteligência artificial (IA) transformaram significativamente a maneira como a sociedade interage com sistemas computacionais. Trata-se de um fenômeno global de consolidação acelerada, amplamente observado no cotidiano de indivíduos e organizações, no qual o paradigma de comunicação em linguagem natural deixou de ser um recurso isolado de pesquisa para se estabelecer como interface predominante em uma variedade de soluções digitais capazes de otimizar diversas demandas e aprimorar a experiência do usuário, influenciando suas expectativas quanto à interatividade de qualquer software.

## Definição do Problema

Em laboratórios de fabricação digital, como Fab Labs, o uso de recursos compartilhados ainda depende de formulários manuais ou sistemas pouco integrados, o que compromete rastreabilidade e eficiência. Esses sistemas não exploram o potencial que as tecnologias de inteligência artificial oferecem para tornar o processo de reserva mais eficiente, evitar a subutilização ou sobrecarga dos ativos e facilitar o acesso à base de conhecimento institucional (IZOURANE et al., 2024).

Estudantes com deficiência enfrentam barreiras de engajamento em contextos STEM e ensino superior, incluindo dificuldades no acesso a processos institucionais (JAMES et al., 2019). A interação por voz é apresentada neste trabalho como modalidade complementar e multimodal de acesso à interface --- não como substituta do teclado, do leitor de tela ou do HTML semântico ---, com o objetivo de ampliar a participação desse grupo.

Observa-se, portanto, a necessidade de soluções capazes de integrar a gestão de recursos compartilhados, consulta à base documental e mecanismos de interação acessível em uma única plataforma.

## Proposta de Contribuição

Diante desse cenário, este trabalho propõe o desenvolvimento *open source* de um assistente conversacional local e parametrizável, destinado à gestão de agendamentos de recursos e à consulta de uma base documental. A parametrização refere-se à possibilidade de configurações de recursos, perfis, regras de funcionamento e documentos da instituição sem alteração do código-fonte central.

A arquitetura da solução abrange a utilização de um *Large Language Model* (LLM) adequado para execução local, combinado à técnica de *Retrieval-Augmented Generation* (RAG), que permite a incorporação, em tempo de inferência, de informações contidas em documentos institucionais previamente cadastrados, como normas, manuais, procedimentos e materiais de apoio. O escopo do projeto não prevê busca aberta na internet, recurso amplamente oferecido por ferramentas comerciais semelhantes que podem ser utilizadas em paralelo, atendendo, dessa forma, a diferentes necessidades. A interação por voz é viabilizada por tecnologias de *Automatic Speech Recognition* (ASR) e *Text-to-Speech* (TTS), como mecanismo complementar à interface textual. A persistência dos agendamentos é realizada em banco de dados relacional, acessado exclusivamente pelo backend. O LLM não manipula o banco diretamente; ele emite chamadas estruturadas de ferramenta, inspiradas no Model Context Protocol, que são validadas e executadas pelo backend para autenticação, autorização, regras de negócio, consistência temporal e confirmação explícita antes de qualquer operação de escrita (MODEL CONTEXT PROTOCOL, 2026; OLLAMA, 2025).

A execução local do modelo reduz dependência de provedores externos de IA durante as funcionalidades principais do software, e diminui a exposição de prompts, documentos e registros de reserva a serviços de terceiros. Não implica, contudo, na garantia automática de privacidade, uma vez que tais atributos dependem de mecanismos complementares de autenticação, autorização, controle de acesso, backup, monitoramento e administração da infraestrutura. Adicionalmente, por eliminar o custo variável por *tokens* de API, a solução pode reduzir a dependência de custos variáveis por uso, embora os custos passem a incidir sobre hardware, energia, manutenção, atualização de modelos e suporte técnico. Essa hipótese de custo operacional deve ser avaliada conforme o contexto institucional.

## Visão Geral

O ACADEMAI: Assistente Inteligente Local para Gestão de Reservas e Base de Conhecimento em Laboratórios Acadêmicos é um sistema web para gestão de reservas de equipamentos e ambientes em laboratórios acadêmicos. O sistema foi desenvolvido para atender estudantes, professores e administradores, com acessibilidade a pessoas com deficiência visual ou motora, com navegação baseada em comandos de voz e interface acessível.

O sistema disponibiliza um chat com assistente de inteligência artificial baseado no modelo Llama 3.2 3B via Ollama, executado localmente. O pipeline RAG utiliza Docling para conversão e chunking de documentos institucionais, embeddings all-MiniLM-L6-v2 via Transformers.js e armazenamento vetorial local, permitindo respostas fundamentadas em fontes verificáveis. A integração com o backend é feita por chamadas estruturadas (tool calling), garantindo que o LLM nunca escreva diretamente no banco de dados. O modelo local não requer acesso à internet durante a inferência; instalação e atualização de modelos podem necessitar de conectividade.

O fluxo de reserva segue regras de negócio de aprovação diferenciadas por perfil: estudantes geram reservas com status PENDENTE, aguardando aprovação de professores ou administradores; professores e administradores têm reservas aprovadas automaticamente pelo sistema. Professores aprovam reservas pendentes de estudantes; administradores aprovam reservas pendentes dentro do escopo do sistema.

## Objetivos

Esta seção apresenta os objetivos deste trabalho, de modo a explicitar a finalidade principal da pesquisa e etapas necessárias para o desenvolvimento e avaliação do software.

### Objetivo Geral

Desenvolver e avaliar um sistema web acessível para gestão de reservas de equipamentos e ambientes de laboratório, promovendo autonomia de uso nas funcionalidades essenciais para todos os usuários --- incluindo pessoas com deficiência visual e motora ---, com suporte a um assistente de IA local. A autonomia será verificada por cenários de acessibilidade e testes com leitor de tela ou usuário representativo.

[]{#_Toc231753880 .anchor}**1.4.2 Objetivos Específicos**

- Especificar requisitos funcionais, não funcionais, regras de negócio e casos de uso do sistema.

- Projetar a arquitetura do sistema, incluindo frontend, backend, banco de dados, pipeline RAG (Docling, chunking, embeddings, armazenamento vetorial) e mecanismos de acessibilidade.

- Implementar o fluxo de autenticação, autorização e aprovação de reservas com base em perfis de usuário (Estudante, Professor, Administrador), conforme RBAC definido neste documento.

- Implementar pipeline RAG para consulta a documentos institucionais do laboratório, com apresentação obrigatória de fonte quando a resposta for fundamentada em documento recuperado.

- Implementar mecanismo seguro de chamadas estruturadas (tool calling) para que o assistente solicite reservas sem manipular diretamente o banco de dados; todas as ações são mediadas e validadas pelo backend.

- Oferecer navegação completa por comandos de voz, cobrindo as funcionalidades: login, consulta de disponibilidade, solicitação de reserva, consulta de histórico e interação com o assistente. Ações críticas (reservar, cancelar, aprovar, rejeitar) exigem confirmação explícita. O sucesso será medido por taxa de conclusão de tarefa sem teclado em cenário controlado.

- Disponibilizar um assistente de IA local capaz de responder perguntas sobre o laboratório e solicitar reservas de forma validada pelo backend, sem inventar disponibilidade.

- Avaliar o protótipo por meio de cenários de casos de uso com métricas de: tempo de resposta do LLM, taxa de sucesso dos casos de uso, aderência das respostas RAG às fontes, taxa de erro de transcrição (WER) e satisfação/acessibilidade percebida.

## Estrutura do Trabalho

Na sequência, são detalhados os fundamentos teóricos que embasam as decisões arquiteturais descritas, discutindo trabalhos correlatos identificados na literatura, assim como a metodologia de desenvolvimento, as tecnologias utilizadas, os resultados obtidos e as considerações conclusivas acerca das contribuições do projeto, suas limitações e perspectivas para estudos futuros.

# PÚBLICO-ALVO E PERFIS DE USUÁRIO

O sistema suportará 3 perfis distintos de usuário, cada um com permissões e fluxos de aprovação específicos. A aprovação automática é tratada como regra de negócio associada ao perfil (ver Seção 10 --- Regras de Negócio). Esses perfis compõem o escopo consolidado do sistema: Estudante, Professor e Administrador.

## Perfis

**• Estudante: Aluno matriculado na universidade.**

◦ Reservas ficam com status PENDENTE e necessitam de aprovação manual de professor ou administrador.

◦ Não pode aprovar reservas de outros usuários.

◦ Pode se autoregistrar no sistema; perfil de Estudante é o único disponível no cadastro público.

• **Professor: Docente da instituição.**

◦ Reservas aprovadas automaticamente pelo sistema (status APROVADA imediato).

◦ Pode aprovar ou rejeitar reservas de estudantes. O escopo de aprovação é configurável pelo administrador por laboratório, disciplina, turma ou recurso; por padrão, abrange todos os estudantes do laboratório.

◦ O perfil Professor requer validação por administrador para ser atribuído --- não é autodeclarado no cadastro público, eliminando risco de elevação indevida de privilégio.

• **Administrador: Responsável pelo laboratório.**

◦ Reservas aprovadas automaticamente pelo sistema.

◦ Aprova ou rejeita reservas pendentes de qualquer perfil (inclusive de estudantes).

◦ Gerencia usuários, recursos e documentos institucionais (acervo RAG).

◦ Não é possível desativar o único administrador ativo do sistema.

## Matriz de Permissões

| **Permissão** | **Estudante** | **Professor** | **Administrador** |
|----|----|----|----|
| Solicitar reserva | Sim | Sim | Sim |
| Reserva com aprovação automática | Não | Sim | Sim |
| Aprovar reserva de estudante | Não | Sim | Sim |
| Aprovar reserva de professor | Não | Não | Sim (se pendente) |
| Gerenciar recursos | Não | Não | Sim |
| Gerenciar usuários | Não | Não | Sim |
| Gerenciar documentos RAG | Não | Não | Sim |
| Consultar própria agenda | Sim | Sim | Sim |
| Consultar agenda global | Parcial | Parcial | Sim |
| Autoregistro público | Sim (Estudante) | Não (adm. atribui) | Não (adm. cria) |

Quadro 1 -- Matriz de permissões por perfil de usuário

# ESCOPO

Esta seção delimita o que está incluído e o que está excluído do escopo do ACADEMAI, fornecendo uma referência objetiva para avaliação do sistema e direcionamento de trabalhos futuros.

## Incluso

• Cadastro, autenticação e gerenciamento de contas de usuários, com perfis Estudante (autoregistro público), Professor e Administrador (atribuídos por administrador).

• Fluxo de aprovação/rejeição de reservas com notificação por interface (notificações em tela via polling ou WebSocket, com fallback para e-mail institucional local quando disponível), em conformidade com WCAG 2.1 AA.

• Assistente de IA conversacional com pipeline RAG sobre documentos institucionais do laboratório (normas, manuais, procedimentos e materiais de apoio), com apresentação obrigatória de fonte quando a resposta for baseada em documento recuperado.

• Reservas via chat com IA por meio de chamadas estruturadas (tool calling): o LLM coleta dados, confirma com o usuário e emite solicitação ao backend, que valida e registra. O LLM não acessa nem manipula o banco de dados diretamente.

• Entrada de voz (ASR) via Whisper local para o chat e navegação. Feedback de voz (TTS) via Web Speech API ou alternativa local --- limitação de privacidade declarada em 7.1.

• Gestão do acervo documental: upload de documentos, conversão via Docling, chunking (2.000 caracteres) e reindexação do pipeline RAG pelo administrador. São aceitos documentos nos formatos PDF e DOCX, com tamanho máximo de 50 MB por arquivo. O procedimento de reindexação deve ser executado pelo administrador após qualquer alteração no acervo, garantindo que o pipeline RAG reflita o estado atual dos documentos institucionais.

• Histórico completo de reservas por usuário.

• Interface acessível em conformidade com WCAG 2.1 nível AA.

• Painel administrativo com aprovações pendentes, calendário global, gestão de usuários, recursos e documentos institucionais.

## Excluído

• Integração com sistemas externos da universidade e SSO institucional.

• Gerenciamento de manutenção preventiva ou corretiva de equipamentos.

• Cobranças ou pagamentos por uso de recursos.

• Otimização automática de agenda e recomendação automática de recursos.

• Busca de informações na internet pelo assistente de IA.

• Aplicativo móvel nativo (iOS ou Android).

• Operação multi-campus ou implantação em larga escala.

# Requisitos Funcionais

Os requisitos funcionais a seguir descrevem os comportamentos esperados do ACADEMAI, organizados por domínio de responsabilidade. Cada requisito é rastreável aos casos de uso, às regras de negócio e aos critérios de aceite adotados na avaliação do protótipo.

## Autenticação e Usuários

• RF01: O sistema deve permitir o cadastro público de usuários com nome, e-mail institucional (com validação de formato e verificação de domínio institucional antes da ativação da conta), senha (mínimo 8 caracteres, letras e números) e perfil Estudante. Os perfis Professor e Administrador são atribuídos manualmente por outro administrador, eliminando risco de elevação indevida de privilégio. Prioridade: Alta.

• RF02: O sistema deve autenticar usuários via JWT com fluxo de lazy login --- o usuário é redirecionado para login apenas ao tentar acessar funcionalidade protegida, sem interrupção desnecessária da sessão. Prioridade: Alta.

• RF03: O sistema deve restringir funcionalidades de acordo com o perfil do usuário autenticado, conforme a Matriz de Permissões RBAC (Seção 3.2). Prioridade: Alta.

• RF04: Administradores devem poder ativar, desativar e editar contas de usuário. O sistema deve impedir a desativação do único administrador ativo. Prioridade: Alta.

• RF07: O sistema deve permitir recuperação de senha. Em ambiente com servidor de e-mail institucional local disponível, o fluxo ocorre via e-mail. Em ambiente offline, o administrador pode redefinir a senha do usuário com registro em log de auditoria. Prioridade: Média.

## Gestão de Recursos

• RF05: O sistema deve permitir que administradores cadastrem, editem e desativem recursos. A exclusão física de recursos com reservas associadas deve ser bloqueada; nesses casos, o recurso deve ser desativado. Prioridade: Alta.

• RF06: O sistema deve exibir calendário de disponibilidade de recursos com atualização periódica (polling ou WebSocket, conforme implementação). Prioridade: Alta.

## Reservas

• RF08: O sistema deve permitir que usuários logados solicitem reservas de recursos disponíveis, informando obrigatoriamente: recurso, data, horário de início, horário de término e finalidade. A antecedência mínima, duração mínima, duração máxima e limite de reservas ativas simultâneas por usuário são configuráveis pelo administrador. Prioridade: Alta.

• RF09: O sistema deve exibir o status da reserva como um dos valores do enum: PENDENTE, APROVADA, REJEITADA, CANCELADA ou CONCLUIDA. Prioridade: Alta.

• RF10: Reservas de estudantes devem aguardar aprovação de professores ou administradores (status PENDENTE). Prioridade: Alta.

• RF11: Reservas de professores e de administradores devem ser aprovadas automaticamente pelo sistema (status APROVADA imediato). Prioridade: Alta.

• RF12: O sistema deve notificar o usuário quando o status da reserva for alterado (canal principal: notificação em tela; fallback: e-mail quando servidor local disponível). Prioridade: Alta.

• RF13: O sistema deve notificar professores e administradores sobre novas reservas pendentes (canal principal: notificação em tela; fallback: e-mail quando servidor local disponível). Prioridade: Alta.

• RF14: Professores e administradores devem poder aprovar ou rejeitar reservas pendentes. A justificativa é obrigatória para rejeição e opcional para aprovação. Prioridade: Alta.

• RF15: Usuários podem cancelar suas próprias reservas com status PENDENTE ou APROVADA, desde que o cancelamento ocorra com antecedência mínima configurável. Prioridade: Média.

• RF16: O sistema deve impedir reservas conflitantes no mesmo recurso e período. Conflito é definido como sobreposição temporal de dois intervalos \[início, fim) com status PENDENTE ou APROVADA para o mesmo recurso. Exemplo de conflito: reserva A de 14h00 a 16h00 e reserva B de 15h00 a 17h00 --- os intervalos se sobrepõem. Exemplo sem conflito: reserva A de 14h00 a 16h00 e reserva B de 16h00 a 18h00 --- os intervalos são adjacentes, sem sobreposição. A verificação ocorre no backend com transação e índice explícito; o assistente de IA não é responsável por garantir essa verificação. Prioridade: Alta.

• RF17: O sistema deve manter histórico completo, imutável e auditável de reservas por usuário e recurso. Prioridade: Média.

## Assistente de IA

• RF18: O sistema deve ter um chat com assistente de IA para dúvidas sobre o laboratório. O assistente responde apenas dentro do escopo do laboratório, com base nos documentos institucionais. Prioridade: Alta.

• RF19: O assistente deve utilizar RAG sobre documentos institucionais do laboratório. Quando a resposta for fundamentada em documento recuperado, a fonte deve ser exibida obrigatoriamente. Se não houver fonte documental, o assistente deve declarar ausência de base documental ou incerteza. Prioridade: Alta.

• RF20: O assistente deve coletar os dados necessários para uma reserva e emitir solicitação estruturada (tool calling / MCP simplificado) ao backend, que validará regras de negócio, autorização e disponibilidade antes de registrar a reserva. O LLM apenas solicita a ação; o backend é o ponto de decisão e persistência. Prioridade: Alta.

• RF21: O assistente deve confirmar os dados da reserva com o usuário antes de submetê-la ao backend. Prioridade: Alta.

• RF22: O chat deve suportar entrada de voz por meio de transcrição local via Whisper (base). Prioridade: Alta.

• RF23: O assistente deve informar ao usuário se a reserva solicitada via chat requer ou não aprovação, conforme o perfil do solicitante. Prioridade: Média.

• RF24: O modelo de IA deve rodar localmente (inferência LLM, RAG, embeddings e ASR são locais). TTS pode usar mecanismo do navegador (Web Speech API) e deve ser tratado como exceção configurável, com alternativa local prevista para ambientes com exigência estrita de privacidade. Prioridade: Alta.

## Acessibilidade

• RF25: O sistema deve suportar navegação completa por teclado. Prioridade: Alta.

• RF26: O sistema deve suportar navegação e comandos por voz (ASR via Whisper local) nas funcionalidades essenciais: login, consulta de disponibilidade, solicitação de reserva, consulta de histórico e interação com o assistente. Ações críticas exigem confirmação explícita. Fallback por teclado e leitor de tela deve estar disponível quando o reconhecimento de voz falhar. Prioridade: Alta.

• RF27: O sistema deve exibir feedback de voz (TTS) para confirmações e erros. Eventos que geram fala: login bem-sucedido, erro de autenticação, confirmação de reserva, rejeição de reserva, comando não reconhecido e navegação entre seções. Utiliza Web Speech API (com limitação de privacidade declarada) ou alternativa local configurável. Prioridade: Alta.

• RF28: Todos os elementos interativos devem possuir rótulos ARIA adequados para leitores de tela, complementando (não substituindo) o uso de HTML semântico. Prioridade: Média.

• RF29: O sistema deve manter contraste mínimo de cores de 4,5:1 em todos os elementos de texto, conforme WCAG 2.1 AA. Prioridade: Média.

## Painel Administrativo

• RF30: Administradores devem ter painel com: visão geral das reservas do dia/semana, lista de aprovações pendentes, calendário global, gestão de usuários, gestão de recursos, gestão de documentos institucionais (acervo RAG) e acesso a logs e relatórios básicos. Prioridade: Alta.

# Requisitos não funcionais

adicionar texto

## Desempenho

• RNF01: Tempos máximos de resposta em condições normais de rede local, medidos com usuário único e dados de teste: carregamento inicial ≤ 4 s; navegação entre telas ≤ 2 s; operações CRUD ≤ 3 s; atualização de calendário ≤ 4 s. Condição de teste: hardware do estudo de caso (Ryzen 5 2400G, 16 GB RAM, sem GPU dedicada), sem carga concorrente. Medições realizadas com ferramenta de profiling de navegador (ex.: Lighthouse ou DevTools Network), com mínimo de 5 repetições, reportando mediana dos tempos.

• RNF02: O assistente de IA deve retornar à primeira resposta em até 10 s para consultas simples (até 200 tokens de entrada), no hardware de referência do estudo de caso (Ryzen 5 2400G, 16 GB RAM, sem GPU dedicada, modelo Llama 3.2 3B via Ollama). Em hardware com GPU dedicada de 6 GB VRAM, o desempenho esperado é superior a esse limite. Esta meta foi definida como objetivo de projeto; a validação no estudo de caso é qualitativa e preliminar, com medição do tempo de primeira resposta registrada manualmente nas sessões com usuários.

## Segurança

• RNF03: Senhas devem ser armazenadas com hash bcrypt (fator de custo mínimo 12) ou Argon2id, avaliando-se o custo computacional no hardware disponível.

• RNF04: O access token JWT deve ter expiração de 15 minutos, com renovação silenciosa via refresh token rotacionado (validade 7 dias). Esta é a política de segurança adotada em todos os fluxos, casos de uso e diagramas do documento.

• RNF05: Todas as rotas protegidas da API devem exigir token JWT válido. Rotas públicas explicitamente definidas (login, cadastro e recuperação de senha) são exceções.

## Acessibilidade

• RNF06: A interface deve estar em conformidade com a WCAG 2.1 nível AA, verificada por ferramentas automatizadas (ex.: axe, Lighthouse) e testes manuais com leitor de tela.

• RNF07: A entrada de voz (ASR) usa Whisper local, sem envio de dados externos. O feedback de voz (TTS) usa Web Speech API (suportada nativamente no Chrome), que pode enviar texto sintetizado a servidores do navegador --- esta é uma limitação declarada. Em outros navegadores ou em ambientes com restrição total de saída de dados, deve-se utilizar alternativa local de TTS. O usuário deve ser informado sobre essa exceção por meio de aviso na interface na primeira utilização do recurso de voz, com opção de configuração administrativa para ativar o TTS local.

## Usabilidade

• RNF08: Um novo usuário deve conseguir realizar sua primeira reserva em até 5 minutos sem treinamento prévio, validado por cenário controlado com usuário real ou simulado.

## Manutenção

• RNF09: O código deve seguir padrões TypeScript e ser coberto por testes unitários nos módulos críticos: autenticação, fluxo de reservas, validação de conflitos e integração com o assistente de IA.

## Portabilidade

• RNF10: O banco de dados deve suportar migração de SQLite para PostgreSQL sem alteração no código de negócio. A camada de domínio não deve depender de SQL específico de cada SGBD; o Prisma ORM é utilizado para abstrair essa camada. Atenção especial é necessária para diferenças em constraints temporais e operações de lock entre os dois SGBDs. A portabilidade será verificada por meio de migrations Prisma e testes de integração executados em SQLite (protótipo) e previstos para PostgreSQL (evolução).

## Privacidade

• RNF11: Inferência LLM, pipeline RAG, embeddings e ASR (Whisper) são executados localmente --- nenhum dado de usuário é enviado a servidores externos nessas operações. TTS (Web Speech API no Chrome) é a única exceção declarada: pode enviar texto sintetizado (não áudio capturado) ao serviço do navegador. Em ambientes com exigência estrita de privacidade, o TTS local deve ser ativado. O usuário deve ser informado sobre essa exceção durante o uso. Matriz de fluxo de dados: prompts e histórico de chat são processados e armazenados localmente; áudio capturado é transcrito localmente pelo Whisper e descartado; documentos institucionais são convertidos e indexados localmente (embeddings armazenados em arquivo JSON ou SQLite local); logs de reservas e dados de usuários são armazenados no banco de dados local; apenas texto sintetizado pelo TTS via Web Speech API pode trafegar externamente.

## Disponibilidade

• RNF12: O sistema deve estar disponível durante todo o horário de funcionamento do laboratório, em ambiente controlado, exceto em janelas de manutenção programada comunicadas com antecedência. Para este protótipo acadêmico, não há garantia formal de alta disponibilidade; o monitoramento e as janelas de manutenção são de responsabilidade do administrador local.

# Restrições e premissas

ADICIONAR TEXTO

## Restrições Técnicas

• O servidor deve rodar em rede local, sem dependência obrigatória de internet para as funcionalidades principais.

• O modelo de IA deve ser executado no servidor local do laboratório; o hardware determina o tempo de resposta.

• Hardware mínimo funcional (protótipo validado): CPU quad-core (ex.: Ryzen 5 2400G), 16 GB RAM, sem GPU dedicada, 50 GB de armazenamento livre. Hardware recomendado para desempenho: GPU com 6 GB VRAM. Os resultados de tempo de resposta medidos no estudo de caso referem-se ao hardware mínimo funcional.

• A funcionalidade de TTS utiliza a Web Speech API no Chrome, que pode enviar texto sintetizado a servidores do Google. Esta é uma limitação de privacidade declarada e documentada. Para ambientes com restrição total de saída de dados, deve-se utilizar alternativa local de TTS; o usuário deve ser informado e a alternativa deve ser configurável.

• A entrada de voz (ASR) para o chat e navegação por voz utiliza Whisper local, sem envio de dados externos.

• O sistema não oferece garantias de alta disponibilidade (HA) nesta versão de protótipo.

• Não há integração com sistemas externos de autenticação (ex.: SSO institucional) nesta versão.

## Premissas

• A instituição possui servidor local com recursos computacionais suficientes para hospedar simultaneamente a aplicação Node.js, o banco de dados e o Ollama (ver hardware mínimo em 7.1).

• O sistema não será integrado ao sistema acadêmico da universidade nesta versão.

• Os documentos institucionais do laboratório serão fornecidos em formato digital para alimentar o pipeline RAG.

# STACK TECNOLÓGICO

| **Camada** | **Tecnologia** | **Responsabilidade** |
|----|----|----|
| Frontend | React 19, TypeScript 5.x, Vite 5.x | Interface web, chat, calendário e acessibilidade |
| Backend | Node.js 20 LTS, Express | API, autenticação, regras de negócio e orquestração |
| ORM | Prisma 5.x | Acesso tipado ao banco; abstração para migração SQLite → PostgreSQL |
| Banco | SQLite (protótipo); PostgreSQL (evolução) | Persistência de usuários, recursos e reservas |
| LLM | Llama 3.2 3B via Ollama | Geração de respostas e interpretação conversacional |
| RAG --- Conversão | Docling | Conversão de documentos (PDF, DOCX) e chunking (2.000 caracteres) |
| RAG --- Embeddings | Transformers.js, all-MiniLM-L6-v2 (ONNX) | Embeddings e busca semântica (top-4 fragmentos) |
| RAG --- Vetores | Armazenamento local (arquivo JSON / SQLite) | Índice vetorial dos chunks indexados |
| ASR | Whisper base (local) | Transcrição de comandos de voz (processado localmente, sem envio externo) |
| TTS | Web Speech API ou alternativa local | Feedback por voz (exceção de privacidade declarada em RNF11) |
| Testes | Jest | Testes unitários dos módulos críticos |
| Docs API | Swagger/OpenAPI | Documentação da API REST |
| Ambiente | Linux Ubuntu 22.04 LTS+, Docker (recomendado) | Deploy e replicação do ambiente |

Quadro 2 -- Stack tecnológico do sistema ACADEMAI

# CASOS DE USO

Os casos de uso consolidam as interações entre os perfis de usuário e o sistema, permitindo verificar se os requisitos funcionais estão cobertos por fluxos observáveis. A descrição está organizada em atores, visão geral e casos expandidos para facilitar a rastreabilidade com requisitos e regras de negócio.

## Atores

• Estudante: Aluno matriculado na universidade, com permissão para solicitar reservas que ficam pendentes de aprovação.

• Professor: Docente da universidade que pode realizar reservas automaticamente e aprovar/rejeitar reservas de estudantes.

• Administrador: Responsável pelo laboratório, pode realizar reservas automaticamente, aprova/rejeita reservas pendentes de todos os perfis e gerencia usuários, recursos e documentos institucionais.

• Sistema: Parte automatizada responsável por notificações, validações e aprovações automáticas conforme regras de negócio. Em UML estrito, o sistema seria um componente interno; neste documento, é tratado como ator secundário por conveniência de rastreabilidade, representando as ações automáticas disparadas sem interação humana direta.

• Assistente de IA: Componente interno do sistema (subsistema local autônomo) que responde a dúvidas sobre o laboratório --- dentro do escopo definido --- e solicita reservas via chamadas estruturadas ao backend, com todas as ações validadas e registradas pelo backend.

## Visão Geral dos Casos de Uso

A tabela abaixo apresenta todos os casos de uso com seus atores e requisitos relacionados. Uma matriz completa de rastreabilidade RF × UC × RN é apresentada na Seção 9.4.

| **UC** | **Nome** | **Atores** | **Requisitos** |
|----|----|----|----|
| UC01 | Cadastrar Usuário | Estudante, Professor, Administrador | RF01 |
| UC02 | Autenticar Usuário (Login) | Estudante, Professor, Administrador | RF02, RF03 |
| UC03 | Recuperar Senha | Estudante, Professor, Administrador | RF07 |
| UC04 | Gerenciar Contas de Usuário | Administrador | RF04 |
| UC05 | Gerenciar Recursos do Laboratório | Administrador | RF05 |
| UC06 | Consultar Disponibilidade de Recursos | Estudante, Professor, Administrador | RF06 |
| UC07 | Solicitar Reserva de Recurso | Estudante, Professor, Administrador | RF08--RF13, RF16 |
| UC08 | Aprovar ou Rejeitar Reserva | Professor, Administrador | RF10, RF12, RF14 |
| UC09 | Cancelar Reserva | Estudante, Professor, Administrador | RF15 |
| UC10 | Consultar Histórico de Reservas | Estudante, Professor, Administrador | RF17 |
| UC11 | Interagir com Assistente de IA | Estudante, Professor, Administrador | RF18, RF19, RF22, RF24 |
| UC12 | Realizar Reserva via Chat com IA | Estudante, Professor, Administrador | RF20, RF21, RF23 |
| UC13 | Navegar pelo Sistema por Voz | Estudante, Professor, Administrador | RF22, RF26, RF27 |
| UC14 | Visualizar Painel Administrativo | Administrador | RF30 |
| UC15 | Aprovar Reservas pelo Painel | Administrador, Professor | RF14 |

Quadro 3 -- Visão geral dos casos de uso com atores e requisitos relacionados

## Casos de Uso Expandidos

Texto aqui explicando sobre os casos de uso

### UC01 -- Cadastrar Usuário {#uc01-cadastrar-usuário}

|  |  |
|----|----|
| **Caso de Uso** | UC01 -- Cadastrar Usuário |
| **Atores** | Estudante, Professor, Administrador |
| **Requisitos relacionados** | RF01 |
| **Pré-condições** | Nenhum usuário autenticado; página de cadastro acessível publicamente. |
| **Pós-condições** | Conta criada com status ativo e perfil definido; usuário redirecionado para a tela de login. |
| **Fluxo principal** | 1\. O usuário acessa a página de cadastro. 2. O sistema exibe o formulário com os campos: nome, e-mail institucional, senha e perfil (apenas Estudante no cadastro público). 3. O usuário preenche os dados e confirma o cadastro. 4. O sistema valida os dados (formato de e-mail, política de senha, unicidade do e-mail). 5. O sistema cria a conta e redireciona o usuário para a tela de login. |
| **Fluxos alternativos** | 4a. E-mail já cadastrado: o sistema exibe mensagem de erro. 4b. Dados inválidos: o sistema informa os campos incorretos e solicita correção. |
| **Fluxos de exceção** | 4c. Falha na conexão com o banco de dados: o sistema exibe mensagem de erro genérica e solicita nova tentativa. |

Quadro 4 -- Caso de uso UC01: Cadastrar Usuário

### UC02 -- Autenticar Usuário (Login) {#uc02-autenticar-usuário-login}

|  |  |
|----|----|
| **Caso de Uso** | UC02 -- Autenticar Usuário (Login) |
| **Atores** | Estudante, Professor, Administrador |
| **Requisitos relacionados** | RF02, RF03 |
| **Pré-condições** | Usuário cadastrado com conta ativa no sistema. |
| **Pós-condições** | Sessão iniciada com access token JWT (15 min) e refresh token rotacionado (7 dias); usuário redirecionado para tela principal conforme perfil. |
| **Fluxo principal** | 1\. O usuário acessa a página de login. 2. O sistema exibe os campos de e-mail e senha. 3. O usuário insere os dados e confirma. 4. O sistema verifica as credenciais e gera access token JWT (15 min) e refresh token rotacionado (7 dias). 5. O sistema redireciona o usuário para a tela principal de acordo com seu perfil. |
| **Fluxos alternativos** | 4a. Credenciais inválidas: o sistema exibe mensagem de erro. 4b. Access token expirado durante sessão ativa: o sistema renova silenciosamente via refresh token sem interromper a sessão. |
| **Fluxos de exceção** | 4c. Refresh token expirado ou inválido: o sistema encerra a sessão e redireciona para login. |

Quadro 5 -- Caso de uso UC02: Autenticar Usuário (Login)

### UC03 -- Recuperar Senha {#uc03-recuperar-senha}

|  |  |
|----|----|
| **Caso de Uso** | UC03 -- Recuperar Senha |
| **Atores** | Estudante, Professor, Administrador |
| **Requisitos relacionados** | RF07 |
| **Pré-condições** | Usuário possui e-mail cadastrado no sistema. |
| **Pós-condições** | Senha atualizada com sucesso; usuário pode autenticar com a nova senha. |
| **Fluxo principal** | 1\. O usuário acessa a página de recuperação de senha. 2. O sistema exibe campo para informar o e-mail cadastrado. 3. O usuário informa o e-mail e confirma. 4a. Com servidor de e-mail local disponível: o sistema envia link de redefinição. 4b. Sem servidor de e-mail: o administrador pode redefinir a senha do usuário com registro em log de auditoria. 5. O usuário acessa o link e define nova senha. 6. O sistema valida e atualiza a senha. |
| **Fluxos alternativos** | 4a-alt. E-mail não encontrado: o sistema exibe mensagem de erro. 5a. Link expirado: o sistema informa e oferece nova solicitação. |
| **Fluxos de exceção** | 4c. Falha no envio de e-mail: o sistema exibe mensagem de erro e solicita nova tentativa. |

Quadro 6 -- Caso de uso UC03: Recuperar Senha

### UC04 -- Gerenciar Contas de Usuário {#uc04-gerenciar-contas-de-usuário}

|  |  |
|----|----|
| **Caso de Uso** | UC04 -- Gerenciar Contas de Usuário |
| **Atores** | Administrador |
| **Requisitos relacionados** | RF04 |
| **Pré-condições** | Administrador autenticado com token JWT válido. |
| **Pós-condições** | Conta de usuário atualizada (editada, ativada ou desativada) conforme a ação selecionada. |
| **Fluxo principal** | 1\. O administrador acessa o painel administrativo. 2. O sistema lista todos os usuários cadastrados. 3. O administrador seleciona um usuário e escolhe a ação: editar, ativar, desativar ou alterar perfil. 4. O sistema exibe o formulário correspondente à ação. 5. O administrador confirma a operação. 6. O sistema aplica a alteração e exibe confirmação. |
| **Fluxos alternativos** | 3a. Administrador busca usuário por nome ou e-mail antes de selecionar. |
| **Fluxos de exceção** | 5a. Tentativa de desativar o único administrador ativo: o sistema bloqueia a operação e exibe mensagem de erro. |

Quadro 7 -- Caso de uso UC04: Gerenciar Contas de Usuário

### UC05 -- Gerenciar Recursos do Laboratório {#uc05-gerenciar-recursos-do-laboratório}

|  |  |
|----|----|
| **Caso de Uso** | UC05 -- Gerenciar Recursos do Laboratório |
| **Atores** | Administrador |
| **Requisitos relacionados** | RF05 |
| **Pré-condições** | Administrador autenticado com token JWT válido. |
| **Pós-condições** | Recurso cadastrado, editado ou desativado; lista de recursos atualizada no sistema. |
| **Fluxo principal** | 1\. O administrador acessa a área de gestão de recursos. 2. O sistema lista os recursos disponíveis. 3. O administrador escolhe a ação: cadastrar, editar ou desativar recurso. 4. O sistema exibe o formulário correspondente. 5. O administrador preenche os dados e confirma. 6. O sistema salva as alterações e atualiza a lista de recursos. |
| **Fluxos alternativos** | 3a. Editar: o sistema preenche o formulário com os dados atuais do recurso. |
| **Fluxos de exceção** | 5a. Tentativa de exclusão física de recurso com reservas ativas: o sistema bloqueia e oferece a opção de desativar o recurso. |

Quadro 8 -- Caso de uso UC05: Gerenciar Recursos do Laboratório

### UC06 -- Consultar Disponibilidade de Recursos {#uc06-consultar-disponibilidade-de-recursos}

|  |  |
|----|----|
| **Caso de Uso** | UC06 -- Consultar Disponibilidade de Recursos |
| **Atores** | Estudante, Professor, Administrador |
| **Requisitos relacionados** | RF06 |
| **Pré-condições** | Usuário autenticado; ao menos um recurso ativo cadastrado no sistema. |
| **Pós-condições** | Usuário visualiza os horários livres e ocupados do recurso selecionado. |
| **Fluxo principal** | 1\. O usuário acessa a tela de calendário de disponibilidade. 2. O sistema exibe o calendário com os recursos e seus status (atualizado periodicamente por polling ou WebSocket). 3. O usuário seleciona um recurso e um período para verificar disponibilidade. 4. O sistema destaca os horários livres e ocupados. |
| **Fluxos alternativos** | 3a. O usuário filtra por tipo de recurso. |
| **Fluxos de exceção** | 2a. Falha ao carregar os dados: o sistema exibe mensagem de erro e oferece opção de recarregar. |

Quadro 9 -- Caso de uso UC06: Consultar Disponibilidade de Recursos

### UC07 -- Solicitar Reserva de Recurso {#uc07-solicitar-reserva-de-recurso}

|  |  |
|----|----|
| **Caso de Uso** | UC07 -- Solicitar Reserva de Recurso |
| **Atores** | Estudante, Professor, Administrador |
| **Requisitos relacionados** | RF08, RF09, RF10, RF11, RF12, RF13, RF16 |
| **Pré-condições** | Usuário autenticado; recurso ativo cadastrado; horário dentro das regras configuradas (antecedência mínima, duração mínima/máxima e limite de reservas ativas). |
| **Pós-condições** | Reserva criada com status correspondente ao perfil (APROVADA para professor/administrador ou PENDENTE para estudante), ou solicitação bloqueada por regra de negócio. |
| **Fluxo principal** | 1\. O usuário acessa a tela de nova reserva. 2. O sistema exibe os campos: recurso, data, horário de início, horário de término e finalidade. 3. O usuário preenche os dados e confirma a solicitação. 4. O sistema valida os campos obrigatórios e as regras configuradas (antecedência, duração, limite ativo). 5. O sistema verifica conflito de horário no backend com transação e índice explícito. 6. Se professor ou administrador: registra como APROVADA (automático). 7. Se estudante: registra como PENDENTE. 8. O sistema notifica o solicitante sobre o status. 9. Se PENDENTE: o sistema notifica professores e administradores. |
| **Fluxos alternativos** | 3a. O usuário inicia a reserva pelo assistente de IA (UC12). 5a. Conflito de horário: o sistema bloqueia e sugere horários alternativos (calculados pelo backend). |
| **Fluxos de exceção** | 4e. Dados inválidos: o sistema informa o campo inconsistente. 5e. Falha na consulta de disponibilidade: o sistema informa indisponibilidade temporária e não registra a reserva. |

Quadro 10 -- Caso de uso UC07: Solicitar Reserva de Recurso

### UC08 -- Aprovar ou Rejeitar Reserva {#uc08-aprovar-ou-rejeitar-reserva}

|  |  |
|----|----|
| **Caso de Uso** | UC08 -- Aprovar ou Rejeitar Reserva |
| **Atores** | Professor, Administrador |
| **Requisitos relacionados** | RF10, RF12, RF14 |
| **Pré-condições** | Usuário autenticado como professor ou administrador; ao menos uma reserva com status PENDENTE. |
| **Pós-condições** | Reserva com status atualizado para APROVADA ou REJEITADA; solicitante notificado com justificativa em caso de rejeição. |
| **Fluxo principal** | 1\. O professor ou administrador acessa a lista de reservas pendentes. 2. O sistema exibe as reservas aguardando aprovação com dados do solicitante, recurso e período. 3. O usuário seleciona uma reserva e escolhe aprovar ou rejeitar. 4. Se rejeitar: o sistema solicita justificativa (obrigatória). 5. O usuário confirma a ação. 6. O sistema atualiza o status da reserva. 7. O sistema notifica o solicitante; se rejeitada, inclui a justificativa. |
| **Fluxos alternativos** | 3a. Administrador pode aprovar ou rejeitar reservas de qualquer perfil. 3b. Professor pode aprovar ou rejeitar apenas reservas de estudantes (conforme escopo definido pelo administrador). |
| **Fluxos de exceção** | 5a. Reserva já aprovada ou rejeitada por outro avaliador: o sistema exibe aviso e impede ação duplicada. |

Quadro 11 -- Caso de uso UC08: Aprovar ou Rejeitar Reserva

### UC09 -- Cancelar Reserva {#uc09-cancelar-reserva}

|  |  |
|----|----|
| **Caso de Uso** | UC09 -- Cancelar Reserva |
| **Atores** | Estudante, Professor, Administrador |
| **Requisitos relacionados** | RF15 |
| **Pré-condições** | Usuário autenticado; reserva com status PENDENTE ou APROVADA associada ao usuário; cancelamento dentro da antecedência mínima configurável. |
| **Pós-condições** | Status da reserva atualizado para CANCELADA; horário liberado no calendário. |
| **Fluxo principal** | 1\. O usuário acessa o histórico de suas reservas. 2. O sistema exibe as reservas com seus respectivos status. 3. O usuário seleciona a reserva com status PENDENTE ou APROVADA e aciona o cancelamento. 4. O sistema solicita confirmação. 5. O usuário confirma o cancelamento. 6. O sistema atualiza o status para CANCELADA e libera o horário. |
| **Fluxos alternativos** | --- |
| **Fluxos de exceção** | 3a. Reserva com status REJEITADA ou CANCELADA: o sistema não exibe a opção de cancelar. |

Quadro 12 -- Caso de uso UC09: Cancelar Reserva

### UC10 -- Consultar Histórico de Reservas {#uc10-consultar-histórico-de-reservas}

|  |  |
|----|----|
| **Caso de Uso** | UC10 -- Consultar Histórico de Reservas |
| **Atores** | Estudante, Professor, Administrador |
| **Requisitos relacionados** | RF17 |
| **Pré-condições** | Usuário autenticado. |
| **Pós-condições** | Usuário visualiza a lista de reservas filtrada conforme critérios selecionados. |
| **Fluxo principal** | 1\. O usuário acessa a tela de histórico de reservas. 2. O sistema exibe a lista completa de reservas do usuário com status, recurso, data e período. 3. O usuário pode filtrar por status, data ou recurso. |
| **Fluxos alternativos** | 2a. Administrador pode visualizar o histórico de todos os usuários e recursos. |
| **Fluxos de exceção** | --- |

Quadro 13 -- Caso de uso UC10: Consultar Histórico de Reservas

### UC11 -- Interagir com Assistente de IA {#uc11-interagir-com-assistente-de-ia}

|  |  |
|----|----|
| **Caso de Uso** | UC11 -- Interagir com Assistente de IA |
| **Atores** | Estudante, Professor, Administrador |
| **Requisitos relacionados** | RF18, RF19, RF22, RF24 |
| **Pré-condições** | Usuário autenticado; modelo de IA disponível localmente; documentos institucionais indexados no pipeline RAG. |
| **Pós-condições** | Resposta exibida ao usuário com base nos documentos institucionais e com indicação obrigatória da fonte quando aplicável; nenhuma ação é executada sem validação pelo backend. |
| **Fluxo principal** | 1\. O usuário acessa o chat do assistente de IA. 2. O sistema exibe a interface de chat. 3. O usuário digita ou fala uma pergunta sobre o laboratório. 4. O assistente processa a consulta usando RAG (top-4 fragmentos por similaridade). 5. O assistente retorna a resposta com indicação da fonte consultada (obrigatória quando baseada em documento recuperado). Se não houver fonte, declara ausência de base documental. |
| **Fluxos alternativos** | 3a. Entrada de voz: o sistema converte áudio em texto via Whisper local e encaminha ao assistente. 3b. Usuário solicita reserva via chat: o sistema executa UC12. |
| **Fluxos de exceção** | 4a. Modelo de IA indisponível: o sistema exibe mensagem informando que o assistente está temporariamente fora do ar. 4b. Resposta demorada: o sistema exibe indicador de carregamento. |

Quadro 14 -- Caso de uso UC11: Interagir com Assistente de IA

### UC12 -- Realizar Reserva via Chat com IA {#uc12-realizar-reserva-via-chat-com-ia}

|  |  |
|----|----|
| **Caso de Uso** | UC12 -- Realizar Reserva via Chat com IA |
| **Atores** | Estudante, Professor, Administrador |
| **Requisitos relacionados** | RF20, RF21, RF23 |
| **Pré-condições** | Usuário autenticado; modelo de IA disponível localmente; recurso ativo cadastrado. |
| **Pós-condições** | Reserva registrada pelo backend com status correspondente ao perfil (APROVADA ou PENDENTE), após validação de regras de negócio e disponibilidade. |
| **Fluxo principal** | 1\. O usuário solicita ao assistente que faça uma reserva, por texto ou voz. 2. O assistente identifica a intenção e coleta os dados necessários (recurso, data, horário de início, horário de término e finalidade). 3. O assistente consulta a disponibilidade do recurso via backend (não via LLM). 4. O assistente apresenta ao usuário um resumo da reserva para confirmação. 5. O assistente informa se a reserva requer aprovação ou é automática, conforme o perfil do usuário. 6. O usuário confirma os dados. 7. O assistente emite solicitação estruturada (tool call) ao backend, que valida e registra a reserva. 8. O assistente notifica o usuário sobre o status gerado. |
| **Fluxos alternativos** | 3a. Recurso indisponível: o assistente informa a indisponibilidade e apresenta horários alternativos calculados pelo backend (não inventados pelo LLM). 6a. Usuário solicita alteração: o assistente retoma ao passo 2. |
| **Fluxos de exceção** | 7a. Conflito de horário detectado pelo backend: o assistente informa o conflito e cancela a operação. |

Quadro 15 -- Caso de uso UC12: Realizar Reserva via Chat com IA

### UC13 -- Navegar pelo Sistema por Voz {#uc13-navegar-pelo-sistema-por-voz}

|  |  |
|----|----|
| **Caso de Uso** | UC13 -- Navegar pelo Sistema por Voz |
| **Atores** | Estudante, Professor, Administrador |
| **Requisitos relacionados** | RF22, RF26, RF27 |
| **Pré-condições** | Usuário autenticado; microfone disponível com permissão concedida; navegador compatível com captura de áudio. |
| **Pós-condições** | Sistema navegado ou ação executada conforme o comando de voz reconhecido; feedback de voz (TTS) emitido ao usuário. |
| **Fluxo principal** | 1\. O usuário ativa a navegação por voz no sistema. 2. O sistema inicia a captura de áudio via Whisper local (ASR). 3. O usuário pronuncia o comando desejado. 4. O sistema converte o áudio em texto e interpreta o comando. 5. O sistema navega para a funcionalidade correspondente. Ações críticas (reservar, cancelar, aprovar ou rejeitar) exigem confirmação explícita antes de serem executadas. 6. O sistema emite feedback de voz (TTS) confirmando a ação realizada. |
| **Fluxos alternativos** | 4a. Comando não reconhecido: o sistema emite feedback de voz e solicita que o usuário repita. |
| **Fluxos de exceção** | 2a. Microfone sem permissão: o sistema exibe mensagem solicitando acesso ao microfone e oferece fallback por teclado/leitor de tela. 2b. Falha no processamento de voz: o sistema exibe mensagem de erro e oferece fallback por teclado e leitor de tela. |

Quadro 16 -- Caso de uso UC13: Navegar pelo Sistema por Voz

### UC14 -- Visualizar Painel Administrativo {#uc14-visualizar-painel-administrativo}

|  |  |
|----|----|
| **Caso de Uso** | UC14 -- Visualizar Painel Administrativo |
| **Atores** | Administrador |
| **Requisitos relacionados** | RF30 |
| **Pré-condições** | Usuário autenticado como administrador. |
| **Pós-condições** | Administrador visualiza a visão consolidada das reservas, aprovações pendentes, recursos, usuários e documentos RAG. |
| **Fluxo principal** | 1\. O administrador acessa o painel administrativo. 2. O sistema exibe: visão geral das reservas do dia/semana, lista de aprovações pendentes, calendário completo, acesso à gestão de usuários, recursos e documentos institucionais. 3. O administrador pode clicar em uma reserva pendente para aprovar ou rejeitar diretamente (UC15). 4. O administrador pode navegar entre dias/semanas no calendário. |
| **Fluxos alternativos** | 3a. O administrador acessa a gestão de usuários, recursos ou documentos RAG a partir do painel. |
| **Fluxos de exceção** | 2a. Falha ao carregar os dados do painel: o sistema exibe mensagem de erro e botão de recarregar. |

Quadro 17 -- Caso de uso UC14: Visualizar Painel Administrativo

### UC15 -- Aprovar Reservas pelo Painel {#uc15-aprovar-reservas-pelo-painel}

|  |  |
|----|----|
| **Caso de Uso** | UC15 -- Aprovar Reservas pelo Painel |
| **Atores** | Administrador, Professor |
| **Requisitos relacionados** | RF14 |
| **Pré-condições** | Usuário autenticado como administrador ou professor; ao menos uma reserva com status PENDENTE visível no painel. |
| **Pós-condições** | Reserva com status atualizado para APROVADA ou REJEITADA; solicitante notificado. |
| **Fluxo principal** | 1\. O administrador ou professor acessa a lista de aprovações pendentes no painel. 2. O usuário seleciona uma reserva e escolhe aprovar ou rejeitar. 3. Segue o fluxo do UC08 a partir do passo 4. |
| **Fluxos alternativos** | --- |
| **Fluxos de exceção** | 2a. Reserva já processada por outro avaliador: o sistema exibe aviso e impede ação duplicada. |

Quadro 18 -- Caso de uso UC15: Aprovar Reservas pelo Painel

## Matriz de Rastreabilidade RF x UC x RN

A tabela abaixo apresenta a rastreabilidade entre requisitos funcionais críticos, casos de uso e regras de negócio. Por questão de objetividade, são listados apenas os requisitos de maior impacto no sistema; os demais requisitos funcionais são rastreáveis individualmente nas descrições de cada caso de uso e regra de negócio correspondentes.

| **RF** | **Descrição resumida** | **UC relacionados** | **RN relacionadas** |
|----|----|----|----|
| RF01 | Cadastro com perfil Estudante público; Professor/Admin por admin | UC01 | RN08 |
| RF02/RF03 | Autenticação JWT + RBAC | UC02 | RN08 |
| RF08/RF09 | Solicitação de reserva com campos obrigatórios e status | UC07, UC12 | RN01, RN03 |
| RF10/RF11 | Aprovação automática (prof/admin) vs. pendente (estudante) | UC07, UC08, UC15 | RN01, RN02 |
| RF16 | Conflito de horário verificado no backend com transação | UC07, UC12 | RN03 |
| RF19 | RAG com fonte obrigatória quando baseada em documento | UC11 | RN07 |
| RF20 | Tool calling: LLM solicita, backend valida e registra | UC12 | RN07 |
| RF24 | Processamento local; TTS como exceção declarada | UC11, UC13 | RN07 |
| RF26/RF27 | Navegação por voz com fallback por teclado/leitor de tela | UC13 | --- |

Quadro 19 -- Matriz de rastreabilidade RF × UC × RN (requisitos críticos)

# regras de negócio

**RN01 -- Aprovação por Perfil**

• Reservas de estudantes recebem status PENDENTE e necessitam de aprovação manual.

• Reservas de professores e administradores são aprovadas automaticamente pelo sistema (status APROVADA imediato). Esse comportamento deve ser refletido em todos os casos de uso, tabelas e diagramas do documento.

**RN02 -- Fluxo de Aprovação**

• Professores aprovam reservas pendentes de estudantes, dentro do escopo definido pelo administrador.

• Administradores aprovam reservas pendentes de todos os perfis.

• Um avaliador não pode duplicar a decisão de outro sobre a mesma reserva.

• A justificativa é obrigatória para rejeição e opcional para aprovação.

**RN03 -- Conflito de Horário**

• O sistema impede duas reservas ativas (status PENDENTE ou APROVADA) para o mesmo recurso no mesmo período. Conflito é definido como sobreposição temporal dos intervalos \[início, fim). A verificação ocorre no backend com transação e índice explícito na camada de serviço; em SQLite, constraints temporais complexas exigem validação explícita, pois não há suporte nativo a exclusão de intervalo.

• Justificativa para bloquear status PENDENTE no conflito: reservas pendentes reservam o slot para evitar sobreposição. Caso haja preocupação com subutilização por pendências não avaliadas, o administrador pode configurar prazo máximo de decisão.

**RN04 -- Cancelamento**

• Usuários só podem cancelar reservas com status PENDENTE ou APROVADA.

• Reservas com status REJEITADA ou CANCELADA não exibem opção de cancelamento.

• O cancelamento deve ser realizado com antecedência mínima configurável pelo administrador.

**RN05 -- Desativação de Administrador**

• O sistema impede a desativação do único administrador ativo.

**RN06 -- Remoção de Recurso**

• Recursos com reservas ativas (status PENDENTE ou APROVADA) não podem ser removidos fisicamente. O sistema deve oferecer a opção de desativação.

**RN07 -- Privacidade e Dados**

• Inferência LLM, pipeline RAG, embeddings e ASR (Whisper) são locais. TTS pode usar mecanismo do navegador (Web Speech API) e é tratado como exceção configurável, com alternativa local disponível. O usuário deve ser informado sobre essa exceção.

• O assistente de IA confirma os dados da reserva com o usuário antes de submetê-la ao backend.

• O assistente não acessa nem manipula o banco de dados diretamente; todas as ações são mediadas pelo backend via chamadas estruturadas (tool calling).

• Sugestões de horários alternativos devem ser calculadas pelo backend ou por serviço determinístico --- não geradas pelo LLM. O LLM apenas verbaliza o resultado.

**RN08 -- Segurança e Autenticação**

• Access tokens JWT com expiração de 15 minutos; refresh tokens rotacionados com expiração de 7 dias. Esta política é a definitiva e deve ser consistente em todos os fluxos e diagramas.

• Rotas protegidas da API exigem token JWT válido. Rotas públicas explicitamente definidas (login, cadastro, recuperação de senha) são exceções.

• Senhas armazenadas com hash bcrypt (fator mínimo 12) ou Argon2id.

• Perfis Professor e Administrador não são autodeclarados no cadastro público; são atribuídos por administrador, evitando elevação indevida de privilégio.

# DIAGRAMA DO MODELO CONCEITUAL

A Figura 1 apresenta o modelo conceitual do ACADEMAI, representando as entidades do domínio e seus relacionamentos. O modelo está organizado em dois domínios principais: domínio de reservas (Usuário, Perfil, Recurso, Reserva e Notificação) e domínio RAG (DocumentoInstitucional, Chunk, Embedding, FonteConsultada e SolicitaçãoEstruturada). As cardinalidades expressam que um usuário pode realizar múltiplas reservas, cada reserva refere-se a um único recurso, e toda resposta fundamentada em documento recuperado apresenta obrigatoriamente a fonte consultada. O LLM não persiste dados diretamente; todas as operações de escrita são mediadas pelo backend via chamadas estruturadas.

<figure>
<img src="media/image1.png" style="width:6.29931in;height:6.78611in" />
<figcaption><p>Figura 1 – Modelo conceitual do ACADEMAI com domínios de reservas e RAG</p></figcaption>
</figure>

# DIAGRAMA DE OBJETOS

A Figura 2 ilustra o diagrama de objetos do ACADEMAI com instâncias concretas de uma situação de uso. O exemplo mostra um professor com reserva aprovada automaticamente e um estudante com solicitação estruturada pendente de validação pelo backend. O diagrama evidencia que a SolicitaçãoEstruturada é emitida pelo LLM, processada e validada pelo backend, e somente então dá origem a uma Reserva

<figure>
<img src="media/image2.png" style="width:6.29931in;height:8.31458in" />
<figcaption><p>Figura 2 – Diagrama de objetos: instâncias de reserva e solicitação estruturada via LLM</p></figcaption>
</figure>

# DIAGRAMA DE SEQUÊNCIA

DS01- Cadastro de Usuário

<figure>
<img src="media/image3.png" style="width:6.29931in;height:4.16319in" />
<figcaption><p>Figura 3 – Diagrama de sequência para cadastro de usuário</p></figcaption>
</figure>

DS02- Login e Autenticação JWT

![](media/image4.png){width="6.299305555555556in" height="8.750694444444445in"}

Figura 4 -- Diagrama de sequência de login e autenticação via JWT

DS03 -- Reserva de equipamento

<figure>
<img src="media/image5.png" style="width:6.29931in;height:5.09375in" />
<figcaption><p>Figura 5 – Diagrama de sequência de reservas de equipamentos</p></figcaption>
</figure>

DS04 -- Aprovação e cancelamento de reservas

<figure>
<img src="media/image6.png" style="width:6.29931in;height:5.85347in" />
<figcaption><p>Figura 6 – Diagrama de sequência de aprovação e cancelamento de reservas</p></figcaption>
</figure>

# REFERÊNCIAS

AUER, C. et al. Docling: an efficient open-source toolkit for AI-driven document conversion. In: **AAAI Conference on Artificial Intelligence**, 2025. Disponível em: https://arxiv.org/abs/2501.17887. Acesso em: 3 maio 2026.

FERNANDES, A.; ANDRADE, F.; AMORIM, J.; MANEIRA, M. **AcademAI**. GitHub, 2026. Disponível em: https://github.com/fabriciosuzart/academai. Acesso em: 16 maio 2026.

GAO, Y. et al. **Retrieval-augmented generation for large language models: a survey**. arXiv, 2024. Disponível em: https://arxiv.org/abs/2312.10997. Acesso em: 3 maio 2026.

HAUCK, K. et al. Inclusive education with AI: supporting special needs and tackling language barriers. **AI and Ethics**, v. 5, p. 5729-5757, 2025. Disponível em: https://link.springer.com/article/10.1007/s43681-025-00824-3. Acesso em: 2 maio 2026.

IZOURANE, F. et al. Smart campus based on AI and IoT in the era of Industry 5.0: challenges and opportunities. In: CHAKIR, A.; BANSAL, R.; AZZOUAZI, M. (eds.). **Industry 5.0 and Emerging Technologies**. Studies in Systems, Decision and Control, vol. 565. Springer, Cham, 2024. Disponível em: https://doi.org/10.1007/978-3-031-70996-8_3. Acesso em: 2 maio 2026.

LEWIS, P. et al. Retrieval-augmented generation for knowledge-intensive NLP tasks. In: **Advances in Neural Information Processing Systems**, v. 33, p. 9459-9474, 2020. Disponível em: https://arxiv.org/abs/2005.11401. Acesso em: 3 maio 2026.

META LLAMA. **\[Model card do Llama 3.2\]**. GitHub, 2024. Disponível em: https://github.com/meta-llama/llama-models/blob/0e0b8c519242d5833d8c11bffc1232b77ad7f301/models/llama3_2/MODEL_CARD.md. Acesso em: 16 maio 2026.

MODEL CONTEXT PROTOCOL. **What is the Model Context Protocol (MCP)?** 2026. Disponível em: https://modelcontextprotocol.io/docs/getting-started/intro. Acesso em: 16 maio 2026.

OLLAMA. **Tool calling**. 2025. Disponível em: https://docs.ollama.com/capabilities/tool-calling. Acesso em: 16 maio 2026.

RADFORD, A. et al. Robust speech recognition via large-scale weak supervision. In: **International Conference on Machine Learning**, p. 28492-28518, 2023. Disponível em: https://proceedings.mlr.press/v202/radford23a.html. Acesso em: 3 maio 2026.

VASWANI, A. et al. Attention is all you need. In: **Advances in Neural Information Processing Systems**, v. 30, p. 5998-6008, 2017. Disponível em: https://arxiv.org/abs/1706.03762. Acesso em: 3 maio 2026.

WADA, A. et al. Retrieval-augmented generation elevates local LLM quality in radiology contrast media consultation. **npj Digital Medicine**, v. 8, n. 395, 2025. Disponível em: https://doi.org/10.1038/s41746-025-01802-z. Acesso em: 3 maio 2026.

JAMES, W. et al. Barriers to physics identity development for students with disabilities. In: **Physics Education Research Conference Proceedings**, 2019, Provo. Proceedings\... College Park: American Association of Physics Teachers, 2019. p. 229-234. Disponível em: https://doi.org/10.1119/perc.2019.pr.James. Acesso em: 7 jun. 2026.
