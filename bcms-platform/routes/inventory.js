const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

router.get('/', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), inventoryController.getAllItems);
router.get('/:id', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), inventoryController.getItemById);
router.post('/', allowRoles('super_admin', 'admin'), inventoryController.createItem);
router.put('/:id', allowRoles('super_admin', 'admin'), inventoryController.updateItem);
router.post('/:id/adjust', allowRoles('super_admin', 'admin', 'hr'), inventoryController.adjustStock);
router.delete('/:id', allowRoles('super_admin', 'admin'), inventoryController.deleteItem);

module.exports = router;
