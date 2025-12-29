import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';

interface DocMarkdownProps {
  children: string;
  className?: string;
}

/**
 * DocMarkdown component for rendering documentation markdown
 * Enhanced version of Markdown component optimized for documentation viewing:
 * - Larger text sizes for readability
 * - Comprehensive table styling with borders
 * - Enhanced code block styling with better contrast
 * - Better spacing for documentation-style content
 * Theme-aware styling that adapts to all predefined themes
 */
export function DocMarkdown({ children, className }: DocMarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-invert max-w-none',
        // Headings - larger sizes for documentation
        '[&_h1]:text-2xl [&_h1]:text-foreground [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-border',
        '[&_h2]:text-xl [&_h2]:text-foreground [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3',
        '[&_h3]:text-lg [&_h3]:text-foreground [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2',
        '[&_h4]:text-base [&_h4]:text-foreground [&_h4]:font-semibold [&_h4]:mt-4 [&_h4]:mb-2',
        '[&_h5]:text-sm [&_h5]:text-foreground [&_h5]:font-semibold [&_h5]:mt-3 [&_h5]:mb-1',
        '[&_h6]:text-sm [&_h6]:text-muted-foreground [&_h6]:font-medium [&_h6]:mt-3 [&_h6]:mb-1',
        // Paragraphs
        '[&_p]:text-foreground-secondary [&_p]:leading-relaxed [&_p]:my-3 [&_p]:text-sm',
        // Lists - enhanced for documentation
        '[&_ul]:my-3 [&_ul]:pl-6 [&_ul]:list-disc',
        '[&_ol]:my-3 [&_ol]:pl-6 [&_ol]:list-decimal',
        '[&_li]:text-foreground-secondary [&_li]:my-1 [&_li]:text-sm [&_li]:leading-relaxed',
        '[&_li_ul]:my-1 [&_li_ol]:my-1',
        // Inline code
        '[&_code]:text-chart-2 [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono',
        // Code blocks - enhanced for documentation
        '[&_pre]:bg-card [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:my-4 [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:shadow-sm',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground-secondary [&_pre_code]:text-[13px] [&_pre_code]:leading-6',
        // Strong/Bold
        '[&_strong]:text-foreground [&_strong]:font-semibold',
        // Emphasis/Italic
        '[&_em]:text-foreground-secondary [&_em]:italic',
        // Links
        '[&_a]:text-brand-500 [&_a]:no-underline hover:[&_a]:underline [&_a]:font-medium',
        // Blockquotes
        '[&_blockquote]:border-l-4 [&_blockquote]:border-brand-500/50 [&_blockquote]:pl-4 [&_blockquote]:py-1 [&_blockquote]:my-4 [&_blockquote]:bg-muted/30 [&_blockquote]:rounded-r-lg',
        '[&_blockquote_p]:text-muted-foreground [&_blockquote_p]:italic [&_blockquote_p]:my-1',
        // Horizontal rules
        '[&_hr]:border-border [&_hr]:my-6',
        // Tables - comprehensive styling for documentation
        '[&_table]:w-full [&_table]:my-4 [&_table]:border-collapse [&_table]:border [&_table]:border-border [&_table]:rounded-lg [&_table]:overflow-hidden',
        '[&_thead]:bg-muted/50',
        '[&_th]:text-foreground [&_th]:font-semibold [&_th]:text-left [&_th]:px-4 [&_th]:py-2 [&_th]:border-b [&_th]:border-border [&_th]:text-sm',
        '[&_tbody_tr]:border-b [&_tbody_tr]:border-border last:[&_tbody_tr]:border-0',
        '[&_tbody_tr:hover]:bg-muted/30',
        '[&_td]:text-foreground-secondary [&_td]:px-4 [&_td]:py-2 [&_td]:text-sm',
        // Images
        '[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-4 [&_img]:border [&_img]:border-border [&_img]:shadow-sm',
        // Definition lists
        '[&_dl]:my-4',
        '[&_dt]:text-foreground [&_dt]:font-semibold [&_dt]:mt-2',
        '[&_dd]:text-foreground-secondary [&_dd]:ml-4 [&_dd]:mt-1',
        // Keyboard shortcuts
        '[&_kbd]:bg-muted [&_kbd]:border [&_kbd]:border-border [&_kbd]:rounded [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:text-xs [&_kbd]:font-mono [&_kbd]:shadow-sm',
        className
      )}
    >
      <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>{children}</ReactMarkdown>
    </div>
  );
}
