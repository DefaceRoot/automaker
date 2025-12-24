# Specification: MCP (Model Context Protocol) Server Integration

## Overview

This feature implements a two-tier MCP (Model Context Protocol) server configuration system for the Automaker application. Users will be able to define MCP servers globally in application settings, then selectively enable/disable specific servers on a per-task basis when creating new features via the Kanban board. The implementation must ensure strict isolation where only explicitly enabled MCP servers are loaded into the Claude agent's context window for each specific task, supporting parallel task execution without cross-contamination.

## Workflow Type

**Type**: feature

**Rationale**: This is a substantial new feature requiring changes across multiple layers (types, backend services, API, frontend UI) with new data models, UI components, and integration with the existing Claude Agent SDK. It introduces new user-facing functionality with settings management and task creation workflow modifications.

## Task Scope

### Services Involved
- **server** (primary) - Backend settings management, MCP configuration storage, agent context injection
- **ui** (primary) - Global MCP settings UI, per-task MCP toggle interface in task creation dialog
- **types** (supporting) - Shared TypeScript interfaces for MCP configuration

### This Task Will:
- [ ] Add MCP server configuration types to shared types library
- [ ] Extend GlobalSettings interface with `mcpServers` configuration array
- [ ] Create settings service methods for MCP server CRUD operations
- [ ] Add API routes for MCP server management
- [ ] Create global MCP settings UI panel for server configuration
- [ ] Modify "Add new feature" dialog to include MCP server toggles
- [ ] Integrate per-task MCP selection into agent execution context
- [ ] Ensure strict isolation of MCP servers per task
- [ ] Add validation and testing for context isolation

### Out of Scope:
- Creating custom MCP server implementations
- MCP server health monitoring/alerting
- MCP server auto-discovery
- Authentication token management for MCP servers (deferred to later enhancement)

## Service Context

### Server (Backend)

**Tech Stack:**
- Language: TypeScript
- Framework: Express
- Key directories: `apps/server/src`
- Testing: Vitest

**Entry Point:** `apps/server/src/index.ts`

**How to Run:**
```bash
cd apps/server && npm run dev
```

**Port:** 3000

**Key Dependencies:**
- `@anthropic-ai/claude-agent-sdk` (v0.1.72) - MCP support built-in
- Express for routing
- File-based settings persistence via `{DATA_DIR}/settings.json`

### UI (Frontend)

**Tech Stack:**
- Language: TypeScript
- Framework: React
- Build Tool: Vite
- Styling: Tailwind CSS
- State Management: Zustand
- UI Components: Radix UI

**Entry Point:** `apps/ui/src/main.ts`

**How to Run:**
```bash
cd apps/ui && npm run dev
```

**Port:** 3000 (proxied)

**Key Dependencies:**
- Radix UI (Switch, Checkbox, Dialog, Tabs)
- `@dnd-kit` for drag-and-drop
- Zustand for state management

### Types (Shared Library)

**Location:** `libs/types/src`

**Key Files:**
- `settings.ts` - Global and project settings interfaces

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `libs/types/src/settings.ts` | types | Add `McpServerConfig` interface and `mcpServers` to `GlobalSettings` |
| `libs/types/src/index.ts` | types | Export new MCP types |
| `apps/server/src/services/settings-service.ts` | server | Add MCP server CRUD methods, increment SETTINGS_VERSION |
| `apps/server/src/routes/settings/index.ts` | server | Add MCP-specific API routes |
| `apps/server/src/providers/types.ts` | server | Properly type `ExecuteOptions.mcpServers` field |
| `apps/server/src/providers/base-provider.ts` | server | Pass MCP config to Claude SDK |
| `apps/ui/src/components/views/board-view/dialogs/add-feature-dialog.tsx` | ui | Add MCP server selection UI |
| `apps/ui/src/store/index.ts` | ui | Add MCP settings state slice |
| `apps/ui/src/components/settings/` | ui | Create new MCP settings panel component |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `libs/types/src/settings.ts` | Type definition patterns, settings schema |
| `apps/server/src/services/settings-service.ts` | Settings CRUD operations, migration pattern |
| `apps/ui/src/components/views/board-view/dialogs/add-feature-dialog.tsx` | Dialog component structure, form patterns |
| `apps/server/src/providers/types.ts` | ExecuteOptions pattern for agent configuration |
| `apps/server/src/routes/settings/index.ts` | Express route patterns for settings endpoints |

## Patterns to Follow

### MCP Server Configuration Schema

Based on Claude Agent SDK requirements:

```typescript
// Stdio Transport (local process-based MCP servers)
interface StdioMcpConfig {
  type: 'stdio';
  command: string;      // e.g., "npx", "node"
  args: string[];       // e.g., ["-y", "@modelcontextprotocol/server-filesystem"]
  env?: Record<string, string>;  // Environment variables
}

// HTTP Transport (remote MCP servers)
interface HttpMcpConfig {
  type: 'http';
  url: string;          // e.g., "https://mcp.example.com"
  headers?: Record<string, string>;  // Custom headers
}

// Complete MCP server configuration
interface McpServerConfig {
  id: string;           // Unique identifier
  name: string;         // Display name
  description?: string; // User description
  transport: StdioMcpConfig | HttpMcpConfig;
  enabled: boolean;     // Default enabled state
  createdAt: string;
  updatedAt: string;
}
```

