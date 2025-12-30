# Directory Structure

## Overview

Automaker is a **monorepo** organized using npm workspaces. The project follows a clean separation between applications, shared libraries, and configuration. The architecture emphasizes:

- **Monorepo structure** - Multiple apps and packages managed in a single repository
- **Workspace-based organization** - Uses npm workspaces (`apps/*` and `libs/*`)
- **Clear dependency hierarchy** - Shared libraries with no circular dependencies
- **Feature-driven development** - Git worktrees for isolated feature development
- **AI-assisted development** - Built-in tooling for AI agent orchestration

The project contains three main applications (ui, server, app) and seven shared libraries, all orchestrated from a root package.json.

## Root Directory

The root directory contains the monorepo orchestration, configuration files, and shared tooling.

### Configuration Files

| File                | Purpose                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `package.json`      | Root package configuration defining workspaces, scripts, and dependencies        |
| `package-lock.json` | npm lock file for dependency resolution (~557KB)                                 |
| `pnpm-lock.yaml`    | Alternative pnpm lock file (maintained but not primary)                          |
| `.npmrc`            | npm configuration for cross-platform Tailwind CSS v4 and lightningcss bindings   |
| `.gitignore`        | Git exclusions (node_modules, build outputs, AI configs, .automaker/)            |
| `.prettierrc`       | Code formatting rules (semi-colons, single quotes, 2-space tabs, 100 char width) |
| `.prettierignore`   | Excludes from Prettier (node_modules, builds, lock files)                        |

### Executable Scripts

| File       | Purpose                                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init.mjs` | Cross-platform development launcher with interactive menu (Web/Electron), automatic dependency installation, Playwright setup, port management, and health checks |

### Docker Configuration

| File                                  | Purpose                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docker-compose.yml`                  | Docker deployment with isolated volumes, non-root user, configurable security (ports 3007, 3008) |
| `docker-compose.override.yml.example` | Example override for mounting host directories (intentionally gitignored)                        |

### Documentation Files

| File                              | Purpose                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `README.md`                       | Main project documentation (features, quick start, tech stack, architecture) |
| `DISCLAIMER.md`                   | Security disclaimer (AI agents have OS access - use at own risk)             |
| `DOCS_TAB_IMPLEMENTATION_PLAN.md` | Documents tab feature implementation plan                                    |
| `LICENSE`                         | Project license terms                                                        |

## Directory Tree

```
automaker/
├── .auto-claude/              # Auto Claude AI framework (project analysis, insights, specs)
│   ├── .locks/               # File locking for concurrent operations
│   ├── baselines/            # Baseline measurements
│   ├── file-timelines/       # File evolution tracking
│   ├── insights/             # AI-generated insights and sessions
│   └── specs/                # Feature specifications and implementation plans
│
├── .automaker/               # Application state (gitignored for user privacy)
│   ├── features/             # Feature definitions and agent outputs
│   ├── context/              # Context files for AI reference
│   ├── images/               # Shared image assets
│   └── worktrees/            # Git worktree management data
│
├── .github/                  # GitHub CI/CD and automation
│   ├── actions/              # Reusable GitHub Actions
│   │   └── setup-project/    # Common CI setup (Node.js, deps, build)
│   ├── scripts/              # Automation scripts
│   │   └── upload-to-r2.js   # Cloudflare R2 CDN upload for releases
│   └── workflows/            # CI/CD pipeline definitions
│       ├── claude.yml        # Claude Code GitHub integration
│       ├── test.yml          # Test suite execution
│       ├── pr-check.yml      # PR build validation
│       ├── release.yml       # Multi-platform releases
│       ├── format-check.yml  # Prettier validation
│       ├── e2e-tests.yml     # Playwright end-to-end tests
│       └── security-audit.yml # Weekly npm security audit
│
├── .husky/                   # Git hooks
│   ├── pre-commit            # Runs lint-staged before commits
│   └── _/                    # Husky internals
│
├── .serena/                  # Serena AI agent memory and config
│   ├── cache/                # Language server cache
│   └── memories/             # Project knowledge base (architecture, patterns, style)
│
├── .worktrees/               # Git worktree storage for parallel feature development
│   ├── 001-*/
│   ├── 002-*/
│   ├── bugfix-*/
│   └── feature-*/
│
├── .git/                     # Git repository metadata
│
├── apps/                     # Main applications
│   ├── ui/                   # Frontend (React + Vite + Electron)
│   ├── server/               # Backend API (Node.js + Express)
│   └── app/                  # Build artifacts for Electron packaging
│
├── libs/                     # Shared packages (monorepo libraries)
│   ├── types/                # Core TypeScript definitions (foundation)
│   ├── platform/             # Path management and security
│   ├── utils/                # Logging, error handling, images
│   ├── dependency-resolver/  # Feature dependency ordering
│   ├── git-utils/            # Git operations and worktrees
│   ├── model-resolver/       # Claude model alias resolution
│   └── prompts/              # AI prompt templates
│
├── docs/                     # Project documentation
│   ├── server/               # Server-specific documentation
│   └── *.md                  # Guides and architecture docs
│
├── scripts/                  # Build and maintenance scripts
│   └── fix-lockfile-urls.mjs # Converts git+ssh:// to git+https:// for CI
│
├── test/                     # Test fixtures
│   └── fixtures/             # Test data (projectA sample app)
│
├── node_modules/             # Dependencies (gitignored)
│
├── package.json              # Root package configuration
├── package-lock.json         # npm lock file
├── pnpm-lock.yaml            # pnpm lock file (alternative)
├── .npmrc                    # npm configuration
├── .gitignore                # Git exclusions
├── .prettierrc               # Code formatting rules
├── .prettierignore           # Prettier exclusions
├── init.mjs                  # Development launcher
├── docker-compose.yml        # Docker deployment
├── docker-compose.override.yml.example # Docker override template
├── README.md                 # Main documentation
├── DISCLAIMER.md             # Security disclaimer
├── DOCS_TAB_IMPLEMENTATION_PLAN.md # Feature implementation plan
└── LICENSE                   # License terms
```

