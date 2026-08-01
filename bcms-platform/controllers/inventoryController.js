const pool = require('../config/database');

/**
 * GET /api/inventory?category=&low_stock=true
 */
exports.getAllItems = async (req, res) => {
  try {
    const { category, low_stock } = req.query;

    let query = 'SELECT * FROM inventory_items WHERE company_id = ?';
    const params = [req.companyId];

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (low_stock === 'true') { query += ' AND quantity <= reorder_level'; }

    query += ' ORDER BY name';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch inventory items' });
  }
};

/**
 * GET /api/inventory/:id
 * Includes recent transaction history for that item.
 */
exports.getItemById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM inventory_items WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const [transactions] = await pool.query(
      `SELECT it.*, u.name AS performed_by_name
       FROM inventory_transactions it
       LEFT JOIN users u ON it.performed_by = u.id
       WHERE it.item_id = ? AND it.company_id = ?
       ORDER BY it.created_at DESC LIMIT 50`,
      [req.params.id, req.companyId]
    );

    res.json({ success: true, data: { ...rows[0], recent_transactions: transactions } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch inventory item' });
  }
};

/**
 * POST /api/inventory
 */
exports.createItem = async (req, res) => {
  try {
    const { name, sku, category, unit, quantity, reorder_level, unit_cost } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO inventory_items (company_id, name, sku, category, unit, quantity, reorder_level, unit_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.companyId, name, sku || null, category || null, unit || 'pcs',
       quantity || 0, reorder_level || 0, unit_cost || null]
    );

    // If the item starts with stock on hand, log that as the first transaction for a clean audit trail.
    if (quantity && Number(quantity) > 0) {
      await pool.query(
        'INSERT INTO inventory_transactions (company_id, item_id, change_qty, reason, performed_by) VALUES (?, ?, ?, ?, ?)',
        [req.companyId, result.insertId, Number(quantity), 'Initial stock', req.user.id]
      );
    }

    res.status(201).json({ success: true, message: 'Inventory item created', data: { id: result.insertId } });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'SKU already exists in your company' });
    }
    res.status(500).json({ success: false, message: 'Failed to create inventory item' });
  }
};

/**
 * PUT /api/inventory/:id
 * Edits descriptive fields only — use POST /api/inventory/:id/adjust to change quantity,
 * so every quantity change always goes through the audited transaction log.
 */
exports.updateItem = async (req, res) => {
  try {
    const { name, sku, category, unit, reorder_level, unit_cost } = req.body;

    const [result] = await pool.query(
      `UPDATE inventory_items SET
        name = COALESCE(?, name),
        sku = COALESCE(?, sku),
        category = COALESCE(?, category),
        unit = COALESCE(?, unit),
        reorder_level = COALESCE(?, reorder_level),
        unit_cost = COALESCE(?, unit_cost)
       WHERE id = ? AND company_id = ?`,
      [name, sku, category, unit, reorder_level, unit_cost, req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    res.json({ success: true, message: 'Inventory item updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update inventory item' });
  }
};

/**
 * POST /api/inventory/:id/adjust
 * Body: { change_qty, reason }  — positive to add stock, negative to remove.
 * The only sanctioned way to change quantity; always logs a transaction row.
 */
exports.adjustStock = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { change_qty, reason } = req.body;

    if (change_qty === undefined || change_qty === 0 || isNaN(Number(change_qty))) {
      return res.status(400).json({ success: false, message: 'change_qty must be a non-zero number' });
    }

    await conn.beginTransaction();

    const [items] = await conn.query(
      'SELECT quantity FROM inventory_items WHERE id = ? AND company_id = ? FOR UPDATE',
      [req.params.id, req.companyId]
    );
    if (items.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const newQuantity = items[0].quantity + Number(change_qty);
    if (newQuantity < 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot remove ${Math.abs(change_qty)} units — only ${items[0].quantity} in stock`
      });
    }

    await conn.query('UPDATE inventory_items SET quantity = ? WHERE id = ?', [newQuantity, req.params.id]);
    await conn.query(
      'INSERT INTO inventory_transactions (company_id, item_id, change_qty, reason, performed_by) VALUES (?, ?, ?, ?, ?)',
      [req.companyId, req.params.id, Number(change_qty), reason || null, req.user.id]
    );

    await conn.commit();
    res.json({ success: true, message: 'Stock adjusted', data: { new_quantity: newQuantity } });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to adjust stock' });
  } finally {
    conn.release();
  }
};

/**
 * DELETE /api/inventory/:id
 */
exports.deleteItem = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM inventory_items WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    res.json({ success: true, message: 'Inventory item deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete inventory item' });
  }
};
