const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistantController');
const authenticate = require('../middleware/auth');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

router.post('/ask', assistantController.ask);

module.exports = router;
