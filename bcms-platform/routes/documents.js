const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');
const upload = require('../middleware/upload');

router.use(authenticate);
router.use(requireCompany);

router.post(
  '/upload',
  allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'),
  upload.single('file'),
  documentController.uploadDocument
);
router.get('/', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), documentController.getAllDocuments);
router.get('/:id/download', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), documentController.downloadDocument);
router.delete('/:id', allowRoles('super_admin', 'admin'), documentController.deleteDocument);

module.exports = router;
