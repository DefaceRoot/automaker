/**
 * Title Generator - Generates concise titles from descriptions using Claude Haiku
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { CLAUDE_MODEL_MAP } from '@automaker/model-resolver';
import { createLogger } from '@automaker/utils';

const logger = createLogger('TitleGenerator');

const SYSTEM_PROMPT = `You are a title generator. Your task is to create a concise, descriptive title (5-10 words max) for a software feature based on its description.

Rules:
- Output ONLY the title, nothing else
- Keep it short and action-oriented (e.g., "Add dark mode toggle", "Fix login validation")
- Start with a verb when possible (Add, Fix, Update, Implement, Create, etc.)
- No quotes, periods, or extra formatting
- Capture the essence of the feature in a scannable way`;

/**
 * Generate a concise title from a feature description
 *
 * @param description - The feature description to generate a title for
 * @returns The generated title, or null if generation fails
 */
export async function generateTitleFromDescription(description: string): Promise<string | null> {
  try {
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      return null;
    }

    logger.info(`Generating title for: ${trimmedDescription.substring(0, 50)}...`);

    const userPrompt = `Generate a concise title for this feature:\n\n${trimmedDescription}`;

    const stream = query({
      prompt: userPrompt,
      options: {
        model: CLAUDE_MODEL_MAP.haiku,
        systemPrompt: SYSTEM_PROMPT,
        maxTurns: 1,
        allowedTools: [],
        permissionMode: 'acceptEdits',
      },
    });

    let responseText = '';
    for await (const msg of stream) {
      if (msg.type === 'assistant' && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text) {
            responseText += block.text;
          }
        }
      } else if (msg.type === 'result' && msg.subtype === 'success') {
        responseText = msg.result || responseText;
      }
    }

    const title = responseText.trim();
    if (!title) {
      logger.warn('Empty title generated');
      return null;
    }

    logger.info(`Generated title: ${title}`);
    return title;
  } catch (error) {
    logger.error('Title generation failed:', error);
    return null;
  }
}
