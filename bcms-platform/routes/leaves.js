const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

router.post('/', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), leaveController.applyLeave);
router.get('/', allowRoles('super_admin', 'admin', 'hr'), leaveController.getAllLeaves);
router.get('/employee/:employeeId', allowRoles('super_admin', 'admin', 'hr', 'employee'), leaveController.getEmployeeLeaves);
router.put('/:id/decision', allowRoles('super_admin', 'admin', 'hr'), leaveController.decideLeave);

module.exports = router;
