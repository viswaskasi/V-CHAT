import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import Message from '../models/Message.js';

const brainPath = path.resolve(process.cwd(), 'offlineBrain.json');

// Simple TF-IDF Vector Space Machine Learning Model in pure JS
class SimpleTFIDFModel {
    constructor() {
        this.documents = []; // Array of { text: string, answer: string, type: string }
        this.vocabulary = new Set();
        this.idf = {};
        this.docVectors = [];
    }

    // Tokenize, lowercase, and clean text
    tokenize(text) {
        if (!text) return [];
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 1); // Skip very short words/empty tokens
    }

    // Train/build model with documents
    train(docs) {
        this.documents = docs;
        this.vocabulary.clear();
        this.idf = {};
        this.docVectors = [];

        // 1. Build vocabulary and compute document frequencies (DF)
        const df = {};
        const N = this.documents.length;

        this.documents.forEach(doc => {
            const tokens = this.tokenize(doc.text);
            const uniqueTokens = new Set(tokens);
            uniqueTokens.forEach(token => {
                this.vocabulary.add(token);
                df[token] = (df[token] || 0) + 1;
            });
        });

        // 2. Compute IDF for each term in vocabulary
        this.vocabulary.forEach(token => {
            this.idf[token] = Math.log(N / (df[token] || 1)) + 1;
        });

        // 3. Compute TF-IDF vectors for all documents
        this.documents.forEach(doc => {
            const tokens = this.tokenize(doc.text);
            const vector = this.computeTFIDFVector(tokens);
            this.docVectors.push(vector);
        });
    }

    // Compute TF-IDF vector for a set of tokens
    computeTFIDFVector(tokens) {
        const tf = {};
        tokens.forEach(token => {
            if (this.vocabulary.has(token)) {
                tf[token] = (tf[token] || 0) + 1;
            }
        });

        const vector = {};
        const totalTokens = tokens.length || 1;
        
        this.vocabulary.forEach(token => {
            const termFreq = (tf[token] || 0) / totalTokens;
            const idfVal = this.idf[token] || 0;
            const tfidf = termFreq * idfVal;
            if (tfidf > 0) {
                vector[token] = tfidf;
            }
        });

        return vector;
    }

    // Calculate Cosine Similarity between two sparse vectors
    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        // Vector A magnitude
        for (const val of Object.values(vecA)) {
            normA += val * val;
        }

        // Vector B magnitude and Dot Product
        for (const [key, val] of Object.entries(vecB)) {
            normB += val * val;
            if (vecA[key]) {
                dotProduct += vecA[key] * val;
            }
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    // Query the model to find the best matching answer
    query(queryText, threshold = 0.05) {
        if (this.documents.length === 0) {
            return null;
        }

        const queryTokens = this.tokenize(queryText);
        const queryVector = this.computeTFIDFVector(queryTokens);

        let bestIndex = -1;
        let bestScore = -1;

        this.docVectors.forEach((docVector, index) => {
            const score = this.cosineSimilarity(queryVector, docVector);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        });

        if (bestIndex !== -1 && bestScore >= threshold) {
            return {
                document: this.documents[bestIndex],
                score: bestScore
            };
        }

        return null;
    }
}

// Instance of the TF-IDF model
const offlineModel = new SimpleTFIDFModel();

// Helper to load brain database
const loadBrain = () => {
    try {
        if (fs.existsSync(brainPath)) {
            return JSON.parse(fs.readFileSync(brainPath, 'utf8')) || [];
        }
    } catch (e) {
        console.error("Failed to load offline brain:", e);
    }
    return [];
};

