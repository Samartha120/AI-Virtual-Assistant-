const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
    console.error('⚠️  GEMINI_API_KEY is missing from environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Model factory (fresh instance per call avoids stale state) ───────────────
const getModel = () => genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const SYSTEM_PROMPT = `You are NexusAI, an intelligent enterprise AI assistant. You are helpful, accurate, and concise.
You assist users with tasks such as answering questions, brainstorming ideas, analyzing documents, and managing tasks.
Always respond in a professional, clear, and structured manner.`;

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT SDK NOTE (@google/generative-ai):
//   model.generateContent()  → returns GenerateContentResult
//   result.response          → is the GenerateContentResponse (NOT a Promise)
//   result.response.text()   → returns the text string
//   DO NOT await result.response — it is already resolved.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Chat ─────────────────────────────────────────────────────────────────────
const generateGeminiResponse = async (message, history = []) => {
    try {
        const model = getModel();

        // Build a full prompt with system context + optional history + new message
        const historyText = history.length > 0
            ? history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')
            : '';

        const prompt = [
            SYSTEM_PROMPT,
            historyText,
            `User: ${message}`,
            'Assistant:'
        ].filter(Boolean).join('\n\n');

        const result = await model.generateContent(prompt);
        const text = result.response.text();       // ✅ Direct access — NOT awaited
        return text;
    } catch (error) {
        console.error('Gemini Chat Error:', error?.message || error);
        throw new Error('Failed to generate AI response. Please try again.');
    }
};

// ─── Brainstorm Ideas ─────────────────────────────────────────────────────────
const brainstormIdeas = async (topic) => {
    try {
        const model = getModel();
        const result = await model.generateContent(
            `${SYSTEM_PROMPT}\n\nGenerate 7 innovative, actionable ideas for the following topic.\nReturn each idea on a new line prefixed with a number (e.g. "1. Idea here").\n\nTopic: ${topic}`
        );
        const text = result.response.text();       // ✅ Direct access — NOT awaited
        return text;
    } catch (error) {
        console.error('Gemini Brainstorm Error:', error?.message || error);
        throw new Error('Failed to generate ideas. Please try again.');
    }
};

// ─── Analyze Document ─────────────────────────────────────────────────────────
const analyzeDocument = async (text) => {
    try {
        const model = getModel();
        const result = await model.generateContent(
            `You are an expert document analyst. Analyze the content below and return a JSON object with exactly these fields:
- "summary": A 3-sentence executive summary (string)
- "keyPoints": Array of 4-6 most critical insights (array of strings)
- "actionItems": Array of 3-5 specific next steps (array of strings)

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no extra text.

Content:
${text.slice(0, 8000)}`
        );
        const raw = result.response.text().trim(); // ✅ Direct access — NOT awaited
        // Strip accidental markdown fences Gemini sometimes adds
        const clean = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        return clean;
    } catch (error) {
        console.error('Gemini Analyze Error:', error?.message || error);
        throw new Error('Failed to analyze document. Please try again.');
    }
};

// ─── Task Analysis (AI Optimize) ──────────────────────────────────────────────
const generateTaskAnalysis = async (taskStr) => {
    try {
        const model = getModel();
        const result = await model.generateContent(
            `${SYSTEM_PROMPT}\n\nAs an elite project manager, provide a concise strategic execution plan (3-5 sentences) for the tasks below. Prioritize by impact and urgency.\n\nTasks: ${taskStr}`
        );
        const text = result.response.text();       // ✅ Direct access — NOT awaited
        return text;
    } catch (error) {
        console.error('Gemini Task Analysis Error:', error?.message || error);
        throw new Error('Failed to analyze tasks. Please try again.');
    }
};

// ─── Decompose Task into Subtasks ─────────────────────────────────────────────
const decomposeTask = async (taskTitle) => {
    try {
        const model = getModel();
        const result = await model.generateContent(
            `Break down the following task into 3-5 actionable subtasks.
Return a JSON array where each item has:
  - "title": string
  - "priority": "low" | "medium" | "high"

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no extra text.

Task: ${taskTitle}`
        );
        const raw = result.response.text().trim(); // ✅ Direct access — NOT awaited
        const clean = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        return clean;
    } catch (error) {
        console.error('Gemini Decompose Error:', error?.message || error);
        throw new Error('Failed to decompose task. Please try again.');
    }
};

module.exports = {
    generateGeminiResponse,
    brainstormIdeas,
    analyzeDocument,
    generateTaskAnalysis,
    decomposeTask,
};
