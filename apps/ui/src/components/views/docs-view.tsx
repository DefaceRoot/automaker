import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { getElectronAPI } from '@/lib/electron';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, FileText, Play, Square, Loader2, Files } from 'lucide-react';
import { DocMarkdown } from '../ui/doc-markdown';
import { DocSidebar } from './docs-view/doc-sidebar';
import { useDocsEvents } from '@/hooks/use-docs-events';
import type { DocType, DocInfo, DocProgress } from '@/lib/http-api-client';

export function DocsView() {
  const { currentProject } = useAppStore();
  const { isGenerating, progress } = useDocsEvents();

  const [docs, setDocs] = useState<DocInfo[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<DocType | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Load docs list
  const loadDocs = useCallback(async () => {
    if (!currentProject) return;

    setIsLoading(true);
    try {
      const api = getElectronAPI();
      if (!api.docs) {
        toast.error('Docs API not available');
        return;
      }
      const result = await api.docs.list(currentProject.path);
      if (result.success && result.docs) {
        setDocs(result.docs);
        // Auto-select first available doc if none selected
        if (!selectedDocType) {
          const firstAvailable = result.docs.find((d) => d.exists);
          if (firstAvailable) {
            setSelectedDocType(firstAvailable.docType);
          }
        }
      }
    } catch (error) {
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, selectedDocType]);

  // Load docs on mount and when project changes
  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Reload docs when generation completes
  useEffect(() => {
    if (!isGenerating && progress.length > 0) {
      // Generation just completed, reload docs list
      const timer = setTimeout(() => {
        loadDocs();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isGenerating, progress.length, loadDocs]);

  // Load selected document content
  const loadDocContent = useCallback(
    async (docType: DocType) => {
      if (!currentProject) return;

      setIsLoadingContent(true);
      setSelectedContent(null);
      try {
        const api = getElectronAPI();
        if (!api.docs) {
          toast.error('Docs API not available');
          return;
        }
        const result = await api.docs.getContent(currentProject.path, docType);
        if (result.success && result.content) {
          setSelectedContent(result.content);
        } else {
          setSelectedContent(null);
        }
      } catch (error) {
        toast.error('Failed to load document content');
        setSelectedContent(null);
      } finally {
        setIsLoadingContent(false);
      }
    },
    [currentProject]
  );

  // Load content when selection changes
  useEffect(() => {
    if (selectedDocType) {
      loadDocContent(selectedDocType);
    } else {
      setSelectedContent(null);
    }
  }, [selectedDocType, loadDocContent]);

  // Handle doc selection
  const handleSelectDoc = (docType: DocType) => {
    setSelectedDocType(docType);
  };

  // Handle generate docs
  const handleGenerate = async () => {
    if (!currentProject) return;

    try {
      const api = getElectronAPI();
      if (!api.docs) {
        toast.error('Docs API not available');
        return;
      }
      const result = await api.docs.generate(currentProject.path);
      if (!result.success) {
        toast.error('Failed to start generation', { description: result.error });
      }
    } catch (error) {
      toast.error('Failed to start generation');
    }
  };

  // Handle stop generation
  const handleStop = async () => {
    if (!currentProject) return;

    try {
      const api = getElectronAPI();
      if (!api.docs) {
        toast.error('Docs API not available');
        return;
      }
      const result = await api.docs.stop(currentProject.path);
      if (!result.success) {
        toast.error('Failed to stop generation', { description: result.error });
      }
    } catch (error) {
      toast.error('Failed to stop generation');
    }
  };

  // Convert store DocProgress format to component DocProgress format
  const mappedProgress: DocProgress[] = progress.map((p) => ({
    docType: p.docType as DocType,
    displayName: p.docType,
    status: p.status === 'running' ? 'generating' : p.status,
    filename: `${p.docType}.md`,
    error: p.message,
  }));

  // No project state
  if (!currentProject) {
    return (
      <div
        className="flex-1 flex items-center justify-center content-bg"
        data-testid="docs-view-no-project"
      >
        <div className="text-center">
          <Files className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Open a project to view or generate documentation</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center content-bg"
        data-testid="docs-view-loading"
      >
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden content-bg" data-testid="docs-view">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-glass backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Files className="w-5 h-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold">Documentation</h1>
            <p className="text-sm text-muted-foreground">AI-generated project documentation</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDocs}
            disabled={isGenerating}
            data-testid="refresh-docs-button"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {isGenerating ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              data-testid="stop-docs-button"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button size="sm" onClick={handleGenerate} data-testid="generate-docs-button">
              <Play className="w-4 h-4 mr-2" />
              Generate Docs
            </Button>
          )}
        </div>
      </div>

      {/* Main content area with sidebar and viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Document Sidebar */}
        <DocSidebar
          docs={docs}
          progress={mappedProgress}
          selectedDocType={selectedDocType}
          onSelectDoc={handleSelectDoc}
          isGenerating={isGenerating}
        />

        {/* Right Panel - Document Viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedDocType ? (
            <>
              {/* Document header */}
              <div className="flex items-center gap-2 p-3 border-b border-border bg-card">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium">
                  {docs.find((d) => d.docType === selectedDocType)?.displayName || selectedDocType}
                </span>
              </div>

              {/* Document content */}
              <div className="flex-1 overflow-auto p-4">
                {isLoadingContent ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : selectedContent ? (
                  <Card className="p-6" data-testid="doc-content-viewer">
                    <DocMarkdown>{selectedContent}</DocMarkdown>
                  </Card>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <FileText className="w-12 h-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">
                      This document hasn't been generated yet.
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">
                      Click "Generate Docs" to create it.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground-secondary">Select a document to view</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Or click "Generate Docs" to create documentation
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
