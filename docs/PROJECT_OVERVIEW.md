Now I have all the information I need to create comprehensive Project Overview documentation. Let me generate it:

# AutoMaker - Project Overview

## Project Description

**AutoMaker** is an autonomous AI development studio that transforms software development by enabling developers to orchestrate AI agents to build entire features automatically. Instead of manually writing code line-by-line, users describe features on a Kanban board and watch as AI agents powered by the Claude Agent SDK implement them with full access to the codebase, file system, and development tools.

The project embodies the future of **agentic coding**—where developers transition from being manual coders to architects who direct AI agents. AutoMaker handles the implementation while developers focus on architecture, business logic, and oversight. This paradigm shift enables building entire applications in days rather than weeks.

### Core Value Proposition

AutoMaker solves the problem of slow, repetitive manual coding by providing:

- **Autonomous Implementation**: AI agents write complete features, run tests, make commits, and create PRs automatically
- **Safe Isolation**: Git worktree technology protects your main branch from unintended changes
- **Real-time Visibility**: Watch agents work live with streaming output, tool usage, and progress tracking
- **Complete Workflow**: From feature specification through planning, implementation, review, and integration
- **Multi-platform Availability**: Desktop app (Windows, macOS, Linux) and web browser modes

---

## Tech Stack

### Frontend (apps/ui)

**Core Framework & Build Tools:**

- **React 19.2.3** - Latest UI framework
- **TypeScript 5.9.3** - Static type safety
- **Vite 7.3.0** - Ultra-fast build tool and dev server
- **Electron 39.2.7** - Cross-platform desktop application framework
- **electron-builder 26.0.12** - Packaging and distribution

**UI Components & Styling:**

- **Tailwind CSS 4.1.18** - Utility-first CSS framework
- **Radix UI** - Accessible headless component primitives (collapsible, checkbox, dialog, dropdown, label, popover, radio, select, slider, switch, tabs, tooltip)
- **Geist 1.5.1** - Modern design system
- **Lucide React 0.562.0** - Icon library
- **Class Variance Authority 0.7.1** - Component variant management
- **Sonner 2.0.7** - Toast notifications

**Routing & State Management:**

- **TanStack Router 1.141.6** - File-based routing with code splitting
- **TanStack React Query 5.90.12** - Server state management and caching
- **Zustand 5.0.9** - Client state management with persistence

**Specialized Components:**

- **@dnd-kit** - Drag-and-drop for Kanban board (core, sortable, utilities)
- **@xyflow/react 12.10.0** - Graph visualization for feature dependencies
- **CodeMirror 4.25.4** - Code editor with XML syntax highlighting
- **XTerm 5.5.0** - Terminal emulator (with fit, search, web-links, and WebGL addons)
- **React Markdown 10.1.0** - Markdown rendering
- **React Resizable Panels 3.0.6** - Flexible panel layouts
- **CMDK 1.1.1** - Command palette functionality
- **Dagre 0.8.5** - Graph layout algorithm

**Development & Testing:**

- **Playwright 1.57.0** - End-to-end browser automation testing
- **ESLint 9.39.2** - Code linting with TypeScript support
- **Prettier 3.7.4** - Code formatting
- **LightningCSS 1.29.2** - Platform-specific CSS optimization

### Backend (apps/server)

**Core Framework:**

- **Node.js 20+** - JavaScript runtime with ES Module support
- **Express 5.2.1** - HTTP server framework
- **TypeScript 5** - Static typing
- **tsx 4.21.0** - TypeScript execution and watch mode

**AI & Agent Integration:**

- **@anthropic-ai/claude-agent-sdk 0.1.72** - Core AI agent orchestration
- **@modelcontextprotocol/sdk 1.12.1** - MCP server integration
- **@automaker/prompts** - AI prompt templates for different modes
- **@automaker/model-resolver** - Model alias resolution and configuration

**Real-time & Terminal:**

