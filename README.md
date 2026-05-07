# V-CHAT: Advanced Neural Intelligence Assistant

V-CHAT is a highly advanced, futuristic AI chatbot application featuring a stunning generative UI, multi-model support, persistent memory, and agentic capabilities. Developed with a modern tech stack, V-CHAT is designed to act as a personal AI brain that remembers, understands files, and helps users think, learn, and build faster.

## ✨ Core Features

*   **Multi-Model Integration**: Seamlessly switch between top-tier AI models based on your needs:
    *   **Google Gemini 2.5 Flash**: Lightning-fast reasoning and code generation via `@langchain/google-genai`.
    *   **NVIDIA GLM-5.1**: Cutting-edge intelligence utilizing NVIDIA's integration API.
    *   **Local Ollama (Phi)**: Completely private, offline inference running entirely on your local machine.
*   **Persistent AI Memory**: The assistant continuously learns from your conversations. It remembers your name, goals, projects, and preferences, allowing it to adapt its responses and provide highly personalized, context-aware answers.
*   **Generative UI (Artifacts)**: The AI can generate complete, beautiful web components (using Tailwind CSS and Vanilla JS) right in the chat. You can instantly preview and interact with these components in a dedicated split-screen artifact viewer.
*   **Voice Interactivity**:
    *   **Speech-to-Text (STT)**: Speak directly to the AI using your microphone.
    *   **Text-to-Speech (TTS)**: The AI can read out its responses using a clean, highly configurable natural voice.
*   **File Intelligence & Vision**: Upload images directly into the chat. The AI can process, describe, and analyze visual data alongside your text prompts.
*   **Agentic Capabilities**: Powered by LangChain, the assistant can execute autonomous tools (like web search or code execution) directly within its thought process before giving you the final answer.
*   **Ultra-Premium UI**: An insanely polished, "glassmorphism" aesthetic built with Tailwind CSS and Framer Motion. Features dynamic glowing wave animations, floating particles, and fluid layout transitions.
*   **Real-time Streaming**: True token-by-token response streaming using Server-Sent Events (SSE) for immediate feedback.

## 🏗️ Architecture

V-CHAT is structured as a full-stack JavaScript application:

*   **Frontend**: React (Vite), TypeScript, Tailwind CSS, Framer Motion, and Lucide Icons.
*   **Backend**: Node.js, Express, LangChain.js, and MongoDB (with a local JSON fallback database).
*   **AI Router**: Manages requests and routing between various AI provider APIs (Gemini, NVIDIA, Ollama).

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18+)
*   MongoDB (optional, falls back to local JSON file if not running)
*   [Ollama](https://ollama.com/) (optional, if you want to run local models like `phi3`)

### Environment Setup

Create a `.env` file in the `backend` directory with your API keys:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ai-chatbot
JWT_SECRET=your_super_secret_jwt_key
GEMINI_API_KEY="your_gemini_api_key_here"
NVIDIA_API_KEY="your_nvidia_api_key_here"
```

### Running the Application

1.  **Start the Backend**:
    ```bash
    cd backend
    npm install
    npm run dev
    ```

2.  **Start the Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

3.  **Start Local Models (Optional)**:
    If you are using the Ollama integration, ensure Ollama is running locally:
    ```bash
    ollama run phi3
    ```

## 🛠️ Tech Stack

*   **UI/UX**: React 18, Tailwind CSS, Framer Motion, React Markdown, React Syntax Highlighter
*   **Backend framework**: Express.js, Mongoose (MongoDB)
*   **AI Frameworks**: LangChain.js, LangGraph, OpenAI Node.js SDK, Google Generative AI SDK
*   **Build Tool**: Vite

## 👨‍💻 Developed By

Engineered by **k.VISWAS**.
