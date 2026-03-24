const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');
const authenticateUser = require('../middleware/authMiddleware');

router.use(authenticateUser);

// AI helper endpoints (used by TaskBoard) — /api/tasks/ai
router.post('/ai', tasksController.taskAi);

router.get('/', tasksController.getTasks);
router.post('/', tasksController.addTask);
router.put('/:id', tasksController.editTask);
router.delete('/:id', tasksController.removeTask);

module.exports = router;
