# Como Executar o projeto

## Pré-requisitos

- **Node.js 22 LTS ou 24.** Confira com `node -v` — precisa mostrar `v22.x` ou `v24.x` (as medições do TCC usaram o `v24.19.0`). O projeto não instala em versões antigas: o Prisma exige Node 18.18+ e o Vite 7 exige 20.19+. Em Node 16 o `npm install` falha com "Prisma only supports Node.js >= 18.18".
- **Máquina:** mínimo de **8 GB de RAM**, CPU de 4 núcleos, sem GPU dedicada (testado em Apple M1 8 GB). As medições do TCC foram feitas em Ryzen 5 4600G, 32 GB, Windows 11. Com GPU de 6 GB de VRAM o assistente responde mais rápido.
- **Ollama**, para o assistente de IA responder. Instale em https://ollama.com/download e baixe o modelo com `ollama pull llama3.2`. Sem ele o chat devolve "Erro ao processar consulta.".

Para iniciar o projeto e testar tudo localmente, você precisará abrir **dois terminais** (um para o servidor/backend e outro para a interface/frontend).

Siga os passos abaixo:

## Passo 1: Iniciar o Banco de Dados e Servidor (Backend)
O Backend gerencia os agendamentos, usuários e a conexão com a Inteligência Artificial.

1. Abra um terminal e navegue até a pasta do backend:
   ```bash
   cd backend
   ```
2. Instale as dependências (se for a primeira vez):
   ```bash
   npm install
   ```
3. Crie o banco e popule com os cadastros (usuários e equipamentos):
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   npx prisma db seed
   ```
   *Use `migrate deploy`, e não `db push`: o projeto tem migrations versionadas, e o `db push` sincroniza o schema por fora delas.*
   *O `generate` não é opcional: sem ele o cliente do Prisma fica com o schema antigo e grava no lugar errado, sem dar erro.*
   *O seed também copia as imagens de `seed-assets/` para `uploads/` — sem isso a página de equipamentos aparece sem foto.*

   > O banco chama-se `academai.db`. Se você tem um `inovfablab.db` de antes do rename, pode apagá-lo.
4. Inicie o servidor:
   ```bash
   node server.js
   ```
*O servidor ficará rodando (provavelmente na porta 3000).*

---

### Executando Testes de Qualidade (Backend)
Se desejar rodar os testes da API ou formatar o código:
- Rodar os Testes (Jest + Supertest): `npm test` *(mantenha o `node server.js` rodando em outro terminal)*
- Checar erros de código (ESLint): `npm run lint`
- Formatar código (Prettier): `npm run format`

## Passo 2: Iniciar o Site (Frontend - React)
O Frontend é a interface visual onde você irá navegar, acessar o perfil e falar com a IA.

1. Abra um **segundo terminal** (mantenha o primeiro aberto rodando o servidor).
2. Garanta que você está na pasta raiz do projeto:
   ```bash
   cd (pasta raiz)
   ```
   *(ou apenas certifique-se de não estar dentro da pasta backend)*
3. Instale as dependências (se for a primeira vez):
   ```bash
   npm install
   ```
4. Inicie o servidor de desenvolvimento do React/Vite:
   ```bash
   npm run dev
   ```
*O sistema vai gerar um link (como `http://localhost:5173/`). Clique nele ou cole no navegador para acessar o site.*

---

## Passo 3: A base de conhecimento da IA (opcional)

A assistente responde com base em documentos, não em conhecimento próprio. Sem
documento nenhum ela não tem o que dizer sobre o laboratório.

O projeto já vem com uma **base inicial versionada** em `backend/documents/` —
sobre o laboratório, regras de uso, equipamentos e como agendar. Ela é lida
automaticamente quando o backend sobe, sem instalar nada além do que o
`npm install` já traz.

Para **enviar novos documentos** pela interface, entre como administrador e vá
em **Perfil → Treinamento IA**. Lá dá para subir arquivos, ver o que já está
indexado e remover o que não vale mais.

Formatos aceitos: **PDF, DOCX, MD e TXT**.

> **PDF e DOCX exigem Python + Docling.** A conversão desses dois formatos é
> feita pelo `backend/converter.py`. Se você só for usar `.md` e `.txt`, pode
> pular esta instalação.
>
> ```bash
> pip install "docling[easyocr]"
> ```
>
> O `[easyocr]` instala o OCR que lê português em PDFs digitalizados; sem ele
> o Docling usa o motor de OCR que tiver disponível. Na primeira conversão o
> Docling baixa seus modelos (precisa de internet uma vez).
>
> Sem o Docling, o upload de PDF ou DOCX é recusado com "Docling não
> instalado"; MD e TXT continuam funcionando.

