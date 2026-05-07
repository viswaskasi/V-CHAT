import axios from 'axios';

async function testOllama() {
    try {
        const res = await axios.post('http://localhost:11434/api/generate', {
            model: 'phi3',
            prompt: 'which model are you',
            stream: false
        });
        console.log("Ollama response:", res.data.response);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testOllama();
