/**
 * Documentation Prompts - AI-powered project documentation generation
 *
 * Provides prompt templates and utilities for generating comprehensive documentation:
 * - project-overview: High-level summary, tech stack, and features
 * - architecture: System design, component diagrams, and patterns
 * - api-reference: All endpoints, parameters, responses, and examples
 * - directory-structure: Folder organization with explanations
 * - modules-components: Module details, functions, and dependencies
 * - setup-development: Installation, development environment, and testing
 *
 * Supports two modes:
 * - generate: Full codebase analysis for first-time documentation
 * - regenerate: Change-aware updates using git history and existing docs
 *
 * Uses chain-of-thought prompting for thorough, well-structured documentation.
 */

import type { GitChanges } from './docs-manifest.js';

/**
 * Generation mode for documentation
 */
export type GenerationMode = 'generate' | 'regenerate';

/**
 * Valid documentation generation modes
 */
export type DocType =
  | 'project-overview'
  | 'architecture'
  | 'api-reference'
  | 'directory-structure'
  | 'modules-components'
  | 'setup-development';

/**
 * Documentation type metadata
 */
export interface DocTypeInfo {
  /** The documentation type identifier */
  type: DocType;
  /** Human-readable display name */
  displayName: string;
  /** Output filename */
  filename: string;
  /** Brief description of what this doc covers */
  description: string;
}

/**
 * All documentation types with their metadata
 */
export const DOC_TYPES: DocTypeInfo[] = [
  {
    type: 'project-overview',
    displayName: 'Project Overview',
    filename: 'PROJECT_OVERVIEW.md',
    description: 'High-level summary, tech stack, and key features',
  },
  {
    type: 'architecture',
    displayName: 'Architecture',
    filename: 'ARCHITECTURE.md',
    description: 'System design, component diagrams, and patterns',
  },
  {
    type: 'api-reference',
    displayName: 'API Reference',
    filename: 'API_REFERENCE.md',
    description: 'All endpoints, parameters, responses, and examples',
  },
  {
    type: 'directory-structure',
    displayName: 'Directory Structure',
    filename: 'DIRECTORY_STRUCTURE.md',
    description: 'Folder organization with explanations',
  },
  {
    type: 'modules-components',
    displayName: 'Modules & Components',
    filename: 'MODULES_AND_COMPONENTS.md',
    description: 'Module details, functions, and dependencies',
  },
  {
    type: 'setup-development',
    displayName: 'Setup & Development',
    filename: 'SETUP_AND_DEVELOPMENT.md',
    description: 'Installation, development environment, and testing',
  },
];

/**
 * Base system prompt shared across all documentation types
 */
const BASE_SYSTEM_PROMPT = `You are an expert technical writer and software documentation specialist. Your task is to generate comprehensive, well-structured documentation for a software project.

## CRITICAL: Codebase as Single Source of Truth

The ACTUAL CODE is your single source of truth. Do NOT rely on any existing markdown files, README files, or documentation. You MUST explore the codebase directly to gather accurate information.

## How to Explore the Codebase

You have access to the Task tool which allows you to spawn subagents for thorough codebase exploration. USE IT.

Before writing any documentation section, you MUST:
1. Use the Task tool with subagent_type="Explore" to investigate relevant parts of the codebase
2. Read actual source files to understand implementations
3. Verify all claims by checking the actual code

Example Task tool usage:
- To understand the project structure: Use Task with prompt "Explore the codebase structure and identify main components, entry points, and how they're organized"
- To find API endpoints: Use Task with prompt "Find all API endpoints, their handlers, request/response types, and authentication requirements"
- To understand a module: Use Task with prompt "Analyze the [module name] module - its purpose, public API, dependencies, and how it's used"

## Documentation Guidelines

- Write in clear, professional technical English
- Use proper Markdown formatting with headers, code blocks, lists, and tables
- Be thorough but concise - include all important details without unnecessary verbosity
- Use concrete examples from the actual codebase - quote real code you've read
- Organize content logically with a clear hierarchy
- Include code snippets with proper syntax highlighting
- NEVER guess or assume - if you cannot find information in the code, explicitly state it is not documented in the codebase
- Every claim must be verifiable from the actual source code

## Accuracy Requirements

- Do NOT hallucinate features, APIs, or configurations that don't exist
- Do NOT copy from existing documentation without verifying against code
- If the codebase context provided is insufficient, USE THE TASK TOOL to explore further
- Cross-reference multiple files when documenting interconnected systems`;

