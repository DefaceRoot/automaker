import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { getElectronAPI } from '@/lib/electron';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  RefreshCw,
  FileText,
  Play,
  Square,
  Loader2,
  Files,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react';
import { DocMarkdown } from '../ui/doc-markdown';
import { DocSidebar } from './docs-view/doc-sidebar';
import { GenerationOverlay } from './docs-view/generation-overlay';
import { useDocsEvents } from '@/hooks/use-docs-events';
import { CLAUDE_MODELS } from '@/components/views/board-view/shared/model-constants';
import { cn } from '@/lib/utils';
import type { DocType, DocInfo, DocProgress, GenerationMode } from '@/lib/http-api-client';
import type { AgentModel } from '@automaker/types';

export function DocsView() {
  const { currentProject } = useAppStore();
  const { isGenerating, progress, logs } = useDocsEvents();

  const [docs, setDocs] = useState<DocInfo[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<DocType | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AgentModel>('sonnet');

  // Check if we have any generated docs
  const hasGeneratedDocs = docs.some((d) => d.exists);

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

  // Check if generation is already running when component mounts
  // This handles the case where user refreshes the page during generation
  useEffect(() => {
    const checkStatus = async () => {
      if (!currentProject) return;

      try {
        const api = getElectronAPI();
        if (!api.docs?.status) return;

        const result = await api.docs.status(currentProject.path);
        if (result.success && result.status?.isGenerating) {
          // Server says generation is running - update the store
          // if we missed the 'generation-started' event
          const { setDocsGenerating, setDocProgress } = useAppStore.getState();
          setDocsGenerating(currentProject.path, true);

          // Initialize progress from server status
          if (result.status.progress) {
            for (const p of result.status.progress) {
              setDocProgress(
                currentProject.path,
                p.docType,
                p.status === 'generating' ? 'running' : p.status,
                p.error
              );
            }
          }
        }
      } catch (error) {
        console.error('[DocsView] Failed to check generation status:', error);
      }
    };

    checkStatus();
  }, [currentProject]);

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

  // Handle generate docs with optional mode
  const handleGenerate = async (mode?: GenerationMode) => {
    if (!currentProject) return;

    try {
      const api = getElectronAPI();
      if (!api.docs) {
        toast.error('Docs API not available');
        return;
      }
      const result = await api.docs.generate(currentProject.path, selectedModel, mode);
      if (!result.success) {
        toast.error('Failed to start generation', { description: result.error });
      } else {
        const modeLabel = result.mode === 'regenerate' ? 'regeneration' : 'generation';
        toast.success(`Started documentation ${modeLabel}`);
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

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!selectedContent) return;

    try {
      await navigator.clipboard.writeText(selectedContent);
      setIsCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
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

  // Generation in progress - show full-screen overlay
  if (isGenerating) {
    return (
      <div
        className="flex-1 flex flex-col overflow-hidden content-bg relative"
        data-testid="docs-view-generating"
      >
        {/* Minimal header during generation */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-glass backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Files className="w-5 h-5 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-bold">Documentation</h1>
              <p className="text-sm text-muted-foreground">Generating documentation...</p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleStop}
            data-testid="stop-docs-button"
          >
            <Square className="w-4 h-4 mr-2" />
            Stop Generation
          </Button>
        </div>

        {/* Full-screen generation overlay */}
        <div className="flex-1 relative">
          <GenerationOverlay
            progress={mappedProgress}
            projectPath={currentProject.path}
            logs={logs}
            onStop={handleStop}
          />
        </div>
      </div>
    );
  }

  // No docs generated yet - show simple generate prompt
  if (!hasGeneratedDocs) {
    return (
      <div
        className="flex-1 flex flex-col overflow-hidden content-bg"
        data-testid="docs-view-empty"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-glass backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Files className="w-5 h-5 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-bold">Documentation</h1>
              <p className="text-sm text-muted-foreground">AI-generated project documentation</p>
            </div>
          </div>
        </div>

        {/* Empty state with generate button */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-20 h-20 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-brand-500" />
            </div>
            <h2 className="text-2xl font-semibold mb-3">Generate Documentation</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              AI agents will analyze your codebase and generate comprehensive documentation
              including project overview, architecture, API reference, and more.
            </p>
            <div className="flex items-center justify-center gap-2 mb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 gap-1 text-sm font-medium rounded-xl border-border px-3"
                    data-testid="docs-model-selector-empty"
                  >
                    {CLAUDE_MODELS.find((m) => m.id === selectedModel)?.label || 'Sonnet'}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  {CLAUDE_MODELS.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={cn('cursor-pointer', selectedModel === model.id && 'bg-accent')}
                      data-testid={`docs-model-option-${model.id}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{model.label}</span>
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="lg"
                onClick={() => handleGenerate('generate')}
                data-testid="generate-docs-button-empty"
              >
                <Play className="w-5 h-5 mr-2" />
                Generate Documentation
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This may take a few minutes. You can navigate away while generating.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Normal view with docs available
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
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" onClick={loadDocs} data-testid="refresh-docs-button">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                data-testid="docs-model-selector"
              >
                {CLAUDE_MODELS.find((m) => m.id === selectedModel)?.label.replace('Claude ', '') ||
                  'Sonnet'}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {CLAUDE_MODELS.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={cn('cursor-pointer', selectedModel === model.id && 'bg-accent')}
                  data-testid={`docs-model-option-${model.id}`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{model.label}</span>
                    <span className="text-xs text-muted-foreground">{model.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" data-testid="generate-docs-button">
                <Play className="w-4 h-4 mr-2" />
                Regenerate
                <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => handleGenerate('regenerate')}
                className="cursor-pointer"
                data-testid="regenerate-option"
              >
                <div className="flex flex-col">
                  <span className="font-medium">Regenerate (Update)</span>
                  <span className="text-xs text-muted-foreground">
                    Incremental update based on code changes
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleGenerate('generate')}
                className="cursor-pointer"
                data-testid="generate-full-option"
              >
                <div className="flex flex-col">
                  <span className="font-medium">Generate (Full)</span>
                  <span className="text-xs text-muted-foreground">
                    Complete regeneration from scratch
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main content area with sidebar and viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Document Sidebar */}
        <DocSidebar
          docs={docs}
          selectedDocType={selectedDocType}
          onSelectDoc={handleSelectDoc}
          isGenerating={false}
        />

        {/* Right Panel - Document Viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedDocType ? (
            <>
              {/* Document header with copy button */}
              <div className="flex items-center justify-between p-3 border-b border-border bg-card">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium">
                    {docs.find((d) => d.docType === selectedDocType)?.displayName ||
                      selectedDocType}
                  </span>
                </div>
                {selectedContent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-8"
                    data-testid="copy-doc-button"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                )}
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
                      Click "Regenerate" to create it.
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
