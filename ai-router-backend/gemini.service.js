import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Handles communication with Google Gemini API
 * @param {string} prompt - The user's input prompt
 * @returns {Promise<string>} - The generated text response
 */
export const callGemini = async (prompt) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_actual_gemini_key_here') {
        throw new Error("GEMINI_API_KEY is missing or invalid in .env file.");
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Using the recommended default model for text generation
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API Error:", error.message);
        throw new Error(`Gemini API failed: ${error.message}`);
    }
};
