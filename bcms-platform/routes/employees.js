const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

// All routes require a valid token
router.use(authenticate);
router.use(requireCompany);

router.get('/', allowRoles('super_admin', 'admin', 'hr'), employeeController.getAllEmployees);
router.get('/:id', allowRoles('super_admin', 'admin', 'hr', 'employee'), employeeController.getEmployeeById);
router.post('/', allowRoles('super_admin', 'admin'), employeeController.createEmployee);
router.put('/:id', allowRoles('super_admin', 'admin', 'hr'), employeeController.updateEmployee);
router.delete('/:id', allowRoles('super_admin', 'admin'), employeeController.deleteEmployee);

module.exports = router;