/**
 * System prompt for project overview documentation.
 * Generates high-level summary, tech stack, and feature descriptions.
 */
export const PROJECT_OVERVIEW_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating a PROJECT OVERVIEW document. This should provide a high-level understanding of the project for new developers or stakeholders.

Structure your output as follows:

1. PROJECT TITLE AND DESCRIPTION
   - Clear, descriptive title
   - One-paragraph executive summary of what the project does
   - The problem it solves and its main value proposition

2. TECH STACK
   - List all major technologies, frameworks, and languages used
   - Organize by category (Frontend, Backend, Database, DevOps, etc.)
   - Include version numbers if available in package.json or config files

3. KEY FEATURES
   - Bullet list of main features/capabilities
   - Brief description of each feature (1-2 sentences)
   - Organize by priority or category if there are many

4. PROJECT STATUS
   - Current state (production, beta, development, etc.)
   - Any notable limitations or known issues
   - Recent major changes or upcoming features if evident

5. QUICK START
   - Brief getting started steps (detailed setup is in separate doc)
   - Link references to other documentation

Output only the Markdown content. Do not include meta-commentary.`;

/**
 * System prompt for architecture documentation.
 * Generates system design, component diagrams, and pattern descriptions.
 */
export const ARCHITECTURE_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating an ARCHITECTURE document. This should explain the system design and how components work together.

Structure your output as follows:

1. ARCHITECTURE OVERVIEW
   - High-level system diagram description (in text/ASCII or Mermaid format)
   - Core architectural pattern (monolith, microservices, serverless, etc.)
   - Key design principles followed

2. SYSTEM COMPONENTS
   - List and describe each major component/service
   - Their responsibilities and boundaries
   - How they communicate (REST, WebSocket, message queues, etc.)

3. DATA FLOW
   - How data moves through the system
   - Request/response lifecycle
   - Event-driven flows if applicable

4. DESIGN PATTERNS
   - Key patterns used in the codebase
   - Why they were chosen
   - Examples of their implementation

5. DIRECTORY STRUCTURE OVERVIEW
   - High-level folder organization
   - Purpose of each major directory
   - Naming conventions

6. EXTERNAL INTEGRATIONS
   - Third-party services and APIs
   - How they're integrated
   - Configuration requirements

7. SECURITY ARCHITECTURE
   - Authentication/authorization approach
   - Data protection measures
   - Security patterns used

Include Mermaid diagrams where helpful using fenced code blocks with the mermaid language identifier.

Output only the Markdown content. Do not include meta-commentary.`;

/**
 * System prompt for API reference documentation.
 * Generates comprehensive endpoint documentation with examples.
 */
export const API_REFERENCE_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating an API REFERENCE document. This should be a comprehensive guide to all API endpoints.

Structure your output as follows:

1. API OVERVIEW
   - Base URL and versioning strategy
   - Authentication requirements
   - Common headers and request format
   - Rate limiting if applicable
   - Error response format

2. AUTHENTICATION
   - How to authenticate requests
   - Token/key management
   - Session handling

3. ENDPOINTS BY CATEGORY
   For each endpoint, include:
   - HTTP method and path
   - Brief description
   - Request parameters (path, query, body)
   - Request body schema with example
   - Response schema with example
   - Possible error responses
   - Code example (curl or fetch)

   Organize endpoints by resource/domain:
   - User/Auth endpoints
   - Core resource endpoints
   - Utility endpoints
   - WebSocket events (if applicable)

