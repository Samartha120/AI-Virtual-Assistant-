const { getUserTasks, createTask, updateTask, deleteTask } = require('../services/supabase.service');
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
    removeTask
};