## Detailed Breakdown

### `apps/` - Main Applications

Contains three applications forming the complete Automaker system.

#### `apps/ui/` - Frontend Application

**Purpose:** React-based user interface that runs as both web app and Electron desktop application

**Tech Stack:**

- React 19 + TypeScript
- Vite 7 (build tool)
- TanStack Router (file-based routing)
- TanStack Query (data fetching)
- Zustand (state management)
- Tailwind CSS v4 (styling)
- Radix UI (headless components)
- Electron 39 (desktop mode)
- Playwright (E2E testing)

**Structure:**

```
ui/
├── src/
│   ├── app.tsx              # React app entry point
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Electron preload script
│   ├── components/          # React components
│   │   ├── dialogs/         # Modal dialogs
│   │   ├── layout/          # Layout components
│   │   │   └── sidebar/     # Sidebar navigation
│   │   ├── settings/        # Settings UI
│   │   ├── ui/              # Reusable UI components (shadcn/ui)
│   │   └── views/           # Main views
│   │       ├── board-view/      # Kanban board
│   │       ├── docs-view/       # Documentation viewer
│   │       ├── spec-view/       # App specification
│   │       ├── agent-view/      # Agent interactions
│   │       ├── context-view/    # Context management
│   │       ├── settings-view/   # Settings pages
│   │       ├── setup-view/      # Setup wizard
│   │       ├── terminal-view/   # Terminal interface
│   │       ├── profiles-view/   # Agent profiles
│   │       └── graph-view/      # Dependency graphs
│   ├── routes/              # TanStack Router routes
│   ├── store/               # Zustand state stores
│   ├── styles/
│   │   └── themes/          # 25+ theme definitions
│   ├── hooks/               # Custom React hooks
│   ├── contexts/            # React contexts
│   ├── lib/                 # Utilities
│   ├── config/              # Configuration files
│   ├── types/               # TypeScript types
│   └── utils/               # Helper functions
├── tests/                   # Playwright E2E tests (15 test files)
│   ├── agent/               # Agent interaction tests
│   ├── context/             # Context management tests
│   ├── features/            # Feature workflow tests
│   ├── git/                 # Git integration tests
│   ├── mcp/                 # MCP server tests
│   ├── profiles/            # Profile management tests
│   └── utils/               # Test utilities and helpers
├── dist/                    # Web build output (gitignored)
└── package.json
```

**Key Routes:**

