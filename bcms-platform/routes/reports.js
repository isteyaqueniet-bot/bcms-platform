const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

router.get('/attendance/pdf', allowRoles('super_admin', 'admin', 'hr'), reportController.attendancePdf);
router.get('/payroll/excel', allowRoles('super_admin', 'admin', 'hr'), reportController.payrollExcel);
router.get('/customers/excel', allowRoles('super_admin', 'admin', 'sales'), reportController.customersExcel);

module.exports = router;
