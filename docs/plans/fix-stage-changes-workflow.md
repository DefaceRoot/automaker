# Fix Stage Changes Workflow

**Date**: 2024-12-30  
**Status**: Ready for Implementation  
**Priority**: High

## Problem Statement

The "Stage Changes" button in the waiting_approval column has a bug: it commits ALL changes from the feature branch instead of just staging them. The current implementation uses `git merge --no-commit --no-ff` which:

1. Brings ALL changes from the branch (not just the specific worktree changes)
2. Puts git in a "merging" state that's complex to manage
3. Shows a confirmation dialog asking to "Confirm Merge"
4. The user has to click confirm to commit, which defeats the purpose

### Expected Behavior

When a user clicks "Stage Changes":

1. Copy only the changed files from the worktree to main
2. Stage those files with `git add`
3. Show a success toast (no dialog)
4. User can review changes via `npm run dev` on main
5. User can click "Revert" to undo the staged changes
6. User manually commits via git CLI when ready

## Files to Modify

| #   | File                                                                        | Action                                     |
| --- | --------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | `apps/server/src/routes/worktree/routes/stage.ts`                           | **Rewrite** - Replace merge with file copy |
| 2   | `apps/server/src/routes/worktree/routes/revert-staged.ts`                   | **Simplify** - Remove merge state logic    |
| 3   | `apps/ui/src/components/views/board-view.tsx`                               | **Update** - Remove dialog, show toast     |
| 4   | `apps/ui/src/components/views/board-view/dialogs/staged-changes-dialog.tsx` | **Delete** - No longer needed              |

---

## Task 1: Rewrite `stage.ts`

**File**: `apps/server/src/routes/worktree/routes/stage.ts`

### Current Implementation (Broken)

The current code uses:

```typescript
await execAsync(`git merge --no-commit --no-ff ${branchName}`, {
  cwd: projectPath,
  env: execEnv,
});
```

This is wrong because it performs a full merge operation.

### New Implementation

Replace the entire merge logic with a file-copy approach:

```typescript
/**
 * POST /stage endpoint - Stage worktree changes to base branch (no commit)
 *
 * This endpoint copies changed files from a feature worktree to the main branch
 * and stages them, allowing the user to review changes before committing manually.
 *
 * Flow:
 * 1. Validate inputs and resolve worktree path
 * 2. Check main branch is clean (no uncommitted changes)
 * 3. Ensure we're on target branch
 * 4. Get list of changed files between branches
 * 5. Copy/delete files from worktree to main
 * 6. Stage the changes with git add
 * 7. Return success with file list for revert tracking
 */
```

### New Logic (Pseudocode)

```
1. Validate inputs (projectPath, featureId, targetBranch)

2. Resolve worktree path and branch name from featureId
   - Use existing resolveWorktreePath() function
   - Get worktreePath and branchName

3. Check main is clean (CRITICAL - fail if dirty)
   - Run: git status --porcelain
   - If output is not empty, return error:
     "Cannot stage changes: uncommitted changes on {targetBranch}. Please commit or stash them first."

4. Ensure we're on target branch
   - Get current branch: git rev-parse --abbrev-ref HEAD
   - If not on targetBranch, checkout: git checkout {targetBranch}

5. Get list of changed files between worktree branch and target
   - Run: git diff --name-status {targetBranch}..{branchName}
   - Parse output to get file status and paths:
     - A = Added (new file)
     - M = Modified
     - D = Deleted
     - R = Renamed (R100 old-path new-path)

6. Copy/delete files from worktree to main:
   - For Added/Modified files:
     - Ensure parent directory exists in projectPath
     - Copy file from worktreePath to projectPath
   - For Deleted files:
     - Delete file from projectPath (if exists)
   - For Renamed files:
     - Delete old path, copy new path

7. Stage the changes:
   - For added/modified files: git add {files}
   - For deleted files: git add {files} (stages the deletion)

8. Get diff summary:
   - Run: git diff --cached --stat
   - Parse to get filesChanged, insertions, deletions

9. Return response:
   {
     success: true,
     staged: true,
     changedFiles: [...],  // List of file paths for revert tracking
     filesChanged: N,
     insertions: N,
     deletions: N,
     diffSummary: "X files changed, Y insertions(+), Z deletions(-)"
   }
```

### Key Implementation Details

#### Getting Changed Files

```typescript
// Get changed files between branches
const { stdout: diffOutput } = await execAsync(
  `git diff --name-status ${targetBranch}..${branchName}`,
  { cwd: projectPath, env: execEnv }
);

// Parse output - each line is: STATUS\tFILEPATH (or STATUS\tOLD\tNEW for renames)
const changes = diffOutput
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const parts = line.split('\t');
    const status = parts[0];
    if (status.startsWith('R')) {
      return { status: 'R', oldPath: parts[1], newPath: parts[2] };
    }
    return { status, path: parts[1] };
  });
```

#### Copying Files

