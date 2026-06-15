import { GoogleGenerativeAI } from '@google/generative-ai';
import Message from '../models/Message.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const localDBPath = path.resolve(process.cwd(), 'localDB.json');

let llmClient;
const getClient = () => {
    if (!llmClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_actual_gemini_api_key_here') {
        llmClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return llmClient;
};

// Helper to load memories from localDB.json
const loadLocalMemories = () => {
    try {
        if (fs.existsSync(localDBPath)) {
            const data = fs.readFileSync(localDBPath, 'utf8');
            const parsed = JSON.parse(data);
            return parsed.memories || [];
        }
    } catch (e) {
        console.error("Failed to load local memories:", e);
    }
    return [];
};

// Helper to save memories to localDB.json
const saveLocalMemories = (memories) => {
    try {
        let db = { chats: [], messages: [], memories: [] };
        if (fs.existsSync(localDBPath)) {
            try {
                db = JSON.parse(fs.readFileSync(localDBPath, 'utf8'));
            } catch (e) {}
        }
        db.memories = memories;
        fs.writeFileSync(localDBPath, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("Failed to save local memories:", e);
    }
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

// Ensures we only keep the last 50 memories for a user in MongoDB
export const optimizeMemory = async (userId, limit = 50) => {
    if (!userId) return;
    try {
        const messages = await Message.find({ userId, chat: { $exists: false } }).sort({ createdAt: -1 }).select('_id');
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
        
        if (mongoose.connection.readyState === 1) {
            const newMsg = await Message.create({ userId, role, content, embedding });
            // Asynchronously optimize to avoid blocking
            optimizeMemory(userId);
            return newMsg;
        } else {
            // LocalDB fallback
            const localMemories = loadLocalMemories();
            const newMem = {
                _id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                userId,
                role,
                content,
                embedding: embedding || [],
                createdAt: new Date().toISOString()
            };
            localMemories.unshift(newMem);
            
            // Limit to last 50 memories for this user locally
            let userMemories = localMemories.filter(m => m.userId === userId);
            if (userMemories.length > 50) {
                const toRemove = userMemories.slice(50).map(m => m._id);
                const optimized = localMemories.filter(m => !toRemove.includes(m._id));
                saveLocalMemories(optimized);
            } else {
                saveLocalMemories(localMemories);
            }
            return newMem;
        }
    } catch (error) {
        console.error("Store memory error:", error);
        return null;
    }
};

// Retrieves top K relevant memories based on semantic search (with keyword fallback)
export const retrieveRelevantMemories = async (userId, currentInput, limit = 5) => {
    if (!userId || !currentInput) return [];
    try {
        const inputEmbedding = await generateEmbedding(currentInput);
        
        let allMemories = [];
        if (mongoose.connection.readyState === 1) {
            allMemories = await Message.find({ userId, chat: { $exists: false }, embedding: { $exists: true, $ne: [] } }).lean();
        } else {
            allMemories = loadLocalMemories().filter(m => m.userId === userId && m.embedding && m.embedding.length > 0);
        }

        // FALLBACK: If embedding model fails or is offline, perform simple keyword matching
        if (!inputEmbedding || allMemories.length === 0) {
            let fallbackMemories = [];
            if (mongoose.connection.readyState === 1) {
                fallbackMemories = await Message.find({ userId, chat: { $exists: false } }).lean();
            } else {
                fallbackMemories = loadLocalMemories().filter(m => m.userId === userId);
            }

            if (fallbackMemories.length === 0) return [];

            const queryWords = currentInput.toLowerCase().split(/[^\w]+/).filter(w => w.length > 3);
            if (queryWords.length === 0) return [];

            const scoredMemories = fallbackMemories.map(memory => {
                const text = memory.content.toLowerCase();
                let matches = 0;
                queryWords.forEach(word => {
                    if (text.includes(word)) matches++;
                });
                const similarity = matches / queryWords.length;
                return { ...memory, similarity };
            });

            const relevant = scoredMemories
                .filter(m => m.similarity > 0.1)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);

            return relevant.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }

        const scoredMemories = allMemories.map(memory => {
            const similarity = cosineSimilarity(inputEmbedding, memory.embedding);
            return { ...memory, similarity };
        });

        // Filter out very low similarity and sort by highest similarity
        const relevant = scoredMemories
            .filter(m => m.similarity > 0.6)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
            
        // Sort chronologically so they make sense in context
        return relevant.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } catch (error) {
        console.error("Retrieve relevant memories error:", error);
        return [];
    }
};

// Retrieve all standalone memories for the dashboard
export const getMemories = async (userId) => {
    if (!userId) return [];
    try {
        if (mongoose.connection.readyState === 1) {
            return await Message.find({ userId, chat: { $exists: false } }).sort({ createdAt: -1 }).lean();
        } else {
            return loadLocalMemories().filter(m => m.userId === userId);
        }
    } catch (error) {
        console.error("Get memories error:", error);
        return [];
    }
};

// Delete memory item by id
export const deleteMemoryById = async (id) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Message.deleteOne({ _id: id });
            return true;
        } else {
            const localMemories = loadLocalMemories();
            const filtered = localMemories.filter(m => m._id !== id);
            saveLocalMemories(filtered);
            return true;
        }
    } catch (error) {
        console.error("Delete memory error:", error);
        return false;
    }
};
