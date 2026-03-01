const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authenticateUser = require('../middleware/authMiddleware');

router.use(authenticateUser);

router.post('/chat', chatController.chat);
router.get('/history', chatController.getHistory);
router.delete('/history', chatController.deleteHistory); // Fixed: was clearHistory

module.exports = router;
