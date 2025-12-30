import { Feature } from '@/store/app-store';
import { GitBranch, GitMerge, GitPullRequest, ExternalLink } from 'lucide-react';

interface CardContentSectionsProps {
  feature: Feature;
  useWorktrees: boolean;
  currentViewBranch?: string; // The branch currently being viewed (for determining when to show target)
}

export function CardContentSections({
  feature,
  useWorktrees,
  currentViewBranch,
}: CardContentSectionsProps) {
  // Determine if we should show the target branch
  // Show target when: feature has a targetBranch AND it's different from the current view
  const showTargetBranch =
    useWorktrees && feature.targetBranch && feature.targetBranch !== currentViewBranch;

  return (
    <>
      {/* Working Branch Display (where code is developed) */}
      {useWorktrees && feature.branchName && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <GitBranch className="w-3 h-3 shrink-0" />
          <span className="font-mono truncate" title={`Working branch: ${feature.branchName}`}>
            {String(feature.branchName)}
          </span>
        </div>
      )}

      {/* Target Branch Display (where code will merge into) */}
      {showTargetBranch && (
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          <GitMerge className="w-3 h-3 shrink-0" />
          <span className="font-mono truncate" title={`Merges into: ${feature.targetBranch}`}>
            → {String(feature.targetBranch)}
          </span>
        </div>
      )}

      {/* PR URL Display */}
      {typeof feature.prUrl === 'string' &&
        /^https?:\/\//i.test(feature.prUrl) &&
        (() => {
          const prNumber = feature.prUrl.split('/').pop();
          return (
            <div className="mb-2">
              <a
                href={feature.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-[11px] text-purple-500 hover:text-purple-400 transition-colors"
                title={feature.prUrl}
                data-testid={`pr-url-${feature.id}`}
              >
                <GitPullRequest className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[150px]">
                  {prNumber ? `Pull Request #${prNumber}` : 'Pull Request'}
                </span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </a>
            </div>
          );
        })()}
    </>
  );
}
