const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authenticateUser = require('../middleware/authMiddleware');

router.use(authenticateUser);

router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;
