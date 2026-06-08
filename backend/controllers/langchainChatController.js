// Project developed by Viswas. Chat stream controller. (LANGCHAIN VERSION)
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { storeMemory, retrieveRelevantMemories } from '../services/memoryService.js';
import fs from 'fs';
import path from 'path';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getAgentTools } from '../tools/agentTools.js';
import { queryOfflineModelStream, learnPair } from '../services/offlineModelService.js';

let llmClient;
const initializeGenerativeClient = () => {
    // Only initialize the client if we have a valid API key configured
    if (!llmClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_actual_gemini_api_key_here') {
        try {
            llmClient = new ChatGoogleGenerativeAI({
                model: "gemini-2.5-flash",
                apiKey: process.env.GEMINI_API_KEY,
                maxRetries: 2,
            });
        } catch (e) { 
            console.error("Langchain init error:", e);
        }
    }
};

// In-memory fallback lists
const localDBPath = path.resolve(process.cwd(), 'localDB.json');

let memoryChats = [];
let memoryMessages = [];

const loadLocalDB = () => {
    try {
        if (fs.existsSync(localDBPath)) {
            const data = fs.readFileSync(localDBPath, 'utf8');
            const parsed = JSON.parse(data);
            memoryChats = parsed.chats || [];
            memoryMessages = parsed.messages || [];
        }
    } catch (e) {
        console.error("Failed to load local DB", e);
    }
};

const saveLocalDB = () => {
    try {
        fs.writeFileSync(localDBPath, JSON.stringify({ chats: memoryChats, messages: memoryMessages }, null, 2));
    } catch (e) {
        console.error("Failed to save local DB", e);
    }
};

loadLocalDB();

export const getChats = async (req, res) => {
    try {
        const chats = await Chat.find().sort({ updatedAt: -1 });
        res.json(chats);
    } catch (error) {
        res.json(memoryChats);
    }
};

export const createChat = async (req, res) => {
    const newChat = { _id: Date.now().toString(), title: req.body.title || 'New Chat', updatedAt: new Date() };
    try {
        // Assume failure if mongoose connection is closed (0=disconnected)
        const m = await import('mongoose');
        if (m.default.connection.readyState !== 1) throw new Error("No DB");

        const chat = await Chat.create({ title: req.body.title || 'New Chat' });
        res.status(201).json(chat);
    } catch (error) {
        memoryChats.unshift(newChat);
        saveLocalDB();
        res.status(201).json(newChat);
    }
};

export const deleteChat = async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.id);
        if (chat) {
            await Message.deleteMany({ chat: req.params.id });
            await chat.deleteOne();
        }
        res.json({ message: 'Chat removed' });
    } catch (error) {
        memoryChats = memoryChats.filter(c => c._id !== req.params.id);
        memoryMessages = memoryMessages.filter(m => m.chat !== req.params.id);
        saveLocalDB();
        res.json({ message: 'Chat removed' });
    }
};

