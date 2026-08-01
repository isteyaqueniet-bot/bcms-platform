const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);
router.use(allowRoles('super_admin', 'admin'));

router.get('/overview', analyticsController.overview);
router.get('/attendance-trend', analyticsController.attendanceTrend);
router.get('/lead-conversion-trend', analyticsController.leadConversionTrend);
router.get('/payroll-cost', analyticsController.payrollCostTrend);
router.get('/project-health', analyticsController.projectHealth);
router.get('/department-headcount', analyticsController.departmentHeadcount);

module.exports = router;
