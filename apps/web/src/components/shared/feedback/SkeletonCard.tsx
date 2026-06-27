/**
 * @file SkeletonCard.tsx
 * @description Configurable shimmer placeholder block for web React islands.
 * Use it (or {@link SkeletonCardList}) for initial-load states where the final
 * content shape is known — it conveys structure better than a bare spinner.
 *
 * This is separate from the Astro skeleton components in
 * `apps/web/src/components/skeletons/*.astro`, which remain for SSR pages. Reach
 * for SkeletonCard inside hydrated React islands only.
 *
 * @example
 * ```tsx
 * <SkeletonCardList count={3} cardHeight="6rem" gap="0.75rem" />
 * ```
 */

import { cn } from '@/lib/cn';
import type { CSSProperties, ReactElement } from 'react';
import styles from './SkeletonCard.module.css';

export interface SkeletonCardProps {
    /** CSS width. Defaults to `'100%'`. */
    readonly width?: string;
    /** CSS height. Defaults to `'5rem'`. */
    readonly height?: string;
    /** CSS border-radius. Defaults to the card radius token. */
    readonly borderRadius?: string;
    /** Optional extra class applied to the root element. */
    readonly className?: string;
}

/**
 * A single shimmer placeholder block.
 *
 * Decorative by design: marked `aria-hidden` so screen readers skip it. The
 * surrounding island must expose progress via a live region (e.g. a labelled
 * {@link Spinner} or `aria-busy` on the container).
 *
 * @param props - {@link SkeletonCardProps}
 * @returns The skeleton block element.
 */
export function SkeletonCard({
    width = '100%',
    height = '5rem',
    borderRadius,
    className
}: SkeletonCardProps): ReactElement {
    const style: CSSProperties = {
        width,
        height,
        ...(borderRadius ? { borderRadius } : {})
    };
    const rootClass = cn(styles.skeleton, className);

    return (
        <div
            className={rootClass}
            style={style}
            aria-hidden="true"
        />
    );
}

export interface SkeletonCardListProps {
    /** Number of skeleton cards to render. Defaults to `3`. */
    readonly count?: number;
    /** Height applied to each card. */
    readonly cardHeight?: string;
    /** Width applied to each card. */
    readonly cardWidth?: string;
    /** Border-radius applied to each card. */
    readonly cardBorderRadius?: string;
    /** Gap between cards (CSS length). Defaults to the card-gap token. */
    readonly gap?: string;
    /** Optional extra class applied to the list wrapper. */
    readonly className?: string;
}

/**
 * Vertical stack of {@link SkeletonCard} placeholders for list/initial-load
 * patterns (e.g. UserFavoritesList, review modals).
 *
 * The wrapper is `aria-hidden`; pair it with a labelled live region for a11y.
 *
 * @param props - {@link SkeletonCardListProps}
 * @returns The skeleton list element.
 */
export function SkeletonCardList({
    count = 3,
    cardHeight,
    cardWidth,
    cardBorderRadius,
    gap,
    className
}: SkeletonCardListProps): ReactElement {
    const style: CSSProperties = gap ? { gap } : {};
    const rootClass = cn(styles.list, className);

    return (
        <div
            className={rootClass}
            style={style}
            aria-hidden="true"
        >
            {Array.from({ length: Math.max(0, count) }, (_, index) => (
                <SkeletonCard
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative placeholder list, never reordered
                    key={index}
                    height={cardHeight}
                    width={cardWidth}
                    borderRadius={cardBorderRadius}
                />
            ))}
        </div>
    );
}
