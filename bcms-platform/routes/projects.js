const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

router.get('/', allowRoles('super_admin', 'admin', 'sales', 'employee'), projectController.getAllProjects);
router.get('/:id', allowRoles('super_admin', 'admin', 'sales', 'employee'), projectController.getProjectById);
router.post('/', allowRoles('super_admin', 'admin'), projectController.createProject);
router.put('/:id', allowRoles('super_admin', 'admin'), projectController.updateProject);
router.delete('/:id', allowRoles('super_admin', 'admin'), projectController.deleteProject);

module.exports = router;