4. DATA MODELS
   - Key data structures/schemas
   - TypeScript interfaces if available
   - Field descriptions and constraints

5. ERROR HANDLING
   - Error code reference
   - Common errors and solutions

6. WEBSOCKET EVENTS (if applicable)
   - Event types and payloads
   - Connection management
   - Example usage

Use tables for parameters and responses. Include realistic example values.

Output only the Markdown content. Do not include meta-commentary.`;

/**
 * System prompt for directory structure documentation.
 * Generates folder organization explanation with annotations.
 */
export const DIRECTORY_STRUCTURE_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating a DIRECTORY STRUCTURE document. This should explain the project's file organization.

Structure your output as follows:

1. OVERVIEW
   - Brief explanation of the organizational approach
   - Monorepo vs single-repo structure
   - Key conventions used

2. ROOT DIRECTORY
   - Explain each file and folder at the root level
   - Configuration files and their purposes
   - Scripts and automation

3. DIRECTORY TREE
   - ASCII tree representation of the full structure
   - Use comments/annotations to explain each folder
   - Group related folders together

4. DETAILED BREAKDOWN
   For each major directory, explain:
   - Purpose and contents
   - Key files and their roles
   - Naming conventions
   - How it relates to other directories

5. FILE NAMING CONVENTIONS
   - Patterns used (kebab-case, camelCase, etc.)
   - File type conventions (.ts, .tsx, .test.ts, etc.)
   - Index files and barrel exports

6. CONFIGURATION FILES
   - List of all config files
   - What each configures
   - Important settings

7. ADDING NEW FILES
   - Guidelines for where to put new code
   - Templates or patterns to follow

Use code blocks for directory trees. Be thorough but organized.

Output only the Markdown content. Do not include meta-commentary.`;

/**
 * System prompt for modules and components documentation.
 * Generates detailed module documentation with functions and dependencies.
 */
export const MODULES_COMPONENTS_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating a MODULES AND COMPONENTS document. This should provide detailed documentation of code modules.

Structure your output as follows:

1. OVERVIEW
   - How the codebase is modularized
   - Core vs feature modules
   - Shared libraries and utilities

2. CORE MODULES
   For each core module/library:
   - Purpose and responsibility
   - Public API (exported functions, classes, types)
   - Usage examples
   - Dependencies (internal and external)

3. SERVICES/BUSINESS LOGIC
   For each service:
   - What it does
   - Key methods and their signatures
   - Dependencies and injections
   - State management if applicable

4. UI COMPONENTS (if applicable)
   For each major component:
   - Purpose and usage
   - Props interface
   - Examples
   - Styling approach
   - Child components

5. UTILITIES AND HELPERS
   - Shared utility functions
   - Common helpers
   - Type utilities

6. HOOKS (if applicable)
   - Custom hooks and their purpose
   - Parameters and return values
   - Usage examples

7. STATE MANAGEMENT
   - Store structure
   - Actions and selectors
   - State shape

8. TYPES AND INTERFACES
   - Key TypeScript types
   - Shared interfaces
   - Type utilities

Use TypeScript code blocks for signatures and examples. Be comprehensive.

