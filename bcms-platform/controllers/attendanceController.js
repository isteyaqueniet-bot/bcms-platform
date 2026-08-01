const pool = require('../config/database');
const qrService = require('../services/qrService');
const { distanceInMeters } = require('../utils/geo');

/**
 * Looks up the configured office location and geofence radius from this company's settings.
 */
async function getGeofenceConfig(companyId) {
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM settings
     WHERE company_id = ? AND setting_key IN ('office_latitude', 'office_longitude', 'geofence_radius_meters')`,
    [companyId]
  );
  const map = {};
  rows.forEach((r) => { map[r.setting_key] = r.setting_value; });

  if (!map.office_latitude || !map.office_longitude) return null;

  return {
    lat: parseFloat(map.office_latitude),
    lng: parseFloat(map.office_longitude),
    radius: parseFloat(map.geofence_radius_meters || '150')
  };
}

/**
 * Confirms an employee_id actually belongs to the caller's company before
 * writing attendance for them — prevents cross-tenant data writes.
 */
async function employeeBelongsToCompany(employeeId, companyId) {
  const [rows] = await pool.query(
    'SELECT id FROM employees WHERE id = ? AND company_id = ?',
    [employeeId, companyId]
  );
  return rows.length > 0;
}

async function upsertCheckIn(companyId, employeeId, { lat, lng, method } = {}) {
  const [existing] = await pool.query(
    'SELECT id, check_in FROM attendance WHERE employee_id = ? AND company_id = ? AND date = CURDATE()',
    [employeeId, companyId]
  );

  if (existing.length > 0 && existing[0].check_in) {
    return { alreadyDone: true };
  }

  if (existing.length > 0) {
    await pool.query(
      `UPDATE attendance SET check_in = CURTIME(), status = 'present',
        check_in_lat = ?, check_in_lng = ?, check_in_method = ? WHERE id = ?`,
      [lat ?? null, lng ?? null, method || 'manual', existing[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO attendance (company_id, employee_id, date, check_in, status, check_in_lat, check_in_lng, check_in_method)
       VALUES (?, ?, CURDATE(), CURTIME(), 'present', ?, ?, ?)`,
      [companyId, employeeId, lat ?? null, lng ?? null, method || 'manual']
    );
  }
  return { alreadyDone: false };
}

/**
 * POST /api/attendance/check-in
 * Body: { employee_id }
 */
exports.checkIn = async (req, res) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'employee_id is required' });
    }
    if (!(await employeeBelongsToCompany(employee_id, req.companyId))) {
      return res.status(404).json({ success: false, message: 'Employee not found in your company' });
    }

    const result = await upsertCheckIn(req.companyId, employee_id, { method: 'manual' });
    if (result.alreadyDone) {
      return res.status(409).json({ success: false, message: 'Already checked in today' });
    }

    res.json({ success: true, message: 'Checked in successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to check in' });
  }
};

/**
 * GET /api/attendance/qr/today
 * Generates today's QR code (PNG) for THIS company. The token is scoped to the
 * company so scanning a poster from Company A can never check someone into Company B.
 */
exports.getTodayQr = async (req, res) => {
  try {
    const token = qrService.generateDailyToken(undefined, req.companyId);
    const buffer = await qrService.generateQrImageBuffer(token);

    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to generate QR code' });
  }
};

/**
 * POST /api/attendance/qr/check-in
 * Body: { employee_id, token, latitude, longitude }
 */