```typescript
import fs from 'fs/promises';
import path from 'path';

// Copy a file from worktree to main
async function copyFile(worktreePath: string, projectPath: string, filePath: string) {
  const srcPath = path.join(worktreePath, filePath);
  const destPath = path.join(projectPath, filePath);

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(destPath), { recursive: true });

  // Copy the file
  await fs.copyFile(srcPath, destPath);
}

// Delete a file from main
async function deleteFile(projectPath: string, filePath: string) {
  const targetPath = path.join(projectPath, filePath);
  try {
    await fs.unlink(targetPath);
  } catch (error) {
    // File might not exist, that's fine
  }
}
```

#### Staging Files

```typescript
// Stage all changed files at once
const filesToStage = changes.map((c) => c.path || c.newPath).filter(Boolean);
if (filesToStage.length > 0) {
  const escapedFiles = filesToStage.map((f) => `"${f.replace(/"/g, '\\"')}"`);
  await execAsync(`git add ${escapedFiles.join(' ')}`, {
    cwd: projectPath,
    env: execEnv,
  });
}
```

### Error Handling

- If worktree doesn't exist: Return 400 with clear error
- If main has uncommitted changes: Return 400 with clear error
- If file copy fails: Log error, continue with other files, report partial success
- If git add fails: Return 500 with error details

### Remove These From Current Implementation

- All `git merge` commands
- All `ConflictResolutionService` usage
- All `mergeStarted` tracking
- All `abortMerge()` calls
- The `generateCommitMessage()` function (not needed anymore)
- The `getCategoryPrefix()` function (not needed anymore)

---

## Task 2: Simplify `revert-staged.ts`

**File**: `apps/server/src/routes/worktree/routes/revert-staged.ts`

### Current Implementation (Over-complicated)

The current code handles merge states with `git merge --abort`. This is no longer needed.

### New Implementation

Simplify to just unstage and restore files:

```typescript
/**
 * POST /revert-staged endpoint - Revert staged changes from a specific task
 *
 * This endpoint reverts changes that were staged from a feature worktree.
 * It unstages the files and restores them to their original state on the target branch.
 *
 * Flow:
 * 1. Validate inputs
 * 2. Verify we're on target branch
 * 3. Unstage and restore each file
 */
