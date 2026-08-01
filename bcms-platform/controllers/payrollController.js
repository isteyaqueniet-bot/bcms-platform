const pool = require('../config/database');

/**
 * POST /api/payroll/generate
 * Body: { month: 1-12, year: 2026 }
 * Generates payroll for all active employees IN THE CALLER'S COMPANY ONLY.
 */
exports.generatePayroll = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }

    const [employees] = await pool.query(
      "SELECT id, salary FROM employees WHERE company_id = ? AND status = 'active'",
      [req.companyId]
    );

    const workingDays = new Date(year, month, 0).getDate();
    const results = [];

    for (const emp of employees) {
      const [[attendanceCount]] = await pool.query(
        `SELECT
           SUM(CASE WHEN status IN ('present','leave') THEN 1 ELSE 0 END) AS present_days,
           SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent_days
         FROM attendance
         WHERE employee_id = ? AND company_id = ? AND MONTH(date) = ? AND YEAR(date) = ?`,
        [emp.id, req.companyId, month, year]
      );

      const presentDays = attendanceCount.present_days || 0;
      const absentDays = attendanceCount.absent_days || 0;
      const perDayRate = emp.salary / workingDays;
      const netSalary = Math.round((perDayRate * presentDays) * 100) / 100;

      await pool.query(
        `INSERT INTO payroll (company_id, employee_id, month, year, basic_salary, working_days, present_days, absent_days, net_salary, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
         ON DUPLICATE KEY UPDATE
           basic_salary = VALUES(basic_salary),
           working_days = VALUES(working_days),
           present_days = VALUES(present_days),
           absent_days = VALUES(absent_days),
           net_salary = VALUES(net_salary),
           status = 'draft'`,
        [req.companyId, emp.id, month, year, emp.salary, workingDays, presentDays, absentDays, netSalary]
      );

      results.push({ employee_id: emp.id, net_salary: netSalary, present_days: presentDays, absent_days: absentDays });
    }

    res.json({ success: true, message: `Payroll generated for ${month}/${year}`, data: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to generate payroll' });
  }
};

/**
 * GET /api/payroll?month=&year=
 */
exports.getPayroll = async (req, res) => {
  try {
    const { month, year, employee_id } = req.query;

    let query = `
      SELECT p.*, e.full_name, e.employee_code
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.company_id = ?
    `;
    const params = [req.companyId];

    if (month) { query += ' AND p.month = ?'; params.push(month); }
    if (year) { query += ' AND p.year = ?'; params.push(year); }
    if (employee_id) { query += ' AND p.employee_id = ?'; params.push(employee_id); }

    query += ' ORDER BY p.year DESC, p.month DESC, e.full_name';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll' });
  }
};

/**
 * PUT /api/payroll/:id/finalize
 */
exports.finalizePayroll = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['finalized', 'paid'].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'finalized' or 'paid'" });
    }

    const [result] = await pool.query(
      'UPDATE payroll SET status = ? WHERE id = ? AND company_id = ?',
      [status, req.params.id, req.companyId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Payroll record not found' });
    }

    res.json({ success: true, message: `Payroll marked as ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update payroll status' });
  }
};