- **WebSocket (ws) 8.18.3** - Real-time event streaming to frontend
- **node-pty 1.1.0-beta41** - Pseudo-terminal for integrated terminal sessions

**Utilities:**

- **Zod 3.25.0** - Schema validation
- **CORS 2.8.5** - Cross-origin resource sharing
- **Morgan 1.10.1** - HTTP request logging
- **Dotenv 17.2.3** - Environment variable management
- **p-limit 6.2.0** - Promise concurrency limiting
- **ccusage 17.2.0** - Claude API usage tracking

**Testing:**

- **Vitest 4.0.16** - Fast unit testing framework
- **@vitest/coverage-v8 4.0.16** - Code coverage reporting
- **@vitest/ui 4.0.16** - Visual test runner interface

### Shared Libraries (libs/)

**@automaker/types** - Centralized TypeScript type definitions used across all packages for type consistency

**@automaker/utils** - Shared utilities including:

- Logging utilities
- Error handling helpers
- Image processing functions
- Common helper functions

**@automaker/platform** - Platform-specific utilities:

- Path management across operating systems
- Security features
- Node executable detection
- Platform-specific operations

**@automaker/prompts** - AI prompt templates:

- Pre-built prompts for Claude Agent SDK
- Templates for different task types
- Planning mode prompts
- Implementation prompts

**@automaker/model-resolver** - AI model management:

- Model alias resolution
- Support for Claude models (Opus, Sonnet, Haiku)
- GLM-4.7 (Z.AI) integration for cost-effective implementation

**@automaker/dependency-resolver** - Feature dependency management:

- Dependency graph construction
- Execution ordering
- Dependency blocking enforcement

**@automaker/git-utils** - Git operations:

- Git worktree creation and management
- Branch isolation for each feature
- Commit and PR creation utilities
- Git operations abstraction

### DevOps & Deployment

**Containerization:**

- **Docker Compose** - Multi-service orchestration
- **Multi-stage builds** - Optimized production images
- **Nginx** - Web server for production UI
- **Node.js 20 Alpine** - Minimal runtime images

**CI/CD (GitHub Actions):**

- **Automated testing** - E2E tests, unit tests, coverage
- **PR validation** - Build checks before merge
- **Multi-platform builds** - Windows, macOS, Linux artifacts
- **Security auditing** - npm audit with weekly scans
- **Release automation** - Artifact upload to GitHub Releases

**Development Tools:**

- **Husky 9.1.7** - Git hooks for pre-commit formatting
- **Lint-staged 16.2.7** - Staged file linting
- **npm workspaces** - Monorepo management
- **init.mjs** - Smart cross-platform development launcher

---

## Key Features

### Core Workflow

- **📋 Kanban Board Management**
  Visual drag-and-drop interface for managing features through four stages: Backlog → In Progress → Waiting Approval → Verified. Feature cards support descriptions, images, priorities, and dependencies with real-time status updates.

- **🤖 AI Agent Integration**
  Automatic AI agent assignment when features move to "In Progress". Powered by Claude Agent SDK, agents have full access to read files, write code, execute commands, run tests, and make git commits while working in isolated environments.

- **🔀 Git Worktree Isolation**
  Each feature executes in isolated git worktrees, protecting the main branch from unintended changes. Supports branch creation, switching, committing, and pull request creation directly from worktrees.

- **📡 Real-time Streaming**
  Watch AI agents work in real-time with live streaming of tool usage, progress updates, terminal output, and task completion. Follow-up instructions can be sent to running agents without stopping them.

- **🔄 Follow-up Instructions**
  Interact with running agents by sending additional instructions, clarifications, or feedback without interrupting the current workflow.

### AI & Planning Capabilities

- **🧠 Multi-Model Support**
  Choose from Claude Opus (most capable), Sonnet (balanced), and Haiku (fastest) models per feature or globally. GLM-4.7 (Z.AI) support for cost-effective implementation tasks.