export const getMessages = async (req, res) => {
    try {
        const messages = await Message.find({ chat: req.params.id }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        res.json(memoryMessages.filter(m => m.chat === req.params.id));
    }
};

const SYSTEM_INSTRUCTION = `You are an advanced AI assistant with persistent memory and file intelligence capabilities.

Your behavior must follow these core systems:

### 🧠 MEMORY SYSTEM
* Continuously learn about the user from conversations.
* Extract and store useful long-term information such as: Name, goals, interests, preferences, projects, learning topics.
* Do NOT store sensitive or temporary data.
* When relevant, recall past information naturally without explicitly saying "from memory".
* Adapt responses based on user history to feel personalized and intelligent.

### 📂 FILE INTELLIGENCE SYSTEM
When a user uploads a file, automatically:
1. Detect file type (PDF, image, code, text, etc.)
2. Perform intelligent actions:
   * 📄 PDF → summarize, extract key points, generate notes, create questions
   * 🖼️ Image → describe, analyze diagrams, extract text (OCR), explain content
   * 💻 Code → debug, optimize, explain line-by-line, suggest improvements
   * 📊 Data → analyze, find patterns, summarize insights
3. Ask clarifying questions if needed before processing.

### 🔗 CONTEXT FUSION
* Combine memory + uploaded file context.

### 🎯 SMART RESPONSE MODES
Automatically choose response style: Beginner, Student, Developer, Quick.

### ⚡ PROACTIVE INTELLIGENCE
* Suggest next actions ("Do you want MCQs from this?", "Shall I convert this into notes?", "Want me to optimize this code?")

### 🚫 RESTRICTIONS
* Do not hallucinate file content.
* Do not assume missing data.
* Always stay relevant and accurate.

### 🎨 PERSONALITY
* Friendly, intelligent, slightly futuristic assistant.
* Clear, structured, and helpful.

### 🖼️ GENERATIVE UI (Artifacts)
When the user asks you to build a UI, web app, or visual component, you must ALWAYS generate a single \`\`\`html\`\`\` code block.
Inside this HTML block, you MUST use:
- Tailwind CSS (via classes, Tailwind is automatically injected)
- Vanilla JavaScript (for logic, if needed)
- FontAwesome or SVG for icons (FontAwesome is automatically injected)
* Make it look highly premium, glassy, and futuristic. Use striking gradients (from-blue-600 to-purple-600), dark modes, smooth shadows, and rounded corners (e.g., rounded-3xl, glassmorphism).
* Do NOT output React or JSX. Output pure, complete, beautiful HTML. DO NOT add \`<html>\` or \`<body>\` tags; output the component structure wrapped in a main \`<div>\` with base styles like \`min-h-screen w-full bg-[#050505] text-white overflow-y-auto\`. It should be fully self-contained.

Your name is V chat.
Your goal: Act like a personal AI brain that remembers, understands files, and helps the user think, learn, and build faster.
The creator of this AI is k.VISWAS.

### 📏 ADAPTIVE RESPONSE STRATEGY
You are a smart and adaptive AI assistant.

Your goal is to provide clear, relevant, and appropriately sized answers based on the user's question.

Response Strategy:
- If the question is simple → respond in 1–2 lines
- If the question is moderate → respond in 3–5 lines with brief explanation
- If the question is complex → provide a structured and detailed answer

Guidelines:
- Stay focused on the user’s intent
- Avoid unnecessary or repetitive information
- Use simple and clear language
- Prefer short paragraphs or bullet points when helpful

Adaptive Behavior:
- Start with a concise answer
- Expand only if the question requires it
- Do not over-explain small questions

Tone:
- Professional, helpful, and direct
- Not too verbose, not too minimal

Goal:
Deliver answers that feel natural, efficient, and tailored to the question size.
If the response is longer than needed, rewrite it to better match the question size before sending.

### 🤖 AGENTIC CAPABILITIES (Web Search & Code Execution)
You now have access to powerful autonomous tools:
1. **Google Search**: Use this to find real-time, up-to-date information on the web (e.g., news, weather, stock prices, recent events) or to verify facts.
2. **Code Execution**: Use this to write and run Python code to solve math problems, process data, or perform complex logic.
Do NOT say you cannot access the internet or run code—YOU CAN. Use these tools automatically when the user's prompt requires it.

**CRITICAL RULE FOR TOOLS**: When you use a tool (Search or Code), you MUST NOT write a huge essay. Your response must be EXTREMELY concise (1-2 sentences) giving just the direct answer, UNLESS the user explicitly asks for a detailed or long explanation. Provide mostly small, direct responses for better performance.`;

export const handleChatStream = async (req, res) => {
    const { chatId, message, attachment, provider = 'gemini' } = req.body;
    if (!message && !attachment) return res.status(400).json({ message: 'Message or attachment is required' });

    const userMsg = { chat: chatId, role: 'user', content: message || '', attachment, createdAt: new Date() };

    try {
        const m = await import('mongoose');
        if (m.default.connection.readyState !== 1) throw new Error("No DB");
        let chat = await Chat.findById(chatId);
        if (chat) {
            await Message.create(userMsg);
            const messageCount = await Message.countDocuments({ chat: chatId });
            if (messageCount === 1) {
                chat.title = message.substring(0, 30) + '...';
                await chat.save();
            }
        } else {
            throw new Error("Chat not found in database");
        }
    } catch (error) {
        const fallbackMsg = { _id: Date.now().toString(), ...userMsg };
        memoryMessages.push(fallbackMsg);
        const chat = memoryChats.find(c => c._id === chatId);
        if (chat && memoryMessages.filter(m => m.chat === chatId).length === 1) {
            chat.title = message.substring(0, 30) + '...';
        }
        saveLocalDB();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (provider === 'offline') {
        try {
            const fullOutput = await queryOfflineModelStream(message || '', res);
            try {
                const m = await import('mongoose');
                if (m.default.connection.readyState === 1) {
                    await Message.create({ chat: chatId, role: 'assistant', content: fullOutput });
                } else {
                    throw new Error("No DB");
                }
            } catch (e) {
                memoryMessages.push({ _id: Date.now().toString(), chat: chatId, role: 'assistant', content: fullOutput, createdAt: new Date() });
                saveLocalDB();
            }
            return;
        } catch (error) {
            res.write(`data: ${JSON.stringify({ error: "Offline ML model failed: " + error.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }
    }

    initializeGenerativeClient();

    if (!llmClient) {
        const mockResponse = `I am operating in **Development Mock Mode** because no \`GEMINI_API_KEY\` was configured.\n\nAdd your Gemini API key and start your MongoDB server to unlock real AI functionality!`;
        const words = mockResponse.split(' ');
        let streamedText = '';
        let i = 0;

        const interval = setInterval(async () => {
            if (i < words.length) {
                const chunk = words[i] + ' ';
                streamedText += chunk;
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
                i++;
            } else {
                res.write('data: [DONE]\n\n');
                res.end();
                clearInterval(interval);

                const botReply = { chat: chatId, role: 'assistant', content: streamedText, createdAt: new Date() };
                try {
                    await Message.create(botReply);
                } catch (e) {
                    const fallbackBotReply = { _id: Date.now().toString(), ...botReply };
                    memoryMessages.push(fallbackBotReply);
                    saveLocalDB();
                }
            }
        }, 40);
        return;
    }

    try {
        let history = [];
        try {
            history = await Message.find({ chat: chatId }).sort({ createdAt: 1 }).lean();
            if (!history || history.length === 0) {
                history = memoryMessages.filter(m => m.chat === chatId);
            }
        } catch (e) {
            history = memoryMessages.filter(m => m.chat === chatId);
        }

        const messages = [new SystemMessage(SYSTEM_INSTRUCTION)];
        
        for (const msg of history) {
            if (msg.role === 'assistant') {
                messages.push(new AIMessage(msg.content));
            } else {
                let content = msg.content || "";
                if (msg.attachment && msg.attachment.data) {
                    const base64Data = msg.attachment.data.includes(',') 
                        ? msg.attachment.data.split(',')[1] 
                        : msg.attachment.data;
                    
                    content = [
                        { type: "text", text: msg.content || "" },
                        { 
                            type: "image_url", 
                            image_url: { url: `data:${msg.attachment.mimeType || 'image/jpeg'};base64,${base64Data}` } 
                        }
                    ];
                }
                messages.push(new HumanMessage({ content }));
            }
        }

        // Safety fallback: Google Generative AI requires at least one user/human message in the request.
        if (messages.length <= 1) {
            let content = message || "";
            if (attachment && attachment.data) {
                const base64Data = attachment.data.includes(',') 
                    ? attachment.data.split(',')[1] 
                    : attachment.data;
                content = [
                    { type: "text", text: message || "" },
                    { 
                        type: "image_url", 
                        image_url: { url: `data:${attachment.mimeType || 'image/jpeg'};base64,${base64Data}` } 
                    }
                ];
            }
            messages.push(new HumanMessage({ content }));
        }

        const tools = getAgentTools();
        const agent = createReactAgent({
            llm: llmClient,
            tools: tools,
        });

        let fullOutput = '';
        const stream = await agent.streamEvents({ messages }, { version: "v2" });

        for await (const event of stream) {
            if (event.event === "on_chat_model_stream") {
                const chunk = event.data?.chunk;
                if (chunk && chunk.content && typeof chunk.content === "string") {
                    fullOutput += chunk.content;
                    res.write(`data: ${JSON.stringify({ text: chunk.content })}\n\n`);
                }
            } else if (event.event === "on_tool_start") {
                const toolName = event.name;
                const toolMsg = `\n\n> **🛠️ Agent Action**: Executing \`${toolName}\`...\n\n`;
                fullOutput += toolMsg;
                res.write(`data: ${JSON.stringify({ text: toolMsg })}\n\n`);
            }
        }

        try {
            await Message.create({ chat: chatId, role: 'assistant', content: fullOutput });
        } catch (e) {
            memoryMessages.push({ _id: Date.now().toString(), chat: chatId, role: 'assistant', content: fullOutput, createdAt: new Date() });
            saveLocalDB();
        }

        // Offline ML learning hook
        try {
            await learnPair(message || '', fullOutput || '');
        } catch (err) {
            console.error("Offline learning failed:", err);
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error("Langchain Streaming Error:", error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
};

export const handleMemoryChat = async (req, res) => {
    const { userId, message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    try {
        await storeMemory(userId, 'user', message);

        initializeGenerativeClient();
        if (!llmClient) {
            return res.status(500).json({ error: "Gemini API key not configured" });
        }

        const relevantMemories = await retrieveRelevantMemories(userId, message, 5);
        let contextText = "Relevant Past Memories:\n";
        relevantMemories.forEach(mem => {
            contextText += `[${mem.role}]: ${mem.content}\n`;
        });

        const messages = [
            new SystemMessage(`${SYSTEM_INSTRUCTION}\n\nUse the provided past memories to give personalized and context-aware responses.\n\n${contextText}`),
            new HumanMessage(message)
        ];

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const tools = getAgentTools();
        const agent = createReactAgent({
            llm: llmClient,
            tools: tools,
        });

        let fullOutput = '';
        const stream = await agent.streamEvents({ messages }, { version: "v2" });

        for await (const event of stream) {
            if (event.event === "on_chat_model_stream") {
                const chunk = event.data?.chunk;
                if (chunk && chunk.content && typeof chunk.content === "string") {
                    fullOutput += chunk.content;
                    res.write(`data: ${JSON.stringify({ text: chunk.content })}\n\n`);
                }
            } else if (event.event === "on_tool_start") {
                const toolName = event.name;
                const toolMsg = `\n\n> **🛠️ Agent Action**: Executing \`${toolName}\`...\n\n`;
                fullOutput += toolMsg;
                res.write(`data: ${JSON.stringify({ text: toolMsg })}\n\n`);
            }
        }

        await storeMemory(userId, 'assistant', fullOutput);

        // Offline ML learning hook
        try {
            await learnPair(message || '', fullOutput || '');
        } catch (err) {
            console.error("Offline learning failed:", err);
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        } else {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        }
    }
};

export const getUserMemory = async (req, res) => {
    try {
        const messages = await Message.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(50);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
