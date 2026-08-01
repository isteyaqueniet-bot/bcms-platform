const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authenticate = require('../middleware/auth');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);
router.get('/', dashboardController.getSummary);

module.exports = router;
