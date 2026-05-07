# AI Chatbot Web Application 🤖

A production-ready full-stack AI chatbot application featuring a modern React frontend with Tailwind CSS glassmorphism, voice input/output, and a Node.js/Express backend integrated with OpenAI.

## 🌟 Features
- **Modern UI**: Dark theme, glassmorphism, smooth Framer Motion animations.
- **ChatGPT-like Experience**: Sidebar history, real-time typing effect, Markdown & code highlighting support.
- **Voice Capabilities**: Built-in Speech-to-Text handling and Text-to-Speech readouts.
- **Robust Backend**: Node.js, Express, MongoDB, JWT Authentication.
- **Streaming Responses**: Real-time token streaming using Server-Sent Events (SSE).

---

## 🛠️ Technology Stack
- **Frontend**: React (Vite TypeScript), Tailwind CSS, Framer Motion, Zustand, React-Router-Dom.
- **Backend**: Node.js, Express, MongoDB (Mongoose).
- **AI Integrations**: OpenAI API (`gpt-3.5-turbo`).

---

## 🚀 Step-by-Step Installation

### 1. Prerequisites
- Node.js (v18+ recommended)
- MongoDB Database (Local or MongoDB Atlas)
- OpenAI API Key

### 2. Environment Setup
#### Backend (`/backend/.env`)
Create a `.env` file in the `backend` directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ai-chat
JWT_SECRET=your_super_secret_jwt_key
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Running the Application Locally
**Start the Backend:**
```bash
cd backend
npm run dev
# Server will automatically restart on changes. It listens on http://localhost:5000
```

**Start the Frontend:**
```bash
cd frontend
npm run dev
# App will start on http://localhost:5173
```

---

## ☁️ Deployment Guide

### Deploying the Backend (Render / Heroku)
1. Push your underlying code to GitHub.
2. Sign up on [Render.com](https://render.com).
3. Create a **New Web Service**, connect your repo, and set the Root directory to `backend`.
4. Set the build command to `npm install` and start command to `npm start`.
5. Add your `.env` variables in Render's Environment Variables portion.
6. Click **Deploy**.

### Deploying the Frontend (Vercel / Netlify)
1. **Prepare API endpoints:** Update `http://localhost:5000` URLs in the frontend React code to your new Render backend URL before deploying if you don't use dynamic environment variables.
2. Sign up on [Vercel](https://vercel.com).
3. Import your GitHub repository.
4. Set the Root Directory to `frontend`.
5. Ensure the Build Command is `npm run build` and Output Directory is `dist`.
6. Deploy the frontend application.

---

## 🧠 Suggestions for Scaling & Enhancements
- **WebSockets over SSE**: For lower latency and bidirectional eventing, transition the streaming API (SSE) to WebSockets (e.g., Socket.io).
- **Redis Caching**: Cache user sessions, token validations, and frequent chat histories in Redis to vastly reduce MongoDB query loads.
- **Dockerization**: Containerize both the frontend and backend using Docker. Write a `docker-compose.yml` to orchestrate the Node processes and a Mongo image simultaneously for ultimate developer parity.
- **CI/CD Pipeline**: Utilize GitHub Actions to automatically run tests, static analysis, and trigger automatic deployments to Vercel and Render upon merging successfully to the `main` branch.
