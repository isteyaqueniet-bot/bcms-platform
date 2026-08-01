const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');

router.use(authenticate);
router.use(allowRoles('platform_admin'));

router.get('/', companyController.getAllCompanies);
router.get('/:id', companyController.getCompanyById);
router.post('/', companyController.createCompany);
router.put('/:id', companyController.updateCompany);
router.put('/:id/suspend', companyController.suspendCompany);
router.put('/:id/activate', companyController.activateCompany);
router.delete('/:id', companyController.deleteCompany);

module.exports = router;
