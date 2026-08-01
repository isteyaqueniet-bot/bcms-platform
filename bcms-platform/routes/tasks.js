const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

router.get('/', allowRoles('super_admin', 'admin', 'sales', 'employee'), taskController.getAllTasks);
router.get('/my/:userId', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), taskController.getMyTasks);
router.post('/', allowRoles('super_admin', 'admin'), taskController.createTask);
router.put('/:id', allowRoles('super_admin', 'admin'), taskController.updateTask);
router.put('/:id/status', allowRoles('super_admin', 'admin', 'sales', 'employee'), taskController.updateTaskStatus);
router.delete('/:id', allowRoles('super_admin', 'admin'), taskController.deleteTask);

module.exports = router;
