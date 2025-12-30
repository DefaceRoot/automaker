import { FileText, FileCode, FolderTree, BookOpen, Settings, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocType, DocInfo } from '@/lib/http-api-client';

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
  selectedDocType: DocType | null;
  onSelectDoc: (docType: DocType) => void;
  isGenerating?: boolean;
}

export function DocSidebar({
  docs,
  selectedDocType,
  onSelectDoc,
  isGenerating = false,
}: DocSidebarProps) {
  // Check if a doc type has content (exists in docs list)
  const hasContent = (docType: DocType): boolean => {
    const docItem = docs.find((d) => d.docType === docType);
    return docItem?.exists ?? false;
  };

  // Count of available documents
  const availableCount = docs.filter((d) => d.exists).length;

  return (
    <div className="w-64 border-r border-border flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Documents {availableCount > 0 && `(${availableCount}/${DOC_TYPE_ORDER.length})`}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2" data-testid="doc-sidebar-list">
        {availableCount === 0 && !isGenerating ? (
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
              const docHasContent = hasContent(docType);
              const Icon = info.icon;
              const isSelected = selectedDocType === docType;
              const isClickable = docHasContent;

              return (
                <button
                  key={docType}
                  onClick={() => isClickable && onSelectDoc(docType)}
                  disabled={!isClickable}
                  className={cn(
                    'group w-full flex items-start gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                    isSelected
                      ? 'bg-primary/10 text-foreground'
                      : isClickable
                        ? 'text-foreground hover:bg-accent'
                        : 'text-muted-foreground/50 cursor-not-allowed'
                  )}
                  data-testid={`doc-sidebar-item-${docType}`}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 flex-shrink-0 mt-0.5',
                      isSelected && 'text-primary',
                      !isClickable && 'opacity-50'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'text-sm font-medium truncate block',
                        isSelected && 'text-primary'
                      )}
                    >
                      {info.displayName}
                    </span>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {info.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
