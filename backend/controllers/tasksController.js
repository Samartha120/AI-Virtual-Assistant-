const { getUserTasks, createTask, updateTask, deleteTask, saveAIInteraction } = require('../services/firebase.service');
const { generateResponse } = require('../services/llmService');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const getTasks = async (req, res) => {
    try {
        const userId = req.user.id;
        const tasks = await getUserTasks(userId);
        successResponse(res, 'Tasks retrieved', tasks);
    } catch (err) {
        errorResponse(res, 500, 'Failed to retrieve tasks', err.message);
    }
};

const addTask = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, description, status, priority, due_date } = req.body;

        if (!title || title.trim() === '') {
            return errorResponse(res, 400, 'Task title is required');
        }

        const task = await createTask(userId, {
            title: title.trim(),
            description: description || '',
            status: status || 'todo',
            priority: priority || 'medium',
            due_date: due_date || null
        });

        successResponse(res, 'Task created', task);
    } catch (err) {
        errorResponse(res, 500, 'Failed to create task', err.message);
    }
};

const editTask = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const updates = req.body;

        if (!updates || Object.keys(updates).length === 0) {
            return errorResponse(res, 400, 'No update data provided');
        }

        const task = await updateTask(id, userId, updates);
        if (!task) return errorResponse(res, 404, 'Task not found');

        successResponse(res, 'Task updated', task);
    } catch (err) {
        errorResponse(res, 500, 'Failed to update task', err.message);
    }
};

const removeTask = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await deleteTask(id, userId);
        successResponse(res, 'Task deleted');
    } catch (err) {
        errorResponse(res, 500, 'Failed to delete task', err.message);
    }
};

module.exports = {
    getTasks,
    addTask,
    editTask,
    removeTask,
    taskAi
};

async function taskAi(req, res) {
    try {
        const userId = req.user.id;
        const { action, tasks, taskTitle } = req.body || {};

        if (action === 'analyze') {
            if (!tasks || typeof tasks !== 'string' || !tasks.trim()) {
                return errorResponse(res, 400, 'tasks required');
            }

            const systemContext =
                'You are a Project Manager AI. Provide concise, actionable optimization advice for the provided task list. ' +
                'Return plain text (no JSON).';

            console.log('Functionality: Task AI (optimize)');

            const llm = await generateResponse(tasks.trim(), [], systemContext);
            const advice = llm?.content || '';

            saveAIInteraction({
                userId,
                module: 'Task AI: Optimize',
                prompt: tasks.trim(),
                response: advice,
                provider: llm?.provider || null,
                notice: llm?.notice || null,
                endpoint: '/api/tasks/ai',
                meta: { action: 'analyze', provider: llm?.provider || null, notice: llm?.notice || null },
            }).catch((e) => console.warn('[Firestore] saveAIInteraction failed:', e?.message || e));

            return res.json({ success: true, advice });
        }

        if (action === 'decompose') {
            if (!taskTitle || typeof taskTitle !== 'string' || !taskTitle.trim()) {
                return errorResponse(res, 400, 'taskTitle required');
            }

            const systemContext =
                'You are a Project Manager AI. Decompose the given task into a JSON array of objects with exactly: ' +
                '"title" (string) and "priority" ("low"|"medium"|"high"). Return ONLY valid JSON.';

            console.log('Functionality: Task AI (decompose)');

            const llm = await generateResponse(taskTitle.trim(), [], systemContext);
            const raw = llm?.content || '';
            let subtasks;
            try {
                subtasks = JSON.parse(raw);
            } catch {
                return res.status(500).json({ success: false, error: 'Malformed subtasks JSON', raw });
            }

            saveAIInteraction({
                userId,
                module: 'Task AI: Decompose',
                prompt: taskTitle.trim(),
                response: subtasks,
                provider: llm?.provider || null,
                notice: llm?.notice || null,
                endpoint: '/api/tasks/ai',
                meta: { action: 'decompose', provider: llm?.provider || null, notice: llm?.notice || null },
            }).catch((e) => console.warn('[Firestore] saveAIInteraction failed:', e?.message || e));

            return res.json({ success: true, subtasks });
        }

        return res.status(400).json({ success: false, error: 'action must be "analyze" or "decompose"' });
    } catch (err) {
        console.error('Task AI Error:', err);
        return errorResponse(res, 500, 'Task AI failed', err.message);
    }
}
