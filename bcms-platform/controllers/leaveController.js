const pool = require('../config/database');
const { notifyUser } = require('../services/notificationDispatch');

/**
 * POST /api/leaves
 * Body: { employee_id, leave_type, start_date, end_date, reason }
 */
exports.applyLeave = async (req, res) => {
  try {
    const { employee_id, leave_type, start_date, end_date, reason } = req.body;

    if (!employee_id || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'employee_id, start_date and end_date are required'
      });
    }
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ success: false, message: 'end_date cannot be before start_date' });
    }

    const [empCheck] = await pool.query(
      'SELECT id FROM employees WHERE id = ? AND company_id = ?',
      [employee_id, req.companyId]
    );
    if (empCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found in your company' });
    }

    const [result] = await pool.query(
      `INSERT INTO leave_requests (company_id, employee_id, leave_type, start_date, end_date, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [req.companyId, employee_id, leave_type || 'general', start_date, end_date, reason || null]
    );

    res.status(201).json({ success: true, message: 'Leave request submitted', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to submit leave request' });
  }
};

/**
 * GET /api/leaves?status=pending
 */
exports.getAllLeaves = async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT lr.*, e.full_name, e.employee_code
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE lr.company_id = ?
    `;
    const params = [req.companyId];

    if (status) {
      query += ' AND lr.status = ?';
      params.push(status);
    }
    query += ' ORDER BY lr.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch leave requests' });
  }
};

/**
 * GET /api/leaves/employee/:employeeId
 */
exports.getEmployeeLeaves = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM leave_requests WHERE employee_id = ? AND company_id = ? ORDER BY created_at DESC',
      [req.params.employeeId, req.companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch leave history' });
  }
};

/**
 * PUT /api/leaves/:id/decision
 * Body: { status: 'approved' | 'rejected' }
 */
exports.decideLeave = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'approved' or 'rejected'" });
    }

    const [result] = await pool.query(
      'UPDATE leave_requests SET status = ? WHERE id = ? AND company_id = ?',
      [status, req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const [[leave]] = await pool.query(
      `SELECT lr.employee_id, lr.start_date, lr.end_date, e.user_id
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.id
       WHERE lr.id = ? AND lr.company_id = ?`,
      [req.params.id, req.companyId]
    );

    if (status === 'approved') {
      // Requires MySQL 8+ (recursive CTE support)
      await pool.query(
        `INSERT INTO attendance (company_id, employee_id, date, status)
         WITH RECURSIVE date_range AS (
           SELECT ? AS d
           UNION ALL
           SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM date_range WHERE d < ?
         )
         SELECT ?, ?, d, 'leave' FROM date_range
         ON DUPLICATE KEY UPDATE status = 'leave'`,
        [leave.start_date, leave.end_date, req.companyId, leave.employee_id]
      );
    }

    if (leave.user_id) {
      await notifyUser(req.companyId, leave.user_id, `Your leave request (${leave.start_date} to ${leave.end_date}) was ${status}.`);
    }

    res.json({ success: true, message: `Leave request ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update leave request' });
  }
};