**Key Points:**
- Use discriminated union for transport types
- Include metadata for UI display
- Track default enabled state for quick task setup

### Settings Migration Pattern

From `settings-service.ts`:

```typescript
// Increment version when schema changes
export const SETTINGS_VERSION = 2; // Current is 1, increment to 2

// Add migration logic
if (settings.version < 2) {
  settings.mcpServers = [];
  settings.version = 2;
}
```

### Feature Dialog Extension Pattern

From `add-feature-dialog.tsx`:

```typescript
// Add to dialog state
const [enabledMcpServers, setEnabledMcpServers] = useState<string[]>([]);

// Pass to create feature API call
const createFeature = () => {
  api.createFeature({
    ...featureData,
    enabledMcpServers: enabledMcpServers
  });
};
```

### Tool Naming Convention

Claude Agent SDK requires specific naming format:

```typescript
// MCP tools are named: mcp__servername__toolname
allowedTools: ["mcp__filesystem__read_file", "mcp__context7__get-library-docs"]
```

## Requirements

### Functional Requirements

1. **Global MCP Server Registry**
   - Description: Users can add, edit, and remove MCP server configurations globally
   - Acceptance: Settings UI shows list of configured MCP servers with add/edit/delete actions

2. **Per-Task MCP Server Selection**
   - Description: When creating a new feature/task, users can toggle which MCP servers to enable
   - Acceptance: "Add new feature" dialog includes MCP server checkbox list

3. **Strict Context Isolation**
   - Description: Only selected MCP servers are available to the task's agent
   - Acceptance: Disabled MCP servers do not appear in agent tool list, verified by logging

4. **Parallel Task Support**
   - Description: Multiple concurrent tasks can have different MCP configurations
   - Acceptance: Tasks with different MCP selections operate independently without cross-contamination

5. **Default Enable State**
   - Description: Each MCP server has a default enabled/disabled state for new tasks
   - Acceptance: New task creation pre-populates toggles based on defaults

### Edge Cases

1. **Empty MCP Configuration** - Task creation works normally with no MCP servers configured
2. **Invalid MCP Server** - Gracefully handle failed MCP server connections without crashing task
3. **Server Removal During Active Task** - Active tasks continue with originally-selected servers
4. **Duplicate Server Names** - Enforce unique names/IDs when adding new servers
5. **Transport Type Validation** - Validate stdio command exists, HTTP URL is reachable

## Implementation Notes

### SDK Format Conversion

**IMPORTANT**: The storage format uses a `type` discriminator inside the `transport` field for TypeScript discrimination. When passing to Claude Agent SDK, convert to the SDK's named-object format:

```typescript
// Storage format (McpServerConfig[])
[
  { id: "fs", name: "Filesystem", transport: { type: "stdio", command: "npx", args: [...] }, enabled: true }
]

// SDK format (passed to query options.mcpServers)
{
  "fs": { command: "npx", args: [...], env: {...} },  // No 'type' field
  "remote": { url: "https://...", headers: {...} }    // URL indicates HTTP
}
```

The SDK auto-detects transport type: objects with `command` are stdio, objects with `url` are HTTP.

### DO
- Follow the existing settings service pattern for persistence
- Use Radix UI Switch/Checkbox components for toggles
- Reuse the existing dialog patterns from `add-feature-dialog.tsx`
- Pass MCP config through `ExecuteOptions` to agent initialization
- Convert storage format to SDK format when passing to agent (strip `type` field)
- Use Zustand for MCP settings state management
- Log MCP server loading for debugging and verification
- Increment SETTINGS_VERSION for migration

### DON'T
- Create new persistence mechanisms - use existing settings.json pattern
- Bypass the permissions model unless explicitly configured
- Spawn MCP server processes without cleanup handlers
- Store sensitive credentials in plain text (mark for future encryption)
- Modify agent behavior for tasks already in progress

## Development Environment

### Start Services

```bash
# From project root
pnpm install

# Start server
cd apps/server && npm run dev

# Start UI (in separate terminal)
cd apps/ui && npm run dev
```

### Service URLs
- Server API: http://localhost:3000
- UI: http://localhost:5173 (Vite dev server)

### Required Environment Variables
- `ANTHROPIC_API_KEY`: API key for Claude (required)
- `DATA_DIR`: Directory for settings persistence
- `CORS_ORIGIN`: Frontend URL for CORS

### Test MCP Server (for development)
```bash
# Install a test MCP server
npx -y @modelcontextprotocol/server-filesystem ./test-directory
```

## Success Criteria

The task is complete when:

