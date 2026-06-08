import { retrainOfflineModel } from './services/offlineModelService.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Re-implement or import SimpleTFIDFModel
class SimpleTFIDFModel {
    constructor() {
        this.documents = [];
        this.vocabulary = new Set();
        this.idf = {};
        this.docVectors = [];
    }

    tokenize(text) {
        if (!text) return [];
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 1);
    }

    train(docs) {
        this.documents = docs;
        this.vocabulary.clear();
        this.idf = {};
        this.docVectors = [];

        const df = {};
        const N = this.documents.length;

        this.documents.forEach(doc => {
            const textToTrain = doc.trainingText || doc.text;
            const tokens = this.tokenize(textToTrain);
            const uniqueTokens = new Set(tokens);
            uniqueTokens.forEach(token => {
                this.vocabulary.add(token);
                df[token] = (df[token] || 0) + 1;
            });
        });

        this.vocabulary.forEach(token => {
            this.idf[token] = Math.log(N / (df[token] || 1)) + 1;
        });

        this.documents.forEach(doc => {
            const textToTrain = doc.trainingText || doc.text;
            const tokens = this.tokenize(textToTrain);
            const vector = this.computeTFIDFVector(tokens);
            this.docVectors.push(vector);
        });
    }

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

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (const val of Object.values(vecA)) {
            normA += val * val;
        }

        for (const [key, val] of Object.entries(vecB)) {
            normB += val * val;
            if (vecA[key]) {
                dotProduct += vecA[key] * val;
            }
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

async function run() {
    const brainPath = path.resolve(process.cwd(), 'offlineBrain.json');
    const brain = JSON.parse(fs.readFileSync(brainPath, 'utf8'));
    
    const model = new SimpleTFIDFModel();
    model.train(brain);
    
    const query = 'summrize this pdf';
    const queryTokens = model.tokenize(query);
    const queryVector = model.computeTFIDFVector(queryTokens);
    
    console.log("Query tokens:", queryTokens);
    
    brain.forEach((doc, index) => {
        const docVector = model.docVectors[index];
        const score = model.cosineSimilarity(queryVector, docVector);
        console.log(`Document [${index}]: "${doc.text.substring(0, 30)}..."`);
        console.log(`  Training text length: ${doc.trainingText ? doc.trainingText.length : doc.text.length}`);
        console.log(`  Score: ${score}`);
        console.log(`  Matches in doc vector:`, Object.keys(queryVector).filter(k => docVector[k]).map(k => `${k}: qTFIDF=${queryVector[k].toFixed(4)}, dTFIDF=${docVector[k].toFixed(4)}`));
    });
}

run();