- `/` - Home
- `/board` - Kanban board
- `/agent` - Agent chat
- `/context` - Context management
- `/docs` - Documentation
- `/spec` - App specification
- `/terminal` - Terminal
- `/settings` - Settings
- `/setup` - Setup wizard
- `/profiles` - Agent profiles
- `/github-issues` - GitHub issues
- `/github-prs` - GitHub pull requests

**Development Modes:**

- Web: `npm run dev:web` (localhost:3007)
- Electron: `npm run dev:electron` (spawns server internally)

---

#### `apps/server/` - Backend API Server

**Purpose:** Node.js/Express backend providing HTTP/WebSocket API for AI agent orchestration

**Tech Stack:**

- Node.js + TypeScript
- Express 5 (web framework)
- WebSocket (real-time streaming)
- Claude Agent SDK (AI integration)
- MCP SDK (Model Context Protocol)
- node-pty (terminal emulation)
- Zod (schema validation)
- Vitest (unit testing)

**Structure:**

```
server/
├── src/
│   ├── index.ts             # Server entry point (port 3008)
│   ├── lib/                 # Shared utilities
│   ├── middleware/          # Express middleware
│   ├── providers/           # AI provider implementations
│   │   ├── base-provider.ts
│   │   ├── claude-provider.ts
│   │   └── provider-factory.ts
│   ├── routes/              # API endpoints (22+ route groups)
│   │   ├── agent/           # Agent operations
│   │   ├── app-spec/        # App specification
│   │   ├── auto-mode/       # Automated development
│   │   ├── backlog-plan/    # Backlog planning
│   │   ├── claude/          # Claude API integration
│   │   ├── context/         # Context management
│   │   ├── docs/            # Documentation generation
│   │   ├── enhance-prompt/  # Prompt enhancement
│   │   ├── features/        # Feature management
│   │   ├── fs/              # File system operations
│   │   ├── git/             # Git operations
│   │   ├── github/          # GitHub integration
│   │   ├── health/          # Health checks
│   │   ├── mcp-servers/     # MCP server management
│   │   ├── models/          # Model management
│   │   ├── running-agents/  # Agent tracking
│   │   ├── sessions/        # Session management
│   │   ├── settings/        # Settings
│   │   ├── setup/           # Setup wizard
│   │   ├── suggestions/     # AI suggestions
│   │   ├── templates/       # Templates
│   │   ├── terminal/        # Terminal operations
│   │   ├── worktree/        # Git worktrees
│   │   └── workspace/       # Workspace management
│   ├── services/            # Business logic
│   │   ├── agent-service.ts
│   │   ├── auto-mode-service.ts
│   │   ├── mcp-server-service.ts
│   │   ├── settings-service.ts
│   │   ├── claude-usage-service.ts
│   │   ├── docs-service.ts
│   │   └── terminal-service.ts
│   └── types/               # TypeScript types
├── tests/                   # Vitest tests (35 test files)
│   ├── fixtures/            # Test fixtures
│   ├── integration/         # Integration tests (2)
│   │   ├── routes/worktree/
│   │   └── services/
│   ├── unit/                # Unit tests (33)
│   │   ├── lib/             # Library tests (19)
│   │   ├── providers/       # Provider tests
│   │   ├── routes/          # Route tests
│   │   └── services/        # Service tests (11)
│   └── utils/               # Test utilities
├── dist/                    # Build output (gitignored)
└── package.json
```

**API Endpoints:**

- HTTP: `http://localhost:3008/api/*`
- WebSocket Events: `ws://localhost:3008/api/events`
- WebSocket Terminal: `ws://localhost:3008/api/terminal/ws`

---

#### `apps/app/` - Build Artifacts

**Purpose:** Contains pre-built server bundle for Electron packaging

**Structure:**

```
app/
└── server-bundle/
    ├── dist/                # Compiled server code
    ├── libs/                # Internal libraries
    ├── node_modules/        # Server dependencies
    └── package.json
```

---

### `libs/` - Shared Packages

Seven TypeScript libraries providing shared functionality. All follow strict dependency hierarchy with no circular dependencies.

