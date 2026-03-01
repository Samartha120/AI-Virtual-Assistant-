const express = require('express');
const router = express.Router();
const {
    generateGeminiResponse,
    brainstormIdeas,
    analyzeDocument,
    generateTaskAnalysis,
    decomposeTask,
} = require('../services/gemini.service');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai-status  — health check to verify Gemini key is set
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ai-status', (req, res) => {
    res.json({
        success: true,
        keySet: !!process.env.GEMINI_API_KEY,
        keyPreview: process.env.GEMINI_API_KEY
            ? `${process.env.GEMINI_API_KEY.slice(0, 8)}...`
            : 'NOT SET'
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

        const reply = await generateGeminiResponse(message.trim(), history);
        res.json({ success: true, reply });

    } catch (error) {
        console.error('[/api/chat Error]', error);
        res.status(500).json({
            success: false,
            error: 'AI processing failed',
            detail: error.message  // expose detail for debugging
        });
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
        res.status(500).json({ success: false, error: 'Brainstorming failed', detail: error.message });
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
        res.status(500).json({ success: false, error: 'Document analysis failed', detail: error.message });
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
        res.status(500).json({ success: false, error: 'Task AI failed', detail: error.message });
    }
});

module.exports = router;
