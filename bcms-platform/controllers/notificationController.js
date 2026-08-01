const pool = require('../config/database');
const { notifyUser } = require('../services/notificationDispatch');

/**
 * GET /api/notifications/:userId?unread_only=true
 */
exports.getUserNotifications = async (req, res) => {
  try {
    const { unread_only } = req.query;

    let query = 'SELECT * FROM notifications WHERE user_id = ? AND company_id = ?';
    const params = [req.params.userId, req.companyId];

    if (unread_only === 'true') {
      query += ' AND is_read = FALSE';
    }
    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

/**
 * POST /api/notifications
 * Body: { user_id, message }
 */
exports.createNotification = async (req, res) => {
  try {
    const { user_id, message } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ success: false, message: 'user_id and message are required' });
    }

    await notifyUser(req.companyId, user_id, message);

    res.status(201).json({ success: true, message: 'Notification sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send notification' });
  }
};

/**
 * PUT /api/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
};

/**
 * PUT /api/notifications/user/:userId/read-all
 */
exports.markAllAsRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND company_id = ?',
      [req.params.userId, req.companyId]
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
};

/**
 * DELETE /api/notifications/:id
 */
exports.deleteNotification = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM notifications WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
};