Output only the Markdown content. Do not include meta-commentary.`;

/**
 * System prompt for setup and development documentation.
 * Generates installation, development environment, and testing guides.
 */
export const SETUP_DEVELOPMENT_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are generating a SETUP AND DEVELOPMENT document. This should be a complete guide for setting up and working on the project.

Structure your output as follows:

1. PREREQUISITES
   - Required software and versions (Node.js, npm/yarn/pnpm, etc.)
   - System requirements
   - Recommended tools and extensions

2. INSTALLATION
   - Step-by-step installation instructions
   - Cloning the repository
   - Installing dependencies
   - Environment setup

3. ENVIRONMENT CONFIGURATION
   - Required environment variables
   - Example .env file (with placeholder values)
   - Configuration files to modify

4. RUNNING THE APPLICATION
   - Development mode commands
   - Production build commands
   - Common scripts in package.json
   - Multi-service startup (if applicable)

5. DEVELOPMENT WORKFLOW
   - Branch naming conventions
   - Commit message format
   - Code review process
   - PR guidelines

6. TESTING
   - How to run tests
   - Test file organization
   - Writing new tests
   - Coverage requirements

7. DEBUGGING
   - Common debugging approaches
   - Useful dev tools
   - Logging configuration

8. COMMON ISSUES
   - Frequently encountered problems
   - Troubleshooting steps
   - Known workarounds

9. DEPLOYMENT
   - Build process
   - Deployment targets
   - CI/CD pipeline overview

10. CONTRIBUTING
    - How to contribute
    - Code style guidelines
    - Documentation requirements

Use code blocks for commands and configuration examples. Be practical and actionable.

Output only the Markdown content. Do not include meta-commentary.`;

// =============================================================================
// REGENERATE MODE PROMPTS
// =============================================================================

/**
 * Base system prompt for regenerate mode - emphasizes updating vs rewriting
 */
const REGENERATE_BASE_SYSTEM_PROMPT = `You are an expert technical writer UPDATING existing documentation based on codebase changes.

## CRITICAL: Update Mode - Not Full Rewrite

You are in REGENERATE mode. Your task is to UPDATE existing documentation, NOT rewrite it from scratch.
The existing documentation has already been written and approved. Your job is to bring it up to date with recent changes.

## Key Principles for Regeneration

1. **PRESERVE EXISTING STRUCTURE**: Keep the existing document structure, headings, and formatting unless changes require restructuring. The current structure was intentionally designed.

2. **FOCUS ON CHANGES**: The git changes provided show what has changed since the last documentation generation. Prioritize updating sections affected by these changes.

3. **UPDATE INCREMENTALLY**: Only modify sections that are affected by the code changes. Don't rewrite sections that are still accurate.

4. **FOLLOW EXISTING PATTERNS**: Match the style, tone, level of detail, and conventions of the existing documentation. Be consistent.

5. **DON'T REMOVE VALID CONTENT**: If existing documentation is still accurate and relevant, keep it. Only remove content that is no longer true.

6. **VERIFY WITH CODE**: Even though you have existing docs, always verify against the actual codebase. The code is still the source of truth.

## Your Workflow

1. **Review the existing documentation** - Understand its structure, style, and content
2. **Analyze the git changes** - Identify what files and features have changed
3. **Use the Task tool** to explore affected parts of the codebase in detail
4. **Plan your updates** - Determine which sections need changes
5. **Make targeted updates** - Modify only what needs to change
6. **Output the complete document** - The full updated documentation (not just diffs)

## Important Guidelines

- If a feature was **added**, add documentation for it in the appropriate section
- If a feature was **removed**, remove or update references to it
- If a feature was **modified**, update the documentation to reflect the changes
- If something was **renamed**, update all references consistently
- Keep the same heading hierarchy and document structure where possible
- Match the existing writing style and level of detail
- Preserve code examples that are still valid; update those that have changed

## Verification Requirements

Even in regenerate mode:
- Use the Task tool with subagent_type="Explore" to verify changes
- Cross-check any updated sections against the actual code
- Don't assume the git diff tells the whole story - explore the affected files`;

/**
 * Regenerate-specific hints for each documentation type
 */
