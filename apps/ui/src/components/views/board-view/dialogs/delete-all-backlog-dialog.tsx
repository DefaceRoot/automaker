import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface DeleteAllBacklogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backlogCount: number;
  onConfirm: () => void;
}

export function DeleteAllBacklogDialog({
  open,
  onOpenChange,
  backlogCount,
  onConfirm,
}: DeleteAllBacklogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="delete-all-backlog-dialog">
        <DialogHeader>
          <DialogTitle>Delete All Backlog Features</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete all backlog features? This action cannot be undone.
            {backlogCount > 0 && (
              <span className="block mt-2 text-yellow-500">
                {backlogCount} feature(s) will be deleted.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            data-testid="confirm-delete-all-backlog"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
