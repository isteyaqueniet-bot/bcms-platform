const twilio = require('twilio');
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Client is only created if credentials are present, so the app still boots
// fine for companies/deployments that haven't set up SMS/WhatsApp yet.
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

module.exports = {
  client,
  smsFrom: process.env.TWILIO_SMS_FROM,             // e.g. '+15017122661'
  whatsappFrom: process.env.TWILIO_WHATSAPP_FROM,   // e.g. 'whatsapp:+14155238886'
  isConfigured: Boolean(client)
};