const REGENERATE_DOC_HINTS: Record<DocType, string> = {
  'project-overview': `For Project Overview updates, focus on:
- Check if the tech stack has changed (new dependencies, removed packages)
- Look for new major features or removed features
- Update version numbers and project status if applicable
- Review the project description for continued accuracy
- Check if the quick start steps are still valid`,

  architecture: `For Architecture updates, focus on:
- Check for new services, modules, or major components
- Review data flow changes between components
- Update diagrams if the system structure changed
- Look for new external integrations or removed ones
- Check if design patterns have changed`,

  'api-reference': `For API Reference updates, focus on:
- Check for new endpoints or removed endpoints
- Look for changes to request/response schemas
- Review authentication changes
- Update error codes if they've changed
- Check WebSocket events if applicable
- Verify example requests/responses are still valid`,

  'directory-structure': `For Directory Structure updates, focus on:
- Check for new directories or removed ones
- Update descriptions for directories that changed purpose
- Review naming convention changes
- Check for new configuration files
- Update the directory tree representation`,

  'modules-components': `For Modules & Components updates, focus on:
- Check for new exported functions, classes, or components
- Look for removed or deprecated APIs
- Review signature changes in existing functions
- Update hook documentation if applicable
- Check for new types or changed interfaces`,

  'setup-development': `For Setup & Development updates, focus on:
- Check for new or changed npm scripts
- Review environment variable changes
- Look for new prerequisites or tools
- Update build/test commands if changed
- Check for CI/CD pipeline changes`,
};

/**
 * Map of documentation types to their system prompts
 */
const SYSTEM_PROMPTS: Record<DocType, string> = {
  'project-overview': PROJECT_OVERVIEW_SYSTEM_PROMPT,
  architecture: ARCHITECTURE_SYSTEM_PROMPT,
  'api-reference': API_REFERENCE_SYSTEM_PROMPT,
  'directory-structure': DIRECTORY_STRUCTURE_SYSTEM_PROMPT,
  'modules-components': MODULES_COMPONENTS_SYSTEM_PROMPT,
  'setup-development': SETUP_DEVELOPMENT_SYSTEM_PROMPT,
};

/**
 * Get the system prompt for a specific documentation type
 *
 * @param docType - The documentation type to get the prompt for
 * @param mode - The generation mode ('generate' for full, 'regenerate' for updates)
 * @returns The system prompt string
 */
export function getDocSystemPrompt(docType: DocType, mode: GenerationMode = 'generate'): string {
  if (mode === 'regenerate') {
    // For regenerate mode, use the regenerate base prompt with doc-specific hints
    return `${REGENERATE_BASE_SYSTEM_PROMPT}

## Document-Specific Guidelines

${REGENERATE_DOC_HINTS[docType]}

## Output Format

Follow the same structure and format as the existing documentation. Output only the Markdown content.`;
  }

  // For generate mode, use the full generation prompts
  return SYSTEM_PROMPTS[docType];
}

/**
 * Get metadata for a specific documentation type
 *
 * @param docType - The documentation type
 * @returns The documentation type info or undefined if not found
 */
export function getDocTypeInfo(docType: DocType): DocTypeInfo | undefined {
  return DOC_TYPES.find((dt) => dt.type === docType);
}

/**
 * Get the filename for a specific documentation type
 *
 * @param docType - The documentation type
 * @returns The output filename
 */
export function getDocFilename(docType: DocType): string {
  const info = getDocTypeInfo(docType);
  return info?.filename ?? `${docType.toUpperCase().replace(/-/g, '_')}.md`;
}

/**
 * Check if a string is a valid documentation type
 *
 * @param type - The string to check
 * @returns True if the type is valid
 */
export function isValidDocType(type: string): type is DocType {
  return type in SYSTEM_PROMPTS;
}

/**
 * Get all available documentation types
 *
 * @returns Array of all documentation type identifiers
 */
export function getAvailableDocTypes(): DocType[] {
  return Object.keys(SYSTEM_PROMPTS) as DocType[];
}

/**
 * Get all documentation types with their metadata
 *
 * @returns Array of all documentation type info objects
 */
