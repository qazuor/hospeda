/**
 * ImageFieldErrorBanner — visible, screen-reader-announced error banner for
 * media upload failures.
 *
 * Introduced by T-045 so upload errors are surfaced inline (not only through
 * toasts or the console), with role="alert" + aria-live="assertive" so screen
 * readers announce them immediately.
 *
 * Dismissible — the user can close the banner after reading. The parent owns
 * the dismissed state and clears it via `onDismiss`.
 */

import { Button } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { CloseIcon } from '@repo/icons';
import type * as React from 'react';

/**
 * Props for {@link ImageFieldErrorBanner}. RO-RO pattern.
 */
export interface ImageFieldErrorBannerProps {
    /** Localized banner title (e.g. "Upload failed"). */
    title: string;
    /** Error message text — typically from the upload hook's error state. */
    message: string;
    /** Localized dismiss button aria-label (e.g. "Dismiss"). */
    dismissLabel: string;
    /** Called when the dismiss button is clicked. */
    onDismiss: () => void;
    /** Optional extra class name. */
    className?: string;
}

/**
 * ImageFieldErrorBanner — dismissible error banner with ARIA live region.
 *
 * Usage:
 * ```tsx
 * {errorBanner && (
 *     <ImageFieldErrorBanner
 *         title={t('admin-entities.fields.image.errorBannerTitle')}
 *         message={errorBanner}
 *         dismissLabel={t('admin-entities.fields.image.errorBannerDismiss')}
 *         onDismiss={() => setErrorBanner(null)}
 *     />
 * )}
 * ```
 */
export const ImageFieldErrorBanner = ({
    title,
    message,
    dismissLabel,
    onDismiss,
    className
}: ImageFieldErrorBannerProps): React.ReactElement => {
    return (
        <div
            role="alert"
            aria-live="assertive"
            data-testid="image-field-error-banner"
            className={cn(
                'flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive text-sm',
                // Respect prefers-reduced-motion — no enter animation.
                'motion-reduce:animate-none motion-reduce:transition-none',
                className
            )}
        >
            <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold leading-tight">{title}</p>
                <p
                    className="break-words leading-snug"
                    data-testid="image-field-error-message"
                >
                    {message}
                </p>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                aria-label={dismissLabel}
                data-testid="image-field-error-dismiss"
                className="h-7 w-7 shrink-0 p-0 text-destructive hover:bg-destructive/20 hover:text-destructive"
            >
                <CloseIcon className="h-4 w-4" />
            </Button>
        </div>
    );
};
