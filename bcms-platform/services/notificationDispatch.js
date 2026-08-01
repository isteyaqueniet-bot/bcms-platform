const pool = require('../config/database');
const twilioConfig = require('../config/twilio');
const mailConfig = require('../config/mail');

/**
 * Reads this company's configured notification channels from settings.
 * Defaults to in-app only if nothing is configured.
 * Set via: PUT /api/settings { "notification_channels": "app,sms,whatsapp" }
 */
async function getEnabledChannels(companyId) {
  const [rows] = await pool.query(
    "SELECT setting_value FROM settings WHERE company_id = ? AND setting_key = 'notification_channels'",
    [companyId]
  );
  if (rows.length === 0) return ['app'];
  return rows[0].setting_value.split(',').map((c) => c.trim()).filter(Boolean);
}

/**
 * Looks up the phone number for a user via their linked employee record.
 * Returns null if the user has no employee profile or no phone on file.
 */
async function getUserPhone(userId) {
  const [rows] = await pool.query(
    'SELECT phone FROM employees WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows.length > 0 ? rows[0].phone : null;
}

/**
 * Users already have an email (it's their login), so unlike phone this
 * never needs an employee-record lookup.
 */
async function getUserEmail(userId) {
  const [rows] = await pool.query('SELECT email FROM users WHERE id = ?', [userId]);
  return rows.length > 0 ? rows[0].email : null;
}

/**
 * Sends an email via Nodemailer. No-ops with a warning if mail isn't configured.
 */
async function sendEmail(toEmail, subject, body) {
  if (!mailConfig.isConfigured) {
    console.warn('Email not configured — skipping email dispatch. Set MAIL_* env vars to enable.');
    return { sent: false, reason: 'not_configured' };
  }
  try {
    await mailConfig.transporter.sendMail({
      from: mailConfig.from,
      to: toEmail,
      subject,
      text: body
    });
    return { sent: true };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * Sends an SMS via Twilio. No-ops with a warning if Twilio isn't configured.
 */
async function sendSms(toPhone, body) {
  if (!twilioConfig.isConfigured || !twilioConfig.smsFrom) {
    console.warn('Twilio SMS not configured — skipping SMS dispatch. Set TWILIO_* env vars to enable.');
    return { sent: false, reason: 'not_configured' };
  }
  try {
    await twilioConfig.client.messages.create({ from: twilioConfig.smsFrom, to: toPhone, body });
    return { sent: true };
  } catch (err) {
    console.error('Twilio SMS send failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * Sends a WhatsApp message via Twilio's WhatsApp Business API.
 * `toPhone` should be a plain phone number (e.g. '+15551234567') — the
 * 'whatsapp:' prefix is added automatically for both sides here.
 */
async function sendWhatsApp(toPhone, body) {
  if (!twilioConfig.isConfigured || !twilioConfig.whatsappFrom) {
    console.warn('Twilio WhatsApp not configured — skipping WhatsApp dispatch. Set TWILIO_WHATSAPP_FROM to enable.');
    return { sent: false, reason: 'not_configured' };
  }
  try {
    await twilioConfig.client.messages.create({
      from: twilioConfig.whatsappFrom,
      to: `whatsapp:${toPhone.replace(/^whatsapp:/, '')}`,
      body
    });
    return { sent: true };
  } catch (err) {
    console.error('Twilio WhatsApp send failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * Central entry point for notifying a user: always writes the in-app
 * notification row, then additionally dispatches SMS/WhatsApp if the
 * company has those channels enabled AND the user has a phone on file.
 *
 * Use this instead of inserting into `notifications` directly whenever
 * a module needs to notify someone (task assignment, leave decisions, etc.),
 * so every notification consistently respects the company's channel settings.
 */
async function notifyUser(companyId, userId, message) {
  await pool.query(
    'INSERT INTO notifications (company_id, user_id, message) VALUES (?, ?, ?)',
    [companyId, userId, message]
  );

  const channels = await getEnabledChannels(companyId);

  if (channels.includes('email')) {
    const email = await getUserEmail(userId);
    if (email) await sendEmail(email, 'BCMS Notification', message);
  }

  const needsPhone = channels.includes('sms') || channels.includes('whatsapp');
  if (!needsPhone) return;

  const phone = await getUserPhone(userId);
  if (!phone) return; // nothing to dispatch to — in-app notification still stands

  if (channels.includes('sms')) await sendSms(phone, message);
  if (channels.includes('whatsapp')) await sendWhatsApp(phone, message);
}

module.exports = { notifyUser, sendSms, sendWhatsApp, sendEmail, getEnabledChannels, getUserPhone, getUserEmail };
