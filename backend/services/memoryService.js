import { GoogleGenerativeAI } from '@google/generative-ai';
import Message from '../models/Message.js';

let llmClient;
const getClient = () => {
    if (!llmClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_actual_gemini_api_key_here') {
        llmClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return llmClient;
};

// Generates an embedding for a given text
export const generateEmbedding = async (text) => {
    const client = getClient();
    if (!client) return null;
    try {
        const model = client.getGenerativeModel({ model: "gemini-embedding-2" });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (e) {
        console.error("Embedding error:", e);
        return null;
    }
};

// Calculates cosine similarity between two vectors
export const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Ensures we only keep the last 50 memories for a user
export const optimizeMemory = async (userId, limit = 50) => {
    if (!userId) return;
    try {
        const messages = await Message.find({ userId }).sort({ createdAt: -1 }).select('_id');
        if (messages.length > limit) {
            const idsToDelete = messages.slice(limit).map(m => m._id);
            await Message.deleteMany({ _id: { $in: idsToDelete } });
        }
    } catch (error) {
        console.error("Optimize memory error:", error);
    }
};

// Saves a memory and triggers optimization
export const storeMemory = async (userId, role, content) => {
    if (!userId) return null;
    try {
        const embedding = await generateEmbedding(content);
        const newMsg = await Message.create({ userId, role, content, embedding });
        
        // Asynchronously optimize to avoid blocking
        optimizeMemory(userId);
        return newMsg;
    } catch (error) {
        console.error("Store memory error:", error);
        return null;
    }
};

// Retrieves top K relevant memories based on semantic search
export const retrieveRelevantMemories = async (userId, currentInput, limit = 5) => {
    if (!userId) return [];
    try {
        const inputEmbedding = await generateEmbedding(currentInput);
        if (!inputEmbedding) return [];

        // We only retrieve user messages to build context, or assistant messages too if preferred.
        // Usually retrieving previous user questions + assistant answers helps. We'll retrieve all.
        const allMemories = await Message.find({ userId, embedding: { $exists: true, $ne: [] } }).lean();
        
        const scoredMemories = allMemories.map(memory => {
            const similarity = cosineSimilarity(inputEmbedding, memory.embedding);
            return { ...memory, similarity };
        });

        // Filter out very low similarity and sort by highest similarity
        const relevant = scoredMemories
            .filter(m => m.similarity > 0.6) // Only somewhat relevant things
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
            
        // Sort chronologically so they make sense in context
        return relevant.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } catch (error) {
        console.error("Retrieve relevant memories error:", error);
        return [];
    }
};
