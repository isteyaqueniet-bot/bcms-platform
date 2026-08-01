const anthropicConfig = require('../config/anthropic');
const { getToolSchemas, runTool } = require('../services/assistantTools');

const SYSTEM_PROMPT = `You are the BCMS platform's internal business assistant. You answer questions
about the asking user's own company by calling the tools available to you — never guess or make up
numbers. If a question needs data no tool provides, say so plainly rather than speculating. Keep
answers concise and business-appropriate. You have no ability to modify any data — you can only look
things up and report back.`;

const MAX_TOOL_ROUNDS = 5;

/**
 * POST /api/assistant/ask
 * Body: { question: string, conversation?: Array<{role, content}> }
 * `conversation` lets the frontend maintain a running chat; if omitted, starts fresh.
 */
exports.ask = async (req, res) => {
  try {
    if (!anthropicConfig.isConfigured) {
      return res.status(503).json({
        success: false,
        message: 'AI assistant is not configured. Set ANTHROPIC_API_KEY in the server .env to enable it.'
      });
    }

    const { question, conversation } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ success: false, message: 'question is required' });
    }

    const context = { companyId: req.companyId, role: req.user.role };
    const messages = Array.isArray(conversation) ? [...conversation] : [];
    messages.push({ role: 'user', content: question });

    let finalText = '';
    let rounds = 0;

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds += 1;

      const response = await anthropicConfig.client.messages.create({
        model: anthropicConfig.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: getToolSchemas(),
        messages
      });

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const textBlocks = response.content.filter((b) => b.type === 'text');
      finalText = textBlocks.map((b) => b.text).join('\n');

      if (toolUseBlocks.length === 0) {
        // Model gave a final answer with no further tool calls — we're done.
        messages.push({ role: 'assistant', content: response.content });
        break;
      }

      // Execute every requested tool call, scoped to this user's company/role.
      messages.push({ role: 'assistant', content: response.content });

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const result = await runTool(block.name, block.input, context);
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result)
          };
        })
      );

      messages.push({ role: 'user', content: toolResults });
    }

    res.json({
      success: true,
      data: {
        answer: finalText || "I wasn't able to complete that — try rephrasing your question.",
        conversation: messages
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to get a response from the assistant' });
  }
};