**O que acontece em cada upload**

- Formatos aceitos: PDF, DOCX, MD e TXT, até 50 MB. Outros formatos são recusados.
- PDF e DOCX passam pelo Docling (`backend/converter.py`): OCR em páginas
  digitalizadas, tabelas viram tabelas em Markdown, imagens viram o marcador
  `<!-- image -->` (não são descritas).
- Documento com falha de conversão, conversão parcial ou sem texto é
  **recusado e não é indexado** — nada fica em `documents/` nem em `uploads/`.
- Todo upload, aceito ou recusado, aparece em **Painel → Logs** como
  `INGESTAO_OK` ou `INGESTAO_FALHA`, com páginas, tabelas, fragmentos, tempo e motivo.

Na primeira vez que o backend sobe, ele baixa o modelo de embeddings
(`Xenova/all-MiniLM-L6-v2`, cerca de 90 MB) e vetoriza os documentos. Isso leva
alguns minutos e **exige internet**. Depois disso o resultado fica em
`backend/vector_cache.json` e as próximas inicializações são imediatas.

---

## Backup

O `npm run backup` (dentro de `backend/`) copia o banco, o índice do RAG
(`vector_cache.json`) e o acervo (`documents/`). O banco é copiado com
`VACUUM INTO`, que gera uma cópia consistente mesmo com o servidor rodando.

- Uma cópia por dia em `academai-backups/diario` (na pasta do usuário), mantendo as **7** mais recentes.
- A primeira cópia de cada semana também vai para `academai-backups/semanal`, mantendo as **4** mais recentes.
- Com `--externo <pasta>` (outro disco ou pasta de rede), a cópia semanal também vai para lá.
- Cada cópia tem um `manifest.json` com o SHA-256 dos arquivos e o resultado do `PRAGMA integrity_check`.

```bash
npm run backup
npm run backup -- --destino D:\academai-backups --externo \\servidor\backups\academai
```

**Agendar todo dia (Windows):** Agendador de Tarefas → Criar Tarefa Básica →
Diariamente, 23:00 → Iniciar um programa: `cmd`, argumentos
`/c cd /d C:\caminho\AcademAI\backend && npm run backup >> backup.log 2>&1`.

**Agendar todo dia (Linux/macOS):** `crontab -e` e adicione
`0 23 * * * cd /caminho/AcademAI/backend && npm run backup >> backup.log 2>&1`.

**Restaurar:** pare o `node server.js`, copie `academai.db` da pasta da cópia
para `backend/prisma/`, `vector_cache.json` para `backend/` e a pasta
`documents/` para `backend/documents/`, e suba o servidor de novo.

## Medições para o TCC

Rode dentro de `backend/`, na máquina em que as medições serão relatadas. Os
relatórios ficam em `docs/medicoes/` (JSON e Markdown).

| Comando | O que mede | Precisa de |
|---|---|---|
| `npm run medir` | Ingestão: formatos, páginas, tempo do Docling, fragmentos, tempo de indexação, tamanho dos embeddings, memória | modelo de embeddings (baixa sozinho) |
| `npm run simular-chunk` | Compara tamanhos de fragmento (500 a 3.000 caracteres) com as perguntas de `scripts/perguntas-chunk.json` | modelo de embeddings |
| `npm run carga-chat` | Tempo de resposta do chat com 1, 2, 4 e 8 perguntas simultâneas | `node server.js` e Ollama rodando |

Para medir PDFs e DOCX reais: `npm run medir -- --pasta C:\pasta\com\documentos`.

### Observações
- **Painel Admin:** Para acessar o painel de administrador, você deve fazer o login com um e-mail de administrador definido no banco de dados. A senha e as permissões são checadas pelo backend. O acesso fica em **Perfil → Painel**, visível para administradores e professores.
- **Inteligência Artificial (IA):** O assistente "Falar com IA" se comunica com o `server.js` do backend, portanto, se o backend não estiver rodando, a IA não irá responder.
- **Microfone:** O reconhecimento de fala (voz) para conversar com a IA funciona melhor no navegador **Google Chrome**.
