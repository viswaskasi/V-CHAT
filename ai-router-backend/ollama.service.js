import axios from 'axios';

/**
 * Handles communication with local Ollama API
 * @param {string} prompt - The user's input prompt
 * @returns {Promise<string>} - The generated text response
 */
export const callOllama = async (prompt) => {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const endpoint = `${ollamaUrl}/api/generate`;

    // As per requirements: Use phi3 (or phi4), we will default to phi3.
    // Ensure stream is false to get a single complete JSON response
    const payload = {
        model: "phi3",
        prompt: prompt,
        stream: false
    };

    try {
        const response = await axios.post(endpoint, payload);
        
        if (response.data && response.data.response) {
            return response.data.response;
        } else {
            throw new Error("Invalid response format from Ollama");
        }
    } catch (error) {
        console.error("Ollama API Error:", error.message);
        if (error.code === 'ECONNREFUSED') {
            throw new Error("Could not connect to Ollama. Is the local server running on port 11434?");
        }
        throw new Error(`Ollama API failed: ${error.response?.data?.error || error.message}`);
    }
};
