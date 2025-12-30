import { useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, type DocsLogsByDocType } from '@/store/app-store';
import { getElectronAPI } from '@/lib/electron';
import type { DocsEvent } from '@/lib/http-api-client';

/**
 * Hook for subscribing to documentation generation WebSocket events
 * and updating the store state based on event type.
 *
 * This hook should be used in components that need to track
 * documentation generation progress in real-time.
 */
export function useDocsEvents() {
  const {
    currentProject,
    docsGeneratingByProject,
    docsProgressByProject,
    docsLogsByProject,
    setDocsGenerating,
    setDocProgress,
    clearDocsProgress,
    addDocToolCall,
    appendDocOutput,
    clearDocsLogs,
  } = useAppStore(
    useShallow((state) => ({
      currentProject: state.currentProject,
      docsGeneratingByProject: state.docsGeneratingByProject,
      docsProgressByProject: state.docsProgressByProject,
      docsLogsByProject: state.docsLogsByProject,
      setDocsGenerating: state.setDocsGenerating,
      setDocProgress: state.setDocProgress,
      clearDocsProgress: state.clearDocsProgress,
      addDocToolCall: state.addDocToolCall,
      appendDocOutput: state.appendDocOutput,
      clearDocsLogs: state.clearDocsLogs,
    }))
  );

  const projectPath = currentProject?.path;

  // Get project-specific docs state
  const isGenerating = projectPath ? (docsGeneratingByProject[projectPath] ?? false) : false;
  const progress = projectPath ? (docsProgressByProject[projectPath] ?? []) : [];
  const logs: DocsLogsByDocType = projectPath ? (docsLogsByProject[projectPath] ?? {}) : {};

  // Handle docs events - listen globally for all projects
  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.docs?.onEvent) return;

    const unsubscribe = api.docs.onEvent((event: DocsEvent) => {
      // Only process events for projects we know about
      const eventProjectPath = event.projectPath;
      if (!eventProjectPath) return;

      switch (event.type) {
        case 'docs:generation-started':
          // Clear previous logs when new generation starts
          clearDocsLogs(eventProjectPath);
          // Mark generation as started for this project
          setDocsGenerating(eventProjectPath, true);
          // Initialize progress for all doc types
          event.docTypes.forEach((doc) => {
            setDocProgress(eventProjectPath, doc.type, 'pending');
          });
          break;

        case 'docs:doc-progress':
          // Update individual doc status to running/generating
          setDocProgress(
            eventProjectPath,
            event.docType,
            event.status === 'generating' ? 'running' : 'pending'
          );
          break;

        case 'docs:doc-completed':
          // Mark individual doc as completed
          setDocProgress(eventProjectPath, event.docType, 'completed');
          break;

        case 'docs:doc-error':
          // Mark individual doc as error with message
          setDocProgress(
            eventProjectPath,
            event.docType,
            'error',
            event.stopped ? 'Generation stopped' : event.error
          );
          break;

        case 'docs:generation-completed':
          // Mark generation as complete for this project
          setDocsGenerating(eventProjectPath, false);
          break;

        case 'docs:doc-tool':
          // Capture tool call for this doc type
          addDocToolCall(eventProjectPath, event.docType, event.tool, event.input);
          break;

        case 'docs:doc-output':
          // Append output for this doc type
          appendDocOutput(eventProjectPath, event.docType, event.content);
          break;
      }
    });

    return unsubscribe;
  }, [setDocsGenerating, setDocProgress, addDocToolCall, appendDocOutput, clearDocsLogs]);

  // Clear progress for the current project
  const clearProgress = useCallback(() => {
    if (projectPath) {
      clearDocsProgress(projectPath);
    }
  }, [projectPath, clearDocsProgress]);

  return {
    isGenerating,
    progress,
    logs,
    clearProgress,
  };
}