```

### New Logic

```typescript
export function createRevertStagedHandler() {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectPath, files, targetBranch = 'main' } = req.body as RevertStagedRequest;

      // Validate inputs
      if (!projectPath || !files || files.length === 0) {
        res.status(400).json({ success: false, error: 'projectPath and files are required' });
        return;
      }

      // Verify we're on target branch
      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
        env: execEnv,
      });

      if (currentBranch.trim() !== targetBranch) {
        res.status(400).json({
          success: false,
          error: `Not on target branch. Currently on '${currentBranch.trim()}', expected '${targetBranch}'.`,
        });
        return;
      }

      const revertedFiles: string[] = [];
      const errors: string[] = [];

      for (const file of files) {
        const escapedFile = `"${file.replace(/"/g, '\\"')}"`;

        try {
          // Step 1: Unstage the file
          await execAsync(`git restore --staged ${escapedFile}`, {
            cwd: projectPath,
            env: execEnv,
          });
        } catch {
          // File might not be staged, continue
        }

        try {
          // Step 2: Restore file to HEAD state
          await execAsync(`git restore ${escapedFile}`, {
            cwd: projectPath,
            env: execEnv,
          });
          revertedFiles.push(file);
        } catch {
          // File might be new (not in HEAD), try to remove it
          try {
            await execAsync(`git clean -f ${escapedFile}`, {
              cwd: projectPath,
              env: execEnv,
            });
            revertedFiles.push(file);
          } catch (cleanError) {
            errors.push(`Could not revert ${file}: ${getErrorMessage(cleanError)}`);
          }
        }
      }

      res.json({
        success: true,
        revertedFiles,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      logError(error, 'Revert staged changes failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
```

### Remove These From Current Implementation

- All `MERGE_HEAD` detection (lines 79-89)
- All `git merge --abort` logic (lines 94-112)
- The `inMergeState` variable and branching logic

---

## Task 3: Update `board-view.tsx`

**File**: `apps/ui/src/components/views/board-view.tsx`

### Changes Required

#### 1. Remove Dialog-Related State and Callbacks

Remove these (around lines 126-133 and 494-513):

```typescript
// REMOVE: stagedChangesInfo state
const [stagedChangesInfo, setStagedChangesInfo] = useState<{
  feature: Feature;
  suggestedMessage: string;
  diffSummary: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
} | null>(null);

// REMOVE: showStagedChangesDialog state (if it exists separately)

// REMOVE: handleAbortStagedMerge callback
const handleAbortStagedMerge = useCallback(async () => {
  // ... entire function
}, [currentProject]);

// REMOVE: handleStagedChangesCommitted callback
const handleStagedChangesCommitted = useCallback(() => {
  // ... entire function
}, [loadFeatures]);
```

#### 2. Update `onStageChanges` Callback

Replace the current implementation (lines 456-491):

```typescript
// BEFORE:
const onStageChanges = useCallback(
  async (feature: Feature) => {
    const result = await handleStageChanges(feature);
    if (result?.success && result.staged) {
      const primaryBranch = ...;
      const stagedToTargetUpdate = {...};
      updateFeature(feature.id, stagedToTargetUpdate);
      persistFeatureUpdate(feature.id, stagedToTargetUpdate);

      // REMOVE: Dialog opening
      setStagedChangesInfo({...});
      setShowStagedChangesDialog(true);
    }
  },
  [...]
);

// AFTER:
const onStageChanges = useCallback(
  async (feature: Feature) => {
    const result = await handleStageChanges(feature);
    if (result?.success && result.staged) {
      const primaryBranch =
        (currentProject?.path ? getPrimaryWorktreeBranch(currentProject.path) : null) || 'main';
      const stagedToTargetUpdate = {
        stagedToTarget: {
          targetBranch: primaryBranch,
          stagedFiles: result.changedFiles || [],
          stagedAt: new Date().toISOString(),
        },
      };
      updateFeature(feature.id, stagedToTargetUpdate);
      persistFeatureUpdate(feature.id, stagedToTargetUpdate);

      // Show success toast instead of dialog
      toast.success('Changes staged to main', {
        description: `${result.filesChanged || 0} file(s) ready for review. Run 'npm run dev' on main to preview.`,
      });
    }
  },
  [
    handleStageChanges,
    currentProject,
    getPrimaryWorktreeBranch,
    updateFeature,
    persistFeatureUpdate,
  ]
);
```

#### 3. Remove Dialog Component Usage

Remove the `<StagedChangesDialog>` component from the JSX (around lines 1452-1457):

```tsx
// REMOVE this entire block:
<StagedChangesDialog
  open={showStagedChangesDialog}
  onOpenChange={setShowStagedChangesDialog}
  feature={stagedChangesInfo?.feature || null}
  suggestedMessage={stagedChangesInfo?.suggestedMessage || ''}
  diffSummary={stagedChangesInfo?.diffSummary || ''}
  filesChanged={stagedChangesInfo?.filesChanged || 0}
  insertions={stagedChangesInfo?.insertions || 0}
  deletions={stagedChangesInfo?.deletions || 0}
  projectPath={currentProject?.path || ''}
  onCommitted={handleStagedChangesCommitted}
  onAbort={handleAbortStagedMerge}
/>
```

#### 4. Remove Import

Remove the import statement:

```typescript
// REMOVE:
import { StagedChangesDialog } from './board-view/dialogs/staged-changes-dialog';
```

---

## Task 4: Delete Dialog File

**File**: `apps/ui/src/components/views/board-view/dialogs/staged-changes-dialog.tsx`

Delete this entire file. It's no longer needed since we're showing a toast instead of a confirmation dialog.

---

## Testing Checklist

After implementation, verify these scenarios:

### Basic Flow

- [ ] Click "Stage Changes" on a feature in waiting_approval column
- [ ] Success toast appears (no dialog)
- [ ] Files are staged on main branch (`git status` shows staged changes)
- [ ] `npm run dev` on main shows the changes in real-time

### File Operations

- [ ] Modified files are copied correctly
- [ ] New files are copied correctly
- [ ] Deleted files are removed on main
- [ ] Binary files (images) work correctly

### Revert Flow

- [ ] Click "Revert" button on a feature with staged changes
- [ ] Staged changes are removed from main
- [ ] Modified files restored to original
- [ ] New files removed
- [ ] Deleted files restored
- [ ] Worktree files remain unchanged

### Error Handling

- [ ] Error shown if main has uncommitted changes
- [ ] Error shown if worktree doesn't exist
- [ ] Partial success handled gracefully

### Multiple Features

- [ ] Can stage changes from multiple features
- [ ] Reverting one feature doesn't affect another's staged changes
- [ ] Each feature tracks its own staged files

---

## Edge Cases to Handle

| Scenario                       | Expected Behavior                          |
| ------------------------------ | ------------------------------------------ |
| Main has uncommitted changes   | Fail with clear error message              |
| Worktree doesn't exist         | Fail with clear error message              |
| File deleted in worktree       | Stage the deletion on main                 |
| New file in worktree           | Copy and stage on main                     |
| Binary files                   | Handle same as text files                  |
| Empty diff (no changes)        | Success with "No changes to stage" message |
| File in nested directory       | Create parent dirs as needed               |
| Special characters in filename | Properly escape in git commands            |

---

## Notes for Implementer

1. **Don't change the API contract** - The `/api/worktree/stage` endpoint should return the same response shape, just without the merge-related fields.

2. **Keep feature.stagedToTarget tracking** - This is used by the revert flow and should continue to work.

3. **The worktree path is a real directory** - You can use `fs` operations to copy files. The worktree is at a separate path from the main project.

4. **Test on Windows** - Path handling should work on both Unix and Windows.

5. **Don't touch the worktree** - Only copy FROM worktree TO main. Never modify worktree files.
