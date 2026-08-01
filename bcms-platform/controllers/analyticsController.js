const pool = require('../config/database');

/**
 * GET /api/analytics/attendance-trend?months=6
 */
exports.attendanceTrend = async (req, res) => {
  try {
    const months = parseInt(req.query.months, 10) || 6;

    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(date, '%Y-%m') AS month,
              SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present_count,
              SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
              SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) AS leave_count
       FROM attendance
       WHERE company_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY month
       ORDER BY month`,
      [req.companyId, months]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to compute attendance trend' });
  }
};

/**
 * GET /api/analytics/lead-conversion-trend?months=6
 */
exports.leadConversionTrend = async (req, res) => {
  try {
    const months = parseInt(req.query.months, 10) || 6;

    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
              COUNT(*) AS total_leads,
              SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted,
              SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) AS lost
       FROM leads
       WHERE company_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY month
       ORDER BY month`,
      [req.companyId, months]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to compute lead conversion trend' });
  }
};

/**
 * GET /api/analytics/payroll-cost?months=6
 */
exports.payrollCostTrend = async (req, res) => {
  try {
    const months = parseInt(req.query.months, 10) || 6;

    const [rows] = await pool.query(
      `SELECT year, month, SUM(net_salary) AS total_cost, COUNT(*) AS employee_count
       FROM payroll
       WHERE company_id = ?
         AND STR_TO_DATE(CONCAT(year, '-', month, '-01'), '%Y-%m-%d') >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY year, month
       ORDER BY year, month`,
      [req.companyId, months]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to compute payroll cost trend' });
  }
};

/**
 * GET /api/analytics/project-health
 */
exports.projectHealth = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.status,
              COUNT(t.id) AS total_tasks,
              SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS completed_tasks,
              SUM(CASE WHEN t.due_date < CURDATE() AND t.status != 'done' THEN 1 ELSE 0 END) AS overdue_tasks
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id AND t.company_id = p.company_id
       WHERE p.company_id = ? AND p.status IN ('planned', 'in_progress', 'on_hold')
       GROUP BY p.id
       ORDER BY overdue_tasks DESC, p.name`,
      [req.companyId]
    );

    const data = rows.map((r) => ({
      ...r,
      completion_pct: r.total_tasks > 0 ? Math.round((r.completed_tasks / r.total_tasks) * 100) : 0
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to compute project health' });
  }
};

/**
 * GET /api/analytics/department-headcount
 */
exports.departmentHeadcount = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.name AS department,
              COUNT(e.id) AS headcount,
              ROUND(AVG(DATEDIFF(CURDATE(), e.date_of_joining) / 365.25), 1) AS avg_tenure_years
       FROM departments d
       LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active' AND e.company_id = d.company_id
       WHERE d.company_id = ?
       GROUP BY d.id
       ORDER BY headcount DESC`,
      [req.companyId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to compute department headcount' });
  }
};

/**
 * GET /api/analytics/overview
 */
exports.overview = async (req, res) => {
  try {
    const cid = req.companyId;

    const [[leadStats]] = await pool.query(
      `SELECT COUNT(*) AS total_leads,
              SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted_leads
       FROM leads WHERE company_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`,
      [cid]
    );
    const [[projectStats]] = await pool.query(
      `SELECT COUNT(*) AS active_projects
       FROM projects WHERE company_id = ? AND status IN ('planned', 'in_progress')`,
      [cid]
    );
    const [[taskStats]] = await pool.query(
      `SELECT SUM(CASE WHEN due_date < CURDATE() AND status != 'done' THEN 1 ELSE 0 END) AS overdue_tasks
       FROM tasks WHERE company_id = ?`,
      [cid]
    );
    const [[attendanceStats]] = await pool.query(
      `SELECT ROUND(100 * SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS attendance_rate_pct
       FROM attendance WHERE company_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [cid]
    );

    res.json({
      success: true,
      data: {
        leads_last_3_months: leadStats.total_leads,
        leads_converted_last_3_months: leadStats.converted_leads,
        active_projects: projectStats.active_projects,
        overdue_tasks: taskStats.overdue_tasks || 0,
        attendance_rate_last_30_days_pct: attendanceStats.attendance_rate_pct || 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to compute analytics overview' });
  }
};