```
libs/
├── tsconfig.base.json       # Shared TypeScript configuration
│
├── types/                   # Foundation - no dependencies
│   ├── src/
│   │   ├── provider.ts      # AI provider types
│   │   ├── feature.ts       # Feature types
│   │   ├── session.ts       # Session types
│   │   ├── model.ts         # Model definitions
│   │   ├── settings.ts      # Settings types
│   │   ├── error.ts         # Error types
│   │   └── [13 more modules]
│   └── package.json
│
├── platform/                # Platform utilities - depends on: types
│   ├── src/
│   │   ├── paths.ts         # AutoMaker directory structure
│   │   ├── security.ts      # Path validation
│   │   ├── secure-fs.ts     # Secure filesystem wrapper
│   │   ├── subprocess.ts    # Subprocess management
│   │   └── node-finder.ts   # Node.js executable finder
│   └── package.json
│
├── utils/                   # Utilities - depends on: types, platform
│   ├── src/
│   │   ├── logger.ts        # Structured logging
│   │   ├── error-handler.ts # Error classification
│   │   ├── conversation-utils.ts
│   │   ├── image-handler.ts # Image processing
│   │   ├── prompt-builder.ts
│   │   ├── fs-utils.ts      # Filesystem utilities
│   │   └── context-loader.ts
│   └── package.json
│
├── git-utils/               # Git operations - depends on: types, utils
│   ├── src/
│   │   ├── status.ts        # Repository detection
│   │   ├── diff.ts          # Diff generation
│   │   ├── merge-preview.ts # Conflict parsing
│   │   └── types.ts
│   └── package.json
│
├── dependency-resolver/     # Dependency ordering - depends on: types
│   ├── src/
│   │   ├── resolver.ts      # Topological sort (Kahn's algorithm)
│   │   └── index.ts
│   └── package.json
│
├── model-resolver/          # Model resolution - depends on: types
│   ├── src/
│   │   ├── resolver.ts      # Model alias resolution
│   │   └── index.ts
│   └── package.json
│
└── prompts/                 # AI prompts - depends on: types
    ├── src/
    │   ├── enhancement.ts   # Enhancement templates
    │   └── index.ts
    └── package.json
```

**Dependency Hierarchy:**

```
types (foundation)
  ↓
platform
  ↓
utils ←───────→ git-utils
  ↓               ↓
server ←─────────┘
  ↓
ui

Other libraries (depend only on types):
- dependency-resolver
- model-resolver
- prompts
```

---

### `docs/` - Documentation

Project documentation including architecture guides, workflows, and AI-specific guides.

```
docs/
├── .generation-manifest.json        # Documentation generation metadata
├── PROJECT_OVERVIEW.md              # (empty - AI-generated)
├── ARCHITECTURE.md                  # (empty - AI-generated)
├── API_REFERENCE.md                 # (empty - AI-generated)
├── DIRECTORY_STRUCTURE.md           # (empty - AI-generated)
├── SETUP_AND_DEVELOPMENT.md         # (empty - AI-generated)
├── checkout-branch-pr.md            # Git workflow guide
├── clean-code.md                    # Code quality guidelines
├── context-files-pattern.md         # Context system guide
├── docker-isolation.md              # Docker setup
├── folder-pattern.md                # Naming conventions
├── glm-setup-guide.md               # GLM-4.7 configuration
├── llm-shared-packages.md           # Shared packages guide for LLMs
├── migration-plan-nextjs-to-vite.md # Architecture migration history
├── pr-comment-fix-agent.md          # PR review automation
├── pr-comment-fix-prompt.md         # PR fix prompts
├── release.md                       # Release commands
├── terminal.md                      # Terminal feature docs
└── server/                          # Server-specific docs
    ├── glm-integration.md          # GLM-4.7 server integration
    ├── providers.md                # Provider architecture
    ├── route-organization.md       # Route patterns
    └── utilities.md                # Server utilities
```

---

### `scripts/` - Automation Scripts

Build and maintenance scripts for the monorepo.

```
scripts/
└── fix-lockfile-urls.mjs          # Converts git+ssh:// to git+https:// for CI
```

---

### `test/` - Test Fixtures

Shared test data used across the project.

```
test/
└── fixtures/
    └── projectA/                  # Sample app specification for testing
        └── .automaker/
            └── app_spec.txt
```

---

### Hidden Directories

#### `.github/` - GitHub CI/CD

Continuous integration, deployment, and automation.

