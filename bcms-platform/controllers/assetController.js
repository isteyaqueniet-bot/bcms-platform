const pool = require('../config/database');

/**
 * GET /api/assets?status=&category=
 */
exports.getAllAssets = async (req, res) => {
  try {
    const { status, category } = req.query;

    let query = `
      SELECT a.*, e.full_name AS assigned_to_name
      FROM assets a
      LEFT JOIN employees e ON a.assigned_to = e.id
      WHERE a.company_id = ?
    `;
    const params = [req.companyId];

    if (status) { query += ' AND a.status = ?'; params.push(status); }
    if (category) { query += ' AND a.category = ?'; params.push(category); }

    query += ' ORDER BY a.name';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch assets' });
  }
};

/**
 * GET /api/assets/:id
 * Includes full assignment history for that asset.
 */
exports.getAssetById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, e.full_name AS assigned_to_name
       FROM assets a
       LEFT JOIN employees e ON a.assigned_to = e.id
       WHERE a.id = ? AND a.company_id = ?`,
      [req.params.id, req.companyId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const [history] = await pool.query(
      `SELECT aa.*, e.full_name AS employee_name
       FROM asset_assignments aa
       JOIN employees e ON aa.employee_id = e.id
       WHERE aa.asset_id = ? AND aa.company_id = ?
       ORDER BY aa.assigned_date DESC`,
      [req.params.id, req.companyId]
    );

    res.json({ success: true, data: { ...rows[0], assignment_history: history } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch asset' });
  }
};

/**
 * POST /api/assets
 */
exports.createAsset = async (req, res) => {
  try {
    const { name, asset_code, category, purchase_date, purchase_cost, location, notes } = req.body;

    if (!name || !asset_code) {
      return res.status(400).json({ success: false, message: 'name and asset_code are required' });
    }

    const [result] = await pool.query(
      `INSERT INTO assets (company_id, name, asset_code, category, purchase_date, purchase_cost, location, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available')`,
      [req.companyId, name, asset_code, category || null, purchase_date || null,
       purchase_cost || null, location || null, notes || null]
    );

    res.status(201).json({ success: true, message: 'Asset created', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Asset code already exists in your company' });
    }
    res.status(500).json({ success: false, message: 'Failed to create asset' });
  }
};

/**
 * PUT /api/assets/:id
 * Edits descriptive fields and status directly (e.g. moving to 'maintenance' or 'retired').
 * Use the dedicated assign/return endpoints below to change who holds it — those also
 * keep assignment_history accurate, which a plain status/field update here does not.
 */
exports.updateAsset = async (req, res) => {
  try {
    const { name, category, purchase_date, purchase_cost, location, notes, status } = req.body;

    if (status === 'assigned') {
      return res.status(400).json({
        success: false,
        message: "Use POST /api/assets/:id/assign to assign an asset, not a direct status update"
      });
    }

    const [result] = await pool.query(
      `UPDATE assets SET
        name = COALESCE(?, name),
        category = COALESCE(?, category),
        purchase_date = COALESCE(?, purchase_date),
        purchase_cost = COALESCE(?, purchase_cost),
        location = COALESCE(?, location),
        notes = COALESCE(?, notes),
        status = COALESCE(?, status)
       WHERE id = ? AND company_id = ?`,
      [name, category, purchase_date, purchase_cost, location, notes, status, req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    res.json({ success: true, message: 'Asset updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update asset' });
  }
};

/**
 * POST /api/assets/:id/assign
 * Body: { employee_id, notes }
 * Assigns an available asset to an employee and opens a new assignment_history row.
 */
exports.assignAsset = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { employee_id, notes } = req.body;
    if (!employee_id) {
      return res.status(400).json({ success: false, message: 'employee_id is required' });
    }

    await conn.beginTransaction();

    const [assets] = await conn.query(
      'SELECT status FROM assets WHERE id = ? AND company_id = ? FOR UPDATE',
      [req.params.id, req.companyId]
    );
    if (assets.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    if (assets[0].status !== 'available') {
      await conn.rollback();
      return res.status(409).json({ success: false, message: `Asset is currently '${assets[0].status}', not available` });
    }

    const [employees] = await conn.query(
      'SELECT id FROM employees WHERE id = ? AND company_id = ?',
      [employee_id, req.companyId]
    );
    if (employees.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Employee not found in your company' });
    }

    await conn.query(
      "UPDATE assets SET status = 'assigned', assigned_to = ? WHERE id = ?",
      [employee_id, req.params.id]
    );
    await conn.query(
      `INSERT INTO asset_assignments (company_id, asset_id, employee_id, assigned_date, notes)
       VALUES (?, ?, ?, CURDATE(), ?)`,
      [req.companyId, req.params.id, employee_id, notes || null]
    );

    await conn.commit();
    res.json({ success: true, message: 'Asset assigned' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to assign asset' });
  } finally {
    conn.release();
  }
};

/**
 * POST /api/assets/:id/return
 * Closes out the currently open assignment_history row and frees up the asset.
 */
exports.returnAsset = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [assets] = await conn.query(
      'SELECT status FROM assets WHERE id = ? AND company_id = ? FOR UPDATE',
      [req.params.id, req.companyId]
    );
    if (assets.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    if (assets[0].status !== 'assigned') {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Asset is not currently assigned' });
    }

    await conn.query(
      "UPDATE assets SET status = 'available', assigned_to = NULL WHERE id = ?",
      [req.params.id]
    );
    await conn.query(
      `UPDATE asset_assignments SET returned_date = CURDATE()
       WHERE asset_id = ? AND company_id = ? AND returned_date IS NULL
       ORDER BY assigned_date DESC LIMIT 1`,
      [req.params.id, req.companyId]
    );

    await conn.commit();
    res.json({ success: true, message: 'Asset returned' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to return asset' });
  } finally {
    conn.release();
  }
};

/**
 * DELETE /api/assets/:id
 */
exports.deleteAsset = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM assets WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    res.json({ success: true, message: 'Asset deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete asset' });
  }
};
