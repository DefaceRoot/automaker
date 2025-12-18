import { useEffect } from "react";
import { getElectronAPI } from "@/lib/electron";
import { useAppStore } from "@/store/app-store";

interface UseBoardEffectsProps {
  currentProject: { path: string; id: string } | null;
  specCreatingForProject: string | null;
  setSpecCreatingForProject: (path: string | null) => void;
  setSuggestionsCount: (count: number) => void;
  setFeatureSuggestions: (suggestions: any[]) => void;
  setIsGeneratingSuggestions: (generating: boolean) => void;
  checkContextExists: (featureId: string) => Promise<boolean>;
  features: any[];
  isLoading: boolean;
  setFeaturesWithContext: (set: Set<string>) => void;
}

export function useBoardEffects({
  currentProject,
  specCreatingForProject,
  setSpecCreatingForProject,
  setSuggestionsCount,
  setFeatureSuggestions,
  setIsGeneratingSuggestions,
  checkContextExists,
  features,
  isLoading,
  setFeaturesWithContext,
}: UseBoardEffectsProps) {
  // Make current project available globally for modal
  useEffect(() => {
    if (currentProject) {
      (window as any).__currentProject = currentProject;
    }
    return () => {
      (window as any).__currentProject = null;
    };
  }, [currentProject]);

  // Listen for suggestions events to update count (persists even when dialog is closed)
  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.suggestions) return;

    const unsubscribe = api.suggestions.onEvent((event) => {
      if (event.type === "suggestions_complete" && event.suggestions) {
        setSuggestionsCount(event.suggestions.length);
        setFeatureSuggestions(event.suggestions);
        setIsGeneratingSuggestions(false);
      } else if (event.type === "suggestions_error") {
        setIsGeneratingSuggestions(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [setSuggestionsCount, setFeatureSuggestions, setIsGeneratingSuggestions]);

  // Subscribe to spec regeneration events to clear creating state on completion
  useEffect(() => {
    const api = getElectronAPI();
    if (!api.specRegeneration) return;

    const unsubscribe = api.specRegeneration.onEvent((event) => {
      console.log(
        "[BoardView] Spec regeneration event:",
        event.type,
        "for project:",
        event.projectPath
      );

      if (event.projectPath !== specCreatingForProject) {
        return;
      }

      if (event.type === "spec_regeneration_complete") {
        setSpecCreatingForProject(null);
      } else if (event.type === "spec_regeneration_error") {
        setSpecCreatingForProject(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [specCreatingForProject, setSpecCreatingForProject]);

  // Sync running tasks from electron backend on mount
  useEffect(() => {
    if (!currentProject) return;

    const syncRunningTasks = async () => {
      try {
        const api = getElectronAPI();
        if (!api?.autoMode?.status) return;

        const status = await api.autoMode.status(currentProject.path);
        if (status.success) {
          const projectId = currentProject.id;
          const { clearRunningTasks, addRunningTask } = useAppStore.getState();

          if (status.runningFeatures) {
            console.log(
              "[Board] Syncing running tasks from backend:",
              status.runningFeatures
            );

            clearRunningTasks(projectId);

            status.runningFeatures.forEach((featureId: string) => {
              addRunningTask(projectId, featureId);
            });
          }
        }
      } catch (error) {
        console.error("[Board] Failed to sync running tasks:", error);
      }
    };

    syncRunningTasks();
  }, [currentProject]);

  // Check which features have context files
  useEffect(() => {
    const checkAllContexts = async () => {
      const featuresWithPotentialContext = features.filter(
        (f) =>
          f.status === "in_progress" ||
          f.status === "waiting_approval" ||
          f.status === "verified"
      );
      const contextChecks = await Promise.all(
        featuresWithPotentialContext.map(async (f) => ({
          id: f.id,
          hasContext: await checkContextExists(f.id),
        }))
      );

      const newSet = new Set<string>();
      contextChecks.forEach(({ id, hasContext }) => {
        if (hasContext) {
          newSet.add(id);
        }
      });

      setFeaturesWithContext(newSet);
    };

    if (features.length > 0 && !isLoading) {
      checkAllContexts();
    }
  }, [features, isLoading, checkContextExists, setFeaturesWithContext]);
}
