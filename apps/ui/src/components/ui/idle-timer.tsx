import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IdleTimerProps {
  lastToolCallAt: string | null; // ISO timestamp string, null if no tool calls yet
  className?: string;
}

/**
 * Color thresholds for idle timer:
 * 0-15 seconds: Green (active)
 * 15-30 seconds: Yellow (warning)
 * 30+ seconds: Red (potentially frozen)
 */
const GREEN_THRESHOLD = 15;
const YELLOW_THRESHOLD = 30;

/**
 * Gets the color class based on idle seconds
 */
function getIdleColor(seconds: number): string {
  if (seconds < GREEN_THRESHOLD) {
    return 'text-green-400';
  } else if (seconds < YELLOW_THRESHOLD) {
    return 'text-yellow-400';
  } else {
    return 'text-red-400';
  }
}

/**
 * Gets the background color class for the timer container
 */
function getIdleBackground(seconds: number): string {
  if (seconds < GREEN_THRESHOLD) {
    return 'bg-green-500/15 border-green-500/50';
  } else if (seconds < YELLOW_THRESHOLD) {
    return 'bg-yellow-500/15 border-yellow-500/50';
  } else {
    return 'bg-red-500/15 border-red-500/50';
  }
}

/**
 * Formats elapsed time in MM:SS format
 * @param seconds - Total elapsed seconds
 * @returns Formatted string like "00:00", "01:30", "59:59", etc.
 */
function formatElapsedTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  const paddedMinutes = minutes.toString().padStart(2, '0');
  const paddedSeconds = remainingSeconds.toString().padStart(2, '0');

  return `${paddedMinutes}:${paddedSeconds}`;
}

/**
 * IdleTimer component that displays time since the last tool call
 * Color-coded to indicate potential frozen state:
 * - Green (0-15s): Active, recent tool call
 * - Yellow (15-30s): Warning, no recent activity
 * - Red (30s+): Potentially frozen, needs attention
 */
export function IdleTimer({ lastToolCallAt, className = '' }: IdleTimerProps) {
  const [idleSeconds, setIdleSeconds] = useState(0);

  useEffect(() => {
    if (!lastToolCallAt) {
      setIdleSeconds(0);
      return;
    }

    const lastToolTime = new Date(lastToolCallAt).getTime();

    const calculateIdle = () => {
      const now = Date.now();
      const idle = Math.floor((now - lastToolTime) / 1000);
      return Math.max(0, idle); // Ensure non-negative
    };

    // Set initial value
    setIdleSeconds(calculateIdle());

    // Update every second
    const interval = setInterval(() => {
      setIdleSeconds(calculateIdle());
    }, 1000);

    return () => clearInterval(interval);
  }, [lastToolCallAt]);

  // Don't show if no tool calls yet
  if (!lastToolCallAt) {
    return null;
  }

  const colorClass = getIdleColor(idleSeconds);
  const bgClass = getIdleBackground(idleSeconds);

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1 rounded-md px-1.5 py-0.5 border',
        bgClass,
        className
      )}
      data-testid="idle-timer"
      title={`Time since last tool call. Green: 0-15s, Yellow: 15-30s, Red: 30s+ (potentially frozen)`}
    >
      <Clock className={cn('w-3 h-3', colorClass)} />
      <span className={cn('text-[10px] font-mono', colorClass)} data-testid="idle-timer-display">
        {formatElapsedTime(idleSeconds)}
      </span>
    </div>
  );
}
