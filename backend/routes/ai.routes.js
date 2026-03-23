const express = require('express');
const router = express.Router();
const {
    generateGrokResponse,
    streamGrokResponse,
    brainstormIdeas,
    analyzeDocument,
    generateTaskAnalysis,
    decomposeTask,
} = require('../services/grok.service');

const { adminAuth } = require('../config/firebaseAdmin');
const { saveAIInteraction, saveChatMessage } = require('../services/firebase.service');

async function getOptionalUserId(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !adminAuth) return null;

    const token = authHeader.split(' ')[1];
    if (!token) return null;

    try {
        const decoded = await adminAuth.verifyIdToken(token);
        return decoded?.uid || null;
    } catch {
        return null;
    }
}

function buildPromptWithContext(message, context) {
    const msg = typeof message === 'string' ? message.trim() : '';
    const ctx = typeof context === 'string' ? context.trim() : '';
    if (!ctx) return msg;
    return `${ctx}\n\nUser Question: ${msg}`;
}

// Helper functions for consistent responses (assuming these are defined elsewhere or need to be added)
function errorResponse(res, status, message, detail = null) {
    res.status(status).json({ success: false, error: message, detail });
}

function successResponse(res, message, data = {}) {
    res.json({ success: true, message, ...data });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai-status  — health check to verify Grok key is set
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ai-status', (req, res) => {
    const key = (process.env.HF_API_KEY || '').trim();
    if (!key) {
      return errorResponse(res, 503, 'AI Service is unavailable (HF_API_KEY missing)');
    }

    const isGoogleKey = key.startsWith('AIza');
    
    successResponse(res, 'AI Service is configured', {
      keySet: true,
      keyType: isGoogleKey ? 'google_suspicious' : 'huggingface',
      build: {
            commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
            service: process.env.RENDER_SERVICE_NAME || null,
            instance: process.env.RENDER_INSTANCE_ID || null,
        },
        keyPreview: key
            ? `${key.slice(0, 8)}...`
            : 'NOT SET',
        baseURL: process.env.GROK_BASE_URL || (/^gsk_/i.test(key) ? 'https://api.groq.com/openai/v1' : 'https://api.x.ai/v1'),
        provider: (process.env.GROK_BASE_URL || '').includes('groq.com')
            ? 'groq'
            : (process.env.GROK_BASE_URL || '').includes('x.ai')
              ? 'xai'
              : /^gsk_/i.test(key)
                ? 'groq'
                : 'xai',
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat
// Body: { message: string, history?: Array<{role, content}> }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
    try {
        const { message, context, history = [] } = req.body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const userId = await getOptionalUserId(req);
        const fullPrompt = buildPromptWithContext(message, context);

        const reply = await generateGrokResponse(fullPrompt, history);
        // Persist both chat history and the generic AI interaction log when authenticated.
        if (userId) {
            try {
                await saveChatMessage(userId, 'user', message.trim());
                await saveChatMessage(userId, 'assistant', reply);
            } catch (e) {
                console.warn('[Firestore] Failed to persist chat_messages:', e?.message || e);
            }
        }

        // Always log AI outputs (userId may be null if not authenticated)
        saveAIInteraction({
            userId,
            module: 'Neural Chat',
            prompt: fullPrompt,
            response: reply,
            endpoint: '/api/chat',
        }).catch((e) => console.warn('[Firestore] saveAIInteraction failed:', e?.message || e));

        res.json({ success: true, reply });

    } catch (error) {
        console.error('[/api/chat Error]', error);
        res.status(error.status || 500).json({
            success: false,
            error: 'AI processing failed',
            detail: error.message, // expose detail for debugging
            code: error.code,
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/stream (SSE)
// Body: { message: string, history?: Array<{role, content}> }
// Streams: { delta: string } events + final [DONE]
// ─────────────────────────────────────────────────────────────────────────────
router.post('/chat/stream', async (req, res) => {
    const { message, history = [] } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Message is required' });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const controller = new AbortController();
    const onClose = () => {
        controller.abort();
    };
    req.on('close', onClose);

    try {
        const userId = await getOptionalUserId(req);
        const stream = await streamGrokResponse(message.trim(), history, { signal: controller.signal });
        let fullText = '';

        for await (const delta of stream) {
            fullText += delta;
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }

        // Best-effort persistence after streaming completes
        saveAIInteraction({
            userId,
            module: 'Neural Chat (stream)',
            prompt: message.trim(),
            response: fullText,
            endpoint: '/api/chat/stream',
        }).catch((e) => console.warn('[Firestore] saveAIInteraction failed:', e?.message || e));

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('[/api/chat/stream Error]', error);
        res.write(`data: ${JSON.stringify({ error: error.message, code: error.code })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
    } finally {
        req.off('close', onClose);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/brainstorm
// Body: { topic: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/brainstorm', async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic || typeof topic !== 'string' || !topic.trim()) {
            return res.status(400).json({ success: false, error: 'Topic is required' });
        }

        const userId = await getOptionalUserId(req);
        const ideas = await brainstormIdeas(topic.trim());

        saveAIInteraction({
            userId,
            module: 'Brainstormer',
            prompt: topic.trim(),
            response: ideas,
            endpoint: '/api/brainstorm',
        }).catch((e) => console.warn('[Firestore] saveAIInteraction failed:', e?.message || e));
        res.json({ success: true, ideas });

    } catch (error) {
        console.error('[/api/brainstorm Error]', error);
        res.status(error.status || 500).json({ success: false, error: 'Brainstorming failed', detail: error.message, code: error.code });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analyze
// Body: { text: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/analyze', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, error: 'Document text is required' });
        }

        const userId = await getOptionalUserId(req);
        const rawResult = await analyzeDocument(text.trim());

        let parsed;
        try {
            parsed = JSON.parse(rawResult);
        } catch {
            return res.status(500).json({ success: false, error: 'AI returned malformed JSON', raw: rawResult });
        }

        saveAIInteraction({
            userId,
            module: 'Doc Analyzer',
            prompt: text.trim(),
            response: parsed,
            endpoint: '/api/analyze',
        }).catch((e) => console.warn('[Firestore] saveAIInteraction failed:', e?.message || e));

        res.json({ success: true, result: parsed });

    } catch (error) {
        console.error('[/api/analyze Error]', error);
        res.status(error.status || 500).json({ success: false, error: 'Document analysis failed', detail: error.message, code: error.code });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tasks/ai
// Body: { action: 'analyze'|'decompose', tasks?: string, taskTitle?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tasks/ai', async (req, res) => {
    try {
        const { action, tasks, taskTitle } = req.body;

        const userId = await getOptionalUserId(req);

        if (action === 'analyze') {
            if (!tasks) return res.status(400).json({ success: false, error: 'tasks required' });
            const advice = await generateTaskAnalysis(tasks.trim());

            saveAIInteraction({
                userId,
                module: 'Task AI: Optimize',
                prompt: tasks.trim(),
                response: advice,
                endpoint: '/api/tasks/ai',
                meta: { action: 'analyze' },
            }).catch((e) => console.warn('[Firestore] saveAIInteraction failed:', e?.message || e));
            return res.json({ success: true, advice });
        }

        if (action === 'decompose') {
            if (!taskTitle) return res.status(400).json({ success: false, error: 'taskTitle required' });
            const rawSubtasks = await decomposeTask(taskTitle.trim());
            let subtasks;
            try {
                subtasks = JSON.parse(rawSubtasks);
            } catch {
                return res.status(500).json({ success: false, error: 'Malformed subtasks JSON', raw: rawSubtasks });
            }

            saveAIInteraction({
                userId,
                module: 'Task AI: Decompose',
                prompt: taskTitle.trim(),
                response: subtasks,
                endpoint: '/api/tasks/ai',
                meta: { action: 'decompose' },
            }).catch((e) => console.warn('[Firestore] saveAIInteraction failed:', e?.message || e));
            return res.json({ success: true, subtasks });
        }

        res.status(400).json({ success: false, error: 'action must be "analyze" or "decompose"' });

    } catch (error) {
        console.error('[/api/tasks/ai Error]', error);
        res.status(error.status || 500).json({ success: false, error: 'Task AI failed', detail: error.message, code: error.code });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vision
// Body: { image: string (base64), prompt?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/vision', async (req, res) => {
    try {
        const { image, prompt } = req.body;

        if (!image || typeof image !== 'string' || !image.trim()) {
            return res.status(400).json({ success: false, error: 'Image (base64) is required' });
        }

        const userId = await getOptionalUserId(req);

        // Strip data prefix if present (e.g., data:image/jpeg;base64,)
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

        const { analyzeImage } = require('../services/grok.service');
        const result = await analyzeImage(base64Data, prompt);
        
        saveAIInteraction({
            userId,
            module: 'Vision',
            prompt: prompt || 'Vision analysis',
            response: result,
            endpoint: '/api/vision',
        }).catch((e) => console.warn('[Firestore] saveAIInteraction failed:', e?.message || e));

        res.json({ success: true, result });

    } catch (error) {
        console.error('[/api/vision Error]', error);
        res.status(error.status || 500).json({ 
            success: false, 
            error: 'Vision analysis failed', 
            detail: error.message, 
            code: error.code 
        });
    }
});

module.exports = router;
