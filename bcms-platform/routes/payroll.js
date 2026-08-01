const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

router.post('/generate', allowRoles('super_admin', 'admin', 'hr'), payrollController.generatePayroll);
router.get('/', allowRoles('super_admin', 'admin', 'hr'), payrollController.getPayroll);
router.put('/:id/finalize', allowRoles('super_admin', 'admin'), payrollController.finalizePayroll);

module.exports = router;
