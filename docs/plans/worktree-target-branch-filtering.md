# Worktree Target Branch Filtering

## Overview

Add a `targetBranch` field to features that specifies which branch the work will merge into. This enables filtering the Kanban board by target branch, so when viewing "main", users see ALL tasks that will merge to main regardless of their working branch (bugfix/_, feature/_, etc.).

## Problem

Currently, when a feature is created:

1. User selects "Target Branch: main" and "Worktree Type: Feature"
2. Server creates worktree with branch `feature/001-my-task`
3. The feature's `branchName` is **overwritten** with `feature/001-my-task`
4. The original target (main) is lost
5. Task no longer appears on "main" Kanban board

## Solution

Separate two concepts:

- `branchName` - Working branch where code changes are made (`feature/001-my-task`)
- `targetBranch` - Branch this work will merge into (`main`)

---

## Phase 1: Data Model

### 1.1 Update Feature Type

**File:** `libs/types/src/feature.ts`

Add new field after `branchName`:

```typescript
branchName?: string; // Name of the feature branch (undefined = use current worktree)
targetBranch?: string; // Branch this work will merge into (e.g., 'main')
```

### 1.2 Update UI Store

**File:** `apps/ui/src/store/app-store.ts`

Add `targetBranch?: string` to the Feature interface in the store (search for the Feature type definition).

---

## Phase 2: Feature Creation

### 2.1 Update AddFeatureDialog

**File:** `apps/ui/src/components/views/board-view/dialogs/add-feature-dialog.tsx`

**Changes:**

1. The existing "Target Branch" UI selector (BranchSelector component) currently stores the selected branch as `branchName`. This value should instead be stored as `targetBranch`.

2. In `handleAdd()` function (~line 265), update the `onAdd` call:
   - Add `targetBranch: finalBranchName` to the payload
   - Keep `branchName` as empty/undefined initially (it will be set by the server when worktree is created)

3. Update the `onAdd` callback interface to include `targetBranch: string`

### 2.2 Update EditFeatureDialog

**File:** `apps/ui/src/components/views/board-view/dialogs/edit-feature-dialog.tsx`

Apply same changes - pass `targetBranch` and handle it appropriately.

### 2.3 Update useBoardActions Hook

**File:** `apps/ui/src/components/views/board-view/hooks/use-board-actions.ts`

**In `handleAddFeature` (~line 91):**

1. Add `targetBranch` to the function parameter interface
2. Pass `targetBranch` to the feature data object
3. Set `branchName: undefined` (let server set it when worktree is created)

**In `handleUpdateFeature` (~line 180):**

1. Add `targetBranch` to the updates interface
2. Include `targetBranch` in the final updates object

---

## Phase 3: Server-Side Changes

### 3.1 Update Feature Creation Route

**File:** `apps/server/src/routes/features/routes/create.ts`

**Changes (~line 70-71):**

- When updating feature with worktree branch, preserve `targetBranch`
- Only update `branchName` with the working branch

```typescript
// Update created feature with branch name (working branch)
// targetBranch remains unchanged (set during feature creation)
created.branchName = worktreeResult.branchName;
// DO NOT overwrite targetBranch
```

### 3.2 Update Worktree Lifecycle Service

**File:** `apps/server/src/services/worktree-lifecycle.ts`

**In `createWorktreeForTask` (~line 147):**

- Only update `branchName`, not `targetBranch`

```typescript
// Update feature with working branch name only
await this.featureLoader.update(projectPath, feature.id, {
  branchName: worktreeResult.branch,
  // targetBranch is preserved from original feature creation
});
```

---

## Phase 4: Kanban Board Filtering

### 4.1 Update Column Features Hook

**File:** `apps/ui/src/components/views/board-view/hooks/use-board-column-features.ts`

**Replace filtering logic (~line 54-77):**

Change from filtering by `branchName` to filtering by `targetBranch`:

```typescript
// Check if feature matches the current view by targetBranch
const featureTargetBranch = f.targetBranch;

let matchesView: boolean;
if (!featureTargetBranch) {
  // No target branch assigned - show only on primary worktree view
  const isViewingPrimary = currentWorktreePath === null;
  matchesView = isViewingPrimary;
} else if (effectiveBranch === null) {
  // Viewing main but branch hasn't initialized - check if feature targets primary
  matchesView = projectPath
    ? useAppStore.getState().isPrimaryWorktreeBranch(projectPath, featureTargetBranch)
    : false;
} else {
  // Match by target branch
  matchesView = featureTargetBranch === effectiveBranch;
}
```

