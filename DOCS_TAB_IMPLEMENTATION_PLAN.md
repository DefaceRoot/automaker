# Implementation Plan: Documents Tab for Automaker

## Overview

Add a "Documents" tab to the Automaker sidebar that generates comprehensive project documentation using parallel Claude agents. Users click "Generate Docs" to spawn 6 agents that analyze the codebase and create in-depth documentation files, viewable in a human-readable markdown viewer.

## User Requirements Summary

- New "Documents" tab in left sidebar (Tools section)
- Single "Generate Docs" button spawns 6 parallel Claude agents
- Generates docs for the user's currently open project
- Overwrites existing docs on regeneration
- Human-readable markdown viewer (not raw markdown with hashtags)
- Docs stored in `/docs` folder in project root

## Generated Documentation Files

| File                        | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| `PROJECT_OVERVIEW.md`       | High-level summary, tech stack, features    |
| `ARCHITECTURE.md`           | System design, component diagrams, patterns |
| `API_REFERENCE.md`          | All endpoints, params, responses, examples  |
| `DIRECTORY_STRUCTURE.md`    | Folder organization with explanations       |
| `MODULES_AND_COMPONENTS.md` | Module details, functions, dependencies     |
| `SETUP_AND_DEVELOPMENT.md`  | Installation, dev environment, testing      |

---

## Architecture Context

### Existing Patterns to Follow

**Sidebar Navigation:** `apps/ui/src/components/layout/sidebar/hooks/use-navigation.ts`

- Navigation items are defined in `allToolsItems` array
- Each item has: `id`, `label`, `icon`, optional `shortcut`
- Icons imported from `lucide-react`

**Routes:** File-based routing with TanStack Router

- Route files in `apps/ui/src/routes/[name].tsx`
- Each exports a `Route` created with `createFileRoute`

**View Components:** `apps/ui/src/components/views/[name]-view.tsx`

- Standard pattern with header, content area
- Uses `useAppStore()` for state
- Conditional rendering for no project / loading states

**Services:** `apps/server/src/services/[name]-service.ts`

- Injected into route handlers
- Use EventEmitter for progress streaming
- Reference: `auto-mode-service.ts` for agent spawning pattern

**Event System:** `libs/types/src/event.ts`

- EventType union for all event types
- WebSocket at `/api/events` broadcasts to UI clients

**State Management:** Zustand store at `apps/ui/src/store/app-store.ts`

- Per-project state keyed by project path
- Actions for state updates

**HTTP API Client:** `apps/ui/src/lib/http-api-client.ts`

- Namespaced API methods (e.g., `api.autoMode.start()`)
- WebSocket event subscription via `subscribeToEvent`

---

## Implementation Steps

### Step 1: Add Event Types

**File:** `libs/types/src/event.ts`

Add these event types to the `EventType` union:

```typescript
| 'docs:generation-started'
| 'docs:doc-progress'
| 'docs:doc-completed'
| 'docs:doc-error'
| 'docs:generation-completed'
```

---

### Step 2: Create DocsService

**File:** `apps/server/src/services/docs-service.ts` (new)

