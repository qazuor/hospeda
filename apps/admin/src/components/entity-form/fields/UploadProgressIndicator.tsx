import { cn } from '@/lib/utils';
import type * as React from 'react';

/**
 * Props for {@link UploadProgressIndicator} (RO-RO).
 */
export interface UploadProgressIndicatorProps {
    /** Human-readable status text, e.g. "Uploading 8.2 MB...". */
    label: string;
    /** Optional secondary text for count progress, e.g. "3 of 6". */
    detail?: string;
    /** Additional CSS classes on the wrapper. */
    className?: string;
    /** Test id forwarded to the wrapper. */
    'data-testid'?: string;
}

/**
 * Accessible indeterminate upload progress indicator.
 *
 * T-046 / GAP-078-140: `fetch()` does not surface per-request upload progress
 * events, so we cannot render a real percentage. This component communicates
 * activity via:
 * - `role="status"` + `aria-live="polite"` so the label is announced on change.
 * - An indeterminate animated bar (pure CSS) that respects
 *   `prefers-reduced-motion` by cancelling the animation.
 *
 * Extracted from GalleryField so the status region can be reused by any
 * batch upload surface without duplicating markup.
 */
export const UploadProgressIndicator: React.FC<UploadProgressIndicatorProps> = ({
    label,
    detail,
    className,
    'data-testid': dataTestId
}) => {
    return (
        <div
            // biome-ignore lint/a11y/useSemanticElements: role="status" is kept
            // explicit so tests and screen readers match via `[role="status"]`;
            // `<output>` has an implicit role=status but its form-associated
            // semantics are not appropriate for a standalone live region.
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={cn('flex flex-col gap-2', className)}
            data-testid={dataTestId ?? 'upload-progress-indicator'}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{label}</p>
                {detail ? (
                    <p
                        className="text-muted-foreground text-xs"
                        data-testid="upload-progress-detail"
                    >
                        {detail}
                    </p>
                ) : null}
            </div>
            <div
                aria-hidden="true"
                className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
                <div
                    // Indeterminate progress: we cannot measure real progress
                    // from `fetch()` so we pulse a full-width bar. Tailwind's
                    // built-in `animate-pulse` respects `prefers-reduced-motion`
                    // via `motion-reduce:animate-none`, but we also lower
                    // opacity as a static fallback in that case.
                    className={cn(
                        'absolute inset-y-0 left-0 w-full rounded-full bg-primary',
                        'animate-pulse',
                        'motion-reduce:animate-none motion-reduce:opacity-60'
                    )}
                />
            </div>
        </div>
    );
};

UploadProgressIndicator.displayName = 'UploadProgressIndicator';