// Helper to save brain database
const saveBrain = (data) => {
    try {
        fs.writeFileSync(brainPath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Failed to save offline brain:", e);
    }
};

// Learn a new Q&A pair in real time
export const learnPair = async (question, answer) => {
    if (!question || !answer) return;
    
    // Ignore short messages, errors, or mock responses
    if (question.trim().length <= 3) return;
    if (answer.includes("API Error:") || answer.includes("Offline ML Model")) return;

    const brain = loadBrain();

    // Check if we already have this exact query (case-insensitive)
    const exists = brain.some(item => item.text.toLowerCase().trim() === question.toLowerCase().trim());
    
    if (!exists) {
        brain.push({
            text: question.trim(),
            answer: answer.trim(),
            type: "conversation",
            learnedAt: new Date()
        });
        saveBrain(brain);
        console.log(`[Offline ML Model] Learned new Q&A pair: "${question.substring(0, 30)}..."`);
    }
};

// Build brain from existing DB history if empty (one-time migration)
export const migrateHistoryToBrain = async () => {
    try {
        const brain = loadBrain();
        if (brain.length > 0) return; // Already initialized

        console.log("[Offline ML Model] Initializing brain from existing database history...");
        const knowledge = [];

        // 1. Fetch from MongoDB
        let messages = [];
        try {
            const m = await import('mongoose');
            if (m.default.connection.readyState === 1) {
                messages = await Message.find({}).sort({ createdAt: 1 }).lean();
            }
        } catch (e) {}

        // 2. Fetch from localDB
        const localDBPath = path.resolve(process.cwd(), 'localDB.json');
        if (fs.existsSync(localDBPath)) {
            try {
                const localData = JSON.parse(fs.readFileSync(localDBPath, 'utf8'));
                if (localData.messages) {
                    localData.messages.forEach(lm => {
                        if (!messages.find(m => m.content === lm.content && m.role === lm.role)) {
                            messages.push(lm);
                        }
                    });
                }
            } catch (e) {}
        }

        // 3. Extract Q&A pairs
        const chatGroups = {};
        messages.forEach(msg => {
            if (msg.chat) {
                const chatKey = msg.chat.toString();
                if (!chatGroups[chatKey]) chatGroups[chatKey] = [];
                chatGroups[chatKey].push(msg);
            }
        });

        Object.values(chatGroups).forEach(chatMsgs => {
            chatMsgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            for (let i = 0; i < chatMsgs.length - 1; i++) {
                const current = chatMsgs[i];
                const next = chatMsgs[i + 1];

                if (current.role === 'user' && next.role === 'assistant') {
                    if (current.content && current.content.length > 3 && next.content && !next.content.includes("API Error:")) {
                        // Avoid duplicates
                        if (!knowledge.some(item => item.text.toLowerCase().trim() === current.content.toLowerCase().trim())) {
                            knowledge.push({
                                text: current.content.trim(),
                                answer: next.content.trim(),
                                type: "conversation",
                                learnedAt: current.createdAt || new Date()
                            });
                        }
                    }
                }
            }
        });

        if (knowledge.length > 0) {
            saveBrain(knowledge);
            console.log(`[Offline ML Model] Migrated ${knowledge.length} past Q&A pairs to offline brain.`);
        }
    } catch (err) {
        console.error("History migration failed:", err);
    }
};

// Read environment variable details safely
const loadEnvKnowledge = () => {
    const envPath = path.resolve(process.cwd(), '.env');
    const knowledge = [];

    let geminiKey = process.env.GEMINI_API_KEY || '';
    let port = process.env.PORT || '5000';
    let dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-chatbot';
    let jwtSecret = process.env.JWT_SECRET || '';

    // If environment variables are not in process.env yet, parse .env file directly
    if (fs.existsSync(envPath)) {
        try {
            const envConfig = dotenv.parse(fs.readFileSync(envPath));
            if (envConfig.GEMINI_API_KEY) geminiKey = envConfig.GEMINI_API_KEY;
            if (envConfig.PORT) port = envConfig.PORT;
            if (envConfig.MONGODB_URI) dbUri = envConfig.MONGODB_URI;
            if (envConfig.JWT_SECRET) jwtSecret = envConfig.JWT_SECRET;
        } catch (e) {
            console.error("Error reading .env for offline model training:", e);
        }
    }

    const maskedKey = geminiKey ? `${geminiKey.substring(0, 8)}...${geminiKey.substring(geminiKey.length - 4)}` : 'Not configured';

    // Index API key and environmental info
    knowledge.push({
        text: "what is my gemini api key show gemini key api key credentials env",
        answer: `Your Gemini API Key configured in your \`.env\` file is: \`${geminiKey || 'Not Configured'}\` (Masked: \`${maskedKey}\`).\n\nIt is loaded into the system as \`process.env.GEMINI_API_KEY\`.`,
        type: "api_key"
    });

    knowledge.push({
        text: "what port is the server running on backend port api port webserver port",
        answer: `The backend server is configured to run on port: \`${port}\`.`,
        type: "config"
    });

    knowledge.push({
        text: "what is my mongodb uri database connection connection string database url",
        answer: `The MongoDB connection URI configured in your environment is: \`${dbUri}\`.`,
        type: "config"
    });

    knowledge.push({
        text: "what is the jwt secret token secret credentials key",
        answer: `The JWT secret key used to sign tokens is: \`${jwtSecret}\`.`,
        type: "config"
    });

    return { knowledge, geminiKey };
};

// Build/retrain the offline model combining environment keys and persistent brain data
export const retrainOfflineModel = async () => {
    try {
        // Run migration from history if it's the first time
        await migrateHistoryToBrain();

        const { knowledge } = loadEnvKnowledge();
        const brain = loadBrain();

        // Combine config info with persistent conversation learnings
        const allDocs = [...knowledge, ...brain];

        offlineModel.train(allDocs);
        console.log(`[Offline ML Model] Trained model on ${allDocs.length} documents (${knowledge.length} env config, ${brain.length} brain memory).`);
    } catch (err) {
        console.error("Failed to retrain offline model:", err);
    }
};

// Query the offline model to get a streamed/event-source answer
export const queryOfflineModelStream = async (queryText, res) => {
    // Make sure we have the latest training data loaded
    await retrainOfflineModel();

    const match = offlineModel.query(queryText);

    let answer = "";
    if (match) {
        const sourceLabel = match.document.type === "api_key" ? "Environment Keys" : 
                            match.document.type === "config" ? "Server Configuration" : "Persistent Brain Memory";
        answer = `🤖 **[Offline ML Model - Match found in ${sourceLabel}]** (Confidence: ${Math.round(match.score * 100)}%)\n\n${match.document.answer}`;
    } else {
        answer = `🔌 **[Offline ML Model - Fully Local Fallback]**\n\nI am currently operating in **Offline Mode** (meaning I cannot query external generative models).\n\nI couldn't find a sufficiently close match for your question: *"${queryText}"* in my local training data.\n\n### What can I answer here?\n- Ask me about the environment settings (e.g. "What is my API key?", "What is the MongoDB URI?", "What port is the server running on?")\n- Ask me questions that you previously asked while Gemini was online, and I will retrieve the exact answers from our chat history!`;
    }

    // Stream the response out word-by-word to match the event-stream UI formatting
    const words = answer.split(' ');
    let currentResponse = "";
    
    for (let i = 0; i < words.length; i++) {
        const chunk = words[i] + ' ';
        currentResponse += chunk;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        // Simulate small streaming delay
        await new Promise(resolve => setTimeout(resolve, 30));
    }

    res.write('data: [DONE]\n\n');
    res.end();

    return currentResponse;
};
