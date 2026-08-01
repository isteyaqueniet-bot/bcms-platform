const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

// Customers
router.get('/', allowRoles('super_admin', 'admin', 'sales'), customerController.getAllCustomers);
router.post('/', allowRoles('super_admin', 'admin', 'sales'), customerController.createCustomer);
router.put('/:id', allowRoles('super_admin', 'admin', 'sales'), customerController.updateCustomer);
router.delete('/:id', allowRoles('super_admin', 'admin'), customerController.deleteCustomer);

// Leads (nested under the same CRM route file for simplicity in Phase 1)
router.get('/leads/all', allowRoles('super_admin', 'admin', 'sales'), customerController.getAllLeads);
router.post('/leads', allowRoles('super_admin', 'admin', 'sales'), customerController.createLead);

module.exports = router;
