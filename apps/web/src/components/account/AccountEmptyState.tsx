/**
 * @file AccountEmptyState.tsx
 * @description React equivalent of `AccountEmptyState.astro` (BETA-143 slice 5d).
 *
 * Astro components can't be used inside React islands, so this ports the same
 * "you have nothing yet" recipe (circular brand icon, heading, description,
 * optional CTA) as a plain React component using the same design tokens.
 * Keep both siblings in sync — this one is for React islands under
 * `src/components/account/*.client.tsx`, the Astro one is for `.astro` pages
 * (e.g. `mi-cuenta/consultas`).
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './AccountEmptyState.module.css';

/** Props for {@link AccountEmptyState}. */
export interface AccountEmptyStateProps {
    /** Bold heading shown under the icon. */
    readonly title: string;
    /** Supporting sentence explaining the empty state. */
    readonly description: string;
    /** Decorative icon element, e.g. `<ChatIcon size={28} />` from `@repo/icons`. */
    readonly icon?: ReactNode;
    /** Optional CTA link target. When omitted (or `ctaLabel` is), no button renders. */
    readonly ctaHref?: string;
    /** Optional CTA link label. Required together with `ctaHref` for the CTA to render. */
    readonly ctaLabel?: string;
    /** Optional extra class name for the root element. */
    readonly className?: string;
}

/**
 * Shared rich empty-state block for account sub-pages rendered as React
 * islands. Renders a circular icon, a title, a description and an optional
 * call-to-action link, matching `AccountEmptyState.astro` pixel-for-pixel.
 */
export function AccountEmptyState({
    title,
    description,
    icon,
    ctaHref,
    ctaLabel,
    className
}: AccountEmptyStateProps) {
    const hasCta = Boolean(ctaHref && ctaLabel);

    return (
        <div className={cn(styles.root, className)}>
            <span
                className={styles.icon}
                aria-hidden="true"
            >
                {icon}
            </span>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.text}>{description}</p>
            {hasCta && (
                <a
                    href={ctaHref}
                    className={styles.cta}
                >
                    {ctaLabel}
                </a>
            )}
        </div>
    );
}
