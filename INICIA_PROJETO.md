# Como Executar o projeto

## Pré-requisitos

- **Node.js 22 LTS.** Confira com `node -v` — precisa mostrar `v22.x`. O projeto não instala em versões antigas: o Prisma exige Node 18.18+ e o Vite 7 exige 20.19+. Em Node 16 o `npm install` falha com "Prisma only supports Node.js >= 18.18".
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
> pip install docling
> ```
>
> Sem o Docling, o upload de PDF ou DOCX falha com "Falha ao processar
> documento"; os demais formatos continuam funcionando.

Na primeira vez que o backend sobe, ele baixa o modelo de embeddings
(`Xenova/all-MiniLM-L6-v2`, cerca de 90 MB) e vetoriza os documentos. Isso leva
alguns minutos e **exige internet**. Depois disso o resultado fica em
`backend/vector_cache.json` e as próximas inicializações são imediatas.

---

### Observações
- **Painel Admin:** Para acessar o painel de administrador, você deve fazer o login com um e-mail de administrador definido no banco de dados. A senha e as permissões são checadas pelo backend. O acesso fica em **Perfil → Painel**, visível para administradores e professores.
- **Inteligência Artificial (IA):** O assistente "Falar com IA" se comunica com o `server.js` do backend, portanto, se o backend não estiver rodando, a IA não irá responder.
- **Microfone:** O reconhecimento de fala (voz) para conversar com a IA funciona melhor no navegador **Google Chrome**.
