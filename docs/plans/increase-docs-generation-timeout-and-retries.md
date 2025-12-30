# Increase Documentation Generation Timeout and Retries

**Status**: Ready for Implementation  
**Priority**: High  
**Estimated Effort**: 5 minutes

## Overview

Increase the stream idle timeout and retry attempts for documentation generation to improve reliability when generating complex documentation that requires deep codebase exploration via subagents.

## Changes Required

### Change 1: Increase Stream Idle Timeout

**File**: `apps/server/src/providers/claude-provider.ts`  
**Line**: 19

Find:

```typescript
const STREAM_IDLE_TIMEOUT_MS = 120000; // 2 minutes
```

Replace with:

```typescript
const STREAM_IDLE_TIMEOUT_MS = 300000; // 5 minutes
```

---

### Change 2: Increase Max Retries

**File**: `apps/server/src/services/docs-service.ts`  
**Line**: 518

Find:

```typescript
const maxRetries = 2;
```

Replace with:

```typescript
const maxRetries = 5;
```

---

## Verification

After making changes:

1. Run `npm run build:packages` to rebuild shared packages
2. Verify no TypeScript errors with `npm run lint`
3. Optionally test documentation generation on a project to confirm improved reliability

## Summary of Changes

| Setting                | Before               | After                |
| ---------------------- | -------------------- | -------------------- |
| Stream Idle Timeout    | 2 minutes (120000ms) | 5 minutes (300000ms) |
| Max Retries            | 2                    | 5                    |
| Total Attempts per Doc | 3                    | 6                    |
