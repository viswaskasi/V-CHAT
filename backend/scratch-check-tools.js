import { getAgentTools } from './tools/agentTools.js';
import dotenv from 'dotenv';

dotenv.config();

async function runTests() {
    const tools = getAgentTools();
    const calculator = tools[0];
    const googleSearch = tools[1];
    const codeExecution = tools[2];

    console.log("=== STARTING AGENT TOOLS VERIFICATION ===");

    // Test 1: Calculator Tool
    console.log("\n[Test 1] Executing Calculator (2 + 2):");
    try {
        const result = await calculator.invoke("2 + 2");
        console.log("Result:", result);
    } catch (err) {
        console.error("Calculator Error:", err.message);
    }

    // Test 2: Web Search Scraper Tool
    console.log("\n[Test 2] Executing Web Search ('Formula 1 latest winner'):");
    try {
        const result = await googleSearch.invoke("Formula 1 latest winner");
        console.log("Result Snippet:\n", result.substring(0, 500) + "\n...");
    } catch (err) {
        console.error("Search Error:", err.message);
    }

    // Test 3: Python / JS Code Execution Tool
    console.log("\n[Test 3] Executing Code Execution (Fibonacci 10th number):");
    const pythonCode = `
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
`;
    try {
        const result = await codeExecution.invoke(pythonCode);
        console.log("Result:", result.trim());
    } catch (err) {
        console.error("Execution Error:", err.message);
    }

    console.log("\n=== VERIFICATION FINISHED ===");
}

runTests();
