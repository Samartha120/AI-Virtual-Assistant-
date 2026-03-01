const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
    console.error('⚠️  GEMINI_API_KEY is missing from environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getModel = () => genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Build a safe generateContent call using the object API (more compatible than string shorthand)
const callGemini = async (text) => {
    const model = getModel();
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text }] }]
    });
    return result.response.text();
};

const SYSTEM_PROMPT = `You are NexusAI, an intelligent enterprise AI assistant. Be helpful, accurate, and concise.`;

// ─── Chat ─────────────────────────────────────────────────────────────────────
const generateGeminiResponse = async (message, history = []) => {
    const historyLines = history.map(m =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n');

    const fullText = [
        SYSTEM_PROMPT,
        historyLines || null,
        `User: ${message}`,
        'Assistant:'
    ].filter(Boolean).join('\n\n');

    return callGemini(fullText);
};

// ─── Brainstorm Ideas ─────────────────────────────────────────────────────────
const brainstormIdeas = async (topic) => {
    return callGemini(
        `Generate 7 innovative, actionable ideas for: "${topic}".\nReturn each idea on a new line prefixed with a number (e.g. "1. Idea here").`
    );
};

// ─── Analyze Document ─────────────────────────────────────────────────────────
const analyzeDocument = async (text) => {
    const raw = await callGemini(
        `Analyze the following content and return a JSON object with exactly these fields:
- "summary": A 3-sentence executive summary (string)
- "keyPoints": Array of 4-6 critical insights (array of strings)
- "actionItems": Array of 3-5 next steps (array of strings)

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences.

Content:
${text.slice(0, 8000)}`
    );
    return raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
};

// ─── Task Analysis ────────────────────────────────────────────────────────────
const generateTaskAnalysis = async (taskStr) => {
    return callGemini(
        `As a project manager, provide a concise strategic plan (3-5 sentences) for these tasks. Prioritize by impact and urgency.\n\nTasks: ${taskStr}`
    );
};

// ─── Decompose Task ───────────────────────────────────────────────────────────
const decomposeTask = async (taskTitle) => {
    const raw = await callGemini(
        `Break down this task into 3-5 actionable subtasks. Return ONLY a JSON array where each item has "title" (string) and "priority" ("low"|"medium"|"high"). No markdown, no extra text.\n\nTask: ${taskTitle}`
    );
    return raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
};

module.exports = { generateGeminiResponse, brainstormIdeas, analyzeDocument, generateTaskAnalysis, decomposeTask };