```
.github/
├── actions/
│   └── setup-project/
│       └── action.yml             # Common CI setup (Node, deps, build)
├── scripts/
│   └── upload-to-r2.js            # Cloudflare R2 CDN upload
└── workflows/
    ├── claude.yml                 # Claude Code GitHub integration
    ├── test.yml                   # Test execution
    ├── pr-check.yml               # PR validation
    ├── release.yml                # Multi-platform releases
    ├── format-check.yml           # Prettier validation
    ├── e2e-tests.yml              # Playwright E2E tests
    └── security-audit.yml         # Weekly npm audit
```

---

#### `.husky/` - Git Hooks

Git hooks automation using Husky.

```
.husky/
├── pre-commit                     # Runs lint-staged
└── _/                             # Husky internals
```

---

#### `.automaker/` - Application State

Runtime state, feature definitions, and configurations (gitignored).

```
.automaker/
├── settings.json                  # Application settings
├── app_spec.txt                   # Project specification
├── categories.json                # Feature categories
├── active-branches.json           # Git branch tracking
├── features/                      # Feature definitions (25+ features)
├── context/                       # AI context files
├── images/                        # Shared images
└── worktrees/                     # Worktree metadata
```

---

#### `.auto-claude/` - Auto Claude Framework

AI development automation framework (gitignored).

```
.auto-claude/
├── .env                           # Claude OAuth, GitHub, Linear tokens
├── project_index.json             # Project structure index
├── file_evolution.json            # File evolution tracking
├── .locks/                        # Concurrent operation locks
├── baselines/                     # Benchmarks
├── file-timelines/                # File history
├── insights/                      # AI insights and sessions
│   └── sessions/                  # Session records
└── specs/                         # Feature specifications
```

---

#### `.serena/` - Serena AI Memory

Serena AI agent configuration and knowledge base (gitignored).

```
.serena/
├── project.yml                    # Serena configuration
├── cache/                         # Language server cache
│   └── typescript/
└── memories/                      # Project knowledge base
    ├── project-overview.md
    ├── architecture-patterns.md
    ├── code-style-conventions.md
    ├── context-files-system.md
    └── suggested-commands.md
```

---

#### `.worktrees/` - Git Worktree Storage

Isolated git worktrees for parallel feature development (gitignored).

```
.worktrees/
├── 001-*/
├── 002-*/
├── bugfix-*/
└── feature-*/
```

---

## File Naming Conventions

### File Names

- **Source files**: `kebab-case.ts` (e.g., `error-handler.ts`, `prompt-builder.ts`)
- **React components**: `PascalCase.tsx` (e.g., `BoardView.tsx`, `AgentChat.tsx`)
- **Test files**: `*.test.ts` (e.g., `logger.test.ts`, `agent-service.test.ts`)
- **E2E tests**: `*.spec.ts` (e.g., `start-new-chat-session.spec.ts`)
- **Config files**: `kebab-case.config.ts` (e.g., `vite.config.mts`, `vitest.config.ts`)

### Directory Names

- **All directories**: `kebab-case` (e.g., `apps/server`, `libs/git-utils`, `src/routes`)

### Export Naming

- **Component exports**: `PascalCase` (e.g., `export { BoardView }`)
- **Function exports**: `camelCase` (e.g., `export { createLogger }`)
- **Type exports**: `PascalCase` (e.g., `export { FeatureConfig }`)

### Index Files

- **Barrel exports**: `index.ts` exports all public APIs
- **Route indices**: Each route directory has `index.ts` for exports

## Configuration Files

### Build & Package

| File                     | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `package.json` (root)    | Monorepo workspace configuration, scripts |
| `package.json` (apps/\*) | Application-specific dependencies         |
| `package.json` (libs/\*) | Library-specific dependencies             |
| `tsconfig.base.json`     | Shared TypeScript config for all packages |
| `tsconfig.json`          | Package-specific TypeScript configs       |
| `vite.config.mts`        | Vite build configuration                  |
| `vitest.config.ts`       | Vitest test configuration                 |
| `playwright.config.ts`   | Playwright E2E test config                |
| `electron-builder.yml`   | Electron packaging config                 |

### Code Quality