exports.qrCheckIn = async (req, res) => {
  try {
    const { employee_id, token, latitude, longitude } = req.body;

    if (!employee_id || !token) {
      return res.status(400).json({ success: false, message: 'employee_id and token are required' });
    }
    if (!(await employeeBelongsToCompany(employee_id, req.companyId))) {
      return res.status(404).json({ success: false, message: 'Employee not found in your company' });
    }
    if (!qrService.verifyDailyToken(token, req.companyId)) {
      return res.status(400).json({ success: false, message: 'QR code is invalid, expired, or belongs to a different company' });
    }

    const geofence = await getGeofenceConfig(req.companyId);
    if (geofence && latitude != null && longitude != null) {
      const distance = distanceInMeters(geofence.lat, geofence.lng, latitude, longitude);
      if (distance > geofence.radius) {
        return res.status(403).json({
          success: false,
          message: `You appear to be ${Math.round(distance)}m from the office (allowed radius: ${geofence.radius}m)`
        });
      }
    }

    const result = await upsertCheckIn(req.companyId, employee_id, { lat: latitude, lng: longitude, method: 'qr' });
    if (result.alreadyDone) {
      return res.status(409).json({ success: false, message: 'Already checked in today' });
    }

    res.json({ success: true, message: 'Checked in via QR code' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to check in via QR code' });
  }
};

/**
 * POST /api/attendance/gps/check-in
 * Body: { employee_id, latitude, longitude }
 */
exports.gpsCheckIn = async (req, res) => {
  try {
    const { employee_id, latitude, longitude } = req.body;

    if (!employee_id || latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'employee_id, latitude and longitude are required' });
    }
    if (!(await employeeBelongsToCompany(employee_id, req.companyId))) {
      return res.status(404).json({ success: false, message: 'Employee not found in your company' });
    }

    const geofence = await getGeofenceConfig(req.companyId);
    if (!geofence) {
      return res.status(400).json({
        success: false,
        message: 'Office location is not configured yet. Set office_latitude/office_longitude via PUT /api/settings'
      });
    }

    const distance = distanceInMeters(geofence.lat, geofence.lng, latitude, longitude);
    if (distance > geofence.radius) {
      return res.status(403).json({
        success: false,
        message: `You appear to be ${Math.round(distance)}m from the office (allowed radius: ${geofence.radius}m)`
      });
    }

    const result = await upsertCheckIn(req.companyId, employee_id, { lat: latitude, lng: longitude, method: 'gps' });
    if (result.alreadyDone) {
      return res.status(409).json({ success: false, message: 'Already checked in today' });
    }

    res.json({ success: true, message: 'Checked in via GPS' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to check in via GPS' });
  }
};

/**
 * POST /api/attendance/check-out
 * Body: { employee_id }
 */
exports.checkOut = async (req, res) => {
  try {
    const { employee_id } = req.body;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'employee_id is required' });
    }

    const [existing] = await pool.query(
      'SELECT id, check_out FROM attendance WHERE employee_id = ? AND company_id = ? AND date = CURDATE()',
      [employee_id, req.companyId]
    );

    if (existing.length === 0) {
      return res.status(400).json({ success: false, message: 'No check-in record found for today' });
    }
    if (existing[0].check_out) {
      return res.status(409).json({ success: false, message: 'Already checked out today' });
    }

    await pool.query('UPDATE attendance SET check_out = CURTIME() WHERE id = ?', [existing[0].id]);
    res.json({ success: true, message: 'Checked out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to check out' });
  }
};

/**
 * GET /api/attendance/today
 */
exports.getToday = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.employee_id, e.full_name, e.employee_code,
              a.check_in, a.check_out, a.status, a.check_in_method
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.company_id = ? AND a.date = CURDATE()
       ORDER BY e.full_name`,
      [req.companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to fetch today's attendance" });
  }
};

/**
 * GET /api/attendance/employee/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
exports.getEmployeeHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { from, to } = req.query;

    let query = 'SELECT * FROM attendance WHERE employee_id = ? AND company_id = ?';
    const params = [employeeId, req.companyId];

    if (from) {
      query += ' AND date >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND date <= ?';
      params.push(to);
    }
    query += ' ORDER BY date DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance history' });
  }
};

/**
 * PUT /api/attendance/:id
 */
exports.updateAttendance = async (req, res) => {
  try {
    const { check_in, check_out, status } = req.body;

    const [result] = await pool.query(
      `UPDATE attendance SET
        check_in = COALESCE(?, check_in),
        check_out = COALESCE(?, check_out),
        status = COALESCE(?, status)
       WHERE id = ? AND company_id = ?`,
      [check_in, check_out, status, req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    res.json({ success: true, message: 'Attendance updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update attendance' });
  }
};