```typescript
import type { EventEmitter } from '../lib/events';
import { secureFs } from '../lib/secure-fs';
import path from 'path';

export type DocType =
  | 'project-overview'
  | 'architecture'
  | 'api-reference'
  | 'directory-structure'
  | 'modules-components'
  | 'setup-development';

interface DocGenerationState {
  projectPath: string;
  abortController: AbortController;
  docStatuses: Record<DocType, 'pending' | 'running' | 'completed' | 'error'>;
  startTime: number;
}

export class DocsService {
  private events: EventEmitter;
  private runningGenerations: Map<string, DocGenerationState> = new Map();

  constructor(events: EventEmitter) {
    this.events = events;
  }

  async generateDocs(projectPath: string): Promise<void> {
    // Implementation: spawn 6 parallel agents, emit events, write files
  }

  async stopGeneration(projectPath: string): Promise<void> {
    // Abort running generation
  }

  async getDocContent(projectPath: string, docType: DocType): Promise<string | null> {
    // Read doc file from {projectPath}/docs/{filename}.md
  }

  async listDocs(projectPath: string): Promise<DocType[]> {
    // List existing docs in /docs folder
  }

  getStatus(): { generating: string[] } {
    // Return list of projects currently generating
  }

  private async runDocAgent(
    projectPath: string,
    docType: DocType,
    abortController: AbortController
  ): Promise<string> {
    // Use ClaudeProvider pattern from auto-mode-service
    // Return generated markdown content
  }

  private emitDocsEvent(eventType: string, data: Record<string, unknown>): void {
    this.events.emit('docs:event' as any, { type: eventType, ...data });
  }

  private getFilename(docType: DocType): string {
    const filenames: Record<DocType, string> = {
      'project-overview': 'PROJECT_OVERVIEW.md',
      architecture: 'ARCHITECTURE.md',
      'api-reference': 'API_REFERENCE.md',
      'directory-structure': 'DIRECTORY_STRUCTURE.md',
      'modules-components': 'MODULES_AND_COMPONENTS.md',
      'setup-development': 'SETUP_AND_DEVELOPMENT.md',
    };
    return filenames[docType];
  }
}
```

**Key Implementation Details:**

1. **Parallel Execution:**

```typescript
const promises = docTypes.map((docType) => this.runDocAgent(projectPath, docType, abortController));
await Promise.allSettled(promises);
```

2. **Agent Spawning:** Follow the pattern in `auto-mode-service.ts` `runAgent()` method
   - Create provider with `ProviderFactory.getProviderForModel()`
   - Use `executeWithStreaming()` for real-time output
   - Emit progress events during execution

3. **File Writing:**

```typescript
const docsDir = path.join(projectPath, 'docs');
await secureFs.mkdir(docsDir, { recursive: true });
await secureFs.writeFile(path.join(docsDir, filename), content, 'utf-8');
```

---

### Step 3: Create Documentation Prompts

**File:** `apps/server/src/services/docs-prompts.ts` (new)

```typescript
import type { DocType } from './docs-service';

export const DOC_PROMPTS: Record<DocType, string> = {
  'project-overview': `You are a technical writer analyzing a codebase to create comprehensive documentation.

Your task is to generate PROJECT_OVERVIEW.md with the following structure:

# [Project Name]

