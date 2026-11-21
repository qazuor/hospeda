/**
 * EmptyState — «there is nothing here yet» for the Mi Cuenta kit
 * (HOS-2413 T-023).
 *
 * Variants `default` and `compact`, an `h3` title (the page already has its
 * `h1` and the Section its `h2`), a decorative icon and an optional action.
 * Use it ONLY for a successful, empty result: a failed load is an
 * `ErrorState`, never an empty state.
 *
 * @module components/account/ui/EmptyState
 */

import type { ReactNode } from 'react';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './Skeleton.module.css';

/** Props of {@link EmptyState}. */
export interface EmptyStateProps {
    /** What is empty, in a few words. */
    readonly title: ReactNode;
    /** One line on what to do or why it is empty. */
    readonly description?: ReactNode;
    /** Decorative icon (an `@repo/icons` element with `aria-hidden`). */
    readonly icon?: ReactNode;
    /** Optional action, usually a LinkButton or Button. */
    readonly action?: ReactNode;
    /** `compact` for inside a Section body or a narrow column. @default 'default' */
    readonly variant?: 'default' | 'compact';
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit empty state.
 *
 * @param props - See {@link EmptyStateProps}.
 * @returns A `<div>` with the icon, title, description and action.
 */
export function EmptyState({
    title,
    description,
    icon,
    action,
    variant = 'default',
    className,
    helpId
}: EmptyStateProps) {
    return (
        <div
            {...helpAttr({ helpId })}
            className={cx(styles.empty, variant === 'compact' && styles.emptyCompact, className)}
        >
            {icon ? (
                <span
                    className={styles.emptyIcon}
                    aria-hidden="true"
                >
                    {icon}
                </span>
            ) : null}
            <div className={styles.emptyBody}>
                <h3 className={styles.emptyTitle}>{title}</h3>
                {description ? <p className={styles.emptyDescription}>{description}</p> : null}
                {action}
            </div>
        </div>
    );
}
