import {
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileCode,
  FolderTree,
  BookOpen,
  Settings,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocType, DocInfo, DocProgress } from '@/lib/http-api-client';

// Document type display information
const DOC_TYPE_INFO: Record<
  DocType,
  { displayName: string; icon: React.ElementType; description: string }
> = {
  'project-overview': {
    displayName: 'Project Overview',
    icon: BookOpen,
    description: 'High-level summary, tech stack, and features',
  },
  architecture: {
    displayName: 'Architecture',
    icon: Layers,
    description: 'System design, patterns, and component diagrams',
  },
  'api-reference': {
    displayName: 'API Reference',
    icon: FileCode,
    description: 'Endpoints, parameters, responses, and examples',
  },
  'directory-structure': {
    displayName: 'Directory Structure',
    icon: FolderTree,
    description: 'Folder organization with explanations',
  },
  'modules-components': {
    displayName: 'Modules & Components',
    icon: Layers,
    description: 'Module details, functions, and dependencies',
  },
  'setup-development': {
    displayName: 'Setup & Development',
    icon: Settings,
    description: 'Installation, dev environment, and testing',
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

interface DocSidebarProps {
  docs: DocInfo[];
  progress: DocProgress[];
  selectedDocType: DocType | null;
  onSelectDoc: (docType: DocType) => void;
  isGenerating: boolean;
}

export function DocSidebar({
  docs,
  progress,
  selectedDocType,
  onSelectDoc,
  isGenerating,
}: DocSidebarProps) {
  // Get status for a doc type from progress or docs
  const getDocStatus = (
    docType: DocType
  ): { status: string; hasContent: boolean; error?: string } => {
    // First check progress (for active generation)
    const progressItem = progress.find((p) => p.docType === docType);
    if (progressItem) {
      return {
        status: progressItem.status,
        hasContent: progressItem.status === 'completed',
        error: progressItem.error,
      };
    }

    // Then check docs (for existing files)
    const docItem = docs.find((d) => d.docType === docType);
    if (docItem?.exists) {
      return { status: 'completed', hasContent: true };
    }

    return { status: 'pending', hasContent: false };
  };

  // Render status indicator
  const renderStatusIndicator = (status: string, error?: string) => {
    switch (status) {
      case 'generating':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'stopped':
        return <XCircle className="w-4 h-4 text-yellow-500" />;
      case 'pending':
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="w-64 border-r border-border flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Documents ({docs.filter((d) => d.exists).length}/{DOC_TYPE_ORDER.length})
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2" data-testid="doc-sidebar-list">
        {DOC_TYPE_ORDER.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <FileText className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No documents yet.
              <br />
              Click "Generate Docs" to create them.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {DOC_TYPE_ORDER.map((docType) => {
              const info = DOC_TYPE_INFO[docType];
              const { status, hasContent, error } = getDocStatus(docType);
              const Icon = info.icon;
              const isSelected = selectedDocType === docType;
              const isClickable = hasContent || status === 'completed';

              return (
                <button
                  key={docType}
                  onClick={() => isClickable && onSelectDoc(docType)}
                  disabled={!isClickable && !isGenerating}
                  className={cn(
                    'group w-full flex items-start gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                    isSelected
                      ? 'bg-primary/20 text-foreground border border-primary/30'
                      : isClickable
                        ? 'text-foreground hover:bg-accent'
                        : 'text-muted-foreground cursor-not-allowed',
                    !isClickable && isGenerating && 'opacity-70'
                  )}
                  data-testid={`doc-sidebar-item-${docType}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{info.displayName}</span>
                      {renderStatusIndicator(status, error)}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {info.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Generation Progress Summary */}
      {isGenerating && progress.length > 0 && (
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              Generating... {progress.filter((p) => p.status === 'completed').length}/
              {DOC_TYPE_ORDER.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