## Overview
[1-2 paragraph description of what the project does, who it's for, and its primary purpose]

## Key Features
- Feature 1: Brief description
- Feature 2: Brief description
[List 4-8 key features]

## Technology Stack
- **Language(s)**: [List primary programming languages used]
- **Framework(s)**: [List major frameworks]
- **Database**: [If applicable]
- **Key Libraries/Tools**: [Important dependencies]

## Quick Stats
- **Project Type**: [Web App / CLI Tool / Library / Backend Service / etc.]
- **Main Language**: [Primary language]

## Getting Started
[Brief overview of the most common first steps]

## Architecture Highlights
[1-2 sentences about key architectural decisions]

## Core Modules
[Brief list of main modules/components - 1 sentence each]

## What's Documented
- Complete project architecture
- Full API reference
- Directory structure and organization
- Module and component descriptions
- Setup and development guide

---

Analyze the codebase thoroughly. Read package.json, README.md, and key source files to understand the project. Include REAL information from the actual codebase, not placeholders.`,

  architecture: `You are a software architect documenting system design.

Your task is to generate ARCHITECTURE.md with the following structure:

# Architecture

## System Overview
[Detailed explanation of how the system works at a high level]

### Architecture Diagram
[ASCII diagram of major components and their relationships]

## Core Components
### [Component 1 Name]
- **Responsibility**: What it does
- **Technology**: What it's built with
- **Interfaces**: How it communicates with other components
- **Key Files**: Important source files

[Repeat for each major component]

## Data Flow
[Describe how data moves through the system with examples]

## Design Patterns
- **Pattern 1**: [Name and where used]
- **Pattern 2**: [Name and where used]

## Technology Decisions
### [Technology Choice]
**Why**: [Reasoning]
**Benefits**: [Key benefits]
**Trade-offs**: [Any limitations]

## Security Architecture
[Overview of security measures, authentication, authorization]

## Deployment Architecture
[How the system is deployed]

---

Explore the codebase structure, analyze key files, understand the component relationships, and document the actual architecture.`,

  'api-reference': `You are an API documentation specialist.

Your task is to generate API_REFERENCE.md documenting ALL API endpoints:

# API Reference

## Overview
[Brief description of the API, base URL pattern]

## Authentication
[How to authenticate - if applicable]

## Endpoints

### [Resource Name]

#### GET /[endpoint]
**Description**: [What this endpoint does]
**Parameters**:
- \`param1\` (type, required/optional): Description
**Response**:
\`\`\`json
{
  "example": "response"
}
\`\`\`
**Example Request**:
\`\`\`bash
curl -X GET "http://localhost:3000/api/endpoint"
\`\`\`

[Document EVERY endpoint found in the codebase]

## Error Codes
| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | [Description] |
[List all error codes used]

---

Search for all route files, API handlers, and endpoints. Document EVERY endpoint with actual request/response formats.`,

  'directory-structure': `You are documenting project organization.

Your task is to generate DIRECTORY_STRUCTURE.md:

# Directory Structure

## Overview
\`\`\`
project-root/
├── [folder]/                # [Purpose]
├── [folder]/                # [Purpose]
└── [file]                   # [Purpose]
\`\`\`

## Detailed Directory Breakdown

### \`/[directory]\`
**Purpose**: [What this directory contains]
**Contents**:
- \`file1\` - [Description]
- \`file2\` - [Description]
**When to use**: [When to look here]

[Repeat for each major directory]

### Root Level Files
**\`package.json\`**: [Description]
**\`tsconfig.json\`**: [Description]
[List all important root files]

## Dependency Graph
[Simple text representation of how main components depend on each other]

## Data Flow Through Directories
[Description of how requests/data flow through the directory structure]

---

List the actual directory structure using file system exploration. Document the REAL structure, not a template.`,

  'modules-components': `You are documenting code modules and components.

Your task is to generate MODULES_AND_COMPONENTS.md:

# Modules and Components

## Overview
[Brief description of the module organization]

## [Module/Component Name]

**File(s)**: \`src/path/to/file.ts\`

**Purpose**: [Clear description of what this module does]

**Responsibilities**:
- Responsibility 1
- Responsibility 2

**Key Functions/Methods**:

### \`functionName(param: Type): ReturnType\`
**Purpose**: [What this function does]
**Parameters**:
- \`param\` (Type): Description
**Returns**: \`ReturnType\` - Description
**Example**:
\`\`\`typescript
const result = functionName(value);
\`\`\`

**Dependencies**:
- \`module1\` - Why needed

**Used By**:
- \`module2\` - How used

[Repeat for each major module/component]

## Component Dependency Graph
[Text representation of how components depend on each other]

## Communication Patterns
[How modules communicate with each other]

---

Analyze the actual source code. Document REAL functions, classes, and their signatures.`,

  'setup-development': `You are writing developer onboarding documentation.

Your task is to generate SETUP_AND_DEVELOPMENT.md:

# Setup and Development Guide

## Prerequisites
- **[Requirement]** version [X.X.X] or higher
[List all prerequisites with versions]

## Installation

### Step 1: Clone the Repository
\`\`\`bash
git clone [repository-url]
cd [project-name]
\`\`\`

### Step 2: Install Dependencies
\`\`\`bash
[actual install command from package.json]
\`\`\`

### Step 3: Environment Setup
[Copy and configure .env file - list actual required variables]

### Step 4: Database Setup (if applicable)
[Actual database setup commands]

### Step 5: Verify Installation
\`\`\`bash
[actual dev command]
\`\`\`

## Development

### Running the Development Server
\`\`\`bash
[actual command from package.json scripts]
\`\`\`

### Code Style and Formatting
[Actual linting/formatting tools used]

### Git Workflow
[Branching strategy if discoverable]

## Testing

### Running Tests
\`\`\`bash
[actual test commands from package.json]
\`\`\`

## Building for Production
\`\`\`bash
[actual build command]
\`\`\`

## Environment Variables Reference
| Variable | Type | Required | Description |
|----------|------|----------|-------------|
[List actual env variables from .env.example or code]

## Troubleshooting
[Common issues and solutions]

## Useful Commands
| Command | Description |
|---------|-------------|
[List all npm scripts from package.json]

---

Read package.json, README.md, .env.example, and configuration files. Document the ACTUAL setup process.`,
};
```

---

### Step 4: Create API Routes

**Directory:** `apps/server/src/routes/docs/` (new)

**File: `index.ts`**

```typescript
import express from 'express';
import type { DocsService } from '../../services/docs-service';
import { createGenerateHandler } from './routes/generate';
import { createStopHandler } from './routes/stop';
import { createListHandler } from './routes/list';
import { createContentHandler } from './routes/content';
import { createStatusHandler } from './routes/status';

