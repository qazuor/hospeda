/**
 * @file Spinner.tsx
 * @description Canonical loading spinner for web React islands. A pure-CSS
 * animated ring (no external dependency) exposed as an accessible `role="status"`
 * live region. This is the single primitive every island should reach for when
 * showing an in-progress indicator — it replaces all ad-hoc spinner CSS classes,
 * the ellipsis-text idiom, and the hourglass emoji (see
 * `apps/web/docs/loading-states.md`).
 *
 * @example
 * ```tsx
 * <Spinner size="sm" label={t('common.loading', 'Cargando…')} />
 * ```
 */

import { cn } from '@/lib/cn';
import type { ReactElement } from 'react';
import styles from './Spinner.module.css';

/** Visual size of the spinner ring. */
export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
    /** Ring size. Defaults to `'md'`. */
    readonly size?: SpinnerSize;
    /**
     * Accessible label announced by assistive tech (forwarded to `aria-label`).
     * When omitted the spinner is treated as decorative (`aria-hidden`) and the
     * caller is responsible for an adjacent live region — prefer passing a label.
     */
    readonly label?: string;
    /** Optional extra class applied to the root element. */
    readonly className?: string;
}

const sizeClass: Record<SpinnerSize, string> = {
    sm: styles.sm,
    md: styles.md,
    lg: styles.lg
};

/**
 * Accessible CSS-only loading spinner.
 *
 * When `label` is provided the root is a `role="status"` region with
 * `aria-label`, so screen readers announce the in-progress state. When `label`
 * is omitted the spinner is marked `aria-hidden` (decorative) and an adjacent
 * live region must communicate progress instead.
 *
 * @param props - {@link SpinnerProps}
 * @returns The spinner element.
 */
export function Spinner({ size = 'md', label, className }: SpinnerProps): ReactElement {
    const rootClass = cn(styles.spinner, sizeClass[size], className);

    if (label) {
        return (
            <span
                className={rootClass}
                // biome-ignore lint/a11y/useSemanticElements: role="status" on a span is the documented live-region pattern for an inline spinner; <output> carries form-association semantics we don't want here
                role="status"
            >
                <span
                    className={styles.ring}
                    aria-hidden="true"
                />
                {/* Visible-to-AT text so the live region reliably announces on mount. */}
                <span className="sr-only">{label}</span>
            </span>
        );
    }

    return (
        <span
            className={rootClass}
            aria-hidden="true"
        >
            <span className={styles.ring} />
        </span>
    );
}
