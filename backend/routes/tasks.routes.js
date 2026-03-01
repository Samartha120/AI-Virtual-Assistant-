const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');
const authenticateUser = require('../middleware/authMiddleware');

router.use(authenticateUser);

router.get('/', tasksController.getTasks);
router.post('/', tasksController.addTask);
router.put('/:id', tasksController.editTask);
router.delete('/:id', tasksController.removeTask);

module.exports = router;
