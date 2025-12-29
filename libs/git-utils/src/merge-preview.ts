/**
 * Merge Preview - Non-destructive conflict detection using git merge-tree
 *
 * Uses git merge-tree --write-tree to simulate a merge and detect conflicts
 * without modifying the working directory or index.
 */

/**
 * Information about a single merge conflict
 */
export interface MergeConflict {
  /** Relative path to the conflicting file */
  filePath: string;
  /** Type of conflict (content, modify/delete, add/add, etc.) */
  conflictType:
    | 'content'
    | 'modify-delete'
    | 'add-add'
    | 'rename-delete'
    | 'rename-rename'
    | 'unknown';
  /** Brief description of the conflict */
  description: string;
  /** The ancestor mode (file permissions) - null if file didn't exist */
  ancestorMode?: string;
  /** The mode in the current branch */
  oursMode?: string;
  /** The mode in the incoming branch */
  theirsMode?: string;
}

/**
 * Result of a merge preview operation
 */
export interface MergePreviewResult {
  /** Whether the preview operation succeeded */
  success: boolean;
  /** Whether the merge would result in conflicts */
  hasConflicts: boolean;
  /** Number of conflicting files */
  conflictCount: number;
  /** Details about each conflict */
  conflicts: MergeConflict[];
  /** The merge base commit used */
  mergeBase?: string;
  /** The tree object that would result from merge (if no conflicts) */
  resultTree?: string;
  /** Error message if the operation failed */
  error?: string;
  /** The source branch being merged */
  sourceBranch?: string;
  /** The target branch being merged into */
  targetBranch?: string;
}

/**
 * Parse the output of git merge-tree --write-tree to extract conflict information
 *
 * Example output with conflicts:
 * ```
 * 100644 abc123 1	path/to/file.txt
 * 100644 def456 2	path/to/file.txt
 * 100644 789ghi 3	path/to/file.txt
 * ```
 *
 * Stages:
 * - 0: merged successfully
 * - 1: common ancestor
 * - 2: ours (current branch)
 * - 3: theirs (incoming branch)
 */
export function parseMergeTreeOutput(
  output: string,
  stderr: string
): {
  hasConflicts: boolean;
  conflicts: MergeConflict[];
  resultTree?: string;
} {
  const conflicts: MergeConflict[] = [];
  const conflictFiles = new Map<string, { stages: Set<number>; modes: Map<number, string> }>();

  // Parse stdout for the result tree (first line if no conflicts)
  const lines = output
    .trim()
    .split('\n')
    .filter((line) => line.length > 0);

  // Check stderr for conflict information (newer git versions output here)
  const stderrLines = stderr
    .trim()
    .split('\n')
    .filter((line) => line.length > 0);

  // Parse CONFLICT lines from stderr
  for (const line of stderrLines) {
    const conflictMatch = line.match(/^CONFLICT \(([^)]+)\): (.+)$/);
    if (conflictMatch) {
      const conflictTypeRaw = conflictMatch[1].toLowerCase();
      const description = conflictMatch[2];

      // Extract file path from description
      let filePath = '';
      let conflictType: MergeConflict['conflictType'] = 'unknown';

      if (conflictTypeRaw === 'content') {
        conflictType = 'content';
        // "Merge conflict in path/to/file.txt"
        const contentMatch = description.match(/Merge conflict in (.+)/);
        if (contentMatch) {
          filePath = contentMatch[1];
        }
      } else if (conflictTypeRaw === 'modify/delete') {
        conflictType = 'modify-delete';
        // Various formats possible
        const modDeleteMatch = description.match(/(.+) deleted in .+ and modified in/);
        if (modDeleteMatch) {
          filePath = modDeleteMatch[1];
        }
      } else if (conflictTypeRaw === 'add/add') {
        conflictType = 'add-add';
        const addAddMatch = description.match(/Merge conflict in (.+)/);
        if (addAddMatch) {
          filePath = addAddMatch[1];
        }
      } else if (conflictTypeRaw.includes('rename')) {
        conflictType = conflictTypeRaw.includes('delete') ? 'rename-delete' : 'rename-rename';
        // Extract paths from rename conflicts
        const renameMatch = description.match(/(.+) was renamed/);
        if (renameMatch) {
          filePath = renameMatch[1];
        }
      }

      if (filePath) {
        conflicts.push({
          filePath,
          conflictType,
          description,
        });
      }
    }
  }

  // Also parse the index-style output (mode hash stage path format)
  // These appear when there are unmerged entries
  for (const line of lines) {
    // Match: mode hash stage\tpath
    const indexMatch = line.match(/^(\d{6})\s+([a-f0-9]{40})\s+(\d)\t(.+)$/);
    if (indexMatch) {
      const [, mode, , stageStr, filePath] = indexMatch;
      const stage = parseInt(stageStr, 10);

      // Stage 0 means merged, stages 1-3 mean conflict
      if (stage > 0) {
        if (!conflictFiles.has(filePath)) {
          conflictFiles.set(filePath, { stages: new Set(), modes: new Map() });
        }
        const fileInfo = conflictFiles.get(filePath)!;
        fileInfo.stages.add(stage);
        fileInfo.modes.set(stage, mode);
      }
    }
  }

  // Convert indexed conflicts to MergeConflict objects
  for (const [filePath, info] of conflictFiles) {
    // Check if we already added this conflict from stderr parsing
    if (conflicts.some((c) => c.filePath === filePath)) {
      continue;
    }

    let conflictType: MergeConflict['conflictType'] = 'content';
    let description = 'Merge conflict';

    // Determine conflict type based on which stages are present
    if (info.stages.has(2) && info.stages.has(3)) {
      if (!info.stages.has(1)) {
        conflictType = 'add-add';
        description = 'Both branches added this file with different content';
      } else {
        conflictType = 'content';
        description = 'Merge conflict in file content';
      }
    } else if (info.stages.has(1) && (info.stages.has(2) || info.stages.has(3))) {
      conflictType = 'modify-delete';
      description = info.stages.has(2)
        ? 'File was modified in current branch but deleted in incoming branch'
        : 'File was deleted in current branch but modified in incoming branch';
    }

    conflicts.push({
      filePath,
      conflictType,
      description,
      ancestorMode: info.modes.get(1),
      oursMode: info.modes.get(2),
      theirsMode: info.modes.get(3),
    });
  }

  // Check for tree SHA on first line (successful merge without conflicts)
  let resultTree: string | undefined;
  if (lines.length > 0) {
    const treeMatch = lines[0].match(/^([a-f0-9]{40})$/);
    if (treeMatch && conflicts.length === 0) {
      resultTree = treeMatch[1];
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    resultTree,
  };
}

/**
 * Determines the type of conflict based on available information
 */
export function classifyConflict(
  ancestorExists: boolean,
  oursExists: boolean,
  theirsExists: boolean
): MergeConflict['conflictType'] {
  if (oursExists && theirsExists) {
    if (ancestorExists) {
      return 'content'; // Normal content conflict
    }
    return 'add-add'; // Both sides added the file
  }

  if (ancestorExists) {
    if (!oursExists || !theirsExists) {
      return 'modify-delete'; // One side deleted, other modified
    }
  }

  return 'unknown';
}
