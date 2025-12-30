Perfect! I now have all the information I need to generate comprehensive Setup & Development documentation. Let me create the document.

# Setup & Development Guide - Automaker

## Prerequisites

### Required Software

- **Node.js 18+** (tested with Node.js 22)
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`
- **npm** (comes with Node.js)
  - Verify installation: `npm --version`

- **Git**
  - Download from [git-scm.com](https://git-scm.com/)
  - Verify installation: `git --version`

### Authentication (Choose One)

Automaker requires an Anthropic API key for AI functionality. You have two options:

#### Option 1: Claude Code CLI (Recommended)

1. Install [Claude Code CLI](https://code.claude.com/docs/en/overview)
2. Authenticate with the CLI
3. Automaker will automatically detect and use your credentials

#### Option 2: Anthropic API Key

1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Set via environment variable (see Environment Configuration below)

### System Requirements

- **Operating System:** Windows 10+, macOS 10.15+, or Linux
- **Memory:** 8GB RAM minimum (16GB recommended)
- **Disk Space:** 2GB free space for development dependencies

### Recommended Tools & Extensions

- **IDE:** VS Code, Cursor, or any TypeScript-compatible editor
- **VS Code Extensions:**
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript Vue Plugin (if using Vite)

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/AutoMaker-Org/automaker.git
cd automaker
```

### 2. Install Dependencies

```bash
npm install
```

This will:

- Install all workspace dependencies for apps and libraries
- Set up git hooks via Husky
- Automatically build shared packages
- Fix macOS file permissions for `node-pty` if needed
- Convert any SSH URLs to HTTPS in the lockfile for CI compatibility

**Note:** The project uses **pnpm** as the package manager (identified by `pnpm-lock.yaml`). However, npm commands work seamlessly due to the workspace configuration.

### 3. Build Shared Packages

```bash
npm run build:packages
```

This builds all shared libraries in the `libs/` directory:

- `@automaker/types`
- `@automaker/platform`
- `@automaker/utils`
- `@automaker/prompts`
- `@automaker/model-resolver`
- `@automaker/dependency-resolver`
- `@automaker/git-utils`

**Note:** This step is now optional as `npm install` and `npm run dev` will automatically build packages if needed.

### 4. Configure Environment (Optional if using Claude Code CLI)

Create a `.env` file in the project root or set environment variables:

```bash
# Required if not using Claude Code CLI
ANTHROPIC_API_KEY=sk-ant-...

# Optional - Server configuration
PORT=3008
DATA_DIR=./data
ENABLE_REQUEST_LOGGING=false

# Optional - Security
AUTOMAKER_API_KEY=
ALLOWED_ROOT_DIRECTORY=
CORS_ORIGIN=*
```

