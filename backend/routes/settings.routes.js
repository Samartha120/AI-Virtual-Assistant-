const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authenticateUser = require('../middleware/authMiddleware');

// All settings routes are protected
router.use(authenticateUser);

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);

module.exports = router;
