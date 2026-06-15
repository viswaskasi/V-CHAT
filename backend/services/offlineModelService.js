import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import Message from '../models/Message.js';

const brainPath = path.resolve(process.cwd(), 'offlineBrain.json');

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 
    'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down', 
    'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 
    'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 
    'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'what', 'this', 
    'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 
    'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 
    'they', 'them', 'their', 'theirs', 'themselves', 'which', 'who', 'whom', 'am', 'be', 'been', 'being', 'have', 
    'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'if', 'because', 'as', 'until', 'while'
]);

// Simple TF-IDF Vector Space Machine Learning Model in pure JS with stop words and hybrid matching
class SimpleTFIDFModel {
    constructor() {
        this.documents = []; // Array of { text: string, trainingText?: string, answer: string, type: string }
        this.vocabulary = new Set();
        this.idf = {};
        this.textVectors = [];
        this.trainingVectors = [];
    }

    // Tokenize, lowercase, and clean text, filtering out stop words
    tokenize(text) {
        if (!text) return [];
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 1 && !STOP_WORDS.has(word));
    }

    // Train/build model with documents
    train(docs) {
        this.documents = docs;
        this.vocabulary.clear();
        this.idf = {};
        this.textVectors = [];
        this.trainingVectors = [];

        // 1. Build vocabulary and compute document frequencies (DF)
        const df = {};
        const N = this.documents.length;

        this.documents.forEach(doc => {
            const tokensText = this.tokenize(doc.text);
            const tokensTraining = this.tokenize(doc.trainingText || doc.text);
            
            const uniqueTokens = new Set([...tokensText, ...tokensTraining]);
            uniqueTokens.forEach(token => {
                this.vocabulary.add(token);
                df[token] = (df[token] || 0) + 1;
            });
        });

        // 2. Compute IDF for each term in vocabulary
        this.vocabulary.forEach(token => {
            this.idf[token] = Math.log(N / (df[token] || 1)) + 1;
        });

        // 3. Compute TF-IDF vectors for all documents (both text and trainingText fields)
        this.documents.forEach(doc => {
            const tokensText = this.tokenize(doc.text);
            const tokensTraining = this.tokenize(doc.trainingText || doc.text);
            
            this.textVectors.push(this.computeTFIDFVector(tokensText));
            this.trainingVectors.push(this.computeTFIDFVector(tokensTraining));
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

    // Query the model to find the best matching answer (hybrid scoring)
    query(queryText, threshold = 0.05) {
        if (this.documents.length === 0) {
            return null;
        }

        const queryTokens = this.tokenize(queryText);
        const queryVector = this.computeTFIDFVector(queryTokens);

        let bestIndex = -1;
        let bestScore = -1;
        let matchedField = "";

        this.documents.forEach((doc, index) => {
            const scoreText = this.cosineSimilarity(queryVector, this.textVectors[index]);
            const scoreTraining = this.cosineSimilarity(queryVector, this.trainingVectors[index]);
            
            const maxScore = Math.max(scoreText, scoreTraining);
            if (maxScore > bestScore) {
                bestScore = maxScore;
                bestIndex = index;
                matchedField = scoreText >= scoreTraining ? "Question Text" : "Training Text";
            }
        });

        if (bestIndex !== -1 && bestScore >= threshold) {
            return {
                document: this.documents[bestIndex],
                score: bestScore,
                matchedField: matchedField
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
export const learnPair = async (question, answer, attachments = []) => {
    if (!question && (!attachments || attachments.length === 0)) return;
    if (!answer) return;
    
    // Ignore short messages or errors
    if (question && question.trim().length <= 3 && (!attachments || attachments.length === 0)) return;
    if (answer.includes("API Error:") || answer.includes("Offline ML Model")) return;

    const brain = loadBrain();

    // Check if we already have this exact query (case-insensitive) and update or add it
    const normalizedQuestion = (question || '').toLowerCase().trim();
    const existingIndex = brain.findIndex(item => item.text.toLowerCase().trim() === normalizedQuestion);
    
    let trainingText = (question || '').trim();
    const documentExtracts = [];
    
    if (attachments && attachments.length > 0) {
        attachments.forEach(att => {
            if (att.extractedText) {
                trainingText += " " + att.extractedText;
                documentExtracts.push({
                    fileName: att.fileName,
                    content: att.extractedText
                });
            }
        });
    }

    if (existingIndex !== -1) {
        // Update the existing entry with the new answer and training text
        brain[existingIndex] = {
            ...brain[existingIndex],
            trainingText: trainingText,
            answer: answer.trim(),
            attachments: documentExtracts,
            updatedAt: new Date()
        };
        saveBrain(brain);
        console.log(`[Offline ML Model] Updated existing Q&A pair: "${(question || '').substring(0, 30)}..."`);
    } else {
        // Create a new entry
        brain.push({
            text: (question || '').trim(),
            trainingText: trainingText, // For TF-IDF index
            answer: answer.trim(),
            attachments: documentExtracts,
            type: "conversation",
            learnedAt: new Date()
        });
        saveBrain(brain);
        console.log(`[Offline ML Model] Learned new Q&A pair with attachments: "${(question || '').substring(0, 30)}..."`);
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
                    const isErrorResponse = next.content.includes("API Error:") || 
                                            next.content.toLowerCase().includes("unable to extract") || 
                                            next.content.toLowerCase().includes("error extracting text") || 
                                            next.content.includes("Offline ML Model");
                    if ((current.content || (current.attachments && current.attachments.length > 0)) && next.content && !isErrorResponse) {
                        const qText = current.content || "";
                        if (!knowledge.some(item => item.text.toLowerCase().trim() === qText.toLowerCase().trim())) {
                            let trainingText = qText.trim();
                            const documentExtracts = [];
                            
                            if (current.attachments && current.attachments.length > 0) {
                                current.attachments.forEach(att => {
                                    if (att.extractedText) {
                                        trainingText += " " + att.extractedText;
                                        documentExtracts.push({
                                            fileName: att.fileName,
                                            content: att.extractedText
                                        });
                                    }
                                });
                            }

                            knowledge.push({
                                text: qText.trim(),
                                trainingText: trainingText,
                                answer: next.content.trim(),
                                attachments: documentExtracts,
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
    let localGemmaModel = process.env.LOCAL_GEMMA_MODEL_NAME || 'gemma4';
    let ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

    // If environment variables are not in process.env yet, parse .env file directly
    if (fs.existsSync(envPath)) {
        try {
            const envConfig = dotenv.parse(fs.readFileSync(envPath));
            if (envConfig.GEMINI_API_KEY) geminiKey = envConfig.GEMINI_API_KEY;
            if (envConfig.LOCAL_GEMMA_MODEL_NAME) localGemmaModel = envConfig.LOCAL_GEMMA_MODEL_NAME;
            if (envConfig.OLLAMA_URL) ollamaUrl = envConfig.OLLAMA_URL;
        } catch (e) {
            console.error("Error reading .env for offline model training:", e);
        }
    }

    // Index API key and Gemma Local info
    knowledge.push({
        text: "what is my gemini api key show gemini key api key credentials env",
        answer: geminiKey ? `Your Gemini API Key is: \`${geminiKey}\`` : "Your Gemini API Key is not configured.",
        type: "api_key"
    });

    knowledge.push({
        text: "what is my local gemma model name local gemma model local gemma gemma model name",
        answer: localGemmaModel ? `Your local Gemma model name is: \`${localGemmaModel}\`` : "Your local Gemma model name is not configured.",
        type: "gemma_local"
    });

    knowledge.push({
        text: "what is my gemma local url ollama url local gemma url",
        answer: ollamaUrl ? `Your local Gemma/Ollama URL is: \`${ollamaUrl}\`` : "Your local Gemma/Ollama URL is not configured.",
        type: "gemma_local"
    });

    return { knowledge, geminiKey };
};

// Build/retrain the offline model combining environment keys, persistent brain data, and any temporary query attachments
export const retrainOfflineModel = async (tempAttachments = []) => {
    try {
        // Run migration from history if it's the first time
        await migrateHistoryToBrain();

        const { knowledge } = loadEnvKnowledge();
        const brain = loadBrain();

        // If there are tempAttachments (files uploaded in offline mode), index and append them
        const tempDocs = [];
        if (tempAttachments && tempAttachments.length > 0) {
            tempAttachments.forEach(att => {
                if (att.extractedText) {
                    tempDocs.push({
                        text: `what is in ${att.fileName} search document content ${att.fileName}`,
                        trainingText: `what is in ${att.fileName} search document content ${att.fileName} ${att.extractedText}`,
                        answer: `From document [${att.fileName}]:\n\n${att.extractedText}`,
                        type: "document_content"
                    });
                }
            });
        }

        // Combine config info, persistent brain memory, and active session attachments
        const allDocs = [...knowledge, ...brain, ...tempDocs];

        offlineModel.train(allDocs);
        console.log(`[Offline ML Model] Trained model on ${allDocs.length} items (${knowledge.length} env config, ${brain.length} brain memory, ${tempDocs.length} temp attachments).`);
    } catch (err) {
        console.error("Failed to retrain offline model:", err);
    }
};

// Query the offline model to get a streamed/event-source answer
export const queryOfflineModelStream = async (queryText, res, queryAttachments = []) => {
    // Make sure we have the latest training data loaded, including current attachments
    await retrainOfflineModel(queryAttachments);

    const match = offlineModel.query(queryText);

    let answer = "";
    if (match) {
        answer = match.document.answer;
    } else {
        answer = `I am currently operating in **Offline Mode** and couldn't find a close match for *"${queryText}"* in my local training database.

Here's what I can do for you right now:
* Look up your **Gemini API key** or local Gemma configurations.
* Search and extract text from any files you've uploaded.
* Retrieve answers to questions we discussed previously while I was online.

Let me know how you'd like to proceed!`;
    }

    // Stream the response out in small chunks of words to make it extremely fast and smooth
    const words = answer.split(' ');
    let currentResponse = "";
    const wordsPerChunk = 4;
    
    for (let i = 0; i < words.length; i += wordsPerChunk) {
        const chunk = words.slice(i, i + wordsPerChunk).join(' ') + ' ';
        currentResponse += chunk;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        // Small delay to let UI render the stream smoothly
        await new Promise(resolve => setTimeout(resolve, 5));
    }

    res.write('data: [DONE]\n\n');
    res.end();

    return currentResponse;
};