export function createDocsRoutes(docsService: DocsService) {
  const router = express.Router();

  router.post('/generate', createGenerateHandler(docsService));
  router.post('/stop', createStopHandler(docsService));
  router.post('/list', createListHandler(docsService));
  router.post('/content', createContentHandler(docsService));
  router.get('/status', createStatusHandler(docsService));

  return router;
}
```

**File: `routes/generate.ts`**

```typescript
import type { Request, Response } from 'express';
import type { DocsService } from '../../../services/docs-service';

export function createGenerateHandler(docsService: DocsService) {
  return async (req: Request, res: Response): Promise<void> => {
    const { projectPath } = req.body;

    if (!projectPath) {
      res.status(400).json({ success: false, error: 'projectPath is required' });
      return;
    }

    // Start generation in background (don't await)
    docsService.generateDocs(projectPath).catch((error) => {
      console.error(`Docs generation error for ${projectPath}:`, error);
    });

    res.json({ success: true, message: 'Documentation generation started' });
  };
}
```

**File: `routes/stop.ts`**

```typescript
import type { Request, Response } from 'express';
import type { DocsService } from '../../../services/docs-service';

export function createStopHandler(docsService: DocsService) {
  return async (req: Request, res: Response): Promise<void> => {
    const { projectPath } = req.body;

    if (!projectPath) {
      res.status(400).json({ success: false, error: 'projectPath is required' });
      return;
    }

    await docsService.stopGeneration(projectPath);
    res.json({ success: true });
  };
}
```

**File: `routes/list.ts`**

```typescript
import type { Request, Response } from 'express';
import type { DocsService } from '../../../services/docs-service';

export function createListHandler(docsService: DocsService) {
  return async (req: Request, res: Response): Promise<void> => {
    const { projectPath } = req.body;

    if (!projectPath) {
      res.status(400).json({ success: false, error: 'projectPath is required' });
      return;
    }

    const docs = await docsService.listDocs(projectPath);
    res.json({ success: true, docs });
  };
}
```

**File: `routes/content.ts`**

```typescript
import type { Request, Response } from 'express';
import type { DocsService } from '../../../services/docs-service';

export function createContentHandler(docsService: DocsService) {
  return async (req: Request, res: Response): Promise<void> => {
    const { projectPath, docType } = req.body;

    if (!projectPath || !docType) {
      res.status(400).json({ success: false, error: 'projectPath and docType are required' });
      return;
    }

    const content = await docsService.getDocContent(projectPath, docType);

    if (content === null) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    res.json({ success: true, content });
  };
}
```

**File: `routes/status.ts`**

```typescript
import type { Request, Response } from 'express';
import type { DocsService } from '../../../services/docs-service';

export function createStatusHandler(docsService: DocsService) {
  return async (_req: Request, res: Response): Promise<void> => {
    const status = docsService.getStatus();
    res.json({ success: true, ...status });
  };
}
```

---

### Step 5: Register Routes in Server

**File:** `apps/server/src/index.ts`

Add imports and route registration:

```typescript
import { DocsService } from './services/docs-service';
import { createDocsRoutes } from './routes/docs';

// In server setup (after events creation):
const docsService = new DocsService(events);

