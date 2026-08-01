const pool = require('../config/database');
const { notifyUser } = require('../services/notificationDispatch');

/**
 * GET /api/tasks?project_id=&assigned_to=&status=
 */
exports.getAllTasks = async (req, res) => {
  try {
    const { project_id, assigned_to, status } = req.query;

    let query = `
      SELECT t.*, p.name AS project_name, u.name AS assigned_to_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.company_id = ?
    `;
    const params = [req.companyId];

    if (project_id) { query += ' AND t.project_id = ?'; params.push(project_id); }
    if (assigned_to) { query += ' AND t.assigned_to = ?'; params.push(assigned_to); }
    if (status) { query += ' AND t.status = ?'; params.push(status); }

    query += ' ORDER BY t.due_date IS NULL, t.due_date, t.id DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
};

/**
 * GET /api/tasks/my/:userId
 */
exports.getMyTasks = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, p.name AS project_name
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       WHERE t.assigned_to = ? AND t.company_id = ?
       ORDER BY t.due_date IS NULL, t.due_date`,
      [req.params.userId, req.companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch your tasks' });
  }
};

/**
 * POST /api/tasks
 */
exports.createTask = async (req, res) => {
  try {
    const { project_id, title, description, assigned_to, due_date } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO tasks (company_id, project_id, title, description, assigned_to, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'todo')`,
      [req.companyId, project_id || null, title, description || null, assigned_to || null, due_date || null]
    );

    if (assigned_to) {
      await notifyUser(req.companyId, assigned_to, `You have been assigned a new task: "${title}"`);
    }

    res.status(201).json({ success: true, message: 'Task created', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create task' });
  }
};

/**
 * PUT /api/tasks/:id
 */
exports.updateTask = async (req, res) => {
  try {
    const { title, description, project_id, assigned_to, due_date } = req.body;

    const [result] = await pool.query(
      `UPDATE tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        project_id = COALESCE(?, project_id),
        assigned_to = COALESCE(?, assigned_to),
        due_date = COALESCE(?, due_date)
       WHERE id = ? AND company_id = ?`,
      [title, description, project_id, assigned_to, due_date, req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, message: 'Task updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
};

/**
 * PUT /api/tasks/:id/status
 */
exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['todo', 'in_progress', 'done'].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'todo', 'in_progress' or 'done'" });
    }

    const [result] = await pool.query(
      'UPDATE tasks SET status = ? WHERE id = ? AND company_id = ?',
      [status, req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, message: `Task marked as ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update task status' });
  }
};

/**
 * DELETE /api/tasks/:id
 */
exports.deleteTask = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM tasks WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
};
