const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

router.get('/', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), assetController.getAllAssets);
router.get('/:id', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), assetController.getAssetById);
router.post('/', allowRoles('super_admin', 'admin'), assetController.createAsset);
router.put('/:id', allowRoles('super_admin', 'admin'), assetController.updateAsset);
router.post('/:id/assign', allowRoles('super_admin', 'admin', 'hr'), assetController.assignAsset);
router.post('/:id/return', allowRoles('super_admin', 'admin', 'hr'), assetController.returnAsset);
router.delete('/:id', allowRoles('super_admin', 'admin'), assetController.deleteAsset);

module.exports = router;
