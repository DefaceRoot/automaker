import { useMemo, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, Terminal, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocProgress, DocType } from '@/lib/http-api-client';
import type { DocsLogsByDocType } from '@/store/app-store';
import { DocOutputModal } from './doc-output-modal';
import { DocViewerModal } from './doc-viewer-modal';

// Document type display information
const DOC_TYPE_INFO: Record<DocType, { displayName: string; description: string }> = {
  'project-overview': {
    displayName: 'Project Overview',
    description: 'High-level summary and features',
  },
  architecture: {
    displayName: 'Architecture',
    description: 'System design and patterns',
  },
  'api-reference': {
    displayName: 'API Reference',
    description: 'Endpoints and parameters',
  },
  'directory-structure': {
    displayName: 'Directory Structure',
    description: 'Folder organization',
  },
  'modules-components': {
    displayName: 'Modules & Components',
    description: 'Module details and dependencies',
  },
  'setup-development': {
    displayName: 'Setup & Development',
    description: 'Installation and dev environment',
  },
};

// Ordered list of doc types for consistent display
const DOC_TYPE_ORDER: DocType[] = [
  'project-overview',
  'architecture',
  'api-reference',
  'directory-structure',
  'modules-components',
  'setup-development',
];

interface GenerationOverlayProps {
  progress: DocProgress[];
  projectPath: string;
  logs: DocsLogsByDocType;
  onStop?: () => void;
}

export function GenerationOverlay({ progress, projectPath, logs, onStop }: GenerationOverlayProps) {
  const [selectedDocType, setSelectedDocType] = useState<DocType | null>(null);
  const [viewingCompletedDoc, setViewingCompletedDoc] = useState<DocType | null>(null);
  // Calculate completion stats
  const stats = useMemo(() => {
    const total = DOC_TYPE_ORDER.length;
    const completed = progress.filter((p) => p.status === 'completed').length;
    const errors = progress.filter((p) => p.status === 'error').length;
    const generating = progress.filter(
      (p) => p.status === 'generating' || p.status === 'pending'
    ).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, errors, generating, percentage };
  }, [progress]);

  // Get status for a doc type
  const getDocStatus = (docType: DocType) => {
    const progressItem = progress.find((p) => p.docType === docType);
    return progressItem?.status || 'pending';
  };

  // Get the currently generating doc type
  const currentlyGenerating = useMemo(() => {
    return progress.find((p) => p.status === 'generating')?.docType;
  }, [progress]);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <style>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.4;
          }
          100% {
            transform: scale(0.8);
            opacity: 0.8;
          }
        }
        @keyframes progress-shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div
        className="flex flex-col items-center gap-6 p-8 max-w-md w-full mx-4"
        style={{ animation: 'fade-in-up 0.3s ease-out' }}
      >
        {/* Animated loader with pulsing ring */}
        <div className="relative">
          {/* Pulsing background ring */}
          <div
            className="absolute inset-0 rounded-full bg-brand-500/20"
            style={{
              animation: 'pulse-ring 2s ease-in-out infinite',
              transform: 'scale(1.5)',
            }}
          />
          {/* Main spinner container */}
          <div className="relative w-20 h-20 rounded-full bg-card border border-border flex items-center justify-center shadow-lg">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
          </div>
          {/* Progress percentage badge */}
          <div className="absolute -bottom-2 -right-2 bg-brand-500 text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md">
            {stats.percentage}%
          </div>
        </div>

        {/* Title and description */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Generating Documentation</h2>
          <p className="text-sm text-muted-foreground">
            AI agents are analyzing your codebase and generating comprehensive documentation.
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {stats.completed} of {stats.total} documents
            </span>
            {stats.errors > 0 && <span className="text-destructive">{stats.errors} error(s)</span>}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
              style={{
                width: `${stats.percentage}%`,
                background: 'linear-gradient(90deg, var(--brand-500), var(--brand-400))',
              }}
            >
              {/* Shimmer effect */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  backgroundSize: '200% 100%',
                  animation: 'progress-shimmer 2s linear infinite',
                }}
              />
            </div>
          </div>
        </div>

        {/* Document status list */}
        <div className="w-full bg-card rounded-lg border border-border p-4 space-y-2">
          {DOC_TYPE_ORDER.map((docType, index) => {
            const status = getDocStatus(docType);
            const info = DOC_TYPE_INFO[docType];
            const isActive = currentlyGenerating === docType;

            return (
              <div
                key={docType}
                className={cn(
                  'flex items-center gap-3 py-2 px-3 rounded-md transition-colors',
                  isActive && 'bg-brand-500/10',
                  status === 'completed' && 'opacity-70'
                )}
                style={{
                  animation: `fade-in-up 0.3s ease-out ${index * 50}ms backwards`,
                }}
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : status === 'error' ? (
                    <XCircle className="w-4 h-4 text-destructive" />
                  ) : status === 'generating' ? (
                    <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                {/* Document info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {info.displayName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{info.description}</div>
                </div>

                {/* Status text and action button */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {status === 'generating' && (
                    <button
                      onClick={() => setSelectedDocType(docType)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 transition-colors"
                      data-testid={`view-output-${docType}`}
                    >
                      <Terminal className="w-3 h-3" />
                      View Output
                    </button>
                  )}
                  {status === 'completed' && (
                    <button
                      onClick={() => setViewingCompletedDoc(docType)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                      data-testid={`view-document-${docType}`}
                    >
                      <FileText className="w-3 h-3" />
                      View Document
                    </button>
                  )}
                  <span
                    className={cn(
                      'text-xs font-medium',
                      status === 'completed' && 'text-green-500',
                      status === 'error' && 'text-destructive',
                      status === 'generating' && 'text-brand-500',
                      status === 'pending' && 'text-muted-foreground'
                    )}
                  >
                    {status === 'completed'
                      ? 'Done'
                      : status === 'error'
                        ? 'Failed'
                        : status === 'generating'
                          ? 'Generating...'
                          : 'Waiting'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Help text */}
        <p className="text-xs text-muted-foreground text-center">
          You can navigate away - generation will continue in the background.
        </p>
      </div>

      {/* Output Modal - for viewing generation output during generation */}
      {selectedDocType && (
        <DocOutputModal
          open={!!selectedDocType}
          onClose={() => setSelectedDocType(null)}
          docType={selectedDocType}
          projectPath={projectPath}
          isGenerating={getDocStatus(selectedDocType) === 'generating'}
          logs={logs[selectedDocType]}
        />
      )}

      {/* Document Viewer Modal - for viewing completed documents */}
      {viewingCompletedDoc && (
        <DocViewerModal
          open={!!viewingCompletedDoc}
          onClose={() => setViewingCompletedDoc(null)}
          docType={viewingCompletedDoc}
          projectPath={projectPath}
        />
      )}
    </div>
  );
}
