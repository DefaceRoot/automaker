"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app-store";
import { getElectronAPI } from "@/lib/electron";
import { pathsEqual } from "@/lib/utils";
import type { WorktreeInfo } from "../types";

interface UseWorktreesOptions {
  projectPath: string;
  refreshTrigger?: number;
  onRemovedWorktrees?: (removedWorktrees: Array<{ path: string; branch: string }>) => void;
}

export function useWorktrees({ projectPath, refreshTrigger = 0, onRemovedWorktrees }: UseWorktreesOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);

  const currentWorktree = useAppStore((s) => s.getCurrentWorktree(projectPath));
  const setCurrentWorktree = useAppStore((s) => s.setCurrentWorktree);
  const setWorktreesInStore = useAppStore((s) => s.setWorktrees);
  const useWorktreesEnabled = useAppStore((s) => s.useWorktrees);

  const fetchWorktrees = useCallback(async () => {
    if (!projectPath) return;
    setIsLoading(true);
    try {
      const api = getElectronAPI();
      if (!api?.worktree?.listAll) {
        console.warn("Worktree API not available");
        return;
      }
      const result = await api.worktree.listAll(projectPath, true);
      if (result.success && result.worktrees) {
        setWorktrees(result.worktrees);
        setWorktreesInStore(projectPath, result.worktrees);
      }
      // Return removed worktrees so they can be handled by the caller
      return result.removedWorktrees;
    } catch (error) {
      console.error("Failed to fetch worktrees:", error);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, setWorktreesInStore]);

  useEffect(() => {
    fetchWorktrees();
  }, [fetchWorktrees]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchWorktrees().then((removedWorktrees) => {
        if (removedWorktrees && removedWorktrees.length > 0 && onRemovedWorktrees) {
          onRemovedWorktrees(removedWorktrees);
        }
      });
    }
  }, [refreshTrigger, fetchWorktrees, onRemovedWorktrees]);

  useEffect(() => {
    if (worktrees.length > 0) {
      const currentPath = currentWorktree?.path;
      const currentWorktreeExists = currentPath === null
        ? true
        : worktrees.some((w) => !w.isMain && pathsEqual(w.path, currentPath));

      if (currentWorktree == null || (currentPath !== null && !currentWorktreeExists)) {
        // Find the primary worktree and get its branch name
        // Fallback to "main" only if worktrees haven't loaded yet
        const mainWorktree = worktrees.find((w) => w.isMain);
        const mainBranch = mainWorktree?.branch || "main";
        setCurrentWorktree(projectPath, null, mainBranch);
      }
    }
  }, [worktrees, currentWorktree, projectPath, setCurrentWorktree]);

  const handleSelectWorktree = useCallback(
    (worktree: WorktreeInfo) => {
      setCurrentWorktree(
        projectPath,
        worktree.isMain ? null : worktree.path,
        worktree.branch
      );
    },
    [projectPath, setCurrentWorktree]
  );

  const currentWorktreePath = currentWorktree?.path ?? null;
  const selectedWorktree = currentWorktreePath
    ? worktrees.find((w) => pathsEqual(w.path, currentWorktreePath))
    : worktrees.find((w) => w.isMain);

  return {
    isLoading,
    worktrees,
    currentWorktree,
    currentWorktreePath,
    selectedWorktree,
    useWorktreesEnabled,
    fetchWorktrees,
    handleSelectWorktree,
  };
}
