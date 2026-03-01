const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is missing from environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use current stable model (gemini-pro is deprecated)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const SYSTEM_PROMPT = `You are NexusAI, an intelligent enterprise AI assistant. You are helpful, accurate, and concise.
You assist users with tasks such as answering questions, brainstorming ideas, analyzing documents, and managing tasks.
Always respond in a professional, clear, and structured manner. If you are unsure about something, say so clearly.`;

const generateGeminiResponse = async (message, history = []) => {
    try {
        // Construct chat history for Gemini API format
        // Gemini expects { role: "user" | "model", parts: [{ text: "..." }] }
        const chatHistory = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
            history: [
                // Inject system personality as first turn
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
        const text = response.text();

        return text;
    } catch (error) {
        console.error('Gemini API Error:', error?.message || error);
        throw new Error('Failed to generate AI response. Please try again.');
    }
};

module.exports = {
    generateGeminiResponse
};
