// Project developed by Viswas. Chat stream controller. (LANGCHAIN VERSION)
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import OpenAI from 'openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { storeMemory, retrieveRelevantMemories } from '../services/memoryService.js';
import fs from 'fs';
import path from 'path';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getAgentTools } from '../tools/agentTools.js';

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

    const userMsg = { _id: Date.now().toString(), chat: chatId, role: 'user', content: message || '', attachment, createdAt: new Date() };

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
        }
    } catch (error) {
        memoryMessages.push(userMsg);
        const chat = memoryChats.find(c => c._id === chatId);
        if (chat && memoryMessages.filter(m => m.chat === chatId).length === 1) {
            chat.title = message.substring(0, 30) + '...';
        }
        saveLocalDB();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (provider === 'ollama') {
        try {
            const OLLAMA_SYSTEM_INSTRUCTION = `You are a helpful AI assistant.

Follow these response rules strictly:

1. If the user's question is simple or short:
   * Respond in 1–2 clear sentences only.
   * Keep it concise and direct.

2. If the question is moderately complex:
   * Respond in 3–5 sentences.
   * Give a clear explanation without unnecessary details.

3. If the question is complex or requires deep understanding:
   * Provide a detailed explanation.
   * Use structured formatting if needed (points or paragraphs).

4. Do NOT generate unnecessarily long responses.
5. Do NOT add unrelated information.
6. Always match the response length to the question complexity.

Keep answers natural, clear, and to the point.`;

            const ollamaRes = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    model: 'phi3', 
                    prompt: message, 
                    system: OLLAMA_SYSTEM_INSTRUCTION,
                    stream: true 
                })
            });

            if (!ollamaRes.ok) throw new Error('Ollama connection failed');

            let fullOutput = '';
            const decoder = new TextDecoder('utf-8');
            for await (const chunk of ollamaRes.body) {
                const textChunk = decoder.decode(chunk, { stream: true });
                const lines = textChunk.split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.response) {
                            fullOutput += data.response;
                            res.write(`data: ${JSON.stringify({ text: data.response })}\n\n`);
                        }
                    } catch (e) { }
                }
            }

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

            res.write('data: [DONE]\n\n');
            res.end();
            return;
        } catch (error) {
            res.write(`data: ${JSON.stringify({ error: "Ollama failed: " + error.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }
    }

    if (provider === 'nvidia') {
        try {
            const client = new OpenAI({
                baseURL: "https://integrate.api.nvidia.com/v1",
                apiKey: process.env.NVIDIA_API_KEY || "YOUR_NVIDIA_API_KEY"
            });

            const msgs = [{ role: "system", content: SYSTEM_INSTRUCTION }];
            let history = [];
            try {
                history = await Message.find({ chat: chatId }).sort({ createdAt: 1 }).lean();
            } catch (e) {
                history = memoryMessages.filter(m => m.chat === chatId);
            }
            for (const msg of history) {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    msgs.push({ role: msg.role, content: msg.content || "" });
                }
            }
            msgs.push({ role: "user", content: message || "" });

            const stream = await client.chat.completions.create({
                model: "z-ai/glm-5.1",
                messages: msgs,
                temperature: 1,
                top_p: 1,
                max_tokens: 16384,
                extra_body: { chat_template_kwargs: { enable_thinking: true, clear_thinking: false } },
                stream: true
            });

            let fullOutput = '';
            for await (const chunk of stream) {
                if (!chunk.choices || chunk.choices.length === 0 || !chunk.choices[0].delta) continue;
                const delta = chunk.choices[0].delta;
                
                // Extract reasoning
                const reasoning = delta.reasoning_content;
                if (reasoning) {
                    fullOutput += reasoning;
                    res.write(`data: ${JSON.stringify({ text: reasoning })}\n\n`);
                }
                
                // Extract content
                if (delta.content) {
                    fullOutput += delta.content;
                    res.write(`data: ${JSON.stringify({ text: delta.content })}\n\n`);
                }
            }

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

            res.write('data: [DONE]\n\n');
            res.end();
            return;
        } catch (error) {
            res.write(`data: ${JSON.stringify({ error: "NVIDIA API failed: " + error.message })}\n\n`);
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

                const botReply = { _id: Date.now().toString(), chat: chatId, role: 'assistant', content: streamedText, createdAt: new Date() };
                try {
                    await Message.create(botReply);
                } catch (e) {
                    memoryMessages.push(botReply);
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
