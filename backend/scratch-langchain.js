import { handleChatStream } from './controllers/langchainChatController.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const req = {
    body: {
        chatId: "6a26dace6bbb463d9ea11ded",
        message: "hello",
        attachments: [],
        provider: "gemini"
    }
};

const res = {
    headers: {},
    setHeader(k, v) { 
        this.headers[k] = v;
    },
    write(data) {
        console.log("STREAM WRITE:", data);
    },
    end() {
        console.log("STREAM END");
        mongoose.disconnect();
        process.exit(0);
    }
};

async function test() {
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-chatbot';
    try {
        await mongoose.connect(dbUri);
        console.log("Connected to MongoDB, starting stream handler...");
        await handleChatStream(req, res);
    } catch (err) {
        console.error("Test function failed:", err);
        mongoose.disconnect();
    }
}

test();
