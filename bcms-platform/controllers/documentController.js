const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

/**
 * POST /api/documents/upload
 */
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { title, related_type, related_id } = req.body;
    const uploaded_by = req.user.id;

    const [result] = await pool.query(
      `INSERT INTO documents (company_id, title, file_path, uploaded_by, related_type, related_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.companyId, title || req.file.originalname, req.file.path, uploaded_by, related_type || null, related_id || null]
    );

    res.status(201).json({
      success: true,
      message: 'Document uploaded',
      data: { id: result.insertId, filename: req.file.filename }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

/**
 * GET /api/documents?related_type=&related_id=
 */
exports.getAllDocuments = async (req, res) => {
  try {
    const { related_type, related_id } = req.query;

    let query = `
      SELECT d.*, u.name AS uploaded_by_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.company_id = ?
    `;
    const params = [req.companyId];

    if (related_type) { query += ' AND d.related_type = ?'; params.push(related_type); }
    if (related_id) { query += ' AND d.related_id = ?'; params.push(related_id); }

    query += ' ORDER BY d.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
};

/**
 * GET /api/documents/:id/download
 */
exports.downloadDocument = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM documents WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const doc = rows[0];
    if (!fs.existsSync(doc.file_path)) {
      return res.status(410).json({ success: false, message: 'File is missing from storage' });
    }

    res.download(doc.file_path, doc.title || path.basename(doc.file_path));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to download document' });
  }
};

/**
 * DELETE /api/documents/:id
 */
exports.deleteDocument = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT file_path FROM documents WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    await pool.query('DELETE FROM documents WHERE id = ? AND company_id = ?', [req.params.id, req.companyId]);

    fs.unlink(rows[0].file_path, (err) => {
      if (err) console.warn('Could not remove file from disk:', err.message);
    });

    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
};
