const pool = require('../config/database');

/**
 * GET /api/dashboard
 * Returns headline metrics scoped to the caller's company.
 */
exports.getSummary = async (req, res) => {
  try {
    const cid = req.companyId;

    const [[employeeTotal]] = await pool.query('SELECT COUNT(*) AS total FROM employees WHERE company_id = ?', [cid]);
    const [[employeeActive]] = await pool.query(
      "SELECT COUNT(*) AS total FROM employees WHERE company_id = ? AND status = 'active'", [cid]
    );
    const [[customerTotal]] = await pool.query('SELECT COUNT(*) AS total FROM customers WHERE company_id = ?', [cid]);
    const [[leadTotal]] = await pool.query('SELECT COUNT(*) AS total FROM leads WHERE company_id = ?', [cid]);
    const [[attendanceToday]] = await pool.query(
      "SELECT COUNT(*) AS total FROM attendance WHERE company_id = ? AND date = CURDATE() AND status = 'present'", [cid]
    );
    const [[pendingLeaves]] = await pool.query(
      "SELECT COUNT(*) AS total FROM leave_requests WHERE company_id = ? AND status = 'pending'", [cid]
    );

    res.json({
      success: true,
      data: {
        total_employees: employeeTotal.total,
        active_employees: employeeActive.total,
        attendance_today: attendanceToday.total,
        pending_leave_requests: pendingLeaves.total,
        total_customers: customerTotal.total,
        total_leads: leadTotal.total
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard summary' });
  }
};
