const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const upload = require('../middleware/uploadMiddleware');
const authenticateUser = require('../middleware/authMiddleware');

router.use(authenticateUser);

router.post('/upload', upload.single('file'), fileController.uploadFile);

module.exports = router;
