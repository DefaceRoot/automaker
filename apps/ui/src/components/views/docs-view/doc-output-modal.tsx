import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, FileText, Copy, Check, Wrench, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { DocType } from '@/lib/http-api-client';
import type { DocLogs } from '@/store/app-store';

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

interface DocOutputModalProps {
  open: boolean;
  onClose: () => void;
  docType: DocType;
  projectPath: string;
  isGenerating: boolean;
  logs?: DocLogs;
}

export function DocOutputModal({
  open,
  onClose,
  docType,
  isGenerating,
  logs,
}: DocOutputModalProps) {
  const [copied, setCopied] = useState(false);
  const [showTools, setShowTools] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const prevToolCallsLength = useRef(0);
  const prevOutputLength = useRef(0);

  const docInfo = DOC_TYPE_INFO[docType];

  // Get tool calls and output from logs prop
  const toolCalls = logs?.toolCalls ?? [];
  const output = logs?.output ?? '';

  // Copy output to clipboard
  const handleCopyOutput = async () => {
    if (!output) return;

    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast.success('Output copied to clipboard');

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy output:', error);
      toast.error('Failed to copy output');
    }
  };

  // Auto-scroll to bottom when output or tool calls change
  useEffect(() => {
    const toolCallsChanged = toolCalls.length !== prevToolCallsLength.current;
    const outputChanged = output.length !== prevOutputLength.current;

    if ((toolCallsChanged || outputChanged) && autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }

    prevToolCallsLength.current = toolCalls.length;
    prevOutputLength.current = output.length;
  }, [toolCalls.length, output.length]);

  // Reset auto-scroll when modal opens
  useEffect(() => {
    if (open) {
      autoScrollRef.current = true;
    }
  }, [open]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    autoScrollRef.current = isAtBottom;
  };

  // Get tool icon based on tool name
  const getToolIcon = (toolName: string) => {
    const iconClass = 'w-3 h-3';
    switch (toolName.toLowerCase()) {
      case 'read':
        return <FileText className={iconClass} />;
      case 'bash':
        return <Terminal className={iconClass} />;
      default:
        return <Wrench className={iconClass} />;
    }
  };

  // Get tool color based on tool name
  const getToolColor = (toolName: string) => {
    switch (toolName.toLowerCase()) {
      case 'read':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'glob':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'grep':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'task':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      default:
        return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="w-[60vw] max-w-[60vw] max-h-[80vh] flex flex-col"
        data-testid="doc-output-modal"
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isGenerating && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
              {docInfo.displayName} - Generation Output
            </DialogTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTools(!showTools)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  showTools
                    ? 'bg-primary/20 text-primary shadow-sm'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                data-testid="toggle-tools-button"
              >
                <Wrench className="w-3.5 h-3.5" />
                Tools ({toolCalls.length})
              </button>
              <button
                onClick={handleCopyOutput}
                disabled={!output}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  copied
                    ? 'bg-green-500/20 text-green-500'
                    : output
                      ? 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                      : 'bg-muted text-muted-foreground/50 cursor-not-allowed'
                )}
                title="Copy output to clipboard"
                data-testid="copy-output-button"
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
          </div>
          <DialogDescription className="mt-1">
            {docInfo.description} - Real-time AI generation output
          </DialogDescription>
        </DialogHeader>

        {/* Tool calls panel - expands when no output yet */}
        {showTools && toolCalls.length > 0 ? (
          <div
            ref={!output ? scrollRef : undefined}
            onScroll={!output ? handleScroll : undefined}
            className={cn(
              'bg-card rounded-lg border border-border p-3 overflow-y-auto scrollbar-visible',
              output ? 'flex-shrink-0 max-h-32' : 'flex-1 min-h-[200px]'
            )}
          >
            <div className="space-y-1.5">
              {(output ? toolCalls.slice(-10) : toolCalls).map((call) => (
                <div
                  key={call.id}
                  className={cn(
                    'flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border',
                    getToolColor(call.tool)
                  )}
                >
                  {getToolIcon(call.tool)}
                  <span className="font-medium">{call.tool}</span>
                  {call.input && (
                    <span className="text-muted-foreground truncate max-w-[400px]">
                      {String(
                        call.input.file_path ||
                          call.input.pattern ||
                          call.input.path ||
                          JSON.stringify(call.input).slice(0, 60)
                      )}
                      ...
                    </span>
                  )}
                </div>
              ))}
              {output && toolCalls.length > 10 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Showing last 10 of {toolCalls.length} tool calls
                </p>
              )}
            </div>
          </div>
        ) : !output && isGenerating ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground min-h-[200px]">
            <p className="text-sm">Waiting for agent activity...</p>
          </div>
        ) : !output ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground min-h-[200px]">
            <p className="text-sm">Output will appear here when generation starts.</p>
          </div>
        ) : null}

        {/* Output viewer - only show when there's actual output */}
        {output && (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto bg-zinc-950 rounded-lg p-4 font-mono text-xs min-h-[200px] max-h-[60vh] scrollbar-visible"
          >
            <div className="whitespace-pre-wrap break-words text-zinc-300">{output}</div>
          </div>
        )}

        {output && (
          <div className="text-xs text-muted-foreground text-center flex-shrink-0">
            {autoScrollRef.current
              ? 'Auto-scrolling enabled'
              : 'Scroll to bottom to enable auto-scroll'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
