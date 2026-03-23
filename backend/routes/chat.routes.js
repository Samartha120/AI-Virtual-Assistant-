const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authenticateUser = require('../middleware/authMiddleware');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateUser);

router.post('/chat', upload.single('audio'), chatController.chat);
router.get('/sessions', chatController.getSessions);
router.get('/messages/:sessionId', chatController.getMessages);

module.exports = router;
