import { Calculator } from "@langchain/community/tools/calculator";
import { DynamicTool } from "@langchain/core/tools";// Safe Calculator Tool
const calculatorTool = new Calculator();

// Free Wikipedia Search Tool (Fallback)
const wikipediaTool = new DynamicTool({
    name: "wikipedia_search",
    description: "Search Wikipedia for general knowledge, facts, and history. Useful for finding information about people, places, events, and concepts.",
    func: async (query) => {
        try {
            const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`);
            const data = await res.json();
            if (data.query && data.query.search && data.query.search.length > 0) {
                // Return the top 3 results
                const topResults = data.query.search.slice(0, 3).map(s => `${s.title}: ${s.snippet.replace(/<[^>]+>/g, '')}`);
                return topResults.join('\n\n');
            }
            return "No relevant Wikipedia results found.";
        } catch (error) {
            return `Error searching Wikipedia: ${error.message}`;
        }
    }
});

export const getAgentTools = () => {
    const tools = [calculatorTool, wikipediaTool];
    return tools;
};
