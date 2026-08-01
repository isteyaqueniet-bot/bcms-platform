const pool = require('../config/database');

/**
 * GET /api/settings
 * Returns this company's settings as a flat key-value object.
 */
exports.getAllSettings = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT setting_key, setting_value FROM settings WHERE company_id = ?',
      [req.companyId]
    );
    const data = {};
    rows.forEach((row) => { data[row.setting_key] = row.setting_value; });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

/**
 * PUT /api/settings
 * Body: { key: value, key2: value2, ... } — upserts each provided key for this company only.
 */
exports.updateSettings = async (req, res) => {
  try {
    const entries = Object.entries(req.body || {});
    if (entries.length === 0) {
      return res.status(400).json({ success: false, message: 'No settings provided' });
    }

    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO settings (company_id, setting_key, setting_value) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [req.companyId, key, String(value)]
      );
    }

    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
};
