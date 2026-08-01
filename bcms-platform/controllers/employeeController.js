const pool = require('../config/database');

/**
 * GET /api/employees
 * Supports optional ?department_id= and ?status= filters, plus pagination.
 * Always scoped to the caller's company.
 */
exports.getAllEmployees = async (req, res) => {
  try {
    const { department_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT e.id, e.employee_code, e.full_name, e.designation, e.phone,
             e.date_of_joining, e.status, d.name AS department
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.company_id = ?
    `;
    const params = [req.companyId];

    if (department_id) {
      query += ' AND e.department_id = ?';
      params.push(department_id);
    }
    if (status) {
      query += ' AND e.status = ?';
      params.push(status);
    }

    query += ' ORDER BY e.id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
};

/**
 * GET /api/employees/:id
 */
exports.getEmployeeById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, d.name AS department
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.id = ? AND e.company_id = ?`,
      [req.params.id, req.companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch employee' });
  }
};

/**
 * POST /api/employees
 */
exports.createEmployee = async (req, res) => {
  try {
    const {
      employee_code, full_name, department_id, designation,
      phone, address, date_of_joining, salary, user_id
    } = req.body;

    if (!employee_code || !full_name) {
      return res.status(400).json({ success: false, message: 'employee_code and full_name are required' });
    }

    const [result] = await pool.query(
      `INSERT INTO employees
       (company_id, employee_code, full_name, department_id, designation, phone, address, date_of_joining, salary, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.companyId, employee_code, full_name, department_id || null, designation || null,
       phone || null, address || null, date_of_joining || null, salary || null, user_id || null]
    );

    res.status(201).json({ success: true, message: 'Employee created', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Employee code already exists in your company' });
    }
    res.status(500).json({ success: false, message: 'Failed to create employee' });
  }
};

/**
 * PUT /api/employees/:id
 */
exports.updateEmployee = async (req, res) => {
  try {
    const { full_name, department_id, designation, phone, address, salary, status } = req.body;

    const [result] = await pool.query(
      `UPDATE employees SET
        full_name = COALESCE(?, full_name),
        department_id = COALESCE(?, department_id),
        designation = COALESCE(?, designation),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        salary = COALESCE(?, salary),
        status = COALESCE(?, status)
       WHERE id = ? AND company_id = ?`,
      [full_name, department_id, designation, phone, address, salary, status, req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, message: 'Employee updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update employee' });
  }
};

/**
 * DELETE /api/employees/:id
 */
exports.deleteEmployee = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM employees WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, message: 'Employee deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete employee' });
  }
};
