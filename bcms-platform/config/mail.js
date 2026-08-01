const nodemailer = require('nodemailer');
require('dotenv').config();

const isConfigured = Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASSWORD);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
      }
    })
  : null;

module.exports = {
  transporter,
  from: process.env.MAIL_FROM || process.env.MAIL_USER,
  isConfigured
};
