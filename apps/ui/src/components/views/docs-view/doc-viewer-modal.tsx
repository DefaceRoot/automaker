import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Copy, Check, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getElectronAPI } from '@/lib/electron';
import { DocMarkdown } from '@/components/ui/doc-markdown';
import type { DocType } from '@/lib/http-api-client';

// Doc type display info
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

interface DocViewerModalProps {
  open: boolean;
  onClose: () => void;
  docType: DocType;
  projectPath: string;
}

export function DocViewerModal({ open, onClose, docType, projectPath }: DocViewerModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const docInfo = DOC_TYPE_INFO[docType];

  // Load document content when modal opens
  useEffect(() => {
    if (!open || !projectPath || !docType) {
      setContent(null);
      return;
    }

    const loadContent = async () => {
      setIsLoading(true);
      try {
        const api = getElectronAPI();
        if (!api.docs) {
          toast.error('Docs API not available');
          return;
        }
        const result = await api.docs.getContent(projectPath, docType);
        if (result.success && result.content) {
          setContent(result.content);
        } else {
          setContent(null);
          toast.error('Failed to load document content');
        }
      } catch (error) {
        console.error('Failed to load document content:', error);
        toast.error('Failed to load document content');
        setContent(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [open, projectPath, docType]);

  // Copy content to clipboard
  const handleCopyContent = async () => {
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Document copied to clipboard');

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy document:', error);
      toast.error('Failed to copy document');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="w-[70vw] max-w-[70vw] h-[85vh] max-h-[85vh] flex flex-col"
        data-testid="doc-viewer-modal"
      >
        <DialogHeader className="flex-shrink-0 pb-4">
          <div className="flex items-center gap-3">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-500" />
              {docInfo.displayName}
            </DialogTitle>
            <button
              onClick={handleCopyContent}
              disabled={!content}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                copied
                  ? 'bg-green-500/20 text-green-500'
                  : content
                    ? 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                    : 'bg-muted text-muted-foreground/50 cursor-not-allowed'
              )}
              title="Copy document to clipboard"
              data-testid="copy-doc-content-button"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <DialogDescription>{docInfo.description}</DialogDescription>
        </DialogHeader>

        {/* Document content */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card p-6 scrollbar-visible">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : content ? (
            <DocMarkdown>{content}</DocMarkdown>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="w-12 h-12 mb-3" />
              <p className="text-sm">Document content not available</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
