const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authenticate = require('../middleware/auth');
const allowRoles = require('../middleware/roles');
const requireCompany = require('../middleware/company');

router.use(authenticate);
router.use(requireCompany);

router.post('/check-in', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), attendanceController.checkIn);
router.post('/check-out', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), attendanceController.checkOut);
router.get('/qr/today', allowRoles('super_admin', 'admin', 'hr'), attendanceController.getTodayQr);
router.post('/qr/check-in', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), attendanceController.qrCheckIn);
router.post('/gps/check-in', allowRoles('super_admin', 'admin', 'hr', 'sales', 'employee'), attendanceController.gpsCheckIn);
router.get('/today', allowRoles('super_admin', 'admin', 'hr'), attendanceController.getToday);
router.get('/employee/:employeeId', allowRoles('super_admin', 'admin', 'hr', 'employee'), attendanceController.getEmployeeHistory);
router.put('/:id', allowRoles('super_admin', 'admin', 'hr'), attendanceController.updateAttendance);

module.exports = router;
