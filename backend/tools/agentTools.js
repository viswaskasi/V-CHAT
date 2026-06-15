import { Calculator } from "@langchain/community/tools/calculator";
import { DynamicTool } from "@langchain/core/tools";
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const calculatorTool = new Calculator();

// Helper to execute Javascript code block in Node.js
async function executeJS(code) {
    const tempDir = path.resolve(process.cwd(), 'scratch');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFile = path.join(tempDir, `exec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.js`);
    
    try {
        fs.writeFileSync(tempFile, code, 'utf8');
        const { stdout, stderr } = await execPromise(`node "${tempFile}"`, { timeout: 5000 });
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        if (stderr) return `Error during Javascript execution:\n${stderr}`;
        return stdout || "Code executed successfully with no output.";
    } catch (error) {
        if (fs.existsSync(tempFile)) {
            try { fs.unlinkSync(tempFile); } catch(e) {}
        }
        if (error.killed) {
            return `Execution Error: Code execution timed out after 5 seconds.`;
        }
        return `Execution Error: ${error.message}`;
    }
}

// Custom Code Execution Tool (Runs Python if available, falls back to JS Node.js execution)
const codeExecutionTool = new DynamicTool({
    name: "code_execution",
    description: "Execute Python code locally to perform calculations, parse data, or solve logic problems. Input should be a single block of valid Python code. If Python is not installed or returns command not found errors, write the equivalent Javascript code block and the system will run it in Node.js.",
    func: async (code) => {
        // Check if the code looks like Javascript or JS keywords are present
        const isJS = code.includes('const ') || code.includes('let ') || code.includes('console.log') || code.includes('function ');
        if (isJS) {
            return await executeJS(code);
        }

        const tempDir = path.resolve(process.cwd(), 'scratch');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const tempFile = path.join(tempDir, `exec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.py`);
        
        try {
            fs.writeFileSync(tempFile, code, 'utf8');
            
            // Check python version to see which command is available
            let command = 'python';
            try {
                await execPromise('python --version');
            } catch (e) {
                try {
                    await execPromise('python3 --version');
                    command = 'python3';
                } catch (e2) {
                    // Python is not installed, fallback to JavaScript Node.js execution!
                    fs.unlinkSync(tempFile);
                    return await executeJS(code);
                }
            }
            
            const { stdout, stderr } = await execPromise(`${command} "${tempFile}"`, { timeout: 5000 });
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            if (stderr) return `Error during Python execution:\n${stderr}`;
            return stdout || "Code executed successfully with no output.";
        } catch (error) {
            if (fs.existsSync(tempFile)) {
                try { fs.unlinkSync(tempFile); } catch(e) {}
            }
            if (error.killed) {
                return `Execution Error: Code execution timed out after 5 seconds.`;
            }
            // If python run failed but it's not a timeout, try running as JS just in case
            try {
                return await executeJS(code);
            } catch (jsErr) {
                return `Execution Error: ${error.message}`;
            }
        }
    }
});

// Custom Search Tool (Tavily search API or free DuckDuckGo HTML scraper fallback)
const googleSearchTool = new DynamicTool({
    name: "google_search",
    description: "Search Google for real-time information, news, current events, and up-to-date facts. Input should be a simple search query string.",
    func: async (query) => {
        const tavilyKey = process.env.TAVILY_API_KEY;
        
        // 1. Tavily Search API (if key exists)
        if (tavilyKey && tavilyKey !== 'your_actual_tavily_api_key_here') {
            try {
                const res = await fetch("https://api.tavily.com/search", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: tavilyKey, query: query, max_results: 3 })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.results && data.results.length > 0) {
                        return data.results.map(r => `**${r.title}**\nURL: ${r.url}\nSnippet: ${r.content}`).join('\n\n');
                    }
                }
            } catch (e) {
                console.error("Tavily API search failed, falling back to keyless search:", e.message);
            }
        }

        // 2. DuckDuckGo HTML Scraper Fallback (completely keyless and free)
        try {
            const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            
            const html = await res.text();
            const results = [];
            const resultRegex = /<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div class="result__snippet"[^>]*>([\s\S]*?)<\/div>)/g;
            let match;
            let count = 0;
            
            while ((match = resultRegex.exec(html)) !== null && count < 3) {
                const url = match[1];
                // Clean HTML tags and entities
                const title = match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
                const snippet = (match[3] || match[4] || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
                results.push(`**${title}**\nSource: ${url}\nSnippet: ${snippet}`);
                count++;
            }

            if (results.length > 0) {
                return results.join('\n\n');
            }

            // 3. Wikipedia Fallback if scraper fails
            const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`);
            const wikiData = await wikiRes.json();
            if (wikiData.query && wikiData.query.search && wikiData.query.search.length > 0) {
                return wikiData.query.search.slice(0, 3).map(s => `**${s.title} (Wikipedia)**\nSnippet: ${s.snippet.replace(/<[^>]+>/g, '')}`).join('\n\n');
            }

            return "No search results found.";
        } catch (error) {
            return `Error performing web search: ${error.message}`;
        }
    }
});

export const getAgentTools = () => {
    // Expose Calculator, Google Search, and Code Execution tools
    const tools = [calculatorTool, googleSearchTool, codeExecutionTool];
    return tools;
};