| File              | Purpose                   |
| ----------------- | ------------------------- |
| `.prettierrc`     | Prettier formatting rules |
| `.prettierignore` | Prettier exclusions       |
| `.eslintrc.js`    | ESLint rules (if present) |
| `.gitignore`      | Git exclusions            |

### Git & CI/CD

| File                           | Purpose                            |
| ------------------------------ | ---------------------------------- |
| `.husky/pre-commit`            | Pre-commit hook (runs lint-staged) |
| `.github/workflows/*.yml`      | CI/CD pipeline definitions         |
| `.github/actions/*/action.yml` | Reusable GitHub Actions            |

### Docker

| File                                  | Purpose                             |
| ------------------------------------- | ----------------------------------- |
| `docker-compose.yml`                  | Production deployment               |
| `docker-compose.override.yml.example` | Local development override template |

## Adding New Files

### Where to Put Code

1. **New UI Component**: `apps/ui/src/components/` or appropriate subdirectory
2. **New API Route**: `apps/server/src/routes/` (create route directory)
3. **New Service**: `apps/server/src/services/`
4. **New Shared Utility**:
   - If types-only: `libs/types/src/`
   - If platform-specific: `libs/platform/src/`
   - If general utility: `libs/utils/src/`
   - If git-related: `libs/git-utils/src/`
   - Create new library if warranted

### Template Patterns

**New React Component** (`apps/ui/src/components/my-feature/MyComponent.tsx`):

```typescript
import { useState } from 'react'

export function MyComponent() {
  const [state, setState] = useState(null)

  return (
    <div>
      {/* Component JSX */}
    </div>
  )
}
```

**New API Route** (`apps/server/src/routes/my-feature/index.ts`):

```typescript
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

router.get('/', async (req, res) => {
  // Route handler
});

export default router;
```

**New Library** (`libs/my-lib/`):

1. Create `libs/my-lib/package.json`:

   ```json
   {
     "name": "@automaker/my-lib",
     "version": "1.0.0",
     "type": "module",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "exports": "./dist/index.js"
   }
   ```

2. Create `libs/my-lib/tsconfig.json`:

   ```json
   {
     "extends": "../tsconfig.base.json",
     "include": ["src/**/*"],
     "compilerOptions": {
       "outDir": "./dist"
     }
   }
   ```

3. Create `libs/my-lib/src/index.ts` with exports

4. Add dependency to consuming package's `package.json`

## Project Scripts

### Development

- `npm run dev` - Interactive launcher (Web/Electron selection)
- `npm run dev:web` - Web mode (localhost:3007)
- `npm run dev:electron` - Electron desktop app
- `npm run dev:server` - Backend only (port 3008)

### Build

- `npm run build` - Build all
- `npm run build:packages` - Build shared libraries
- `npm run build:server` - Build backend
- `npm run build:electron` - Build Electron desktop app

### Testing

- `npm run test` - Run E2E tests
- `npm run test:server` - Run server unit tests
- `npm run test:server:coverage` - Server tests with coverage
- `npm run test:packages` - Run all library tests
- `npm run test:all` - Run all tests

### Code Quality

- `npm run lint` - Run ESLint
- `npm run format` - Format with Prettier
- `npm run format:check` - Check formatting

### Maintenance

- `npm run fix:lockfile` - Convert SSH URLs to HTTPS in lockfile
- `npm run lint:lockfile` - Check for SSH URLs

## Architecture Notes

### Monorepo Structure

The project uses **npm workspaces** with the following configuration in `package.json`:

```json
{
  "workspaces": ["apps/*", "libs/*"]
}
```

This enables:

- Single `npm install` for all packages
- Cross-package imports (e.g., `import { Logger } from '@automaker/utils'`)
- Shared dependency management
- Atomic version changes

### Dependency Flow

```
Root (orchestration)
  ↓
Libraries (foundation)
  ↓
Server (backend)
  ↓
UI (frontend)
```

### Key Design Principles

1. **No circular dependencies** - Strict one-way flow
2. **Types as foundation** - `@automaker/types` has no dependencies
3. **Clear separation** - Apps vs. libs
4. **Shared config** - Base TypeScript config extended by all
5. **Consistent naming** - kebab-case for files, PascalCase for components
6. **Test organization** - Tests co-located with source (not in `src/`)

This directory structure supports the project's goal of providing an autonomous AI development studio while maintaining code quality, testability, and developer experience.