See [Environment Configuration](#environment-configuration) for detailed options.

---

## Environment Configuration

### Required Environment Variables

#### `ANTHROPIC_API_KEY` (Optional if using Claude Code CLI)

Your Anthropic API key for Claude Agent SDK.

**Methods to set:**

**A. Environment Variable:**

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**B. .env File (in project root):**

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

**C. In-App Storage:**
The application can store your API key securely in the settings UI.

### Optional Environment Variables

#### Server Configuration

| Variable                 | Default  | Description                              |
| ------------------------ | -------- | ---------------------------------------- |
| `PORT`                   | `3008`   | Server port                              |
| `DATA_DIR`               | `./data` | Data directory for sessions and metadata |
| `ENABLE_REQUEST_LOGGING` | `false`  | Enable HTTP request logging              |

#### Security & Authentication

| Variable                 | Default | Description                                                             |
| ------------------------ | ------- | ----------------------------------------------------------------------- |
| `AUTOMAKER_API_KEY`      | (empty) | API key for authenticating requests via `X-API-Key` header              |
| `ALLOWED_ROOT_DIRECTORY` | (empty) | Restrict file operations to specific directory (recommended for Docker) |
| `CORS_ORIGIN`            | `*`     | CORS origin policy                                                      |

#### Terminal Access

| Variable            | Default | Description                             |
| ------------------- | ------- | --------------------------------------- |
| `TERMINAL_ENABLED`  | `true`  | Enable/disable terminal access          |
| `TERMINAL_PASSWORD` | (empty) | Password protection for terminal access |

#### Client-Side (Vite) Variables

| Variable                   | Description                                               |
| -------------------------- | --------------------------------------------------------- |
| `VITE_SERVER_URL`          | Backend API server URL (default: `http://localhost:3008`) |
| `VITE_AUTOMAKER_API_KEY`   | API key for web mode authentication                       |
| `VITE_SKIP_SETUP`          | Skip initial setup wizard                                 |
| `VITE_SKIP_ELECTRON`       | Skip Electron build (for CI/web mode)                     |
| `VITE_HIDE_TERMINAL`       | Hide terminal feature                                     |
| `VITE_HIDE_WIKI`           | Hide wiki feature                                         |
| `VITE_HIDE_RUNNING_AGENTS` | Hide running agents                                       |
| `VITE_HIDE_CONTEXT`        | Hide context feature                                      |
| `VITE_HIDE_SPEC_EDITOR`    | Hide spec editor                                          |
| `VITE_HIDE_AI_PROFILES`    | Hide AI profiles                                          |
| `OPEN_DEVTOOLS`            | Open DevTools in Electron                                 |
| `CI`                       | CI environment flag                                       |
| `TEST_PORT`                | Test server port                                          |

#### Model Configuration

| Variable                  | Description               |
| ------------------------- | ------------------------- |
| `AUTOMAKER_MODEL_CHAT`    | Model for chat operations |
| `AUTOMAKER_MODEL_DEFAULT` | Default fallback model    |

### Example .env File

```bash
# ============================================
# REQUIRED
# ============================================

# Your Anthropic API key for Claude models
ANTHROPIC_API_KEY=sk-ant-...

# ============================================
# OPTIONAL - Security
# ============================================

# API key for authenticating requests (leave empty to disable auth)
# If set, all API requests must include X-API-Key header
AUTOMAKER_API_KEY=

# Root directory for projects and file operations
# If set, users can only create/open projects and files within this directory
# Recommended for sandboxed deployments (Docker, restricted environments)
# Example: ALLOWED_ROOT_DIRECTORY=/projects
ALLOWED_ROOT_DIRECTORY=

# CORS origin - which domains can access the API
# Use "*" for development, set specific origin for production
CORS_ORIGIN=*

# ============================================
# OPTIONAL - Server
# ============================================

# Port to run the server on
PORT=3008

# Data directory for sessions and metadata
DATA_DIR=./data

# ============================================
# OPTIONAL - Terminal Access
# ============================================

# Enable/disable terminal access (default: true)
TERMINAL_ENABLED=true

# Password to protect terminal access (leave empty for no password)
# If set, users must enter this password before accessing terminal
TERMINAL_PASSWORD=

ENABLE_REQUEST_LOGGING=false
```

### Docker Environment Variables

When using Docker Compose, environment variables are set in `docker-compose.yml`:

```yaml
environment:
  - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
  - AUTOMAKER_API_KEY=${AUTOMAKER_API_KEY:-}
  - ALLOWED_ROOT_DIRECTORY=${ALLOWED_ROOT_DIRECTORY:-/projects}
  - DATA_DIR=/data
  - CORS_ORIGIN=${CORS_ORIGIN:-*}
```

**Important:** The Docker setup uses **container-only paths**. The `ALLOWED_ROOT_DIRECTORY` and `DATA_DIR` paths are inside the container, not on your host.

---

## Running the Application

### Development Mode

Automaker provides an interactive development launcher that guides you through setup:

```bash
npm run dev
```

This command will:

1. Check for dependencies and install if needed
2. Install Playwright browsers for E2E tests
3. Kill any processes on ports 3007/3008
4. Present an interactive menu to choose your run mode

**Interactive Menu:**

```
═══════════════════════════════════════════════════════
  Select Application Mode:
═══════════════════════════════════════════════════════
  1) Web Application (Browser)
  2) Desktop Application (Electron)
═══════════════════════════════════════════════════════
```

#### Direct Mode Selection

You can also specify the mode directly via CLI arguments:

```bash
# Web mode
npm run dev -- --web
# or
npm run dev -- -w

# Electron mode
npm run dev -- --electron
# or
npm run dev -- -e
```

#### Web Application Mode

```bash
npm run dev:web
```

This will:

1. Build shared packages
2. Start the backend server on port 3008
3. Wait for the server to be ready (health check at `/api/health`)
4. Start the web application on port 3007
5. Open browser at `http://localhost:3007`

**Server logs** are written to `logs/server.log`.

#### Electron Desktop Application Mode

```bash
# Standard development mode
npm run dev:electron

# With DevTools open automatically (for debugging)
npm run dev:electron:debug

# For Windows Subsystem for Linux (WSL)
npm run dev:electron:wsl

# For WSL with GPU acceleration
npm run dev:electron:wsl:gpu
```

This will:

1. Build shared packages
2. Launch Electron with its own embedded backend server
3. Open the desktop application window

#### Full Stack Development (Separate Server + Web)

```bash
npm run dev:full
```

This runs both server and web concurrently using `concurrently`.

### Production Mode

#### Build for Web

```bash
npm run build
```

This builds:

1. Shared packages
2. UI application for web deployment (outputs to `apps/ui/dist/`)

#### Build for Electron

```bash
# Build for current platform
npm run build:electron

# Platform-specific builds
npm run build:electron:mac       # macOS (DMG + ZIP, x64 + arm64)
npm run build:electron:win       # Windows (NSIS installer, x64)
npm run build:electron:linux     # Linux (AppImage + DEB, x64)

# Directory builds (for testing without packaging)
npm run build:electron:dir
npm run build:electron:mac:dir
npm run build:electron:win:dir
npm run build:electron:linux:dir
```

Output directory: `apps/ui/release/`

**Electron Build Process:**

1. Builds TypeScript server
2. Copies `server/dist` to `ui/server-bundle/dist`
3. Copies all library packages to `ui/server-bundle/libs/`
4. Creates modified `package.json` with `file:` references
5. Installs production dependencies only
6. Rebuilds native modules (like `node-pty`) for target platform

#### Build Server Only

```bash
npm run build:server
```

This compiles the server TypeScript to `apps/server/dist/`.

### Docker Deployment

#### Quick Start

```bash
docker-compose up -d
```

This will:

1. Build UI and server Docker images
2. Start services on ports 3007 (UI) and 3008 (server)
3. Access at `http://localhost:3007`

#### Docker Environment Setup

Create a `.env` file in the project root (not in `apps/server/`):

```bash
ANTHROPIC_API_KEY=sk-ant-...
AUTOMAKER_API_KEY=                 # Optional auth
ALLOWED_ROOT_DIRECTORY=/projects   # Container path, not host path
CORS_ORIGIN=*
```

#### Docker with Host Workspace Mount

For development with access to your host files, create `docker-compose.override.yml`:

```yaml
services:
  server:
    volumes:
      # Mount your workspace directory
      - /path/to/your/workspace:/projects:rw

volumes:
  automaker-data:
```

**Security Warning:** This gives the container access to your host filesystem. Use with caution.

#### Stop Docker Services

```bash
docker-compose down
```

#### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f ui
docker-compose logs -f server
```

---

## Development Workflow

### Project Structure

Automaker is a **monorepo** using npm workspaces:

```
automaker/
├── apps/
│   ├── ui/              # React + Vite + Electron frontend
│   └── server/          # Express + WebSocket backend
├── libs/                # Shared packages
│   ├── types/
│   ├── platform/
│   ├── utils/
│   ├── prompts/
│   ├── model-resolver/
│   ├── dependency-resolver/
│   └── git-utils/
├── scripts/             # Build and utility scripts
└── docs/                # Documentation
```

### Common Development Scripts

| Command                  | Description                       |
| ------------------------ | --------------------------------- |
| `npm run dev`            | Interactive development launcher  |
| `npm run dev:web`        | Start web application (port 3007) |
| `npm run dev:electron`   | Start Electron desktop app        |
| `npm run dev:server`     | Start server only (port 3008)     |
| `npm run dev:full`       | Start server + web concurrently   |
| `npm run build`          | Build for web production          |
| `npm run build:electron` | Build Electron app                |
| `npm run build:packages` | Build all shared packages         |
| `npm run build:server`   | Build server only                 |

### Code Style & Formatting

#### Prettier (Auto-Formatted on Commit)

The project uses **Prettier** for code formatting with **Husky** git hooks.

**Configuration** (`.prettierrc`):

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**Manual formatting:**

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

**Pre-commit Hook:**
The `.husky/pre-commit` hook automatically runs `lint-staged` which formats staged files before commit.

**lint-staged Configuration:**

```json
{
  "*.{js,jsx,ts,tsx,json,css,md,html,yml,yaml}": ["prettier --write"]
}
```

#### ESLint (Manual Linting)

```bash
# Run ESLint
npm run lint
```

**ESLint Configuration:**

- Located at `apps/ui/eslint.config.mjs`
- Uses flat config format
- Configured for JavaScript, TypeScript, React, and Electron
- Warns on unused vars (with `^_` args ignore pattern)
- Warns on `any` types

### Branch Naming Conventions

While no specific convention is enforced in the codebase, recommended patterns:

- `feature/feature-name` - New features
- `fix/bug-name` - Bug fixes
- `docs/update-name` - Documentation updates
- `refactor/component-name` - Refactoring
- `test/test-name` - Test additions/changes

### Commit Message Format

The project uses conventional commits (based on release script):

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Example:**

```
feat(board): add drag and drop for feature cards

Implement drag and drop functionality using @dnd-kit
to allow moving features between columns.
```

### Code Review Process

1. **Create a feature branch** from `main` or `master`
2. **Make changes** following code style guidelines
3. **Test your changes** (run tests locally)
4. **Commit** with clear commit messages
5. **Push** to your fork or repository
6. **Create Pull Request** with:
   - Clear description of changes
   - Link to related issues
   - Screenshots for UI changes
7. **CI/CD checks** will run automatically:
   - Format check
   - Build verification
   - E2E tests
   - Security audit
8. **Address review comments**
9. **Merge** after approval

### PR Guidelines

- **Title:** Use conventional commit format
- **Description:** Include:
  - What changes were made and why
  - How to test
  - Any breaking changes
  - Screenshots for UI changes
- **Checks Required:**
  - All CI checks must pass
  - At least one approval required
  - No merge conflicts

---

## Testing

### Test Frameworks

- **Frontend (E2E):** Playwright
- **Backend & Libraries:** Vitest

### Running Tests

#### End-to-End Tests (Playwright)

```bash
# Headless E2E tests
npm run test

# Headed mode (browser visible)
npm run test:headed
```

**Test Organization:**

- Location: `apps/ui/tests/`
- Organized by feature:
  - `agent/` - Agent chat session tests
  - `context/` - Context file management tests
  - `features/` - Feature-related tests
  - `git/` - Git/worktree integration tests
  - `profiles/` - Profile CRUD tests
  - `projects/` - Project creation/opening tests
  - `mcp/` - MCP server tests

**Playwright Configuration:**

- Parallel execution (auto-detect workers)
- HTML reporter
- 30-second timeout
- Chromium desktop device
- Auto-starts backend server on port 3008
- Trace and screenshot on failures

#### Unit Tests (Vitest)

```bash
# Server tests
npm run test:server

# Server tests with coverage
npm run test:server:coverage

# All shared package tests
npm run test:packages

# Packages + server tests
npm run test:all
```

**Test Organization:**

**Server** (`apps/server/tests/`):

- `unit/` - Unit tests for lib, routes, providers, services
- `integration/` - Integration tests for routes and services

**Libraries** (each library has `tests/` directory):

- Simple directory structure with `.test.ts` files

**Vitest Configuration:**

- V8 coverage provider
- Server coverage thresholds: 60% lines, 75% functions, 55% branches, 60% statements
- Library coverage thresholds: 90% lines, 95% functions, 85% branches, 90% statements
- Mock reset and restoration enabled
- Path aliases for workspace packages

#### Test Utilities

**UI Test Utilities** (`apps/ui/tests/utils/`):

- Element selection: `getByTestId()`, `getButtonByText()`
- Test fixtures and project setup
- Component helpers: Dialog, modal, toast utilities
- Feature-specific helpers: Kanban board, timers, approval workflows
- Git utilities for worktree operations
- Navigation utilities for view helpers

**Server Test Utilities** (`apps/server/tests/utils/`):

- Mock configurations
- Helper functions
- Global setup with environment variable configuration

### Writing New Tests

#### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('create new feature', async ({ page }) => {
  // Navigate to board
  await page.goto('http://localhost:3007');

  // Click new feature button
  await page.click('[data-testid="new-feature-button"]');

  // Fill in feature details
  await page.fill('[data-testid="feature-title"]', 'Test Feature');
  await page.fill('[data-testid="feature-description"]', 'Test description');

  // Save
  await page.click('[data-testid="save-feature"]');

  // Verify feature created
  await expect(page.locator('text=Test Feature')).toBeVisible();
});
```

#### Unit Test Example (Vitest)

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/utils';

describe('myFunction', () => {
  it('should return expected result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Coverage Requirements

**Server:**

- 60% lines
- 75% functions
- 55% branches
- 60% statements

**Libraries:**

- 90% lines
- 95% functions
- 85% branches
- 90% statements

### Test Environment Variables

- `NODE_ENV=test` - Set automatically in CI
- `TEST_PORT` - Alternate port for test server
- `AUTOMAKER_MOCK_AGENT=true` - Use mock agent in CI (for API calls)

---

## Debugging

### Common Debugging Approaches

#### Frontend (React/Electron)

**Browser DevTools:**

```bash
npm run dev:web
```

Open DevTools in browser (F12 or Cmd+Option+I)

**Electron DevTools:**

```bash
# Auto-open DevTools
npm run dev:electron:debug
```

Or press `F12` or `Cmd+Option+I` in Electron window

#### Backend (Server)

**Server Logs:**

```bash
# Logs written to logs/server.log in web mode
tail -f logs/server.log
```

**Enable Request Logging:**

```bash
# In .env file
ENABLE_REQUEST_LOGGING=true
```

**Debug with Node.js Inspector:**

```bash
# Run server in debug mode
node --inspect apps/server/dist/index.js
```

Then attach via Chrome DevTools (chrome://inspect)

### Useful Dev Tools

#### VS Code Extensions

- **ESLint** - Real-time linting
- **Prettier** - Code formatting
- **Tailwind CSS IntelliSense** - Tailwind class autocomplete
- **TypeScript Vue Plugin** - Vite support
- **Thunder Client** - API testing (alternative to Postman)

#### Terminal Tools

```bash
# Monitor ports
lsof -ti:3007  # macOS/Linux
netstat -ano | findstr :3007  # Windows

# Kill processes on port
npx kill-port 3007

# Watch files
fswatch -o src/ | xargs -n1 -I{} npm test  # macOS
```

#### Browser Tools

- **React DevTools** - Inspect React component tree
- **Redux DevTools** - If using Redux (Automaker uses Zustand)
- ** axe DevTools** - Accessibility testing

### Logging Configuration

#### Server Logging

**Environment Variables:**

```bash
ENABLE_REQUEST_LOGGING=true  # Log HTTP requests
NODE_ENV=development         # Enable debug logs
```

**Winston Logger** (if configured):
Check `apps/server/src/lib/logger.ts` for log levels and configuration.

#### Frontend Logging

**Console Logging:**
Use `console.log()`, `console.error()`, etc. in development.

**Zustand DevTools:**
Automaker uses Zustand with persistence. Check middleware configuration in store setup.

---

## Common Issues

### Dependency Installation Issues

**Problem:** `npm install` fails with permissions errors

**Solution:**

```bash
# macOS/Linux: Fix node-pty permissions
chmod +x node_modules/node-pty/prebuilds/*/spawn-helper

# Or use the postinstall script
node -e "const fs=require('fs');if(process.platform==='darwin'){['darwin-arm64','darwin-x64'].forEach(a=>{const p='node_modules/node-pty/prebuilds/'+a+'/spawn-helper';if(fs.existsSync(p))fs.chmodSync(p,0o755)})}"
```

**Problem:** Lockfile contains SSH URLs

**Solution:**

```bash
# Fix lockfile URLs
npm run fix:lockfile

# Or configure git globally
git config --global url."https://github.com/".insteadOf "git@github.com:"
```

### Port Already in Use

**Problem:** Port 3007 or 3008 already in use

**Solution:**

```bash
# The dev script automatically kills processes on these ports
npm run dev

# Or manually kill
# macOS/Linux
lsof -ti:3007 | xargs kill -9
lsof -ti:3008 | xargs kill -9

# Windows
netstat -ano | findstr :3007
taskkill /F /PID <PID>
```

### Docker Issues

**Problem:** Container cannot access host files

**Explanation:** Default Docker setup is **intentionally isolated** for security.

**Solution:** For development with host access, create `docker-compose.override.yml`:

```yaml
services:
  server:
    volumes:
      - /path/to/your/workspace:/projects:rw
```

**Problem:** Playwright browsers not installed in container

**Solution:** Install in Dockerfile:

```dockerfile
RUN npx playwright install --with-deps chromium
```

### Build Failures

**Problem:** Electron build fails on native modules

**Solution:**

```bash
# Rebuild native modules for current platform
npm run build:electron

# Check electron-rebuild logs in apps/ui/
```

**Problem:** TypeScript compilation errors

**Solution:**

```bash
# Clean and rebuild
rm -rf node_modules dist apps/*/dist
npm install
npm run build:packages
```

### Test Failures

**Problem:** E2E tests fail with "Server not ready"

**Solution:**

```bash
# Check if server is running on port 3008
curl http://localhost:3008/api/health

# Ensure Playwright browsers installed
npx playwright install chromium
```

**Problem:** Unit tests fail with module resolution errors

**Solution:**

```bash
# Rebuild packages
npm run build:packages

# Check TypeScript configuration
cat apps/server/tsconfig.json
cat apps/ui/tsconfig.json
```

### Authentication Issues

**Problem:** "Invalid API key" error

**Solution:**

```bash
# Verify API key is set
echo $ANTHROPIC_API_KEY

# Or check .env file
cat .env | grep ANTHROPIC_API_KEY

# If using Claude Code CLI, verify authentication
claude auth status
```

**Problem:** CORS errors in browser

**Solution:**

```bash
# Set CORS origin in .env
CORS_ORIGIN=http://localhost:3007

# Or in Docker Compose
CORS_ORIGIN=*
```

### Performance Issues

**Problem:** Slow build times

**Solution:**

```bash
# Use pnpm for faster installs (if compatible)
npm install -g pnpm
pnpm install

# Enable Vite cache (automatic)
# Check for node_modules/.vite cache
```

**Problem:** Electron app slow to start

**Solution:**

```bash
# Check for verbose logging
DEBUG=* npm run dev:electron

# Disable unnecessary extensions
# Check Electron main process for blocking operations
```

---

## Deployment

### Build Process

#### Web Application

```bash
npm run build
```

**Output:** `apps/ui/dist/`

**Contents:**

- Static HTML, CSS, JavaScript files
- Optimized and minified for production
- Ready for deployment to any static hosting service

**Deployment Options:**

- Nginx (see `apps/ui/Dockerfile` for example)
- Vercel, Netlify, Cloudflare Pages
- AWS S3 + CloudFront
- Any static file server

#### Desktop Application

```bash
npm run build:electron
```

**Output:** `apps/ui/release/`

**Platform-Specific Outputs:**

**macOS:**

- `.dmg` - Disk image installer
- `.zip` - Archive (x64 + arm64 universal)

**Windows:**

- `.exe` - NSIS installer

**Linux:**

- `.AppImage` - Universal Linux package
- `.deb` - Debian package

**Electron Build Process:**

1. Builds TypeScript server
2. Bundles server with all dependencies
3. Copies shared libraries
4. Creates minimal `package.json` for server
5. Installs production dependencies
6. Rebuilds native modules for target platform
7. Packages with electron-builder

#### Server Only

```bash
npm run build:server
```

**Output:** `apps/server/dist/`

**Deployment:**

```bash
# Run production server
NODE_ENV=production node apps/server/dist/index.js

# Or use PM2
pm2 start apps/server/dist/index.js --name automaker-server
```

### Deployment Targets

#### Docker (Recommended)

**Production Deployment:**

```bash
docker-compose up -d
```

**Security Features:**

- Complete filesystem isolation
- Non-root user execution
- No host network access
- No host filesystem mounts
- Named volumes for data persistence

**Environment Setup:**
Create `.env` in project root:

```bash
ANTHROPIC_API_KEY=sk-ant-...
AUTOMAKER_API_KEY=optional-auth-key
ALLOWED_ROOT_DIRECTORY=/projects
CORS_ORIGIN=https://your-domain.com
```

#### Web Hosting

**Nginx Configuration Example:**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/apps/ui/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3008;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Cloud Platforms

**Vercel/Netlify (Web only):**

1. Connect repository
2. Set build command: `npm run build`
3. Set output directory: `apps/ui/dist`
4. Set environment variables
5. Deploy

**AWS (EC2):**

1. Launch EC2 instance
2. Install Node.js
3. Clone repository
4. Run `npm install && npm run build:server`
5. Use PM2 for process management
6. Configure Nginx reverse proxy

### CI/CD Pipeline Overview

Automaker uses **GitHub Actions** for CI/CD.

#### Workflows (`.github/workflows/`)

**1. Format Check (`format-check.yml`)**

- Trigger: PRs and pushes to main/master
- Runs Prettier formatting check
- Ensures consistent code style

**2. PR Check (`pr-check.yml`)**

- Trigger: PRs and pushes to main/master
- Fast directory-only build check
- Validates build process

**3. E2E Tests (`e2e-tests.yml`)**

- Trigger: PRs and pushes to main/master
- Installs Playwright browsers
- Builds and starts backend server
- Runs E2E tests
- Uploads test reports and results
- Timeout: 15 minutes

**4. Unit Tests (`test.yml`)**

- Trigger: PRs and pushes to main/master
- Runs package tests
- Runs server tests with coverage
- Uses Node.js v22
- Environment: `NODE_ENV=test`

**5. Security Audit (`security-audit.yml`)**

- Trigger: PRs, pushes, and weekly schedule
- Runs `npm audit` with moderate severity threshold
- Weekly security scans on Mondays at 9 AM UTC

**6. Release (`release.yml`)**

- Trigger: GitHub release publication
- Multi-platform builds (Ubuntu, macOS, Windows)
- Builds Electron app for each platform
- Uploads artifacts to GitHub Release
- Version extracted from git tag

**7. Claude Integration (`claude.yml`)**

- Trigger: Issue comments with `@claude`, PR review comments, assigned issues
- Runs Claude Code action for AI-assisted development
- Requires `CLAUDE_CODE_OAUTH_TOKEN` secret

#### Shared Actions

**Setup Project (`.github/actions/setup-project/`)**

- Sets up Node.js v22 with npm caching
- Lockfile lint checking
- Configures Git for HTTPS dependencies
- Installs dependencies
- Rebuilds platform-specific dependencies (node-pty)
- Builds shared packages

#### Release Process

**Creating a Release:**

```bash
# Tag version
git tag v1.0.0
git push origin v1.0.0

# Create GitHub release
gh release create v1.0.0 --notes "Release notes"
```

**CI will automatically:**

1. Detect new tag
2. Update package.json version
3. Build for all platforms
4. Upload artifacts to release
5. Optionally upload to Cloudflare R2

**Release Artifacts:**

- macOS: `.dmg` and `.zip` (universal x64/arm64)
- Windows: `.exe` installer
- Linux: `.AppImage` and `.deb`

---

## Contributing

### How to Contribute

We welcome contributions to Automaker! Here's how to get started:

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
4. **Make changes** following code style guidelines
5. **Test thoroughly** (`npm test` and `npm run lint`)
6. **Commit changes** (`git commit -m 'feat: add amazing feature'`)
7. **Push to your fork** (`git push origin feature/amazing-feature`)
8. **Create Pull Request** with clear description

### Code Style Guidelines

#### TypeScript

- Use **TypeScript** for all new code
- Enable **strict mode** in `tsconfig.json`
- Avoid `any` types (warned by ESLint)
- Use interfaces for object shapes
- Use type aliases for unions/intersections
- Prefer `const` and `let` over `var`

**Example:**

```typescript
// Good
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): User | null {
  // implementation
}

// Bad
function getUser(id: any): any {
  // implementation
}
```

#### React

- Use **functional components** with hooks
- Prefer `useState` over `useReducer` for simple state
- Use `useCallback` and `useMemo` for optimization
- Follow React best practices
- Use TypeScript for props

**Example:**

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled }: ButtonProps) {
  const handleClick = useCallback(() => {
    if (!disabled) {
      onClick();
    }
  }, [onClick, disabled]);

  return (
    <button onClick={handleClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

#### Tailwind CSS

- Use **utility classes** over custom CSS
- Prefer component composition
- Use theme tokens (colors, spacing)
- Avoid arbitrary values when possible

**Example:**

```tsx
// Good
<div className="bg-primary-500 text-white px-4 py-2 rounded-lg">

// Bad
<div className="bg-[#3b82f6] text-[#ffffff] p-[1rem] rounded-[0.5rem]">
```

#### Error Handling

- Always handle errors gracefully
- Use proper error types
- Log errors for debugging
- Show user-friendly error messages

**Example:**

```typescript
try {
  const result = await fetchData();
  return result;
} catch (error) {
  console.error('Failed to fetch data:', error);
  throw new Error('Unable to load data. Please try again later.');
}
```

### Documentation Requirements

#### Code Comments

- **JSDoc comments** for public APIs
- Explain **why**, not **what**
- Keep comments up to date
- Use TODO for future work

**Example:**

```typescript
/**
 * Fetches user data from the API
 * @param userId - The unique identifier of the user
 * @returns Promise<User> - User object with id, name, and email
 * @throws Error if user not found or API error occurs
 */
async function getUser(userId: string): Promise<User> {
  // TODO: Add caching layer
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) {
    throw new Error(`User ${userId} not found`);
  }
  return response.json();
}
```

#### README Updates

When contributing features:

1. Update **README.md** if user-facing
2. Add **technical docs** to `docs/` if complex
3. Update **package.json** scripts if needed
4. Add **environment variables** to documentation

#### API Documentation

For new APIs:

1. Add **JSDoc comments** to all public functions
2. Document **parameters** and **return types**
3. Provide **usage examples**
4. Note any **breaking changes**

### Testing Requirements

#### Test Coverage

- **Server:** 60% lines, 75% functions, 55% branches, 60% statements
- **Libraries:** 90% lines, 95% functions, 85% branches, 90% statements

#### Test Types

1. **Unit Tests** - For individual functions and components
2. **Integration Tests** - For API endpoints and services
3. **E2E Tests** - For critical user workflows

**Example Test Structure:**

```typescript
// Unit test
describe('calculateTotal', () => {
  it('should return sum of all items', () => {
    const result = calculateTotal([1, 2, 3]);
    expect(result).toBe(6);
  });
});

// Integration test
describe('POST /api/features', () => {
  it('should create a new feature', async () => {
    const response = await request(app)
      .post('/api/features')
      .send({ title: 'Test', description: 'Test feature' });
    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Test');
  });
});

// E2E test
test('create feature via UI', async ({ page }) => {
  await page.goto('/board');
  await page.click('[data-testid="new-feature"]');
  await page.fill('[data-testid="title"]', 'Test');
  await page.click('[data-testid="save"]');
  await expect(page.locator('text=Test')).toBeVisible();
});
```

### Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows style guidelines
- [ ] Tests pass locally (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Formatting passes (`npm run format:check`)
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commit messages follow conventional format
- [ ] PR description is clear and detailed
- [ ] All CI checks pass (automated)

### Getting Help

- **Documentation:** Check `docs/` directory
- **Issues:** Search GitHub issues first
- **Discord:** Join [Agentic Jumpstart Discord](https://discord.gg/jjem7aEDKU)
- **Discussions:** Use GitHub Discussions for questions

### License & Contributor Agreement

By contributing to Automaker, you agree that your contributions can be used under the **Automaker License Agreement**. Please review the [LICENSE](LICENSE) file for details.

**Key Points:**

- Core contributors have perpetual, royalty-free licenses
- By contributing, you grant full, irrevocable rights to your code
- See LICENSE for complete terms

---

**Happy coding! 🚀**

For more information, visit the main [README.md](README.md) or check out the [docs/](docs/) directory.