export function getAllDocTypeInfo(): DocTypeInfo[] {
  return [...DOC_TYPES];
}

/**
 * Build a user prompt for documentation generation
 *
 * @param docType - The type of documentation to generate
 * @param codebaseContext - Summary of the codebase analysis
 * @param projectName - Name of the project
 * @returns The formatted user prompt string
 */
export function buildDocUserPrompt(
  docType: DocType,
  codebaseContext: string,
  projectName: string
): string {
  const typeInfo = getDocTypeInfo(docType);
  const displayName = typeInfo?.displayName ?? docType;

  return `Generate comprehensive ${displayName} documentation for the project "${projectName}".

## Initial Codebase Overview

Here is a high-level overview of the project structure to help you get started:

<codebase_context>
${codebaseContext}
</codebase_context>

## IMPORTANT: Explore Before Writing

The context above is just a starting point. Before writing each section of the documentation:

1. **USE THE TASK TOOL** to spawn subagents that will explore the relevant parts of the codebase
2. **READ ACTUAL SOURCE FILES** - do not rely solely on the context above
3. **VERIFY EVERYTHING** - the code is the single source of truth, not any existing docs

For ${displayName} specifically, you should explore:
${getExplorationHints(docType)}

## Output Requirements

Generate thorough, well-structured Markdown documentation following the guidelines in your system prompt.

Remember: Every fact in your documentation must be verifiable from the actual source code. Use subagents liberally to ensure accuracy.`;
}

/**
 * Get exploration hints specific to each documentation type
 */
function getExplorationHints(docType: DocType): string {
  const hints: Record<DocType, string> = {
    'project-overview': `- The main entry points and how the application starts
- package.json for dependencies and scripts
- Configuration files to understand the tech stack
- Main source directories to identify key features`,

    architecture: `- All major directories and their relationships
- Service files, controllers, and how they connect
- Data flow between components
- External integrations and API clients
- Database models and schemas`,

    'api-reference': `- Route definitions and handlers
- Request/response types and validation
- Authentication middleware
- WebSocket event handlers if present
- API error handling patterns`,

    'directory-structure': `- Every top-level directory and subdirectory
- Naming conventions used throughout
- Configuration files and their purposes
- Test file organization`,

    'modules-components': `- All exported modules and their public APIs
- Service classes and their methods
- React/UI components and their props
- Shared utilities and helpers
- Type definitions and interfaces`,

    'setup-development': `- package.json scripts and their purposes
- Environment variable usage throughout the code
- Build and compilation configuration
- Test setup and configuration
- CI/CD configuration files`,
  };

  return hints[docType] || '- All relevant source files for this documentation type';
}

/**
 * Build a user prompt for regenerate mode (updating existing documentation)
 *
 * @param docType - The type of documentation to update
 * @param codebaseContext - Summary of the codebase analysis
 * @param projectName - Name of the project
 * @param existingContent - The current content of the documentation
 * @param gitChanges - Information about what changed since last generation
 * @returns The formatted user prompt string
 */
