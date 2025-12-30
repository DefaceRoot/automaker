import { useMemo, useCallback } from 'react';
import { Feature, useAppStore, KanbanFilterMode } from '@/store/app-store';
import { resolveDependencies, getBlockingDependencies } from '@automaker/dependency-resolver';

type ColumnId = Feature['status'];

/**
 * Get the effective target branch for a feature.
 * Handles backward compatibility for features created before targetBranch was added.
 *
 * @param feature - The feature to get the target branch for
 * @param primaryBranch - The primary branch name (e.g., 'main' or 'master')
 * @returns The effective target branch for filtering
 */
function getEffectiveTargetBranch(feature: Feature, primaryBranch: string): string | undefined {
  // Explicit targetBranch takes precedence
  if (feature.targetBranch) {
    return String(feature.targetBranch);
  }

  // Infer from branchName patterns (for backward compatibility)
  const branchName = feature.branchName ? String(feature.branchName) : '';
  const worktreePatterns = ['feature/', 'bugfix/', 'hotfix/', 'refactor/', 'chore/', 'docs/'];

  // If branchName matches worktree patterns, it's targeting the primary branch
  if (worktreePatterns.some((pattern) => branchName.startsWith(pattern))) {
    return primaryBranch;
  }

  // Empty or matches primary branch = targeting primary
  if (!branchName || branchName === primaryBranch) {
    return primaryBranch;
  }

  // Default: use branchName as target (legacy behavior)
  return branchName;
}

/**
 * Get the effective working branch for a feature.
 * Used when filtering by working branch (kanbanFilterMode === 'working').
 *
 * @param feature - The feature to get the working branch for
 * @param primaryBranch - The primary branch name (e.g., 'main' or 'master')
 * @returns The effective working branch for filtering
 */
function getEffectiveWorkingBranch(feature: Feature, primaryBranch: string): string | undefined {
  // Use explicit branchName if set
  if (feature.branchName) {
    return String(feature.branchName);
  }

  // No working branch assigned - default to primary branch
  return primaryBranch;
}

interface UseBoardColumnFeaturesProps {
  features: Feature[];
  runningAutoTasks: string[];
  searchQuery: string;
  currentWorktreePath: string | null; // Currently selected worktree path
  currentWorktreeBranch: string | null; // Branch name of the selected worktree (null = main)
  projectPath: string | null; // Main project path (for main worktree)
}

export function useBoardColumnFeatures({
  features,
  runningAutoTasks,
  searchQuery,
  currentWorktreePath,
  currentWorktreeBranch,
  projectPath,
}: UseBoardColumnFeaturesProps) {
  // Get kanbanFilterMode from store for reactive updates
  const kanbanFilterMode = useAppStore((state) => state.kanbanFilterMode);

  // Memoize column features to prevent unnecessary re-renders
  const columnFeaturesMap = useMemo(() => {
    const map: Record<ColumnId, Feature[]> = {
      backlog: [],
      in_progress: [],
      waiting_approval: [],
      verified: [],
      completed: [], // Completed features are shown in the archive modal, not as a column
    };

    // Filter features by search query (case-insensitive)
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const filteredFeatures = normalizedQuery
      ? features.filter(
          (f) =>
            f.description.toLowerCase().includes(normalizedQuery) ||
            f.category?.toLowerCase().includes(normalizedQuery)
        )
      : features;

    // Determine the effective worktree path and branch for filtering
    // If currentWorktreePath is null, we're on the main worktree
    const effectiveWorktreePath = currentWorktreePath || projectPath;
    // Use the branch name from the selected worktree
    // If we're selecting main (currentWorktreePath is null), currentWorktreeBranch
    // should contain the main branch's actual name, defaulting to "main"
    // If we're selecting a non-main worktree but can't find it, currentWorktreeBranch is null
    // In that case, we can't do branch-based filtering, so we'll handle it specially below
    const effectiveBranch = currentWorktreeBranch;

    // Get primary branch for migration helper
    const primaryBranch = projectPath
      ? useAppStore.getState().getPrimaryWorktreeBranch(projectPath) || 'main'
      : 'main';

    filteredFeatures.forEach((f) => {
      // If feature has a running agent, always show it in "in_progress"
      const isRunning = runningAutoTasks.includes(f.id);

      // Get the branch to filter by based on the filter mode
      const filterBranch =
        kanbanFilterMode === 'working'
          ? getEffectiveWorkingBranch(f, primaryBranch)
          : getEffectiveTargetBranch(f, primaryBranch);

      let matchesView: boolean;
      if (!filterBranch) {
        // No branch assigned - show only on primary worktree view
        const isViewingPrimary = currentWorktreePath === null;
        matchesView = isViewingPrimary;
      } else if (effectiveBranch === null) {
        // Viewing main but branch hasn't been initialized yet
        // Check if feature is on primary branch
        matchesView = projectPath
          ? useAppStore.getState().isPrimaryWorktreeBranch(projectPath, filterBranch)
          : false;
      } else {
        // Match by the selected filter branch
        matchesView = filterBranch === effectiveBranch;
      }

      if (isRunning) {
        // Only show running tasks if they match the current view
        if (matchesView) {
          map.in_progress.push(f);
        }
      } else {
        // Otherwise, use the feature's status (fallback to backlog for unknown statuses)
        const status = f.status as ColumnId;

        // Filter all items by target branch, including backlog
        // This ensures backlog items targeting a branch only show when viewing that target
        if (status === 'backlog') {
          if (matchesView) {
            map.backlog.push(f);
          }
        } else if (map[status]) {
          // Only show if matches current view's target branch
          if (matchesView) {
            map[status].push(f);
          }
        } else {
          // Unknown status, default to backlog
          if (matchesView) {
            map.backlog.push(f);
          }
        }
      }
    });

    // Apply dependency-aware sorting to backlog
    // This ensures features appear in dependency order (dependencies before dependents)
    // Within the same dependency level, features are sorted by priority
    if (map.backlog.length > 0) {
      const { orderedFeatures } = resolveDependencies(map.backlog);

      // Get all features to check blocking dependencies against
      const allFeatures = features;
      const enableDependencyBlocking = useAppStore.getState().enableDependencyBlocking;

      // Sort blocked features to the end of the backlog
      // This keeps the dependency order within each group (unblocked/blocked)
      if (enableDependencyBlocking) {
        const unblocked: Feature[] = [];
        const blocked: Feature[] = [];

        for (const f of orderedFeatures) {
          if (getBlockingDependencies(f, allFeatures).length > 0) {
            blocked.push(f);
          } else {
            unblocked.push(f);
          }
        }

        map.backlog = [...unblocked, ...blocked];
      } else {
        map.backlog = orderedFeatures;
      }
    }

    return map;
  }, [
    features,
    runningAutoTasks,
    searchQuery,
    currentWorktreePath,
    currentWorktreeBranch,
    projectPath,
    kanbanFilterMode,
  ]);

  const getColumnFeatures = useCallback(
    (columnId: ColumnId) => {
      return columnFeaturesMap[columnId];
    },
    [columnFeaturesMap]
  );

  // Memoize completed features for the archive modal
  const completedFeatures = useMemo(() => {
    return features.filter((f) => f.status === 'completed');
  }, [features]);

  return {
    columnFeaturesMap,
    getColumnFeatures,
    completedFeatures,
  };
}
