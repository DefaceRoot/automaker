import { useState, useEffect, useCallback, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getElectronAPI } from '@/lib/electron';
import { useAppStore, type ClaudeUsage } from '@/store/app-store';

// Error codes for distinguishing failure modes
const ERROR_CODES = {
  API_BRIDGE_UNAVAILABLE: 'API_BRIDGE_UNAVAILABLE',
  AUTH_ERROR: 'AUTH_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

type UsageError = {
  code: ErrorCode;
  message: string;
};

// Fixed refresh interval (45 seconds)
const REFRESH_INTERVAL_SECONDS = 45;

/**
 * BoardUsageDisplay - A compact inline usage display for the Kanban Board header.
 * Shows session and weekly usage percentages with small progress bars.
 * Click to open a detailed popover with full usage information.
 */
export function BoardUsageDisplay() {
  const { claudeUsage, claudeUsageLastUpdated, setClaudeUsage } = useAppStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UsageError | null>(null);

  // Check if data is stale (older than 2 minutes)
  const isStale = useMemo(() => {
    return !claudeUsageLastUpdated || Date.now() - claudeUsageLastUpdated > 2 * 60 * 1000;
  }, [claudeUsageLastUpdated]);

  const fetchUsage = useCallback(
    async (isAutoRefresh = false) => {
      if (!isAutoRefresh) setLoading(true);
      setError(null);
      try {
        const api = getElectronAPI();
        if (!api.claude) {
          setError({
            code: ERROR_CODES.API_BRIDGE_UNAVAILABLE,
            message: 'Claude API bridge not available',
          });
          return;
        }
        const data = await api.claude.getUsage();
        if ('error' in data) {
          setError({
            code: ERROR_CODES.AUTH_ERROR,
            message: data.message || data.error,
          });
          return;
        }
        setClaudeUsage(data);
      } catch (err) {
        setError({
          code: ERROR_CODES.UNKNOWN,
          message: err instanceof Error ? err.message : 'Failed to fetch usage',
        });
      } finally {
        if (!isAutoRefresh) setLoading(false);
      }
    },
    [setClaudeUsage]
  );

  // Auto-fetch on mount if data is stale
  useEffect(() => {
    if (isStale) {
      fetchUsage(true);
    }
  }, [isStale, fetchUsage]);

  // Auto-refresh interval
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    intervalId = setInterval(() => {
      fetchUsage(true);
    }, REFRESH_INTERVAL_SECONDS * 1000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchUsage]);

  // Fetch when popover opens
  useEffect(() => {
    if (open && (!claudeUsage || isStale)) {
      fetchUsage();
    }
  }, [open, claudeUsage, isStale, fetchUsage]);

  // Derived status color/icon helper
  const getStatusInfo = (percentage: number) => {
    if (percentage >= 75) return { color: 'text-red-500', icon: XCircle, bg: 'bg-red-500' };
    if (percentage >= 50)
      return { color: 'text-orange-500', icon: AlertTriangle, bg: 'bg-orange-500' };
    return { color: 'text-green-500', icon: CheckCircle, bg: 'bg-green-500' };
  };

  // Helper component for the progress bar
  const ProgressBar = ({ percentage, colorClass }: { percentage: number; colorClass: string }) => (
    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
      <div
        className={cn('h-full transition-all duration-500', colorClass)}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );

  const UsageCard = ({
    title,
    subtitle,
    percentage,
    resetText,
    isPrimary = false,
    stale = false,
  }: {
    title: string;
    subtitle: string;
    percentage: number;
    resetText?: string;
    isPrimary?: boolean;
    stale?: boolean;
  }) => {
    const isValidPercentage =
      typeof percentage === 'number' && !isNaN(percentage) && isFinite(percentage);
    const safePercentage = isValidPercentage ? percentage : 0;

    const status = getStatusInfo(safePercentage);
    const StatusIcon = status.icon;

    return (
      <div
        className={cn(
          'rounded-xl border bg-card/50 p-4 transition-opacity',
          isPrimary ? 'border-border/60 shadow-sm' : 'border-border/40',
          (stale || !isValidPercentage) && 'opacity-50'
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className={cn('font-semibold', isPrimary ? 'text-sm' : 'text-xs')}>{title}</h4>
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          </div>
          {isValidPercentage ? (
            <div className="flex items-center gap-1.5">
              <StatusIcon className={cn('w-3.5 h-3.5', status.color)} />
              <span
                className={cn(
                  'font-mono font-bold',
                  status.color,
                  isPrimary ? 'text-base' : 'text-sm'
                )}
              >
                {Math.round(safePercentage)}%
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">N/A</span>
          )}
        </div>
        <ProgressBar
          percentage={safePercentage}
          colorClass={isValidPercentage ? status.bg : 'bg-muted-foreground/30'}
        />
        {resetText && (
          <div className="mt-2 flex justify-end">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {title === 'Session Usage' && <Clock className="w-3 h-3" />}
              {resetText}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Compact inline indicator
  const CompactIndicator = () => {
    if (!claudeUsage) {
      return (
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-b from-secondary/40 to-secondary/10 border border-white/5 backdrop-blur-md cursor-pointer hover:from-secondary/50 hover:to-secondary/20 transition-all duration-300',
            loading && 'opacity-60'
          )}
          onClick={() => setOpen(true)}
        >
          <RefreshCw
            className={cn('w-3.5 h-3.5 text-muted-foreground', loading && 'animate-spin')}
          />
          <span className="text-xs font-medium text-muted-foreground">Loading...</span>
        </div>
      );
    }

    const sessionPercentage = claudeUsage.sessionPercentage ?? 0;
    const weeklyPercentage = claudeUsage.weeklyPercentage ?? 0;

    const getProgressStyles = (percentage: number) => {
      if (percentage >= 75) return 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]';
      if (percentage >= 50) return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]';
      return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]';
    };

    const sessionStyles = getProgressStyles(sessionPercentage);
    const weeklyStyles = getProgressStyles(weeklyPercentage);

    return (
      <div
        className={cn(
          'group flex items-center gap-4 px-4 py-1.5 rounded-full bg-gradient-to-b from-secondary/40 to-secondary/10 border border-white/5 backdrop-blur-md shadow-sm cursor-pointer hover:from-secondary/50 hover:to-secondary/20 hover:border-white/10 hover:shadow-md transition-all duration-300',
          isStale && 'opacity-70 grayscale'
        )}
        onClick={() => setOpen(true)}
      >
        {/* Session indicator */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
            Session
          </span>
          <div className="relative h-1.5 w-14 bg-white/5 rounded-full overflow-hidden shadow-inner">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                sessionStyles
              )}
              style={{ width: `${Math.min(sessionPercentage, 100)}%` }}
            />
          </div>
          <span
            className={cn(
              'text-xs font-mono font-medium tabular-nums min-w-[2.5ch]',
              sessionPercentage > 90 ? 'text-rose-400' : 'text-foreground/90'
            )}
          >
            {Math.round(sessionPercentage)}%
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-3 bg-white/10 group-hover:bg-white/20 transition-colors" />

        {/* Weekly indicator */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 group-hover:text-muted-foreground transition-colors">
            Weekly
          </span>
          <div className="relative h-1.5 w-14 bg-white/5 rounded-full overflow-hidden shadow-inner">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                weeklyStyles
              )}
              style={{ width: `${Math.min(weeklyPercentage, 100)}%` }}
            />
          </div>
          <span
            className={cn(
              'text-xs font-mono font-medium tabular-nums min-w-[2.5ch]',
              weeklyPercentage > 90 ? 'text-rose-400' : 'text-foreground/90'
            )}
          >
            {Math.round(weeklyPercentage)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <CompactIndicator />
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border shadow-2xl"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-secondary/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Claude Usage</span>
          </div>
          {error && (
            <button
              className={cn(
                'text-muted-foreground hover:text-foreground transition-colors',
                loading && 'opacity-80'
              )}
              onClick={() => !loading && fetchUsage(false)}
              disabled={loading}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {error ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-yellow-500/80" />
              <div className="space-y-1 flex flex-col items-center">
                <p className="text-sm font-medium">{error.message}</p>
                <p className="text-xs text-muted-foreground">
                  {error.code === ERROR_CODES.API_BRIDGE_UNAVAILABLE ? (
                    'Ensure the Electron bridge is running or restart the app'
                  ) : (
                    <>
                      Make sure Claude CLI is installed and authenticated via{' '}
                      <code className="font-mono bg-muted px-1 rounded">claude login</code>
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : !claudeUsage ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Loading usage data...</p>
            </div>
          ) : (
            <>
              {/* Primary Card - Session Usage */}
              <UsageCard
                title="Session Usage"
                subtitle="5-hour rolling window"
                percentage={claudeUsage.sessionPercentage}
                resetText={claudeUsage.sessionResetText}
                isPrimary={true}
                stale={isStale}
              />

              {/* Secondary Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                <UsageCard
                  title="Weekly"
                  subtitle="All models"
                  percentage={claudeUsage.weeklyPercentage}
                  resetText={claudeUsage.weeklyResetText}
                  stale={isStale}
                />
                <UsageCard
                  title="Sonnet"
                  subtitle="Weekly"
                  percentage={claudeUsage.sonnetWeeklyPercentage}
                  resetText={claudeUsage.sonnetResetText}
                  stale={isStale}
                />
              </div>

              {/* Extra Usage / Cost */}
              {claudeUsage.costLimit && claudeUsage.costLimit > 0 && (
                <UsageCard
                  title="Extra Usage"
                  subtitle={`${claudeUsage.costUsed ?? 0} / ${claudeUsage.costLimit} ${claudeUsage.costCurrency ?? ''}`}
                  percentage={
                    claudeUsage.costLimit > 0
                      ? ((claudeUsage.costUsed ?? 0) / claudeUsage.costLimit) * 100
                      : 0
                  }
                  stale={isStale}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/10 border-t border-border/50">
          <a
            href="https://status.claude.com"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Claude Status <ExternalLink className="w-2.5 h-2.5" />
          </a>

          <span className="text-[10px] text-muted-foreground">Updates every 45s</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
