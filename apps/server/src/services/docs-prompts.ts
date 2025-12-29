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
 * Uses chain-of-thought prompting for thorough, well-structured documentation.
 */

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
const BASE_SYSTEM_PROMPT = `You are an expert technical writer and software documentation specialist. Your task is to generate comprehensive, well-structured documentation for a software project based on the codebase analysis provided.

Guidelines:
- Write in clear, professional technical English
- Use proper Markdown formatting with headers, code blocks, lists, and tables
- Be thorough but concise - include all important details without unnecessary verbosity
- Use concrete examples from the actual codebase when possible
- Organize content logically with a clear hierarchy
- Include code snippets with proper syntax highlighting
- When information is not available or unclear from the codebase, note it explicitly rather than making assumptions`;

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
 * @returns The system prompt string
 */
export function getDocSystemPrompt(docType: DocType): string {
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

Based on the following codebase analysis:

<codebase_context>
${codebaseContext}
</codebase_context>

Please generate thorough, well-structured Markdown documentation following the guidelines in your system prompt.`;
}
