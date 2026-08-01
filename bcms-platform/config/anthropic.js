const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

module.exports = {
  client,
  model: 'claude-sonnet-5',
  isConfigured: Boolean(process.env.ANTHROPIC_API_KEY)
};
