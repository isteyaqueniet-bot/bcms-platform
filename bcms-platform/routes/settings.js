const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

router.get('/', settingsController.getAllSettings);
router.put('/', allowRoles('super_admin', 'admin'), settingsController.updateSettings);

module.exports = router;