// Register routes:
app.use('/api/docs', createDocsRoutes(docsService));
```

---

### Step 6: Extend HTTP API Client

**File:** `apps/ui/src/lib/http-api-client.ts`

Add docs namespace:

```typescript
docs = {
  generate: (projectPath: string): Promise<{ success: boolean; error?: string }> =>
    this.post('/api/docs/generate', { projectPath }),

  stop: (projectPath: string): Promise<{ success: boolean; error?: string }> =>
    this.post('/api/docs/stop', { projectPath }),

  list: (projectPath: string): Promise<{ success: boolean; docs?: string[]; error?: string }> =>
    this.post('/api/docs/list', { projectPath }),

  getContent: (
    projectPath: string,
    docType: string
  ): Promise<{ success: boolean; content?: string; error?: string }> =>
    this.post('/api/docs/content', { projectPath, docType }),

  status: (): Promise<{ success: boolean; generating?: string[]; error?: string }> =>
    this.get('/api/docs/status'),

  onEvent: (callback: (event: DocsEvent) => void) => {
    return this.subscribeToEvent('docs:event' as EventType, callback as EventCallback);
  },
};
```

---

### Step 7: Add Store State

**File:** `apps/ui/src/store/app-store.ts`

Add to interface and implementation:

```typescript
// In AppState interface:
docsGeneratingByProject: Record<string, boolean>;
docsProgressByProject: Record<string, Record<string, 'pending' | 'running' | 'completed' | 'error'>>;

// In AppActions interface:
setDocsGenerating: (projectPath: string, isGenerating: boolean) => void;
setDocProgress: (projectPath: string, docType: string, status: 'pending' | 'running' | 'completed' | 'error') => void;
clearDocsProgress: (projectPath: string) => void;

// In create() implementation - initial state:
docsGeneratingByProject: {},
docsProgressByProject: {},

// In create() implementation - actions:
setDocsGenerating: (projectPath, isGenerating) =>
  set((state) => ({
    docsGeneratingByProject: {
      ...state.docsGeneratingByProject,
      [projectPath]: isGenerating,
    },
  })),

setDocProgress: (projectPath, docType, status) =>
  set((state) => ({
    docsProgressByProject: {
      ...state.docsProgressByProject,
      [projectPath]: {
        ...state.docsProgressByProject[projectPath],
        [docType]: status,
      },
    },
  })),

clearDocsProgress: (projectPath) =>
  set((state) => {
    const { [projectPath]: _, ...rest } = state.docsProgressByProject;
    return { docsProgressByProject: rest };
  }),
