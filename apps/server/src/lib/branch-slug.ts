/**
 * Branch Slug Utilities - Converts titles to branch-friendly slugs
 */

/**
 * Convert a title to a short branch-friendly slug (2-3 words max)
 *
 * Examples:
 * - "Fix augment-context-engine MCP server connection" -> "augment-mcp-server"
 * - "Add dark mode toggle to settings" -> "dark-mode-toggle"
 * - "Update user authentication flow" -> "user-auth-flow"
 */
export function titleToBranchSlug(title: string): string {
  // Common verbs to strip from the beginning
  const verbsToStrip = [
    'fix',
    'add',
    'update',
    'implement',
    'create',
    'remove',
    'refactor',
    'improve',
    'enhance',
    'resolve',
    'handle',
    'setup',
    'configure',
    'enable',
    'disable',
    'integrate',
  ];

  // Common filler words to remove
  const fillerWords = [
    'the',
    'a',
    'an',
    'to',
    'for',
    'of',
    'in',
    'on',
    'with',
    'and',
    'or',
    'that',
    'this',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'dare',
    'ought',
    'used',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'every',
    'both',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    'just',
    'also',
    'now',
    'here',
    'there',
  ];

  // Normalize: lowercase, replace special chars with spaces
  let normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split into words
  let words = normalized.split(' ');

  // Remove leading verb if present
  if (words.length > 0 && verbsToStrip.includes(words[0])) {
    words = words.slice(1);
  }

  // Filter out filler words and short words
  words = words.filter((word) => word.length > 1 && !fillerWords.includes(word));

  // Take first 3 significant words
  words = words.slice(0, 3);

  // If we have no words, fall back to first 3 from original
  if (words.length === 0) {
    words = normalized
      .split(' ')
      .filter((w) => w.length > 1)
      .slice(0, 3);
  }

  // Join with hyphens
  return words.join('-') || 'task';
}
