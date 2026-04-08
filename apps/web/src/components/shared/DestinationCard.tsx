/**
 * @file DestinationCard.tsx
 * @description React card component for destination items inside Embla carousels.
 * Displays an organic-shaped image with a dark gradient overlay showing the
 * destination name, accommodation count, and an arrow link icon.
 * Hover effects: image zoom, border-radius flip, content slides up, summary reveals.
 */

import type { DestinationCardData } from '@/data/types';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { ArrowRightIcon } from '@repo/icons';
import styles from './DestinationCard.module.css';

/** Props for the DestinationCard component. */
interface DestinationCardProps {
    /** Destination data to display on the card. */
    readonly data: DestinationCardData;
    /** Active locale used to build the destination URL. */
    readonly locale: SupportedLocale;
    /** Optional additional CSS classes for the card root element. */
    readonly className?: string;
}

/**
 * Destination card with template-matching hover effects:
 * - Image zooms to scale(1.1)
 * - Border-radius flips from organic to organic-alt
 * - Content block slides up to center
 * - Summary text reveals with fade
 * - Arrow link appears
 */
export function DestinationCard({ data, locale, className }: DestinationCardProps) {
    const href = buildUrl({ locale, path: `destinos/${data.path}` });

    return (
        <article
            className={cn(styles.card, className)}
            aria-label={`Destino: ${data.name}`}
        >
            {/* Inner wrapper clips image zoom while allowing circle to overflow */}
            <div className={styles.inner}>
                {/* Image with zoom on hover */}
                <img
                    src={data.featuredImage || '/assets/images/placeholder-destination.svg'}
                    alt={data.name}
                    loading="lazy"
                    className={styles.image}
                    width={300}
                    height={300}
                />

                {/* Overlay link */}
                <a
                    href={href}
                    className={styles.overlayLink}
                    aria-label={`Ver destino ${data.name}`}
                >
                    {/* Gradient */}
                    <div className={styles.gradient} />

                    {/* Content block .. slides up on hover */}
                    <div className={styles.contentBlock}>
                        <h3 className={styles.title}>{data.name}</h3>

                        <p className={styles.summary}>{data.summary}</p>

                        <div>
                            <span className={styles.count}>
                                {data.accommodationsCount}{' '}
                                {data.accommodationsCount === 1 ? 'alojamiento' : 'alojamientos'}
                            </span>
                        </div>
                    </div>
                </a>
            </div>

            {/* Circle button .. appears on hover, protrudes from card */}
            <div
                className={styles.circle}
                aria-hidden="true"
            >
                <ArrowRightIcon
                    size={32}
                    weight="bold"
                    className={styles.circleIcon}
                />
            </div>
        </article>
    );
}
