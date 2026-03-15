const { generateGeminiResponse } = require('../services/gemini.service');
const { saveChatMessage, getChatHistory, clearChatHistory } = require('../services/firebase.service');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const chat = async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.id;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return errorResponse(res, 400, 'Message is required and must be a non-empty string');
        }

        // 1. Fetch recent chat history from DB to provide context (last 10 messages)
        const dbHistory = await getChatHistory(userId, 10);

        // 2. Generate AI Response
        const aiResponseText = await generateGeminiResponse(message.trim(), dbHistory);

        // 3. Save User Message to DB
        await saveChatMessage(userId, 'user', message.trim());

        // 4. Save AI Response to DB
        const savedAiMessage = await saveChatMessage(userId, 'assistant', aiResponseText);

        // 5. Return structured response
        successResponse(res, 'AI Response generated', {
            reply: aiResponseText,
            messageId: savedAiMessage.id,
            role: 'assistant'
        });

    } catch (err) {
        errorResponse(res, 500, 'Failed to process chat message', err.message);
    }
};

const getHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const history = await getChatHistory(userId, 50);
        successResponse(res, 'Chat history retrieved', history);
    } catch (err) {
        errorResponse(res, 500, 'Failed to retrieve chat history', err.message);
    }
};

const deleteHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        await clearChatHistory(userId); // Clean service-layer call — no inline DB logic
        successResponse(res, 'Chat history cleared');
    } catch (err) {
        errorResponse(res, 500, 'Failed to clear chat history', err.message);
    }
};

module.exports = {
    chat,
    getHistory,
    deleteHistory
};
