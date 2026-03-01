const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
    console.error('⚠️  GEMINI_API_KEY is missing from environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Shared model — gemini-1.5-flash for all AI features
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const SYSTEM_PROMPT = `You are NexusAI, an intelligent enterprise AI assistant. You are helpful, accurate, and concise.
You assist users with tasks such as answering questions, brainstorming ideas, analyzing documents, and managing tasks.
Always respond in a professional, clear, and structured manner. If you are unsure about something, say so clearly.`;

// ─── Chat (with history context) ─────────────────────────────────────────────
const generateGeminiResponse = async (message, history = []) => {
    try {
        const chatHistory = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: 'System instructions: ' + SYSTEM_PROMPT }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'Understood. I am NexusAI, your enterprise AI assistant. How can I help you today?' }]
                },
                ...chatHistory
            ],
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.7,
            },
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini Chat Error:', error?.message || error);
        throw new Error('Failed to generate AI response. Please try again.');
    }
};

// ─── Brainstorm Ideas ─────────────────────────────────────────────────────────
const brainstormIdeas = async (topic) => {
    try {
        const result = await model.generateContent(
            `You are a creative strategist. Generate 7 innovative, actionable ideas for the following topic. 
Return each idea on a new line, prefixed with a number (e.g., "1. Idea here"). Be specific and insightful.

Topic: ${topic}`
        );
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini Brainstorm Error:', error?.message || error);
        throw new Error('Failed to generate ideas. Please try again.');
    }
};

// ─── Analyze Document ─────────────────────────────────────────────────────────
const analyzeDocument = async (text) => {
    try {
        const result = await model.generateContent(
            `You are an expert document analyst. Analyze the following content and return a JSON object with exactly these fields:
- "summary": A 3-sentence executive summary
- "keyPoints": Array of 4-6 most critical insights (strings)
- "actionItems": Array of 3-5 specific next steps (strings)

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no extra text.

Content: ${text.slice(0, 8000)}`
        );
        const response = await result.response;
        const raw = response.text().trim();
        // Strip any accidental markdown fences from model output
        const clean = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/```$/, '').trim();
        return clean;
    } catch (error) {
        console.error('Gemini Analyze Error:', error?.message || error);
        throw new Error('Failed to analyze document. Please try again.');
    }
};

// ─── Task Analysis (AI Optimize) ──────────────────────────────────────────────
const generateTaskAnalysis = async (taskStr) => {
    try {
        const result = await model.generateContent(
            `As an elite project manager, provide a concise strategic execution plan (3-5 sentences) 
for the following tasks. Prioritize by impact and urgency.

Tasks: ${taskStr}`
        );
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini Task Analysis Error:', error?.message || error);
        throw new Error('Failed to analyze tasks. Please try again.');
    }
};

// ─── Decompose Task into Subtasks ─────────────────────────────────────────────
const decomposeTask = async (taskTitle) => {
    try {
        const result = await model.generateContent(
            `Break down the following task into 3-5 actionable subtasks. 
Return a JSON array where each item has "title" (string) and "priority" ("low" | "medium" | "high").
IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no extra text.

Task: ${taskTitle}`
        );
        const response = await result.response;
        const raw = response.text().trim();
        const clean = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/```$/, '').trim();
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

