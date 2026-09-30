import { runMigrations } from "./client";
import { agentsRepository } from "@/lib/repositories/agents";

const STARTER_AGENTS = [
  {
    name: "Text Summarizer",
    description: "Summarizes any text into concise key points",
    status: "active" as const,
    config: {
      model: "gemini-2.0-flash",
      temperature: 0.3,
      maxTokens: 1024,
      systemPrompt: `You are a concise text summarizer. Summarize the provided text into key points.

Return a JSON object with:
- summary: A 2-3 sentence overview
- keyPoints: An array of 3-5 bullet points
- wordCount: The approximate word count of the original text`,
      inputParams: [
        {
          id: "text",
          name: "text",
          type: "string" as const,
          required: true,
          description: "The text to summarize",
        },
      ],
      outputFormat: "json" as const,
      outputSchema: JSON.stringify({
        type: "object",
        properties: {
          summary: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" } },
          wordCount: { type: "number" },
        },
        required: ["summary", "keyPoints", "wordCount"],
      }),
      strictValidation: false,
      maxIterations: 1,
      repairRetries: 1,
      timeoutMs: 30000,
    },
  },
  {
    name: "Sentiment Classifier",
    description: "Analyzes text sentiment with confidence scores",
    status: "active" as const,
    config: {
      model: "gemini-2.0-flash",
      temperature: 0.1,
      maxTokens: 512,
      systemPrompt: `You are a sentiment analysis expert. Analyze the sentiment of the provided text.

Return a JSON object with:
- sentiment: One of "positive", "negative", "neutral", "mixed"
- confidence: A number between 0 and 1
- explanation: A brief explanation of your analysis
- emotions: An array of detected emotions (e.g., ["joy", "surprise"])`,
      inputParams: [
        {
          id: "text",
          name: "text",
          type: "string" as const,
          required: true,
          description: "The text to analyze",
        },
      ],
      outputFormat: "json" as const,
      outputSchema: JSON.stringify({
        type: "object",
        properties: {
          sentiment: { type: "string", enum: ["positive", "negative", "neutral", "mixed"] },
          confidence: { type: "number" },
          explanation: { type: "string" },
          emotions: { type: "array", items: { type: "string" } },
        },
        required: ["sentiment", "confidence", "explanation"],
      }),
      strictValidation: false,
      maxIterations: 1,
      repairRetries: 1,
      timeoutMs: 30000,
    },
  },
  {
    name: "Data Extractor",
    description: "Extracts structured data from unstructured text",
    status: "active" as const,
    config: {
      model: "gemini-2.0-flash",
      temperature: 0.1,
      maxTokens: 2048,
      systemPrompt: `You are a data extraction specialist. Extract structured information from the provided text.

Extract all relevant entities and facts into a JSON object with appropriate keys. Be thorough and accurate.`,
      inputParams: [
        {
          id: "text",
          name: "text",
          type: "string" as const,
          required: true,
          description: "The text to extract data from",
        },
        {
          id: "fields",
          name: "fields",
          type: "string" as const,
          required: false,
          description: "Comma-separated list of specific fields to extract (optional)",
        },
      ],
      outputFormat: "json" as const,
      outputSchema: "{}",
      strictValidation: false,
      maxIterations: 1,
      repairRetries: 1,
      timeoutMs: 30000,
    },
  },
];

export async function seed() {
  runMigrations();
  console.log("Running seed...");

  const existing = await agentsRepository.findAll();
  if (existing.length > 0) {
    console.log("Database already has agents, skipping seed.");
    return;
  }

  for (const agent of STARTER_AGENTS) {
    await agentsRepository.create(agent);
    console.log(`Created agent: ${agent.name}`);
  }

  console.log("Seed complete.");
}

// Run if called directly
if (require.main === module) {
  seed().catch(console.error);
}
