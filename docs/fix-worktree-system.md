# Fix Worktree System - Two Critical Bugs

## Problem Summary

Worktrees are completely broken due to **TWO separate bugs**:

### Bug 1: Worktree CREATION fails (Windows)

**Root cause:** Branch names containing `/` are NOT quoted in git commands.

```typescript
// BROKEN (worktree-manager.ts line 213):
createCmd = `git worktree add -b ${actualBranchName} "${worktreePath}" ${base}`;

// With actualBranchName = "feature/001-add-user-auth", this becomes:
// git worktree add -b feature/001-add-user-auth "C:\path\.worktrees\..." HEAD
// The unquoted forward slash fails on Windows MSYS/Git Bash
```

**Why it's silent:** Error is caught and logged but NOT re-thrown - feature creation succeeds anyway.

### Bug 2: Worktree LOOKUP uses wrong path pattern

| Component    | Path Pattern                         | Example                                      |
| ------------ | ------------------------------------ | -------------------------------------------- |
| **Creation** | `.worktrees/{category}/{NNN}-{slug}` | `.worktrees/feature/001-add-user-auth`       |
| **Lookup**   | `.worktrees/{featureId}`             | `.worktrees/feature-1767059001767-piqeiepsy` |

---

## Part 1: Fix Worktree CREATION (Priority)

### 1.1 Quote branch names in git commands

**File:** `apps/server/src/services/worktree-manager.ts`

**Lines 207-214 - Fix:**

```typescript
// BEFORE (broken):
createCmd = `git worktree add -b ${actualBranchName} "${worktreePath}" ${base}`;
createCmd = `git worktree add "${worktreePath}" ${actualBranchName}`;

// AFTER (fixed):
createCmd = `git worktree add -b "${actualBranchName}" "${worktreePath}" ${base}`;
createCmd = `git worktree add "${worktreePath}" "${actualBranchName}"`;
```

**File:** `apps/server/src/routes/worktree/routes/create.ts`

**Lines 312-320 - Same fix:**

```typescript
// BEFORE:
createCmd = `git worktree add -b ${actualBranchName} "${worktreePath}" ${base}`;
createCmd = `git worktree add "${worktreePath}" ${actualBranchName}`;

// AFTER:
createCmd = `git worktree add -b "${actualBranchName}" "${worktreePath}" ${base}`;
createCmd = `git worktree add "${worktreePath}" "${actualBranchName}"`;
```

### 1.2 Improve error propagation

**File:** `apps/server/src/routes/features/routes/create.ts` (lines 45-69)

Instead of silently catching errors, either:

- Re-throw the error so the user knows worktree creation failed
- OR return `worktreeError` in the response so the UI can show a warning

### 1.3 Add proper directory existence check

**File:** `apps/server/src/services/worktree-manager.ts` (after line 217)

```typescript
// After execAsync(createCmd)...
// Verify directory was actually created
const exists = await secureFs
  .access(worktreePath)
  .then(() => true)
  .catch(() => false);
if (!exists) {
  throw new Error(`Worktree directory was not created at ${worktreePath}`);
}
```

---

## Part 2: Fix Worktree LOOKUP

### 2.1 Add shared utility (common.ts)

**File:** `apps/server/src/routes/worktree/common.ts`

Add two new functions:

- `resolveWorktreePath(projectPath, featureId)` - Load feature, get branchName, find worktree
- `findWorktreeByBranch(projectPath, branchName)` - Use `git worktree list --porcelain` to find actual path

```typescript
/**
 * Resolve worktree path for a feature by looking up its branchName
 * and finding the actual worktree path from git.
 */
export async function resolveWorktreePath(
  projectPath: string,
  featureId: string
): Promise<{ path: string; branchName: string } | null> {
  try {
    // Load feature to get branch name
    const feature = await featureLoader.get(projectPath, featureId);
    if (!feature?.branchName) return null;

    // Find worktree by branch name using git
    const worktreeInfo = await findWorktreeByBranch(projectPath, feature.branchName);
    if (!worktreeInfo) return null;

    return { path: worktreeInfo.path, branchName: feature.branchName };
  } catch {
    return null;
  }
}

export async function findWorktreeByBranch(
  projectPath: string,
  branchName: string
): Promise<{ path: string; branch: string } | null> {
  try {
    const { stdout } = await execAsync('git worktree list --porcelain', { cwd: projectPath });

    const lines = stdout.split('\n');
    let currentPath: string | null = null;
    let currentBranch: string | null = null;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentPath = line.slice(9);
      } else if (line.startsWith('branch ')) {
        currentBranch = line.slice(7).replace('refs/heads/', '');
      } else if (line === '' && currentPath && currentBranch) {
        if (currentBranch === branchName) {
          const resolvedPath = path.isAbsolute(currentPath)
            ? path.resolve(currentPath)
            : path.resolve(projectPath, currentPath);
          return { path: resolvedPath, branch: currentBranch };
        }
        currentPath = null;
        currentBranch = null;
      }
    }

    // Check last entry
    if (currentPath && currentBranch && currentBranch === branchName) {
      const resolvedPath = path.isAbsolute(currentPath)
        ? path.resolve(currentPath)
        : path.resolve(projectPath, currentPath);
      return { path: resolvedPath, branch: currentBranch };
    }

    return null;
  } catch {
    return null;
  }
}
```

