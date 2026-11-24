/**
 * @file GalleryCounter.tsx
 * @description The «Z/X» photo counter pill shared by every gallery surface: the
 * mobile swipe track and the lightbox, on accommodation, venue and experience pages
 * (owner smoke, HOS-2520 item 16). One markup, one look; each caller only positions
 * it through `className`.
 */
import styles from './GalleryCounter.module.css';

/** Props for {@link GalleryCounter}. */
export interface GalleryCounterProps {
    /** Already-localized label, from `ui.accessibility.galleryCounter` («3/12»). */
    readonly label: string;
    /** Positioning class supplied by the caller. */
    readonly className?: string;
}

/**
 * Renders the counter pill. It is a polite live region so a screen reader hears the
 * new position after a swipe or an arrow press.
 *
 * @param props - {@link GalleryCounterProps}
 * @returns The counter element.
 */
export function GalleryCounter({ label, className }: GalleryCounterProps) {
    return (
        <span
            className={className ? `${styles.counter} ${className}` : styles.counter}
            aria-live="polite"
            aria-atomic="true"
        >
            {label}
        </span>
    );
}
