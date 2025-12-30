# Refactor Worktree Branch Naming

## Objective

Improve worktree branch name generation to produce concise, meaningful names (2-3 words max) instead of truncated descriptions.

**Current behavior**: `bugfix/001-can-you-please-debug-and-resolve-the-issue-with-th`
**Desired behavior**: `bugfix/001-augment-mcp-fix`

## Branch Name Format

```
{category}/{NNN}-{word1}-{word2}-{word3}
```

- `category`: bugfix, feature, hotfix, refactor, chore, docs
- `NNN`: Zero-padded sequential number, category-specific (001, 002, etc.)
- `word1-word2-word3`: 2-3 relevant words extracted from the feature title

## Implementation Tasks

### Task 1: Create Title Generator Helper

**File**: `apps/server/src/lib/title-generator.ts` (NEW)

Extract the title generation logic from the route handler into a reusable helper function.

```typescript
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
```

### Task 2: Create `titleToBranchSlug()` Function

**File**: `apps/server/src/services/worktree-manager.ts`

Replace the existing `titleToSlug()` method (lines 629-638) with a new `titleToBranchSlug()` method that extracts 2-3 relevant words.

```typescript
/**
 * Convert a title to a short branch-friendly slug (2-3 words max)
 *
 * Examples:
 * - "Fix augment-context-engine MCP server connection" -> "augment-mcp-server"
 * - "Add dark mode toggle to settings" -> "dark-mode-toggle"
 * - "Update user authentication flow" -> "user-auth-flow"
 */
private titleToBranchSlug(title: string): string {
  // Common verbs to strip from the beginning
  const verbsToStrip = [
    'fix', 'add', 'update', 'implement', 'create', 'remove',
    'refactor', 'improve', 'enhance', 'resolve', 'handle',
    'setup', 'configure', 'enable', 'disable', 'integrate'
  ];

  // Common filler words to remove
  const fillerWords = [
    'the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'with',
    'and', 'or', 'that', 'this', 'is', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'when', 'where', 'why', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'also', 'now', 'here', 'there'
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
  words = words.filter(word => word.length > 1 && !fillerWords.includes(word));

  // Take first 3 significant words
  words = words.slice(0, 3);

  // If we have no words, fall back to first 3 from original
  if (words.length === 0) {
    words = normalized.split(' ').filter(w => w.length > 1).slice(0, 3);
  }

  // Join with hyphens
  return words.join('-') || 'task';
}
```

### Task 3: Update `generateCategorizedPath()` in WorktreeManager

**File**: `apps/server/src/services/worktree-manager.ts`

Update the `generateCategorizedPath()` method (around line 661) to use `titleToBranchSlug()` instead of `titleToSlug()`.

Change:

```typescript
const titleSlug = this.titleToSlug(title);
```

To:

```typescript
const titleSlug = this.titleToBranchSlug(title);
```

Then delete the old `titleToSlug()` method.

### Task 4: Update WorktreeLifecycleService

**File**: `apps/server/src/services/worktree-lifecycle.ts`

#### 4a. Add import for title generator

```typescript
import { generateTitleFromDescription } from '../lib/title-generator.js';
```

#### 4b. Replace `generateWorktreeTitle()` with async `getOrGenerateTitle()`

Replace the existing method (lines 319-336):

```typescript
private generateWorktreeTitle(feature: Feature): string {
  // ...existing code...
}
```

With:

```typescript
/**
 * Get or generate a title for the worktree branch name.
 * If feature has no title, generates one using AI (synchronously waits).
 * Falls back to truncated description if AI generation fails.
 */
private async getOrGenerateTitle(feature: Feature): Promise<string> {
  // Use existing title if available (user-provided or previously AI-generated)
  if (feature.title && feature.title.trim()) {
    return feature.title.trim();
  }

  // Try to generate title using AI
  if (feature.description && feature.description.trim()) {
    try {
      const generatedTitle = await generateTitleFromDescription(feature.description);
      if (generatedTitle) {
        return generatedTitle;
      }
    } catch (error) {
      logger.warn('Failed to generate title, falling back to description', error);
    }

    // Fallback: truncated description
    return feature.description.trim().substring(0, 100);
  }

  // Last resort fallback
  return `task-${feature.id.substring(0, 8)}`;
}
```

#### 4c. Update `createWorktreeForTask()` to use async title generation

In the `createWorktreeForTask()` method (around line 90), change:

```typescript
const title = this.generateWorktreeTitle(feature);
```

To:

```typescript
const title = await this.getOrGenerateTitle(feature);
```

### Task 5: Update Route Handler

**File**: `apps/server/src/routes/worktree/routes/create.ts`

#### 5a. Replace `titleToSlug()` function (lines 151-159) with `titleToBranchSlug()`

Use the same implementation as in Task 2.

#### 5b. Update `generateCategorizedWorktreePath()` to use the new function

Change:

```typescript
const titleSlug = titleToSlug(title);
```

To:

```typescript
const titleSlug = titleToBranchSlug(title);
```

### Task 6: Refactor generate-title.ts Route

**File**: `apps/server/src/routes/features/routes/generate-title.ts`

Refactor to use the shared helper:

```typescript
import { generateTitleFromDescription } from '../../../lib/title-generator.js';

// ... in the handler:
const title = await generateTitleFromDescription(trimmedDescription);

if (!title) {
  const response: GenerateTitleErrorResponse = {
    success: false,
    error: 'Failed to generate title - empty response',
  };
  res.status(500).json(response);
  return;
}

const response: GenerateTitleSuccessResponse = {
  success: true,
  title,
};
res.json(response);
```

Remove the duplicated `SYSTEM_PROMPT`, `extractTextFromStream()`, and inline query logic.

## Files Summary

| File                                                       | Action                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/server/src/lib/title-generator.ts`                   | CREATE - Shared title generation helper                       |
| `apps/server/src/services/worktree-manager.ts`             | MODIFY - Replace `titleToSlug()` with `titleToBranchSlug()`   |
| `apps/server/src/services/worktree-lifecycle.ts`           | MODIFY - Make title generation async, use AI if title missing |
| `apps/server/src/routes/worktree/routes/create.ts`         | MODIFY - Replace `titleToSlug()` with `titleToBranchSlug()`   |
| `apps/server/src/routes/features/routes/generate-title.ts` | MODIFY - Use shared helper                                    |

## Expected Results

| Input Title                                      | Output Slug                   | Full Branch Name                           |
| ------------------------------------------------ | ----------------------------- | ------------------------------------------ |
| Fix augment-context-engine MCP server connection | `augment-mcp-server`          | `bugfix/001-augment-mcp-server`            |
| Add dark mode toggle to settings                 | `dark-mode-toggle`            | `feature/001-dark-mode-toggle`             |
| Update user authentication flow                  | `user-auth-flow`              | `feature/002-user-auth-flow`               |
| Implement WebSocket reconnection logic           | `websocket-reconnect-logic`   | `feature/003-websocket-reconnect-logic`    |
| Fix the login bug                                | `login-bug`                   | `bugfix/002-login-bug`                     |
| Refactor database connection pooling             | `database-connection-pooling` | `refactor/001-database-connection-pooling` |

## Verification

After implementation:

1. Create a new feature with only a description (no title)
2. Drag it to "In Progress" with a worktree category selected
3. Verify the branch name is concise (2-3 words) and meaningful
4. Verify sequential numbering is category-specific
5. Test with features that already have titles (user-provided)
6. Test fallback behavior when AI title generation fails