- **💭 Extended Thinking Modes**
  Enable enhanced reasoning with four levels: None, Medium, Deep, and Ultra for complex problem-solving and improved decision-making on challenging tasks.

- **📝 Planning Modes**
  Four planning levels to match task complexity:
  - **Skip**: Direct implementation without planning
  - **Lite**: Quick planning outline (3-7 items)
  - **Spec**: Detailed task breakdown with multi-agent execution
  - **Full**: Phased execution with comprehensive planning

- **✅ Plan Approval**
  Optional review workflow where AI-generated plans require user approval before implementation begins, preventing unwanted changes and ensuring alignment.

- **📊 Multi-Agent Task Execution**
  In Spec mode, each task in the plan gets a dedicated agent for focused implementation, enabling parallel work on different aspects of a feature.

### Project Management

- **🔍 Project Analysis**
  AI-powered codebase analysis that automatically understands project structure, technology stack, patterns, and dependencies to provide context for feature development.

- **💡 Feature Suggestions**
  AI-generated feature recommendations based on project analysis, helping identify improvements, refactoring opportunities, and new capabilities to add.

- **📁 Context Management**
  Add markdown files, images, diagrams, and documentation as context that AI agents automatically reference during implementation for better alignment with project conventions.

- **🔗 Dependency Management**
  Features can depend on other features with visual enforcement of execution order. Interactive dependency graph visualization shows relationships and blocking relationships.

- **🌳 Graph View**
  Visualize feature dependencies with interactive graph visualization using @xyflow/react, showing relationships, execution order, and blocking chains.

- **📋 GitHub Integration**
  Import GitHub issues, validate feasibility automatically, convert issues to feature tasks, and create PRs directly from worktrees.

### Collaboration & Review

- **🧪 Verification Workflow**
  Features move to "Waiting Approval" stage for review and testing. Built-in git diff viewer shows all changes made by agents before approval.

- **💬 Agent Chat**
  Interactive chat sessions with AI agents for exploratory work, Q&A, code explanation, and general assistance. Persistent conversation history across restarts.

- **👤 AI Profiles**
  Create custom agent configurations with different prompts, models, thinking modes, and settings. Pre-built profiles for common use cases (planning, implementation, coding, etc.).

- **📜 Session History**
  All chat sessions persist across application restarts with full conversation history preserved for continuity and reference.

- **🔍 Git Diff Viewer**
  Review changes made by agents before approving with side-by-side or unified diff views, showing exactly what will be integrated.

### Developer Tools

- **🖥️ Integrated Terminal**
  Full terminal emulator with tabs, splits, and persistent sessions. Execute commands directly in worktrees with full shell access and history.

- **🖼️ Image Support**
  Attach screenshots, wireframes, diagrams, and mockups to feature descriptions for visual context. Images are stored and referenced by AI agents during implementation.

- **⚡ Concurrent Execution**
  Configure how many features can run simultaneously (default: 3). Resource management and prioritization for parallel agent workloads.

- **⌨️ Keyboard Shortcuts**
  Fully customizable keyboard shortcuts for navigation, actions, and view switching. Default shortcuts provide efficient workflow for power users.

- **🎨 Theme System**
  25+ built-in themes including Dark, Light, Dracula, Nord, Catppuccin, GitHub Dark, Monokai, Solarized, and more. Customizable appearance with instant switching.

- **🖥️ Cross-Platform Support**
  Desktop application for macOS (x64, arm64/Apple Silicon), Windows (x64), and Linux (x64). Consistent experience across all platforms.

- **🌐 Web Mode**
  Run in browser for quick access or in environments where desktop installation isn't possible. Same functionality with web-based deployment.

### Advanced Features

- **🔐 Docker Isolation**
  Security-focused Docker deployment with complete isolation from host filesystem. Multi-stage builds, non-root user execution, health checks, and named volumes.

