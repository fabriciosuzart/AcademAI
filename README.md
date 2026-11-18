# AcademAI - Assistente Acadêmico (Frontend)

Repositório da interface web do TCC **AcademAI**, desenvolvido com React, TypeScript e Vite, integrando reconhecimento de voz 100% offline via **Whisper (Transformers.js)** para atender aos requisitos de privacidade e execução estritamente *offline* do projeto acadêmico.

## 🚀 Como Executar o Projeto Localmente

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/fabriciosuzart/academai.git
   cd academai
   ```
   O backend (API, banco, Ollama e RAG) tem o passo a passo em [`INICIA_PROJETO.md`](INICIA_PROJETO.md).

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configuração dos Modelos Offline (Whisper & ONNX):**
   Para garantir o funcionamento sem internet (RNF de operação offline), certifique-se de que os arquivos do modelo e do ONNX Runtime encontram-se nas pastas estáticas corretas:
   * **Binários WASM:** `public/wasm/`
   * **Pesos do Whisper Base:** `public/models/Xenova/whisper-base/`

4. **Endereço do backend (opcional):**
   O front usa `http://localhost:3000` por padrão. Se o backend estiver em outra máquina, copie `.env.example` para `.env.local` e ajuste `VITE_API_URL`.

5. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

## 🛠️ Tecnologias e Arquitetura

* **React 19 + TypeScript + Vite**
* **Transformers.js & ONNX Runtime Web:** Execução local de modelos de Inteligência Artificial diretamente no navegador do cliente.
* **Web Workers:** Isolamento do processamento ASR (*Automatic Speech Recognition*) em background para evitar travamentos da interface principal.
* **Lucide React:** Sistema de ícones.

## 👥 Equipe / Autoria

* **Desenvolvedor:** Fabricio Suzart Andrade (Universidade Santa Cecília - Unisanta