### 4.2 Update BoardView Auto-Mode Logic

**File:** `apps/ui/src/components/views/board-view.tsx`

**In the auto-mode effect (~line 700-722):**

Change backlog filtering from `branchName` to `targetBranch`:

```typescript
const backlogFeatures = currentFeatures.filter((f) => {
  if (f.status !== 'backlog') return false;

  const featureTargetBranch = f.targetBranch;

  // Features without targetBranch show only on primary worktree
  if (!featureTargetBranch) {
    const isViewingPrimary = currentWorktreePath === null;
    return isViewingPrimary;
  }

  if (currentWorktreeBranch === null) {
    return currentProject.path
      ? isPrimaryWorktreeBranch(currentProject.path, featureTargetBranch)
      : false;
  }

  return featureTargetBranch === currentWorktreeBranch;
});
```

### 4.3 Update handleStartNextFeatures

**File:** `apps/ui/src/components/views/board-view/hooks/use-board-actions.ts`

**In `handleStartNextFeatures` (~line 825-848):**

Change filtering from `branchName` to `targetBranch`:

```typescript
const backlogFeatures = features.filter((f) => {
  if (f.status !== 'backlog') return false;

  const featureTargetBranch = f.targetBranch || primaryBranch || 'main';

  if (
    !currentWorktreeBranch ||
    (projectPath && isPrimaryWorktreeBranch(projectPath, currentWorktreeBranch))
  ) {
    return (
      !f.targetBranch || (projectPath && isPrimaryWorktreeBranch(projectPath, featureTargetBranch))
    );
  }

  return featureTargetBranch === currentWorktreeBranch;
});
```

---

## Phase 5: Card Display Updates

### 5.1 Update Card Content Sections

**File:** `apps/ui/src/components/views/board-view/components/kanban-card/card-content-sections.tsx`

**Update the component to show both branches:**

```typescript
interface CardContentSectionsProps {
  feature: Feature;
  useWorktrees: boolean;
  currentViewBranch?: string; // The branch currently being viewed
}

export function CardContentSections({ feature, useWorktrees, currentViewBranch }: CardContentSectionsProps) {
  return (
    <>
      {/* Working Branch Display */}
      {useWorktrees && feature.branchName && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <GitBranch className="w-3 h-3 shrink-0" />
          <span className="font-mono truncate" title={feature.branchName}>
            {feature.branchName}
          </span>
        </div>
      )}

      {/* Target Branch Badge - show if different from current view */}
      {useWorktrees && feature.targetBranch && feature.targetBranch !== currentViewBranch && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <GitMerge className="w-3 h-3 shrink-0" />
          <span className="font-mono truncate" title={`Merges to ${feature.targetBranch}`}>
            → {feature.targetBranch}
          </span>
        </div>
      )}

      {/* PR URL Display - existing code */}
      ...
    </>
  );
}
```

Import `GitMerge` from lucide-react.

### 5.2 Update KanbanCard Props

**File:** `apps/ui/src/components/views/board-view/components/kanban-card/kanban-card.tsx`

Pass `currentViewBranch` to `CardContentSections`:

```typescript
<CardContentSections
  feature={feature}
  useWorktrees={useWorktrees}
  currentViewBranch={currentViewBranch}
/>
```

### 5.3 Update KanbanBoard

**File:** `apps/ui/src/components/views/board-view/kanban-board.tsx`

Add `currentViewBranch` prop and pass it through to KanbanCard.

---

## Phase 6: View Mode Toggle

### 6.1 Add View Mode State

**File:** `apps/ui/src/store/app-store.ts`

Add to the store:

```typescript
kanbanFilterMode: 'target' | 'working'; // 'target' = filter by targetBranch, 'working' = filter by branchName
setKanbanFilterMode: (mode: 'target' | 'working') => void;
```

Default to `'target'`.

### 6.2 Add Toggle UI

**File:** `apps/ui/src/components/views/board-view/board-controls.tsx`

Add a toggle button or segmented control:

