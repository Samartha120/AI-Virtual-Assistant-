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
// POST /api/chat
// Body: { message: string, history?: Array<{role, content}> }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Message is required and must be a non-empty string' });
        }

        const reply = await generateGeminiResponse(message.trim(), history);
        res.json({ success: true, reply });

    } catch (error) {
        console.error('[/api/chat Error]', error.message);
        res.status(500).json({ success: false, error: 'AI processing failed. Please try again.' });
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
        console.error('[/api/brainstorm Error]', error.message);
        res.status(500).json({ success: false, error: 'Brainstorming failed. Please try again.' });
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

        // Parse and validate JSON from Gemini
        let parsed;
        try {
            parsed = JSON.parse(rawResult);
        } catch {
            return res.status(500).json({ success: false, error: 'AI returned malformed response. Please try again.' });
        }

        res.json({ success: true, result: parsed });

    } catch (error) {
        console.error('[/api/analyze Error]', error.message);
        res.status(500).json({ success: false, error: 'Document analysis failed. Please try again.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tasks/ai
// Body: { action: 'analyze' | 'decompose', tasks?: string, taskTitle?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tasks/ai', async (req, res) => {
    try {
        const { action, tasks, taskTitle } = req.body;

        if (action === 'analyze') {
            if (!tasks || typeof tasks !== 'string') {
                return res.status(400).json({ success: false, error: 'Tasks string is required for analyze action' });
            }
            const advice = await generateTaskAnalysis(tasks.trim());
            return res.json({ success: true, advice });
        }

        if (action === 'decompose') {
            if (!taskTitle || typeof taskTitle !== 'string') {
                return res.status(400).json({ success: false, error: 'taskTitle is required for decompose action' });
            }
            const rawSubtasks = await decomposeTask(taskTitle.trim());
            let subtasks;
            try {
                subtasks = JSON.parse(rawSubtasks);
            } catch {
                return res.status(500).json({ success: false, error: 'AI returned malformed subtasks response.' });
            }
            return res.json({ success: true, subtasks });
        }

        res.status(400).json({ success: false, error: 'action must be "analyze" or "decompose"' });

    } catch (error) {
        console.error('[/api/tasks/ai Error]', error.message);
        res.status(500).json({ success: false, error: 'Task AI feature failed. Please try again.' });
    }
});

module.exports = router;
