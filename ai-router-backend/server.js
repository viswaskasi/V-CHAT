import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { callGemini } from './gemini.service.js';
import { callOllama } from './ollama.service.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Main Chat Endpoint
app.post('/chat', async (req, res) => {
    const { model, prompt } = req.body;

    // Validate Input
    if (!prompt) {
        return res.status(400).json({
            status: "error",
            message: "Prompt is required."
        });
    }

    if (!model || !['gemini', 'phi'].includes(model.toLowerCase())) {
        return res.status(400).json({
            status: "error",
            message: "Invalid or missing model. Please select either 'gemini' or 'phi'."
        });
    }

    try {
        let aiOutput = "";
        const selectedModel = model.toLowerCase();

        // Routing Logic
        if (selectedModel === 'gemini') {
            aiOutput = await callGemini(prompt);
        } else if (selectedModel === 'phi') {
            aiOutput = await callOllama(prompt);
        }

        // Unified Response Format
        return res.status(200).json({
            model: selectedModel,
            response: aiOutput,
            status: "success"
        });

    } catch (error) {
        return res.status(500).json({
            model: model.toLowerCase(),
            status: "error",
            message: error.message
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 AI Router Backend running on http://localhost:${PORT}`);
    console.log(`- Supported Models: Gemini (cloud), Phi (Ollama local)`);
    console.log(`- Endpoint: POST http://localhost:${PORT}/chat`);
});
