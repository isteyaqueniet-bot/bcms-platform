const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

router.get('/', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), departmentController.getAllDepartments);
router.post('/', allowRoles('super_admin', 'admin'), departmentController.createDepartment);
router.put('/:id', allowRoles('super_admin', 'admin'), departmentController.updateDepartment);
router.delete('/:id', allowRoles('super_admin', 'admin'), departmentController.deleteDepartment);

module.exports = router;