### 2.2 Fix route files (5 files)

| File                                                  | Line | Change                                                             |
| ----------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `apps/server/src/routes/worktree/routes/info.ts`      | 31   | Replace path.join with resolveWorktreePath                         |
| `apps/server/src/routes/worktree/routes/status.ts`    | 31   | Replace path.join with resolveWorktreePath                         |
| `apps/server/src/routes/worktree/routes/diffs.ts`     | 28   | Replace path.join with resolveWorktreePath                         |
| `apps/server/src/routes/worktree/routes/file-diff.ts` | 33   | Replace path.join with resolveWorktreePath                         |
| `apps/server/src/routes/worktree/routes/merge.ts`     | 35   | Replace path.join with resolveWorktreePath + use actual branchName |

**Before (all 5 files):**

```typescript
const worktreePath = path.join(projectPath, '.worktrees', featureId);
try {
  await secureFs.access(worktreePath);
  // ... use worktreePath
}
```

**After:**

```typescript
import { resolveWorktreePath } from '../common.js';

const worktreeInfo = await resolveWorktreePath(projectPath, featureId);
if (!worktreeInfo) {
  // Return success with null/empty data (graceful fallback)
  return;
}
// ... use worktreeInfo.path
```

---

## Error Handling

| Case                      | Behavior                                                                    |
| ------------------------- | --------------------------------------------------------------------------- |
| Feature not found         | Return success with null/empty data                                         |
| Feature has no branchName | Return success with null/empty data                                         |
| Worktree not found        | Return success with null/empty data (or fallback to project path for diffs) |
| Git command fails         | Return error 500                                                            |

---

## Implementation Order

### Phase 1: Fix Creation (gets worktrees working)

1. Quote branch names in `worktree-manager.ts` (lines 210, 213)
2. Quote branch names in `create.ts` (lines 312-320)
3. Add directory existence verification in `worktree-manager.ts`
4. **Test:** Create a feature with worktrees enabled - verify `.worktrees/` folder is created

### Phase 2: Fix Lookup (makes UI work with new worktrees)

5. Add `resolveWorktreePath` and `findWorktreeByBranch` to `common.ts`
6. Update `info.ts`
7. Update `status.ts`
8. Update `diffs.ts`
9. Update `file-diff.ts`
10. Update `merge.ts`
11. **Test:** Verify worktree info/status/diffs work in UI

### Phase 3: Improve Error Handling (optional, prevents future silent failures)

12. Update `features/routes/create.ts` to surface worktree errors

---

## Files Summary

| File                                                  | What to Change                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/server/src/services/worktree-manager.ts`        | Quote branch names (lines 210, 213), add existence check               |
| `apps/server/src/routes/worktree/routes/create.ts`    | Quote branch names (lines 312-320)                                     |
| `apps/server/src/routes/worktree/common.ts`           | Add `resolveWorktreePath` and `findWorktreeByBranch`                   |
| `apps/server/src/routes/worktree/routes/info.ts`      | Use `resolveWorktreePath` instead of path.join                         |
| `apps/server/src/routes/worktree/routes/status.ts`    | Use `resolveWorktreePath` instead of path.join                         |
| `apps/server/src/routes/worktree/routes/diffs.ts`     | Use `resolveWorktreePath` instead of path.join                         |
| `apps/server/src/routes/worktree/routes/file-diff.ts` | Use `resolveWorktreePath` instead of path.join                         |
| `apps/server/src/routes/worktree/routes/merge.ts`     | Use `resolveWorktreePath` instead of path.join + use actual branchName |
| `apps/server/src/routes/features/routes/create.ts`    | Surface worktree creation errors                                       |
