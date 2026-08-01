const pool = require('../config/database');

/**
 * GET /api/projects?status=&customer_id=
 */
exports.getAllProjects = async (req, res) => {
  try {
    const { status, customer_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, c.name AS customer_name,
             (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
             (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count
      FROM projects p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE p.company_id = ?
    `;
    const params = [req.companyId];

    if (status) { query += ' AND p.status = ?'; params.push(status); }
    if (customer_id) { query += ' AND p.customer_id = ?'; params.push(customer_id); }

    query += ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch projects' });
  }
};

/**
 * GET /api/projects/:id
 * Returns project detail plus its tasks and assigned team members.
 */
exports.getProjectById = async (req, res) => {
  try {
    const [projectRows] = await pool.query(
      `SELECT p.*, c.name AS customer_name
       FROM projects p
       LEFT JOIN customers c ON p.customer_id = c.id
       WHERE p.id = ? AND p.company_id = ?`,
      [req.params.id, req.companyId]
    );

    if (projectRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const [tasks] = await pool.query(
      `SELECT t.*, u.name AS assigned_to_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.project_id = ? AND t.company_id = ?
       ORDER BY t.due_date IS NULL, t.due_date`,
      [req.params.id, req.companyId]
    );

    const [team] = await pool.query(
      `SELECT DISTINCT u.id, u.name, u.email
       FROM tasks t
       JOIN users u ON t.assigned_to = u.id
       WHERE t.project_id = ? AND t.company_id = ?`,
      [req.params.id, req.companyId]
    );

    res.json({ success: true, data: { ...projectRows[0], tasks, team } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch project' });
  }
};

/**
 * POST /api/projects
 */
exports.createProject = async (req, res) => {
  try {
    const { name, customer_id, start_date, end_date, status } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO projects (company_id, name, customer_id, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.companyId, name, customer_id || null, start_date || null, end_date || null, status || 'planned']
    );

    res.status(201).json({ success: true, message: 'Project created', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create project' });
  }
};

/**
 * PUT /api/projects/:id
 */
exports.updateProject = async (req, res) => {
  try {
    const { name, customer_id, start_date, end_date, status } = req.body;

    const [result] = await pool.query(
      `UPDATE projects SET
        name = COALESCE(?, name),
        customer_id = COALESCE(?, customer_id),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        status = COALESCE(?, status)
       WHERE id = ? AND company_id = ?`,
      [name, customer_id, start_date, end_date, status, req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, message: 'Project updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update project' });
  }
};

/**
 * DELETE /api/projects/:id
 */
exports.deleteProject = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM projects WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, message: 'Project deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete project' });
  }
};
