import { cn } from '@/lib/utils';

/** Presentation options for the admin brand; suffix copy is translated by callers. */
export interface BrandWordmarkProps {
    readonly size?: 'sm' | 'md' | 'lg';
    readonly suffix?: string;
    readonly className?: string;
}

const sizeClasses = {
    sm: { root: 'text-base', mark: 'h-7 w-auto' },
    md: { root: 'text-lg', mark: 'h-9 w-auto' },
    lg: { root: 'text-2xl', mark: 'h-12 w-auto' }
} as const;

/** Renders a decorative mark, the sans wordmark, and an optional muted suffix. */
export function BrandWordmark({ size = 'md', suffix, className }: BrandWordmarkProps) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-heading font-medium text-foreground',
                sizeClasses[size].root,
                className
            )}
        >
            <img
                src="/logo.webp"
                alt=""
                aria-hidden="true"
                width={34}
                height={36}
                className={cn('shrink-0 object-contain', sizeClasses[size].mark)}
            />
            <span>Hospeda</span>
            {suffix && (
                <span className="hidden text-muted-foreground text-sm sm:inline">{suffix}</span>
            )}
        </span>
    );
}
