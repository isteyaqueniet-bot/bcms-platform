const pool = require('../config/database');

/**
 * GET /api/departments
 */
exports.getAllDepartments = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id) AS employee_count
       FROM departments d
       WHERE d.company_id = ?
       ORDER BY d.name`,
      [req.companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch departments' });
  }
};

/**
 * POST /api/departments
 */
exports.createDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO departments (company_id, name) VALUES (?, ?)',
      [req.companyId, name]
    );

    res.status(201).json({ success: true, message: 'Department created', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create department' });
  }
};

/**
 * PUT /api/departments/:id
 */
exports.updateDepartment = async (req, res) => {
  try {
    const { name } = req.body;

    const [result] = await pool.query(
      'UPDATE departments SET name = COALESCE(?, name) WHERE id = ? AND company_id = ?',
      [name, req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    res.json({ success: true, message: 'Department updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update department' });
  }
};

/**
 * DELETE /api/departments/:id
 */
exports.deleteDepartment = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM departments WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    res.json({ success: true, message: 'Department deleted' });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ success: false, message: 'Cannot delete a department that still has employees assigned' });
    }
    res.status(500).json({ success: false, message: 'Failed to delete department' });
  }
};
