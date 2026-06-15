# V-CHAT: Advanced Neural Intelligence Assistant

V-CHAT is a highly advanced, futuristic full-stack AI chatbot application featuring a stunning generative UI sandbox, multi-model execution architecture, persistent semantic memory, and agentic tool integrations. Designed to operate as a personal AI brain, V-CHAT remembers context, parses complex document attachments, and runs both online and offline models to help users think, learn, and build faster.

---

## ✨ Core Features

### 1. 🤖 Multi-Model Execution Engine
Easily switch between different intelligence tiers depending on your environment:
*   **Google Gemini 2.5 Flash (Cloud)**: Lightning-fast cloud reasoning, native multimodal analysis, and tool execution powered by LangChain (`@langchain/google-genai`).
*   **Gemma Local (Ollama)**: Offline LLM processing using a local Ollama server running Gemma 2 (configured as `gemma4` or custom local models). Uses dynamic prompt caching, temperature controls, context length custom scaling, and local GPU/CPU hardware.
*   **Offline Semantic Brain**: A localized, zero-dependency TF-IDF vector space model running local-first. It automatically processes conversation histories, extracts training pairs, and stores knowledge to local databases so you can query questions even when fully disconnected.

### 2. 📂 Advanced RAG & Document Intelligence
Queue, index, and query multiple file attachments simultaneously with real-time text parsing:
*   **PDF Documents**: Structured textual parsing using `pdf-parse`.
*   **Spreadsheets (XLSX, CSV)**: Tabular data conversions to readable CSV context using `xlsx`.
*   **Code & Plain Text**: Full-content file scanning with format-aware syntax rendering.
*   **Images & Vision**: Multi-image multimodal inputs converted to base64 for vision processing.
*   **Smart Document Chunking**: Text is split into overlapping paragraph segments, vectorized, and indexed. Queries retrieve the most relevant sections using vector cosine similarity (or keyless text-matching when offline).

### 3. 🎨 Premium Generative UI Sandbox (Artifacts)
When you ask V-CHAT to build a website, component, or web tool, it generates full-featured, self-contained HTML/CSS/JS applications:
*   **Interactive Simulation Preview**: Dedicated split-screen mode to view live components.
*   **Multi-Device Viewport Toggles**: Simulate and test designs across Desktop, Tablet, and Mobile sizing.
*   **In-App Code Editor**: Adjust HTML/CSS/JS directly with Monaco-style scroll-synced line numbers.
*   **Console Logging Drawer**: View iframe warnings, errors, and standard log messages directly inside the application debugger.

### 4. 🧠 Persistent Memory & Adaptive Response
*   **Self-Learning Memory**: Continuously extracts long-term context (goals, name, interests, tech stacks, projects) and retrieves relevant memories dynamically using vector-space similarity.
*   **Adaptive Response Strategy**: Automatically targets response lengths matching the question's scale (concise answers for simple prompts, structured explanations for complex ones, and minimal summaries for agent actions).
*   **Thought Process Timelines**: Visual step-by-step progress bars showing parsing, vector searches, and tokens generation stages depending on the active model.

### 5. 🛠️ Agentic Tools Integration
Autonomous tools run within the AI's reasoning cycles:
*   **Web Search**: Direct Google Search integration to fetch current, live web data.
*   **Python Sandbox**: Execute complex calculations, script processing, and logic formulas dynamically.

### 6. 🎙️ Voice & Audio Notes
*   **Audio Recording Visualizer**: Record voice notes directly inside the input bar with reactive waveform animation previews.
*   **Speech-to-Text (STT)**: Dictate message prompts using speech recognition.
*   **Text-to-Speech (TTS)**: Clean, natural synthesis audio playback of assistant messages.

---

## 🏗️ Project Architecture

V-CHAT is organized into a full-stack directory layout:
```bash
c:/CHAT ALWAYS/
├── frontend/             # React (Vite) client with Tailwind CSS, Framer Motion, and sandboxed previewers
├── backend/              # Express API with LangChain agents, MongoDB connections, and local JSON database fallbacks
├── ai-router-backend/    # Middleware server proxying requests between Gemini APIs and local Ollama models
└── README.md             # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18+)
*   [MongoDB](https://www.mongodb.com/try/download/community) (Optional: backend automatically falls back to `localDB.json` if MongoDB is offline)
*   [Ollama](https://ollama.com/) (Optional: for running local Gemma models)

---

### Installation & Configuration

#### 1. Setup Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/ai-chatbot
   GEMINI_API_KEY="your_google_gemini_api_key"
   OLLAMA_URL="http://localhost:11434"
   LOCAL_GEMMA_MODEL_NAME="gemma4"
   ```

#### 2. Setup AI Router
1. Navigate to the router directory:
   ```bash
   cd ../ai-router-backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `ai-router-backend/` directory:
   ```env
   PORT=4000
   GEMINI_API_KEY="your_google_gemini_api_key"
   ```

#### 3. Setup Frontend
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install client dependencies:
   ```bash
   npm install
   ```

---

### Running the Services

Start the three primary services to run the full V-CHAT environment:

1.  **Run Backend Server** (starts on port 5000):
    ```bash
    cd backend
    npm run dev
    ```
2.  **Run AI Router Backend** (starts on port 4000):
    ```bash
    cd ai-router-backend
    node server.js
    ```
3.  **Run Frontend Client** (starts on port 5173 / localhost):
    ```bash
    cd frontend
    npm run dev
    ```

---

## 🛠️ Tech Stack & Integrations

*   **Frontend UI/UX**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons, React Markdown, Prism Syntax Highlighter.
*   **Backend & Frameworks**: Node.js, Express, LangChain.js, LangGraph, MongoDB/Mongoose.
*   **AI Models**: Google Gemini 2.5 Flash, Ollama Gemma 2 (Gemma 4), Offline Custom TF-IDF Model.

---

## 👨‍💻 Developed By

Engineered with ❤️ by **k.VISWAS**.
