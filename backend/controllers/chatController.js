const { generateResponse } = require('../services/llmService');
const { speechToText } = require('../services/speechService');
const { getAiSessions, getSessionMessages, persistChatTurn } = require('../services/firebase.service');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { logEvent } = require('../utils/logService');

function formatFunctionalityName(module) {
    const m = String(module || '').trim();
    if (!m) return 'Unknown';
    const key = m.toLowerCase();
    if (key === 'neural_chat') return 'Neural Chat';
    if (key === 'brainstormer') return 'Brainstormer';
    if (key === 'doc_analyzer') return 'Document Analyzer';
    if (key === 'writing_studio') return 'Writing Studio';
    if (key === 'task_board') return 'Task Board';
    if (key === 'live_assistant') return 'Live Assistant';
    return m;
}

function buildSessionTitle(module, message) {
    const raw = typeof message === 'string' ? message.trim() : '';
    const snippet = raw.length > 60 ? `${raw.slice(0, 60)}...` : raw;
    const m = String(module || '').toLowerCase();

    if (m === 'brainstormer') return `Brainstorm — ${snippet || 'New ideas'}`;
    if (m === 'doc_analyzer') return `Doc Analyzer — ${snippet || 'New analysis'}`;
    if (m === 'writing_studio') return `Writing Studio — ${snippet || 'New draft'}`;
    if (m === 'neural_chat') return `Neural Chat — ${snippet || 'New chat'}`;
    if (m === 'task_board') return `Task Board — ${snippet || 'New task'}`;
    if (m === 'live_assistant') return `Live Assistant — ${snippet || 'New request'}`;
    return `Conversation — ${snippet || 'New'}`;
}

const chat = async (req, res) => {
    try {
        let { message, module, sessionId, type } = req.body;
        const userId = req.user.id;

        // MODULE event (best-effort; do not block)
        logEvent(userId, {
            type: 'module',
            action: `OPEN_${String(module || '').toUpperCase()}`,
            module,
            route: '/api/chat',
            metadata: req.session?.metadata,
        });

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

        // Action log: user submitted a message (only after validation)
        logEvent(userId, {
            type: 'action',
            action: 'MESSAGE_SENT',
            module,
            route: '/api/chat',
            description: `User sent a ${inputType} message`,
            metadata: req.session?.metadata,
        });

        // Fetch recent chat history from DB only when continuing an existing session.
        // For brand-new sessions we intentionally avoid creating a session until we have
        // a valid assistant reply to persist (prevents empty “hi…” sessions).
        const currentSessionId = sessionId ? String(sessionId) : null;
        const dbHistory = currentSessionId ? await getSessionMessages(userId, currentSessionId, 20) : [];
        
        // Format history for HF prompt
        const historyForPrompt = dbHistory.map(msg => ({ role: msg.role, content: msg.content }));

        // Terminal visibility: which functionality/module is invoking the LLM
        console.log(`Functionality: ${formatFunctionalityName(module)}`);

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

        const llm = await generateResponse(message.trim(), historyForPrompt, systemContext);
        const aiResponseText = llm?.content;
        const provider = llm?.provider;
        const notice = llm?.notice;

        // AI event
        logEvent(userId, {
            type: 'ai',
            action: 'AI_RESPONSE_GENERATED',
            provider: provider || null,
            module,
            route: '/api/chat',
            description: notice ? String(notice) : `AI response generated using ${provider || 'unknown provider'}`,
            metadata: req.session?.metadata,
        });

        const title = currentSessionId ? null : buildSessionTitle(module, message);

        const persisted = await persistChatTurn({
            userId,
            module,
            sessionId: currentSessionId,
            title,
            userMessage: message.trim(),
            assistantMessage: aiResponseText,
            provider,
            notice,
            inputType,
            endpoint: '/api/chat',
        });

        // API events
        if (!currentSessionId && persisted?.sessionId) {
            logEvent(userId, {
                type: 'api',
                action: 'SESSION_CREATED',
                module,
                route: '/api/sessions',
                metadata: req.session?.metadata,
            });
        }
        logEvent(userId, {
            type: 'api',
            action: 'MESSAGE_SENT',
            module,
            route: '/api/messages',
            metadata: req.session?.metadata,
        });

        // 6. Return structured response
        successResponse(res, 'AI Response generated', {
            reply: aiResponseText,
            sessionId: persisted?.sessionId || currentSessionId,
            messageId: persisted?.assistantMessageId,
            role: 'assistant',
            provider: provider || null,
            notice: notice || null,
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

        logEvent(userId, {
            type: 'api',
            action: 'API_CALL',
            module: module ? String(module) : null,
            route: '/api/sessions',
            metadata: req.session?.metadata,
        });

        // This endpoint is called when opening modules (sidebar/history load)
        if (module) console.log(`Functionality: ${formatFunctionalityName(module)} (sessions)`);

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

        logEvent(userId, {
            type: 'api',
            action: 'API_CALL',
            module: null,
            route: `/api/messages/${sessionId}`,
            metadata: req.session?.metadata,
        });

        if (!sessionId) {
            return errorResponse(res, 400, 'Session ID is required');
        }

        // Called when opening a session; module may be unknown here
        console.log(`Functionality: Session Messages (sessionId=${sessionId})`);

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