```

---

### Step 8: Create useDocsEvents Hook

**File:** `apps/ui/src/hooks/use-docs-events.ts` (new)

```typescript
import { useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { getHttpApiClient } from '@/lib/http-api-client';

interface DocsEvent {
  type: string;
  projectPath: string;
  docType?: string;
  error?: string;
}

interface UseDocsEventsProps {
  onGenerationStarted?: () => void;
  onDocProgress?: (docType: string) => void;
  onDocCompleted?: (docType: string) => void;
  onDocError?: (docType: string, error: string) => void;
  onGenerationCompleted?: () => void;
}

export function useDocsEvents({
  onGenerationStarted,
  onDocProgress,
  onDocCompleted,
  onDocError,
  onGenerationCompleted,
}: UseDocsEventsProps = {}) {
  const { currentProject, setDocsGenerating, setDocProgress, clearDocsProgress } = useAppStore();

  useEffect(() => {
    const api = getHttpApiClient();
    if (!api || !currentProject?.path) return;

    const unsubscribe = api.docs.onEvent((event: DocsEvent) => {
      if (event.projectPath !== currentProject.path) return;

      switch (event.type) {
        case 'generation-started':
          setDocsGenerating(event.projectPath, true);
          onGenerationStarted?.();
          break;

        case 'doc-progress':
          if (event.docType) {
            setDocProgress(event.projectPath, event.docType, 'running');
            onDocProgress?.(event.docType);
          }
          break;

        case 'doc-completed':
          if (event.docType) {
            setDocProgress(event.projectPath, event.docType, 'completed');
            onDocCompleted?.(event.docType);
          }
          break;

        case 'doc-error':
          if (event.docType) {
            setDocProgress(event.projectPath, event.docType, 'error');
            onDocError?.(event.docType, event.error || 'Unknown error');
          }
          break;

        case 'generation-completed':
          setDocsGenerating(event.projectPath, false);
          onGenerationCompleted?.();
          break;
      }
    });

    return unsubscribe;
  }, [currentProject?.path]);
}
```

---

### Step 9: Create Route File

**File:** `apps/ui/src/routes/docs.tsx` (new)

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { DocsView } from '@/components/views/docs-view';

export const Route = createFileRoute('/docs')({
  component: DocsView,
});
```

---

### Step 10: Add Sidebar Navigation

**File:** `apps/ui/src/components/layout/sidebar/hooks/use-navigation.ts`

Add import:

```typescript
import { FileStack } from 'lucide-react';
```

Add to `allToolsItems` array:

```typescript
const allToolsItems: NavItem[] = [
  {
    id: 'spec',
    label: 'Spec Editor',
    icon: FileText,
    shortcut: shortcuts.spec,
  },
  {
    id: 'context',
    label: 'Context',
    icon: BookOpen,
    shortcut: shortcuts.context,
  },
  {
    id: 'profiles',
    label: 'AI Profiles',
    icon: UserCircle,
    shortcut: shortcuts.profiles,
  },
  // ADD THIS:
  {
    id: 'docs',
    label: 'Documents',
    icon: FileStack,
  },
];
```

---

### Step 11: Create DocsView Component

**File:** `apps/ui/src/components/views/docs-view.tsx` (new)

```typescript
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FileStack, Play, Square } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { getHttpApiClient } from '@/lib/http-api-client';
import { useDocsEvents } from '@/hooks/use-docs-events';
import { DocSidebar } from './docs-view/doc-sidebar';
import { DocMarkdown } from '@/components/ui/doc-markdown';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type DocType =
  | 'project-overview'
  | 'architecture'
  | 'api-reference'
  | 'directory-structure'
  | 'modules-components'
  | 'setup-development';

const DOC_ORDER: { type: DocType; label: string }[] = [
  { type: 'project-overview', label: 'Project Overview' },
  { type: 'architecture', label: 'Architecture' },
  { type: 'api-reference', label: 'API Reference' },
  { type: 'directory-structure', label: 'Directory Structure' },
  { type: 'modules-components', label: 'Modules & Components' },
  { type: 'setup-development', label: 'Setup & Development' },
];

export function DocsView() {
  const { currentProject, docsGeneratingByProject, docsProgressByProject } = useAppStore();
  const [availableDocs, setAvailableDocs] = useState<DocType[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocType | null>(null);
  const [docContent, setDocContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const isGenerating = currentProject?.path
    ? docsGeneratingByProject[currentProject.path] ?? false
    : false;

  const docProgress = currentProject?.path
    ? docsProgressByProject[currentProject.path] ?? {}
    : {};

  // Subscribe to docs events
  useDocsEvents({
    onGenerationCompleted: () => {
      toast({ title: 'Documentation generated successfully!' });
      loadDocsList();
    },
    onDocError: (docType, error) => {
      toast({ title: `Error generating ${docType}`, description: error, variant: 'destructive' });
    },
  });

  // Load list of available docs
  const loadDocsList = useCallback(async () => {
    if (!currentProject?.path) return;

    const api = getHttpApiClient();
    const result = await api.docs.list(currentProject.path);
    if (result.success && result.docs) {
      setAvailableDocs(result.docs as DocType[]);
      // Auto-select first doc if none selected
      if (!selectedDoc && result.docs.length > 0) {
        setSelectedDoc(result.docs[0] as DocType);
      }
    }
  }, [currentProject?.path, selectedDoc]);

  // Load selected doc content
  const loadDocContent = useCallback(async () => {
    if (!currentProject?.path || !selectedDoc) {
      setDocContent('');
      return;
    }

    setIsLoading(true);
    const api = getHttpApiClient();
    const result = await api.docs.getContent(currentProject.path, selectedDoc);
    if (result.success && result.content) {
      setDocContent(result.content);
    } else {
      setDocContent('');
    }
    setIsLoading(false);
  }, [currentProject?.path, selectedDoc]);

  useEffect(() => {
    loadDocsList();
  }, [loadDocsList]);

  useEffect(() => {
    loadDocContent();
  }, [loadDocContent]);

  const handleGenerate = async () => {
    if (!currentProject?.path) return;

    const api = getHttpApiClient();
    await api.docs.generate(currentProject.path);
    toast({ title: 'Documentation generation started...' });
  };

  const handleStop = async () => {
    if (!currentProject?.path) return;

    const api = getHttpApiClient();
    await api.docs.stop(currentProject.path);
    toast({ title: 'Documentation generation stopped' });
  };

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center content-bg">
        <div className="text-center text-muted-foreground">
          <FileStack className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Open a project to generate documentation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col content-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-glass backdrop-blur-md">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileStack className="w-5 h-5" />
            Documents
          </h1>
          <p className="text-sm text-muted-foreground">{currentProject.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {isGenerating ? (
            <Button onClick={handleStop} variant="destructive" size="sm">
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button onClick={handleGenerate} size="sm">
              <Play className="w-4 h-4 mr-2" />
              Generate Docs
            </Button>
          )}
          <Button onClick={loadDocsList} variant="ghost" size="sm">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <DocSidebar
          docs={DOC_ORDER}
          availableDocs={availableDocs}
          selectedDoc={selectedDoc}
          onSelectDoc={setSelectedDoc}
          docProgress={docProgress}
        />

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : docContent ? (
            <DocMarkdown>{docContent}</DocMarkdown>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileStack className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg mb-2">No documentation yet</p>
              <p className="text-sm">Click "Generate Docs" to create documentation for this project</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### Step 12: Create Doc Sidebar Component

**File:** `apps/ui/src/components/views/docs-view/doc-sidebar.tsx` (new)

```typescript
import {
  FileText,
  GitBranch,
  Code,
  Folder,
  Package,
  Settings,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DocType =
  | 'project-overview'
  | 'architecture'
  | 'api-reference'
  | 'directory-structure'
  | 'modules-components'
  | 'setup-development';

interface DocSidebarProps {
  docs: { type: DocType; label: string }[];
  availableDocs: DocType[];
  selectedDoc: DocType | null;
  onSelectDoc: (docType: DocType) => void;
  docProgress: Record<string, 'pending' | 'running' | 'completed' | 'error'>;
}

const DOC_ICONS: Record<DocType, typeof FileText> = {
  'project-overview': FileText,
  'architecture': GitBranch,
  'api-reference': Code,
  'directory-structure': Folder,
  'modules-components': Package,
  'setup-development': Settings,
};

export function DocSidebar({
  docs,
  availableDocs,
  selectedDoc,
  onSelectDoc,
  docProgress,
}: DocSidebarProps) {
  const getStatusIcon = (docType: DocType) => {
    const status = docProgress[docType];
    const isAvailable = availableDocs.includes(docType);

    if (status === 'running') {
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    }
    if (status === 'error') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    if (status === 'completed' || isAvailable) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (status === 'pending') {
      return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
    return null;
  };

  return (
    <div className="w-64 border-r border-border flex flex-col bg-background/50">
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-medium text-muted-foreground">Documentation</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {docs.map((doc) => {
          const Icon = DOC_ICONS[doc.type];
          const isSelected = selectedDoc === doc.type;
          const isAvailable = availableDocs.includes(doc.type);

          return (
            <button
              key={doc.type}
              onClick={() => onSelectDoc(doc.type)}
              disabled={!isAvailable && !docProgress[doc.type]}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-2 text-left text-sm transition-colors',
                isSelected
                  ? 'bg-primary/20 border-l-2 border-primary text-primary-foreground'
                  : 'hover:bg-muted/50',
                !isAvailable && !docProgress[doc.type] && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">{doc.label}</span>
              {getStatusIcon(doc.type)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

---

### Step 13: Create Enhanced Markdown Viewer

**File:** `apps/ui/src/components/ui/doc-markdown.tsx` (new)

```typescript
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface DocMarkdownProps {
  children: string;
  className?: string;
}

export function DocMarkdown({ children, className }: DocMarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-sm prose-invert max-w-none',
        // Enhanced heading styles
        '[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-3 [&_h1]:mb-6',
        '[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:border-border/50 [&_h2]:pb-2',
        '[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3',
        '[&_h4]:text-lg [&_h4]:font-medium [&_h4]:mt-6 [&_h4]:mb-2',
        // Paragraph styles
        '[&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:my-4',
        // List styles
        '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4',
        '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4',
        '[&_li]:my-1 [&_li]:text-muted-foreground',
        // Table styles
        '[&_table]:w-full [&_table]:border-collapse [&_table]:my-6',
        '[&_th]:bg-muted [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:border [&_th]:border-border',
        '[&_td]:px-4 [&_td]:py-2 [&_td]:border [&_td]:border-border [&_td]:text-muted-foreground',
        '[&_tr:nth-child(even)]:bg-muted/30',
        // Code styles
        '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono',
        '[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-4',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        // Blockquote styles
        '[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4',
        // Link styles
        '[&_a]:text-primary [&_a]:underline [&_a]:hover:text-primary/80',
        // Horizontal rule
        '[&_hr]:border-border [&_hr]:my-8',
        className
      )}
    >
      <ReactMarkdown
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
```

---

## File Summary

### New Files (13)

| Path                                                     | Description                           |
| -------------------------------------------------------- | ------------------------------------- |
| `apps/server/src/services/docs-service.ts`               | Core documentation generation service |
| `apps/server/src/services/docs-prompts.ts`               | Agent prompts for each doc type       |
| `apps/server/src/routes/docs/index.ts`                   | Route definitions                     |
| `apps/server/src/routes/docs/routes/generate.ts`         | Generate endpoint                     |
| `apps/server/src/routes/docs/routes/stop.ts`             | Stop endpoint                         |
| `apps/server/src/routes/docs/routes/list.ts`             | List endpoint                         |
| `apps/server/src/routes/docs/routes/content.ts`          | Content endpoint                      |
| `apps/server/src/routes/docs/routes/status.ts`           | Status endpoint                       |
| `apps/ui/src/routes/docs.tsx`                            | Route definition                      |
| `apps/ui/src/components/views/docs-view.tsx`             | Main view component                   |
| `apps/ui/src/components/views/docs-view/doc-sidebar.tsx` | Document navigation                   |
| `apps/ui/src/components/ui/doc-markdown.tsx`             | Enhanced markdown viewer              |
| `apps/ui/src/hooks/use-docs-events.ts`                   | WebSocket event hook                  |

### Modified Files (5)

| Path                                                            | Changes                          |
| --------------------------------------------------------------- | -------------------------------- |
| `libs/types/src/event.ts`                                       | Add docs event types             |
| `apps/server/src/index.ts`                                      | Register docs routes and service |
| `apps/ui/src/lib/http-api-client.ts`                            | Add docs API methods             |
| `apps/ui/src/store/app-store.ts`                                | Add docs state/actions           |
| `apps/ui/src/components/layout/sidebar/hooks/use-navigation.ts` | Add Documents nav item           |

---

## Implementation Order

1. **Backend Foundation**
   - Add event types to `libs/types/src/event.ts`
   - Create `docs-prompts.ts`
   - Create `DocsService`
   - Create API routes
   - Register in server `index.ts`

2. **UI Foundation**
   - Add route file `docs.tsx`
   - Add sidebar navigation item
   - Extend HTTP API client
   - Add store state

3. **UI Components**
   - Create `DocMarkdown` component
   - Create `DocSidebar` component
   - Create `DocsView` component

4. **Real-time Updates**
   - Create `useDocsEvents` hook
   - Connect UI to WebSocket events

5. **Testing & Polish**
   - Test with various project types
   - Add error handling edge cases
   - Verify progress indicators work