1. [ ] Global MCP settings UI allows adding stdio and HTTP transport MCP servers
2. [ ] MCP servers can be edited and deleted from settings
3. [ ] "Add new feature" dialog shows MCP server toggles
4. [ ] Task creation API accepts `enabledMcpServers` array
5. [ ] Agent initialization only includes selected MCP servers
6. [ ] Parallel tasks maintain separate MCP configurations
7. [ ] Console logs confirm correct MCP server loading per task
8. [ ] No console errors during MCP operations
9. [ ] Existing tests still pass
10. [ ] New functionality verified via browser interaction

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| MCP Config Type Validation | `apps/server/tests/unit/services/settings-service.test.ts` | McpServerConfig interface correctly validates |
| Settings Service MCP CRUD | `apps/server/tests/unit/services/settings-service.test.ts` | Add/update/delete MCP servers works |
| Settings Migration | `apps/server/tests/unit/services/settings-service.test.ts` | Version 2 migration adds mcpServers array |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| MCP Settings API | server | GET/PUT /settings/global returns mcpServers |
| Task Creation with MCP | server | POST /features/create accepts enabledMcpServers |
| Agent MCP Injection | server ↔ Claude SDK | Only enabled servers passed to agent |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Add MCP Server | 1. Open settings 2. Add stdio MCP server 3. Save | Server appears in list |
| Toggle MCP in Task | 1. Click "Add feature" 2. Toggle MCP servers 3. Create task | Task has correct MCP config |
| Parallel Task Isolation | 1. Create task A with MCP-1 2. Create task B with MCP-2 3. Run both | Each task only sees its MCPs |

### Browser Verification (if frontend)
| Page/Component | URL | Checks |
|----------------|-----|--------|
| MCP Settings Panel | `http://localhost:5173/settings` | MCP server list displays, add/edit/delete works |
| Add Feature Dialog | `http://localhost:5173/` (Kanban board) | MCP toggles visible, state persists through creation |

### Database Verification (if applicable)
| Check | Query/Command | Expected |
|-------|---------------|----------|
| Settings file updated | `cat {DATA_DIR}/settings.json` | Contains `mcpServers` array |
| Feature data includes MCP | Check feature JSON file | Contains `enabledMcpServers` field |

### QA Sign-off Requirements
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Browser verification complete
- [ ] MCP server isolation verified via console logs
- [ ] Parallel tasks tested with different MCP configs
- [ ] No regressions in existing functionality
- [ ] Code follows established patterns
- [ ] No security vulnerabilities introduced (no credential exposure)

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend (UI)                             │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │   Settings Panel    │    │     Add Feature Dialog         │  │
│  │  ┌───────────────┐  │    │  ┌──────────────────────────┐  │  │
│  │  │ MCP Server    │  │    │  │ MCP Server Toggles       │  │  │
│  │  │ Registry      │  │    │  │ [ ] context7             │  │  │
│  │  │ - Add         │  │    │  │ [x] filesystem           │  │  │
│  │  │ - Edit        │  │    │  │ [ ] postgres             │  │  │
│  │  │ - Delete      │  │    │  └──────────────────────────┘  │  │
│  │  └───────────────┘  │    └────────────────────────────────┘  │
│  └─────────────────────┘                                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │ API Calls
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Backend (Server)                           │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │  Settings Service   │    │    Feature Service             │  │
│  │  - getMcpServers()  │    │    - createFeature(mcpIds[])   │  │
│  │  - addMcpServer()   │    │    - Stores enabledMcpServers  │  │
│  │  - updateMcpServer()│    └────────────────────────────────┘  │
│  │  - deleteMcpServer()│                  │                      │
│  └─────────────────────┘                  ▼                      │
│                              ┌────────────────────────────────┐  │
│                              │    Agent Execution             │  │
│                              │    - Filters MCP by task config │  │
│                              │    - Passes to Claude SDK       │  │
│                              └────────────────────────────────┘  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Selected MCPs Only
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Claude Agent SDK                               │
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │ MCP Server 1        │    │ MCP Server 2                   │  │
│  │ (filesystem)        │    │ (context7)                     │  │
│  │ - Only if enabled   │    │ - Only if enabled              │  │
│  └─────────────────────┘    └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Settings Configuration**
   - User opens Settings → MCP panel
   - User adds MCP server config (name, transport type, command/URL)
   - Settings service persists to `{DATA_DIR}/settings.json`

2. **Task Creation**
   - User clicks "Add new feature"
   - Dialog loads available MCP servers from settings
   - User toggles desired MCP servers for this task
   - Feature created with `enabledMcpServers: ["server-id-1", "server-id-2"]`

3. **Agent Execution**
   - Agent service receives task with `enabledMcpServers`
   - Filters global MCP config to only enabled servers
   - Passes filtered config to Claude SDK agent initialization
   - Agent can only access tools from enabled MCP servers

4. **Isolation Verification**
   - Each task runs with independent MCP configuration
   - Log messages confirm which MCP servers are loaded
   - Tools from disabled servers are not available
