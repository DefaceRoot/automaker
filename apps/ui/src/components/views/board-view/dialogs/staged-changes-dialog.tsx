import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GitMerge, Loader2, ExternalLink, XCircle, FileCode, CheckCircle2 } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron';
import { toast } from 'sonner';
import type { Feature } from '@/store/app-store';

interface StagedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: Feature | null;
  suggestedMessage: string;
  diffSummary: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  projectPath: string;
  onCommitted: () => void;
  onAbort: () => void;
}

export function StagedChangesDialog({
  open,
  onOpenChange,
  feature,
  suggestedMessage,
  diffSummary,
  filesChanged,
  insertions,
  deletions,
  projectPath,
  onCommitted,
  onAbort,
}: StagedChangesDialogProps) {
  const [isMerging, setIsMerging] = useState(false);
  const [isAborting, setIsAborting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmMerge = async () => {
    if (!feature) return;

    setIsMerging(true);
    setError(null);

    try {
      const api = getElectronAPI();
      if (!api?.worktree?.commit) {
        setError('Merge API not available');
        return;
      }

      // Commit the staged merge with the suggested message
      const result = await api.worktree.commit(projectPath, suggestedMessage);

      if (result.success && result.result?.committed) {
        toast.success('Changes merged successfully', {
          description: `Merged to ${result.result.branch}`,
        });
        onCommitted();
        onOpenChange(false);
      } else if (result.success && !result.result?.committed) {
        toast.info('No changes to merge', {
          description: result.result?.message || 'All changes may have been unstaged',
        });
      } else {
        setError(result.error || 'Failed to merge changes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge');
    } finally {
      setIsMerging(false);
    }
  };

  const handleAbort = async () => {
    setIsAborting(true);
    setError(null);

    try {
      // The abort is handled by calling git merge --abort in the parent
      onAbort();
      toast.info('Merge cancelled', {
        description: 'Staged changes have been discarded',
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setIsAborting(false);
    }
  };

  const handleOpenInEditor = async () => {
    try {
      const api = getElectronAPI();
      if (!api?.worktree?.openInEditor) {
        toast.error('Editor API not available');
        return;
      }

      const result = await api.worktree.openInEditor(projectPath);
      if (result.success) {
        toast.success('Opened in editor', {
          description: result.result?.message || 'Review the staged changes',
        });
      } else {
        toast.error('Failed to open in editor', {
          description: result.error || 'Unknown error',
        });
      }
    } catch (err) {
      toast.error('Failed to open in editor');
    }
  };

  if (!feature) return null;

  const isLoading = isMerging || isAborting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-purple-500" />
            Review Changes
          </DialogTitle>
          <DialogDescription>
            Changes from the worktree have been staged to the target branch. Review the summary
            below and confirm to complete the merge.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Diff Summary */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileCode className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Changes Summary</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Files changed</span>
                <span className="font-mono text-sm font-medium">{filesChanged}</span>
              </div>
              {insertions > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Additions</span>
                  <span className="font-mono text-sm font-medium text-green-500">
                    +{insertions}
                  </span>
                </div>
              )}
              {deletions > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Deletions</span>
                  <span className="font-mono text-sm font-medium text-red-500">-{deletions}</span>
                </div>
              )}
            </div>
            {diffSummary && diffSummary !== 'No changes staged' && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                {diffSummary}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Click "Review in Editor" to inspect the changes before confirming.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleAbort}
            disabled={isLoading}
            className="sm:mr-auto"
          >
            {isAborting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Cancel
              </>
            )}
          </Button>

          <Button variant="secondary" onClick={handleOpenInEditor} disabled={isLoading}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Review in Editor
          </Button>

          <Button onClick={handleConfirmMerge} disabled={isLoading}>
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm Merge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
