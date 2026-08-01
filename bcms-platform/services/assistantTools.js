const pool = require('../config/database');

/**
 * Each tool's `execute` receives (input, context) where context = { companyId, role }.
 * Tools NEVER accept a company_id or user-supplied scope from the model — it always
 * comes from context, which is set server-side from the authenticated request.
 * This is the same rule the rest of the app follows; the assistant is not an exception.
 */

const tools = [
  {
    name: 'get_dashboard_summary',
    description: 'Get headline company metrics: employee counts, attendance today, pending leave requests, customers, leads.',
    input_schema: { type: 'object', properties: {} },
    execute: async (_input, { companyId }) => {
      const cid = companyId;
      const [[employeeTotal]] = await pool.query('SELECT COUNT(*) AS total FROM employees WHERE company_id = ?', [cid]);
      const [[employeeActive]] = await pool.query("SELECT COUNT(*) AS total FROM employees WHERE company_id = ? AND status = 'active'", [cid]);
      const [[customerTotal]] = await pool.query('SELECT COUNT(*) AS total FROM customers WHERE company_id = ?', [cid]);
      const [[leadTotal]] = await pool.query('SELECT COUNT(*) AS total FROM leads WHERE company_id = ?', [cid]);
      const [[attendanceToday]] = await pool.query(
        "SELECT COUNT(*) AS total FROM attendance WHERE company_id = ? AND date = CURDATE() AND status = 'present'", [cid]
      );
      const [[pendingLeaves]] = await pool.query(
        "SELECT COUNT(*) AS total FROM leave_requests WHERE company_id = ? AND status = 'pending'", [cid]
      );
      return {
        total_employees: employeeTotal.total,
        active_employees: employeeActive.total,
        attendance_today: attendanceToday.total,
        pending_leave_requests: pendingLeaves.total,
        total_customers: customerTotal.total,
        total_leads: leadTotal.total
      };
    }
  },
  {
    name: 'get_pending_leave_requests',
    description: 'List all leave requests currently awaiting a decision, with employee name and dates.',
    input_schema: { type: 'object', properties: {} },
    execute: async (_input, { companyId }) => {
      const [rows] = await pool.query(
        `SELECT lr.id, e.full_name, lr.leave_type, lr.start_date, lr.end_date, lr.reason
         FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id
         WHERE lr.company_id = ? AND lr.status = 'pending'
         ORDER BY lr.created_at`,
        [companyId]
      );
      return rows;
    }
  },
  {
    name: 'get_todays_attendance',
    description: "List who has checked in today, and who from active employees has NOT checked in yet.",
    input_schema: { type: 'object', properties: {} },
    execute: async (_input, { companyId }) => {
      const [present] = await pool.query(
        `SELECT e.full_name, a.check_in, a.check_in_method
         FROM attendance a JOIN employees e ON a.employee_id = e.id
         WHERE a.company_id = ? AND a.date = CURDATE() AND a.status = 'present'`,
        [companyId]
      );
      const [absent] = await pool.query(
        `SELECT e.full_name FROM employees e
         WHERE e.company_id = ? AND e.status = 'active'
           AND e.id NOT IN (SELECT employee_id FROM attendance WHERE company_id = ? AND date = CURDATE())`,
        [companyId, companyId]
      );
      return { checked_in: present, not_yet_checked_in: absent };
    }
  },
  {
    name: 'get_overdue_tasks',
    description: 'List tasks that are past their due date and not yet marked done, with assignee and project.',
    input_schema: { type: 'object', properties: {} },
    execute: async (_input, { companyId }) => {
      const [rows] = await pool.query(
        `SELECT t.title, t.due_date, u.name AS assigned_to, p.name AS project_name
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         LEFT JOIN projects p ON t.project_id = p.id
         WHERE t.company_id = ? AND t.due_date < CURDATE() AND t.status != 'done'
         ORDER BY t.due_date`,
        [companyId]
      );
      return rows;
    }
  },
  {
    name: 'get_department_headcount',
    description: 'Get active employee headcount per department.',
    input_schema: { type: 'object', properties: {} },
    execute: async (_input, { companyId }) => {
      const [rows] = await pool.query(
        `SELECT d.name AS department, COUNT(e.id) AS headcount
         FROM departments d
         LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active' AND e.company_id = d.company_id
         WHERE d.company_id = ?
         GROUP BY d.id ORDER BY headcount DESC`,
        [companyId]
      );
      return rows;
    }
  },
  {
    name: 'search_employees',
    description: 'Search employees by name (partial match), department name, or status.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Partial name to search for' },
        department: { type: 'string', description: 'Department name' },
        status: { type: 'string', enum: ['active', 'inactive', 'terminated'] }
      }
    },
    execute: async (input, { companyId }) => {
      let query = `
        SELECT e.full_name, e.employee_code, e.designation, e.phone, e.status, d.name AS department
        FROM employees e LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.company_id = ?
      `;
      const params = [companyId];
      if (input.name) { query += ' AND e.full_name LIKE ?'; params.push(`%${input.name}%`); }
      if (input.department) { query += ' AND d.name LIKE ?'; params.push(`%${input.department}%`); }
      if (input.status) { query += ' AND e.status = ?'; params.push(input.status); }
      query += ' LIMIT 25';

      const [rows] = await pool.query(query, params);
      return rows;
    }
  },
  {
    name: 'get_lead_pipeline',
    description: 'Get CRM lead counts grouped by status (new, contacted, qualified, converted, lost) for the last N months.',
    input_schema: {
      type: 'object',
      properties: { months: { type: 'number', description: 'How many months back to include (default 3)' } }
    },
    execute: async (input, { companyId }) => {
      const months = input.months || 3;
      const [rows] = await pool.query(
        `SELECT status, COUNT(*) AS count FROM leads
         WHERE company_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
         GROUP BY status`,
        [companyId, months]
      );
      return rows;
    }
  },
  {
    name: 'get_payroll_summary',
    description: 'Get payroll totals for a given month/year. Restricted to admin/hr/super_admin roles.',
    input_schema: {
      type: 'object',
      properties: {
        month: { type: 'number', description: '1-12' },
        year: { type: 'number', description: 'e.g. 2026' }
      },
      required: ['month', 'year']
    },
    execute: async (input, { companyId, role }) => {
      if (!['super_admin', 'admin', 'hr'].includes(role)) {
        return { error: 'You do not have permission to view payroll data.' };
      }
      const [[totals]] = await pool.query(
        `SELECT COUNT(*) AS employee_count, SUM(net_salary) AS total_cost
         FROM payroll WHERE company_id = ? AND month = ? AND year = ?`,
        [companyId, input.month, input.year]
      );
      return totals;
    }
  }
];

/** Returns tool schemas formatted for the Anthropic API (no `execute` field). */
function getToolSchemas() {
  return tools.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
}

/** Runs a named tool by looking it up from the registry above. */
async function runTool(name, input, context) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { error: `Unknown tool: ${name}` };
  try {
    return await tool.execute(input || {}, context);
  } catch (err) {
    console.error(`Assistant tool "${name}" failed:`, err);
    return { error: 'Something went wrong running that lookup.' };
  }
}

module.exports = { getToolSchemas, runTool };
