'use strict';
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
var __spreadArray =
  (this && this.__spreadArray) ||
  function (to, from, pack) {
    if (pack || arguments.length === 2)
      for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.SETUP_DEVELOPMENT_SYSTEM_PROMPT =
  exports.MODULES_COMPONENTS_SYSTEM_PROMPT =
  exports.DIRECTORY_STRUCTURE_SYSTEM_PROMPT =
  exports.API_REFERENCE_SYSTEM_PROMPT =
  exports.ARCHITECTURE_SYSTEM_PROMPT =
  exports.PROJECT_OVERVIEW_SYSTEM_PROMPT =
  exports.DOC_TYPES =
    void 0;
exports.getDocSystemPrompt = getDocSystemPrompt;
exports.getDocTypeInfo = getDocTypeInfo;
exports.getDocFilename = getDocFilename;
exports.isValidDocType = isValidDocType;
exports.getAvailableDocTypes = getAvailableDocTypes;
exports.getAllDocTypeInfo = getAllDocTypeInfo;
exports.buildDocUserPrompt = buildDocUserPrompt;
/**
 * All documentation types with their metadata
 */
exports.DOC_TYPES = [
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
var BASE_SYSTEM_PROMPT =
  'You are an expert technical writer and software documentation specialist. Your task is to generate comprehensive, well-structured documentation for a software project based on the codebase analysis provided.\n\nGuidelines:\n- Write in clear, professional technical English\n- Use proper Markdown formatting with headers, code blocks, lists, and tables\n- Be thorough but concise - include all important details without unnecessary verbosity\n- Use concrete examples from the actual codebase when possible\n- Organize content logically with a clear hierarchy\n- Include code snippets with proper syntax highlighting\n- When information is not available or unclear from the codebase, note it explicitly rather than making assumptions';
/**
 * System prompt for project overview documentation.
 * Generates high-level summary, tech stack, and feature descriptions.
 */
exports.PROJECT_OVERVIEW_SYSTEM_PROMPT = ''.concat(
  BASE_SYSTEM_PROMPT,
  '\n\nYou are generating a PROJECT OVERVIEW document. This should provide a high-level understanding of the project for new developers or stakeholders.\n\nStructure your output as follows:\n\n1. PROJECT TITLE AND DESCRIPTION\n   - Clear, descriptive title\n   - One-paragraph executive summary of what the project does\n   - The problem it solves and its main value proposition\n\n2. TECH STACK\n   - List all major technologies, frameworks, and languages used\n   - Organize by category (Frontend, Backend, Database, DevOps, etc.)\n   - Include version numbers if available in package.json or config files\n\n3. KEY FEATURES\n   - Bullet list of main features/capabilities\n   - Brief description of each feature (1-2 sentences)\n   - Organize by priority or category if there are many\n\n4. PROJECT STATUS\n   - Current state (production, beta, development, etc.)\n   - Any notable limitations or known issues\n   - Recent major changes or upcoming features if evident\n\n5. QUICK START\n   - Brief getting started steps (detailed setup is in separate doc)\n   - Link references to other documentation\n\nOutput only the Markdown content. Do not include meta-commentary.'
);
/**
 * System prompt for architecture documentation.
 * Generates system design, component diagrams, and pattern descriptions.
 */
exports.ARCHITECTURE_SYSTEM_PROMPT = ''.concat(
  BASE_SYSTEM_PROMPT,
  "\n\nYou are generating an ARCHITECTURE document. This should explain the system design and how components work together.\n\nStructure your output as follows:\n\n1. ARCHITECTURE OVERVIEW\n   - High-level system diagram description (in text/ASCII or Mermaid format)\n   - Core architectural pattern (monolith, microservices, serverless, etc.)\n   - Key design principles followed\n\n2. SYSTEM COMPONENTS\n   - List and describe each major component/service\n   - Their responsibilities and boundaries\n   - How they communicate (REST, WebSocket, message queues, etc.)\n\n3. DATA FLOW\n   - How data moves through the system\n   - Request/response lifecycle\n   - Event-driven flows if applicable\n\n4. DESIGN PATTERNS\n   - Key patterns used in the codebase\n   - Why they were chosen\n   - Examples of their implementation\n\n5. DIRECTORY STRUCTURE OVERVIEW\n   - High-level folder organization\n   - Purpose of each major directory\n   - Naming conventions\n\n6. EXTERNAL INTEGRATIONS\n   - Third-party services and APIs\n   - How they're integrated\n   - Configuration requirements\n\n7. SECURITY ARCHITECTURE\n   - Authentication/authorization approach\n   - Data protection measures\n   - Security patterns used\n\nInclude Mermaid diagrams where helpful using fenced code blocks with the mermaid language identifier.\n\nOutput only the Markdown content. Do not include meta-commentary."
);
/**
 * System prompt for API reference documentation.
 * Generates comprehensive endpoint documentation with examples.
 */
exports.API_REFERENCE_SYSTEM_PROMPT = ''.concat(
  BASE_SYSTEM_PROMPT,
  '\n\nYou are generating an API REFERENCE document. This should be a comprehensive guide to all API endpoints.\n\nStructure your output as follows:\n\n1. API OVERVIEW\n   - Base URL and versioning strategy\n   - Authentication requirements\n   - Common headers and request format\n   - Rate limiting if applicable\n   - Error response format\n\n2. AUTHENTICATION\n   - How to authenticate requests\n   - Token/key management\n   - Session handling\n\n3. ENDPOINTS BY CATEGORY\n   For each endpoint, include:\n   - HTTP method and path\n   - Brief description\n   - Request parameters (path, query, body)\n   - Request body schema with example\n   - Response schema with example\n   - Possible error responses\n   - Code example (curl or fetch)\n\n   Organize endpoints by resource/domain:\n   - User/Auth endpoints\n   - Core resource endpoints\n   - Utility endpoints\n   - WebSocket events (if applicable)\n\n4. DATA MODELS\n   - Key data structures/schemas\n   - TypeScript interfaces if available\n   - Field descriptions and constraints\n\n5. ERROR HANDLING\n   - Error code reference\n   - Common errors and solutions\n\n6. WEBSOCKET EVENTS (if applicable)\n   - Event types and payloads\n   - Connection management\n   - Example usage\n\nUse tables for parameters and responses. Include realistic example values.\n\nOutput only the Markdown content. Do not include meta-commentary.'
);
/**
 * System prompt for directory structure documentation.
 * Generates folder organization explanation with annotations.
 */
exports.DIRECTORY_STRUCTURE_SYSTEM_PROMPT = ''.concat(
  BASE_SYSTEM_PROMPT,
  "\n\nYou are generating a DIRECTORY STRUCTURE document. This should explain the project's file organization.\n\nStructure your output as follows:\n\n1. OVERVIEW\n   - Brief explanation of the organizational approach\n   - Monorepo vs single-repo structure\n   - Key conventions used\n\n2. ROOT DIRECTORY\n   - Explain each file and folder at the root level\n   - Configuration files and their purposes\n   - Scripts and automation\n\n3. DIRECTORY TREE\n   - ASCII tree representation of the full structure\n   - Use comments/annotations to explain each folder\n   - Group related folders together\n\n4. DETAILED BREAKDOWN\n   For each major directory, explain:\n   - Purpose and contents\n   - Key files and their roles\n   - Naming conventions\n   - How it relates to other directories\n\n5. FILE NAMING CONVENTIONS\n   - Patterns used (kebab-case, camelCase, etc.)\n   - File type conventions (.ts, .tsx, .test.ts, etc.)\n   - Index files and barrel exports\n\n6. CONFIGURATION FILES\n   - List of all config files\n   - What each configures\n   - Important settings\n\n7. ADDING NEW FILES\n   - Guidelines for where to put new code\n   - Templates or patterns to follow\n\nUse code blocks for directory trees. Be thorough but organized.\n\nOutput only the Markdown content. Do not include meta-commentary."
);
/**
 * System prompt for modules and components documentation.
 * Generates detailed module documentation with functions and dependencies.
 */
exports.MODULES_COMPONENTS_SYSTEM_PROMPT = ''.concat(
  BASE_SYSTEM_PROMPT,
  '\n\nYou are generating a MODULES AND COMPONENTS document. This should provide detailed documentation of code modules.\n\nStructure your output as follows:\n\n1. OVERVIEW\n   - How the codebase is modularized\n   - Core vs feature modules\n   - Shared libraries and utilities\n\n2. CORE MODULES\n   For each core module/library:\n   - Purpose and responsibility\n   - Public API (exported functions, classes, types)\n   - Usage examples\n   - Dependencies (internal and external)\n\n3. SERVICES/BUSINESS LOGIC\n   For each service:\n   - What it does\n   - Key methods and their signatures\n   - Dependencies and injections\n   - State management if applicable\n\n4. UI COMPONENTS (if applicable)\n   For each major component:\n   - Purpose and usage\n   - Props interface\n   - Examples\n   - Styling approach\n   - Child components\n\n5. UTILITIES AND HELPERS\n   - Shared utility functions\n   - Common helpers\n   - Type utilities\n\n6. HOOKS (if applicable)\n   - Custom hooks and their purpose\n   - Parameters and return values\n   - Usage examples\n\n7. STATE MANAGEMENT\n   - Store structure\n   - Actions and selectors\n   - State shape\n\n8. TYPES AND INTERFACES\n   - Key TypeScript types\n   - Shared interfaces\n   - Type utilities\n\nUse TypeScript code blocks for signatures and examples. Be comprehensive.\n\nOutput only the Markdown content. Do not include meta-commentary.'
);
/**
 * System prompt for setup and development documentation.
 * Generates installation, development environment, and testing guides.
 */
exports.SETUP_DEVELOPMENT_SYSTEM_PROMPT = ''.concat(
  BASE_SYSTEM_PROMPT,
  '\n\nYou are generating a SETUP AND DEVELOPMENT document. This should be a complete guide for setting up and working on the project.\n\nStructure your output as follows:\n\n1. PREREQUISITES\n   - Required software and versions (Node.js, npm/yarn/pnpm, etc.)\n   - System requirements\n   - Recommended tools and extensions\n\n2. INSTALLATION\n   - Step-by-step installation instructions\n   - Cloning the repository\n   - Installing dependencies\n   - Environment setup\n\n3. ENVIRONMENT CONFIGURATION\n   - Required environment variables\n   - Example .env file (with placeholder values)\n   - Configuration files to modify\n\n4. RUNNING THE APPLICATION\n   - Development mode commands\n   - Production build commands\n   - Common scripts in package.json\n   - Multi-service startup (if applicable)\n\n5. DEVELOPMENT WORKFLOW\n   - Branch naming conventions\n   - Commit message format\n   - Code review process\n   - PR guidelines\n\n6. TESTING\n   - How to run tests\n   - Test file organization\n   - Writing new tests\n   - Coverage requirements\n\n7. DEBUGGING\n   - Common debugging approaches\n   - Useful dev tools\n   - Logging configuration\n\n8. COMMON ISSUES\n   - Frequently encountered problems\n   - Troubleshooting steps\n   - Known workarounds\n\n9. DEPLOYMENT\n   - Build process\n   - Deployment targets\n   - CI/CD pipeline overview\n\n10. CONTRIBUTING\n    - How to contribute\n    - Code style guidelines\n    - Documentation requirements\n\nUse code blocks for commands and configuration examples. Be practical and actionable.\n\nOutput only the Markdown content. Do not include meta-commentary.'
);
/**
 * Map of documentation types to their system prompts
 */
var SYSTEM_PROMPTS = {
  'project-overview': exports.PROJECT_OVERVIEW_SYSTEM_PROMPT,
  architecture: exports.ARCHITECTURE_SYSTEM_PROMPT,
  'api-reference': exports.API_REFERENCE_SYSTEM_PROMPT,
  'directory-structure': exports.DIRECTORY_STRUCTURE_SYSTEM_PROMPT,
  'modules-components': exports.MODULES_COMPONENTS_SYSTEM_PROMPT,
  'setup-development': exports.SETUP_DEVELOPMENT_SYSTEM_PROMPT,
};
/**
 * Get the system prompt for a specific documentation type
 *
 * @param docType - The documentation type to get the prompt for
 * @returns The system prompt string
 */
function getDocSystemPrompt(docType) {
  return SYSTEM_PROMPTS[docType];
}
/**
 * Get metadata for a specific documentation type
 *
 * @param docType - The documentation type
 * @returns The documentation type info or undefined if not found
 */
function getDocTypeInfo(docType) {
  return exports.DOC_TYPES.find(function (dt) {
    return dt.type === docType;
  });
}
/**
 * Get the filename for a specific documentation type
 *
 * @param docType - The documentation type
 * @returns The output filename
 */
function getDocFilename(docType) {
  var _a;
  var info = getDocTypeInfo(docType);
  return (_a = info === null || info === void 0 ? void 0 : info.filename) !== null && _a !== void 0
    ? _a
    : ''.concat(docType.toUpperCase().replace(/-/g, '_'), '.md');
}
/**
 * Check if a string is a valid documentation type
 *
 * @param type - The string to check
 * @returns True if the type is valid
 */
function isValidDocType(type) {
  return type in SYSTEM_PROMPTS;
}
/**
 * Get all available documentation types
 *
 * @returns Array of all documentation type identifiers
 */
function getAvailableDocTypes() {
  return Object.keys(SYSTEM_PROMPTS);
}
/**
 * Get all documentation types with their metadata
 *
 * @returns Array of all documentation type info objects
 */
function getAllDocTypeInfo() {
  return __spreadArray([], exports.DOC_TYPES, true);
}
/**
 * Build a user prompt for documentation generation
 *
 * @param docType - The type of documentation to generate
 * @param codebaseContext - Summary of the codebase analysis
 * @param projectName - Name of the project
 * @returns The formatted user prompt string
 */
function buildDocUserPrompt(docType, codebaseContext, projectName) {
  var _a;
  var typeInfo = getDocTypeInfo(docType);
  var displayName =
    (_a = typeInfo === null || typeInfo === void 0 ? void 0 : typeInfo.displayName) !== null &&
    _a !== void 0
      ? _a
      : docType;
  return 'Generate comprehensive '
    .concat(displayName, ' documentation for the project "')
    .concat(projectName, '".\n\nBased on the following codebase analysis:\n\n<codebase_context>\n')
    .concat(
      codebaseContext,
      '\n</codebase_context>\n\nPlease generate thorough, well-structured Markdown documentation following the guidelines in your system prompt.'
    );
}
