import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY);
        const data = await response.json();
        console.log("Available Models:");
        data.models.forEach(model => {
            if (model.name.includes("gemini")) {
                console.log(`- ${model.name}`);
            }
        });
    } catch (e) {
        console.error(e);
    }
}

listModels();
