const crypto = require('crypto');
const QRCode = require('qrcode');

const QR_SECRET = process.env.QR_SECRET || 'change_this_qr_secret_in_env';

/**
 * Generates a signed token for a given company + date (defaults to today),
 * valid only for that company on that date.
 * Format: <companyId>.<YYYY-MM-DD>.<hmac>
 */
function generateDailyToken(dateStr = new Date().toISOString().slice(0, 10), companyId) {
  const payload = `${companyId}.${dateStr}`;
  const hmac = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex').slice(0, 16);
  return `${payload}.${hmac}`;
}

/**
 * Verifies a token was generated for today AND for the given company, and hasn't been tampered with.
 */
function verifyDailyToken(token, companyId) {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [tokenCompanyId, dateStr, providedHmac] = parts;
  const today = new Date().toISOString().slice(0, 10);

  if (dateStr !== today) return false; // expired / wrong day
  if (String(tokenCompanyId) !== String(companyId)) return false; // wrong tenant

  const payload = `${tokenCompanyId}.${dateStr}`;
  const expectedHmac = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex').slice(0, 16);

  if (providedHmac.length !== expectedHmac.length) return false;
  return crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac));
}

/**
 * Renders a QR code (as a PNG data buffer) encoding the given token.
 */
async function generateQrImageBuffer(token) {
  return QRCode.toBuffer(token, { type: 'png', width: 320, margin: 2 });
}

module.exports = { generateDailyToken, verifyDailyToken, generateQrImageBuffer };
