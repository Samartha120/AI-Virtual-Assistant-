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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai-status  — health check to verify Grok key is set
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ai-status', (req, res) => {
    const key = (process.env.GROK_API_KEY || '').trim();
    const keyType = /^AIza/i.test(key) ? 'google' : /^gsk_/i.test(key) ? 'groq' : key ? 'unknown' : 'missing';
    res.json({
        success: true,
        build: {
            commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
            service: process.env.RENDER_SERVICE_NAME || null,
            instance: process.env.RENDER_INSTANCE_ID || null,
        },
        keySet: !!key,
        keyType,
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
        const { message, history = [] } = req.body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const reply = await generateGrokResponse(message.trim(), history);
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
        const stream = await streamGrokResponse(message.trim(), history, { signal: controller.signal });

        for await (const delta of stream) {
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }

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

        const ideas = await brainstormIdeas(topic.trim());
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

        const rawResult = await analyzeDocument(text.trim());

        let parsed;
        try {
            parsed = JSON.parse(rawResult);
        } catch {
            return res.status(500).json({ success: false, error: 'AI returned malformed JSON', raw: rawResult });
        }

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

        if (action === 'analyze') {
            if (!tasks) return res.status(400).json({ success: false, error: 'tasks required' });
            const advice = await generateTaskAnalysis(tasks.trim());
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
            return res.json({ success: true, subtasks });
        }

        res.status(400).json({ success: false, error: 'action must be "analyze" or "decompose"' });

    } catch (error) {
        console.error('[/api/tasks/ai Error]', error);
        res.status(error.status || 500).json({ success: false, error: 'Task AI failed', detail: error.message, code: error.code });
    }
});

module.exports = router;
