import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import DocumentChunk from '../models/DocumentChunk.js';
import { generateEmbedding, cosineSimilarity } from './memoryService.js';

const localDBPath = path.resolve(process.cwd(), 'localDB.json');

// Helper to load chunks from localDB.json
const loadLocalChunks = () => {
    try {
        if (fs.existsSync(localDBPath)) {
            const data = fs.readFileSync(localDBPath, 'utf8');
            const parsed = JSON.parse(data);
            return parsed.documentChunks || [];
        }
    } catch (e) {
        console.error("Failed to load local document chunks:", e);
    }
    return [];
};

// Helper to save chunks to localDB.json
const saveLocalChunks = (chunks) => {
    try {
        let db = { chats: [], messages: [], memories: [], documentChunks: [] };
        if (fs.existsSync(localDBPath)) {
            try {
                db = JSON.parse(fs.readFileSync(localDBPath, 'utf8'));
            } catch (e) {}
        }
        db.documentChunks = chunks;
        fs.writeFileSync(localDBPath, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("Failed to save local document chunks:", e);
    }
};

// Splits a string of text into overlapping paragraph chunks
export const chunkText = (text, size = 1200, overlap = 200) => {
    if (!text) return [];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        chunks.push(text.substring(start, end));
        // If we reached the end of the text, stop
        if (end === text.length) break;
        start += size - overlap;
    }
    return chunks;
};

// Indexes a parsed document: chunks it, generates embeddings, and saves to active database
export const indexDocument = async (chatId, fileName, text) => {
    if (!chatId || !fileName || !text) return;
    try {
        // Check if this file was already indexed for this chat to avoid duplicates
        let alreadyExists = false;
        if (mongoose.connection.readyState === 1) {
            const count = await DocumentChunk.countDocuments({ chat: chatId.toString(), fileName });
            if (count > 0) alreadyExists = true;
        } else {
            const localChunks = loadLocalChunks();
            alreadyExists = localChunks.some(c => c.chat === chatId.toString() && c.fileName === fileName);
        }

        if (alreadyExists) {
            console.log(`[RAG Service] "${fileName}" is already indexed in chat ${chatId}. Skipping re-indexing.`);
            return;
        }

        const chunks = chunkText(text);
        console.log(`[RAG Service] Chunked "${fileName}" into ${chunks.length} segments. Generating embeddings...`);
        
        const indexedChunks = [];
        for (let i = 0; i < chunks.length; i++) {
            const content = chunks[i];
            const embedding = await generateEmbedding(content);
            indexedChunks.push({
                chat: chatId.toString(),
                fileName,
                content,
                embedding: embedding || []
            });
        }

        if (mongoose.connection.readyState === 1) {
            await DocumentChunk.insertMany(indexedChunks);
        } else {
            const localChunks = loadLocalChunks();
            indexedChunks.forEach(c => {
                c._id = 'chunk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localChunks.push(c);
            });
            saveLocalChunks(localChunks);
        }
        console.log(`[RAG Service] Successfully indexed "${fileName}" with ${chunks.length} chunks.`);
    } catch (error) {
        console.error("Failed to index document in RAG service:", error);
    }
};

// Retrieve top K relevant document chunks for a chat query (using semantic or keyword matching)
export const retrieveRelevantChunks = async (chatId, queryText, limit = 5) => {
    if (!chatId || !queryText) return [];
    try {
        const queryEmbedding = await generateEmbedding(queryText);
        
        let allChunks = [];
        if (mongoose.connection.readyState === 1) {
            allChunks = await DocumentChunk.find({ chat: chatId.toString() }).lean();
        } else {
            allChunks = loadLocalChunks().filter(c => c.chat === chatId.toString());
        }

        if (allChunks.length === 0) return [];

        // FALLBACK: If embedding model is offline/invalid, perform keyless keyword matching search
        if (!queryEmbedding || allChunks.every(c => !c.embedding || c.embedding.length === 0)) {
            console.log("[RAG Service] No embedding generated. Falling back to keyword search over document chunks...");
            const queryWords = queryText.toLowerCase().split(/[^\w]+/).filter(w => w.length > 3);
            if (queryWords.length === 0) {
                // Return first few chunks if no useful search keywords exist
                return allChunks.slice(0, limit);
            }

            const scored = allChunks.map(chunk => {
                const text = chunk.content.toLowerCase();
                let matches = 0;
                queryWords.forEach(word => {
                    if (text.includes(word)) matches++;
                });
                return { ...chunk, similarity: matches / queryWords.length };
            });

            return scored
                .filter(c => c.similarity > 0.05)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
        }

        const scored = allChunks.map(chunk => {
            const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
            return { ...chunk, similarity };
        });

        // Sort by highest similarity
        return scored
            .filter(c => c.similarity > 0.4) // Relevance threshold
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    } catch (error) {
        console.error("Retrieve relevant chunks error:", error);
        return [];
    }
};