- **🎯 Worktree Management**
  Create, switch, list, commit, and create PRs from git worktrees directly from the UI. Full control over isolated development environments.

- **📊 Usage Tracking**
  Monitor Claude API usage with detailed metrics on token consumption, costs, and request patterns. Track spending across features and sessions.

- **🔊 Audio Notifications**
  Optional completion sounds for when features finish, errors occur, or agents need attention. Muted by default with per-event configuration.

- **💾 Auto-Save**
  All work automatically persisted to `.automaker/` directory. Features, settings, sessions, and context files saved in real-time with no manual save required.

---

## Project Status

**Current State:** Production-ready, actively developed

**Stability:** Stable with regular releases and active maintenance

**Recent Major Capabilities:**

- Multi-model support (Claude + GLM-4.7)
- Extended thinking modes for complex reasoning
- GitHub integration with issue import
- Docker isolation for secure deployment
- Multi-platform desktop builds (Windows, macOS, Linux)
- Real-time agent streaming and monitoring

**Platform Support:**

- **Desktop:** Windows (x64), macOS (x64, arm64), Linux (x64)
- **Web:** Modern browsers with full feature parity
- **Docker:** Production-ready containerized deployment

**Known Limitations:**

- Requires Anthropic API key or Claude Code CLI authentication
- AI agents have full filesystem access (use Docker for isolation)
- Network connectivity required for AI model access
- Native module compilation required for terminal features

**Upcoming Features:**
Refer to GitHub issues and roadmap for planned enhancements and feature requests.

---

## Quick Start

### Prerequisites

- **Node.js 18+** (tested with Node.js 22)
- **npm** (included with Node.js)
- **Authentication** (choose one):
  - **Claude Code CLI** (recommended) - Install and authenticate
  - **Anthropic API Key** - Get key from [console.anthropic.com](https://console.anthropic.com/)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/AutoMaker-Org/automaker.git
cd automaker

# 2. Install dependencies
npm install

# 3. Set up authentication
# Option A: Use Claude Code CLI (credentials auto-detected)
# Option B: Set API key via environment variable
export ANTHROPIC_API_KEY="sk-ant-..."

# Option C: Create .env file
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# 4. Start Automaker
npm run dev
```

### Running the Application

The `npm run dev` command provides an interactive launcher with options:

- **Electron Desktop App** (Recommended)

  ```bash
  npm run dev:electron          # Standard mode
  npm run dev:electron:debug    # With DevTools
  npm run dev:electron:wsl      # WSL support
  ```

- **Web Browser Mode**
  ```bash
  npm run dev:web              # Runs at http://localhost:3007
  ```

### Building for Production

**Desktop Application:**

```bash
npm run build:electron          # Current platform
npm run build:electron:mac      # macOS (DMG + ZIP)
npm run build:electron:win      # Windows (NSIS)
npm run build:electron:linux    # Linux (AppImage + DEB)
```

**Web Application:**

```bash
npm run build                   # Build for web deployment
```

**Docker Deployment:**

```bash
docker-compose up -d            # Security-focused containerized deployment
```

### Testing

```bash
npm run test                    # E2E tests (Playwright)
npm run test:server             # Unit tests (Vitest)
npm run test:server:coverage    # Coverage reports
npm run test:all                # All tests
```

### Documentation

For detailed guides and architecture documentation, see the [docs/](./docs/) directory:

- [Docker Isolation Guide](./docs/docker-isolation.md)
- [Shared Packages Guide](./docs/llm-shared-packages.md)
- [GLM Setup Guide](./docs/glm-setup-guide.md)

### Community & Support

Join the [Agentic Jumpstart Discord](https://discord.gg/jjem7aEDKU) to connect with other developers exploring agentic coding and AI-powered development workflows.

---

**Additional Documentation:**

- Refer to [README.md](./README.md) for complete feature documentation
- See [LICENSE](./LICENSE) for license terms and usage restrictions
- Visit [automaker.app](https://automaker.app) for product information