export function buildRegenerateUserPrompt(
  docType: DocType,
  codebaseContext: string,
  projectName: string,
  existingContent: string,
  gitChanges: GitChanges
): string {
  const typeInfo = getDocTypeInfo(docType);
  const displayName = typeInfo?.displayName ?? docType;

  // Build the list of changed files, prioritizing the most relevant ones
  const changedFilesList = gitChanges.changedFiles
    .slice(0, 30) // Limit to 30 files to avoid prompt bloat
    .map((f) => `- [${f.status.toUpperCase()}] ${f.path}`)
    .join('\n');

  // Build the list of recent commits
  const commitsList = gitChanges.commitsSinceLastGen
    .slice(0, 15) // Limit to 15 commits
    .map((c) => `- ${c.hash.slice(0, 7)}: ${c.message}`)
    .join('\n');

  return `Update the ${displayName} documentation for the project "${projectName}".

## Existing Documentation

The current documentation is provided below. Your task is to UPDATE this documentation based on the code changes that have occurred since it was last generated.

<existing_documentation>
${existingContent}
</existing_documentation>

## Changes Since Last Generation

${gitChanges.summary}

### Files Changed:
${changedFilesList || '(No file changes detected)'}

### Recent Commits:
${commitsList || '(No commits detected)'}

## Codebase Context

Here is the current project structure for reference:

<codebase_context>
${codebaseContext}
</codebase_context>

## Instructions

1. **Review the existing documentation** - Understand its structure, style, and level of detail
2. **Use the Task tool** to explore the changed files listed above and understand what has changed
3. **Identify what needs updating** - Focus on sections affected by the changes
4. **Make targeted updates** - Don't rewrite sections that are still accurate
5. **Preserve the existing style** - Match formatting, tone, and conventions
6. **Output the complete document** - Return the full updated documentation (not just the changes)

## Priority Areas

Based on the files that changed, you should particularly focus on:
${getRegenerateExplorationHints(docType, gitChanges)}

## Output Requirements

Output the complete updated ${displayName} documentation in Markdown format. Preserve all sections that are still accurate, and update only what has changed.`;
}

/**
 * Get exploration hints for regenerate mode based on changed files
 */
function getRegenerateExplorationHints(docType: DocType, gitChanges: GitChanges): string {
  const changedPaths = gitChanges.changedFiles.map((f) => f.path);

  // Group files by likely documentation relevance
  const hints: string[] = [];

  // Check for specific file patterns relevant to each doc type
  switch (docType) {
    case 'project-overview':
      if (changedPaths.some((p) => p.includes('package.json'))) {
        hints.push('- package.json changed - check for dependency or script updates');
      }
      if (changedPaths.some((p) => p.includes('README'))) {
        hints.push('- README changed - but verify against actual code, not the README');
      }
      break;

    case 'architecture':
      if (changedPaths.some((p) => p.includes('service') || p.includes('provider'))) {
        hints.push('- Service/provider files changed - check for architectural changes');
      }
      if (changedPaths.some((p) => p.includes('/api/') || p.includes('/routes/'))) {
        hints.push('- API routes changed - check for new endpoints or data flow changes');
      }
      break;

    case 'api-reference':
      if (changedPaths.some((p) => p.includes('/routes/') || p.includes('/api/'))) {
        hints.push('- Route files changed - document new/modified endpoints');
      }
      if (changedPaths.some((p) => p.includes('types') || p.includes('schema'))) {
        hints.push('- Type/schema files changed - update request/response documentation');
      }
      break;

    case 'directory-structure':
      hints.push('- Review any new directories or renamed files');
      hints.push('- Update the directory tree if structure changed');
      break;

    case 'modules-components':
      if (changedPaths.some((p) => p.includes('component') || p.includes('.tsx'))) {
        hints.push('- Component files changed - update component documentation');
      }
      if (changedPaths.some((p) => p.includes('hook') || p.includes('use'))) {
        hints.push('- Hook files changed - update hook documentation');
      }
      break;

    case 'setup-development':
      if (changedPaths.some((p) => p.includes('package.json'))) {
        hints.push('- package.json changed - check for new scripts or dependencies');
      }
      if (changedPaths.some((p) => p.includes('.env') || p.includes('config'))) {
        hints.push('- Config files changed - update environment/configuration docs');
      }
      break;
  }

  // Add some changed files as hints if we didn't find specific patterns
  if (hints.length === 0) {
    const topChangedFiles = changedPaths.slice(0, 5);
    if (topChangedFiles.length > 0) {
      hints.push('- Explore these recently changed files:');
      topChangedFiles.forEach((f) => hints.push(`  - ${f}`));
    } else {
      hints.push(
        '- No specific file changes detected - verify existing documentation is still accurate'
      );
    }
  }

  return hints.join('\n');
}
