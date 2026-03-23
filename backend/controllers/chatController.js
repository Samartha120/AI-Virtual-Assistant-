const { generateResponse } = require('../services/llmService');
const { speechToText } = require('../services/speechService');
const { createAiSession, getAiSessions, getSessionMessages, saveSessionMessage, saveAIInteraction } = require('../services/firebase.service');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const chat = async (req, res) => {
    try {
        let { message, module, sessionId, type } = req.body;
        const userId = req.user.id;

        // Default to text if not specified
        const inputType = type === 'voice' ? 'voice' : 'text';

        if (inputType === 'voice') {
            if (!req.file || !req.file.buffer) {
                return errorResponse(res, 400, 'Audio file is required for voice input');
            }
            try {
                // Convert audio to text
                message = await speechToText(req.file.buffer, req.file.mimetype);
            } catch (err) {
                return errorResponse(res, 500, 'Speech-to-text conversion failed', err.message);
            }
        }

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return errorResponse(res, 400, 'Message is required and must be a non-empty string');
        }

        if (!module || typeof module !== 'string') {
            return errorResponse(res, 400, 'Module is required');
        }

        let currentSessionId = sessionId;
        if (!currentSessionId) {
            // Create a new session, name it by trimming message
            const title = message.trim().substring(0, 40) + '...';
            const newSession = await createAiSession(userId, module, title);
            currentSessionId = newSession.id;
        }

        // Fetch recent chat history from DB for this session
        const dbHistory = await getSessionMessages(userId, currentSessionId, 20);
        
        // Format history for HF prompt
        const historyForPrompt = dbHistory.map(msg => ({ role: msg.role, content: msg.content }));

        // 2. Generate AI Response
        let systemContext = `You are an AI assistant for the Nexus AI application, currently operating in the ${module} module.`;
        if (module === 'brainstormer') {
            systemContext = `You are a creative Brainstorming AI. Generate innovative, actionable ideas for the user's topic. Return each idea on a new line prefixed with a number (e.g. "1. Idea here").`;
        } else if (module === 'doc_analyzer') {
            systemContext = `You are a Document Analyzer AI. Analyze the content and return a JSON object with exactly these fields: "summary" (3-sentence string), "keyPoints" (array of 4-6 strings), "actionItems" (array of 3-5 strings). Return ONLY valid JSON.`;
        } else if (module === 'task_board') {
            systemContext = `You are a Project Manager AI. Provide concise strategic plans or decompose tasks into a JSON array of objects with "title" and "priority" ("low"|"medium"|"high").`;
        } else if (module === 'live_assistant') {
            systemContext = `You are NexusAI, an elite academic and professional assistant. Provide brief, ultra-intelligent, and concise verbal responses suitable for speech synthesis.`;
        }

        const aiResponseText = await generateResponse(message.trim(), historyForPrompt, systemContext);

        // 3. Save User Message to DB
        await saveSessionMessage(userId, currentSessionId, 'user', message.trim(), inputType);

        // 4. Save AI Response to DB
        const savedAiMessage = await saveSessionMessage(userId, currentSessionId, 'assistant', aiResponseText, 'text');

        // 5. Log interaction
        saveAIInteraction({
            userId,
            module,
            prompt: message.trim(),
            response: aiResponseText,
            endpoint: '/api/chat',
        }).catch((e) => console.warn('[Firestore] saveAIInteraction failed:', e?.message || e));

        // 6. Return structured response
        successResponse(res, 'AI Response generated', {
            reply: aiResponseText,
            sessionId: currentSessionId,
            messageId: savedAiMessage.id,
            role: 'assistant'
        });

    } catch (err) {
        console.error('Chat Error:', err);
        errorResponse(res, 500, 'Failed to process chat message', err.message);
    }
};

const getSessions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { module } = req.query;
        const sessions = await getAiSessions(userId, module);
        successResponse(res, 'Sessions retrieved', sessions);
    } catch (err) {
        errorResponse(res, 500, 'Failed to retrieve sessions', err.message);
    }
};

const getMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.params;
        if (!sessionId) {
            return errorResponse(res, 400, 'Session ID is required');
        }
        const messages = await getSessionMessages(userId, sessionId, 100);
        successResponse(res, 'Session messages retrieved', messages);
    } catch (err) {
        errorResponse(res, 500, 'Failed to retrieve messages', err.message);
    }
};

module.exports = {
    chat,
    getSessions,
    getMessages
};
