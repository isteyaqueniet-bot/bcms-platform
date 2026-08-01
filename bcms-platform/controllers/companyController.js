const pool = require('../config/database');

/**
 * GET /api/companies
 * Platform admin: list all tenants with basic usage stats.
 */
exports.getAllCompanies = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS user_count,
              (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.id) AS employee_count
       FROM companies c
       ORDER BY c.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch companies' });
  }
};

/**
 * GET /api/companies/:id
 */
exports.getCompanyById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch company' });
  }
};

/**
 * POST /api/companies
 * Platform admin manually creates a tenant WITHOUT a first user
 * (use /api/auth/signup-company for the self-serve flow that creates both).
 */
exports.createCompany = async (req, res) => {
  try {
    const { name, slug, industry, email, phone, address, plan } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, message: 'name and slug are required' });
    }

    const [result] = await pool.query(
      `INSERT INTO companies (name, slug, industry, email, phone, address, plan)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, slug, industry || null, email || null, phone || null, address || null, plan || 'trial']
    );

    res.status(201).json({ success: true, message: 'Company created', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'That slug is already taken' });
    }
    res.status(500).json({ success: false, message: 'Failed to create company' });
  }
};

/**
 * PUT /api/companies/:id
 */
exports.updateCompany = async (req, res) => {
  try {
    const { name, industry, email, phone, address, plan, status } = req.body;

    const [result] = await pool.query(
      `UPDATE companies SET
        name = COALESCE(?, name),
        industry = COALESCE(?, industry),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        plan = COALESCE(?, plan),
        status = COALESCE(?, status)
       WHERE id = ?`,
      [name, industry, email, phone, address, plan, status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.json({ success: true, message: 'Company updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update company' });
  }
};

/**
 * PUT /api/companies/:id/suspend
 * Quick action: blocks all logins for that company without deleting any data.
 */
exports.suspendCompany = async (req, res) => {
  try {
    const [result] = await pool.query("UPDATE companies SET status = 'suspended' WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, message: 'Company suspended' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to suspend company' });
  }
};

/**
 * PUT /api/companies/:id/activate
 */
exports.activateCompany = async (req, res) => {
  try {
    const [result] = await pool.query("UPDATE companies SET status = 'active' WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, message: 'Company activated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to activate company' });
  }
};

/**
 * DELETE /api/companies/:id
 * Destructive — cascades to ALL of that company's users, employees, customers,
 * projects, etc. via ON DELETE CASCADE. Use suspend instead unless you're certain.
 */
exports.deleteCompany = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM companies WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }
    res.json({ success: true, message: 'Company and all associated data deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete company' });
  }
};