```typescript
<div className="flex items-center gap-2">
  <span className="text-xs text-muted-foreground">View by:</span>
  <ToggleGroup type="single" value={kanbanFilterMode} onValueChange={setKanbanFilterMode}>
    <ToggleGroupItem value="target" size="sm">Target Branch</ToggleGroupItem>
    <ToggleGroupItem value="working" size="sm">Working Branch</ToggleGroupItem>
  </ToggleGroup>
</div>
```

### 6.3 Update Filtering to Respect Toggle

**File:** `apps/ui/src/components/views/board-view/hooks/use-board-column-features.ts`

Read `kanbanFilterMode` from store and switch filtering logic:

```typescript
const kanbanFilterMode = useAppStore.getState().kanbanFilterMode;

// Choose which field to filter by
const filterBranch = kanbanFilterMode === 'target' ? f.targetBranch : f.branchName;
```

---

## Phase 7: Migration for Existing Features

### 7.1 Handle Features Without targetBranch

In the filtering logic, when a feature has no `targetBranch`:

1. If `branchName` starts with `feature/`, `bugfix/`, `hotfix/`, `refactor/`, `chore/`, or `docs/`:
   - Infer `targetBranch` = primary branch (main/master)
2. If `branchName` is empty, undefined, or equals primary branch:
   - Treat as `targetBranch` = primary branch
3. Otherwise:
   - Use `branchName` as `targetBranch` (backward compatibility)

Add a helper function:

```typescript
function getEffectiveTargetBranch(feature: Feature, primaryBranch: string): string {
  // Explicit targetBranch takes precedence
  if (feature.targetBranch) {
    return feature.targetBranch;
  }

  // Infer from branchName patterns
  const branchName = feature.branchName || '';
  const worktreePatterns = ['feature/', 'bugfix/', 'hotfix/', 'refactor/', 'chore/', 'docs/'];

  if (worktreePatterns.some((pattern) => branchName.startsWith(pattern))) {
    return primaryBranch;
  }

  // Empty or primary branch
  if (!branchName || branchName === primaryBranch) {
    return primaryBranch;
  }

  // Default: use branchName as target
  return branchName;
}
```

---

## Testing Checklist

- [ ] Create feature on main with "Feature" worktree type → appears on main board
- [ ] Create feature on main with "Bugfix" worktree type → appears on main board
- [ ] Feature card shows working branch (feature/001-xxx)
- [ ] Feature card shows target branch indicator when viewing different branch
- [ ] Toggle between "Target Branch" and "Working Branch" view modes
- [ ] Auto-mode starts features correctly based on target branch
- [ ] "Make" button (G key) starts correct features based on current view
- [ ] Existing features without targetBranch still display correctly
- [ ] Edit feature dialog preserves targetBranch

---

## Files Summary

| File                                                                                       | Change                                                      |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `libs/types/src/feature.ts`                                                                | Add `targetBranch` field                                    |
| `apps/ui/src/store/app-store.ts`                                                           | Add `targetBranch` to Feature, add `kanbanFilterMode` state |
| `apps/ui/src/components/views/board-view/dialogs/add-feature-dialog.tsx`                   | Pass `targetBranch`                                         |
| `apps/ui/src/components/views/board-view/dialogs/edit-feature-dialog.tsx`                  | Handle `targetBranch`                                       |
| `apps/ui/src/components/views/board-view/hooks/use-board-actions.ts`                       | Include `targetBranch` in handlers                          |
| `apps/server/src/routes/features/routes/create.ts`                                         | Preserve `targetBranch`                                     |
| `apps/server/src/services/worktree-lifecycle.ts`                                           | Don't overwrite `targetBranch`                              |
| `apps/ui/src/components/views/board-view/hooks/use-board-column-features.ts`               | Filter by `targetBranch`                                    |
| `apps/ui/src/components/views/board-view.tsx`                                              | Update auto-mode filtering                                  |
| `apps/ui/src/components/views/board-view/components/kanban-card/card-content-sections.tsx` | Show both branches                                          |
| `apps/ui/src/components/views/board-view/components/kanban-card/kanban-card.tsx`           | Pass `currentViewBranch`                                    |
| `apps/ui/src/components/views/board-view/kanban-board.tsx`                                 | Add `currentViewBranch` prop                                |
| `apps/ui/src/components/views/board-view/board-controls.tsx`                               | Add view mode toggle                                        |
