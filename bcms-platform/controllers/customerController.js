const pool = require('../config/database');

/**
 * GET /api/customers
 */
exports.getAllCustomers = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT c.*, u.name AS assigned_to_name
      FROM customers c
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE c.company_id = ?
    `;
    const params = [req.companyId];

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    query += ' ORDER BY c.id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch customers' });
  }
};

/**
 * POST /api/customers
 */
exports.createCustomer = async (req, res) => {
  try {
    const { name, company_name, email, phone, address, assigned_to } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO customers (company_id, name, company_name, email, phone, address, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.companyId, name, company_name || null, email || null, phone || null, address || null, assigned_to || null]
    );

    res.status(201).json({ success: true, message: 'Customer created', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create customer' });
  }
};

/**
 * PUT /api/customers/:id
 */
exports.updateCustomer = async (req, res) => {
  try {
    const { name, company_name, email, phone, address, assigned_to, status } = req.body;

    const [result] = await pool.query(
      `UPDATE customers SET
        name = COALESCE(?, name),
        company_name = COALESCE(?, company_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        assigned_to = COALESCE(?, assigned_to),
        status = COALESCE(?, status)
       WHERE id = ? AND company_id = ?`,
      [name, company_name, email, phone, address, assigned_to, status, req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, message: 'Customer updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update customer' });
  }
};

/**
 * DELETE /api/customers/:id
 */
exports.deleteCustomer = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM customers WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, message: 'Customer deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete customer' });
  }
};

/**
 * POST /api/leads
 */
exports.createLead = async (req, res) => {
  try {
    const { name, email, phone, source, assigned_to, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO leads (company_id, name, email, phone, source, assigned_to, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.companyId, name, email || null, phone || null, source || null, assigned_to || null, notes || null]
    );

    res.status(201).json({ success: true, message: 'Lead created', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create lead' });
  }
};

/**
 * GET /api/leads
 */
exports.getAllLeads = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT l.*, u.name AS assigned_to_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.company_id = ?
    `;
    const params = [req.companyId];

    if (status) {
      query += ' AND l.status = ?';
      params.push(status);
    }

    query += ' ORDER BY l.id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch leads' });
  }
};
