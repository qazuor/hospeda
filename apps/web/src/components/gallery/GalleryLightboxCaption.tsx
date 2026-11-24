/**
 * @file GalleryLightboxCaption.tsx
 * @description Caption bar under the lightbox photo (HOS-2125), extracted from
 * `ImageGallery.client.tsx` to keep that file under the 500-line limit (HOS-2520).
 */

import { useId, useState } from 'react';
import type { GalleryImage } from '../ImageGallery.client';
import styles from './GalleryLightbox.module.css';

/** Description length above which the mobile "ver más" toggle is offered. */
const DESCRIPTION_TOGGLE_THRESHOLD = 90;

/** Props of {@link LightboxCaption}. */
export interface LightboxCaptionProps {
    readonly image: GalleryImage;
    readonly t: (key: string, fallback?: string) => string;
}

/**
 * Caption bar under the lightbox photo (HOS-2125): caption prominent,
 * description below it, credit small. The description is clamped on mobile
 * (CSS) and expanded through a real toggle button. Remounted per photo (via
 * `key`) so the expanded state never leaks between photos.
 */
export function LightboxCaption({ image, t }: LightboxCaptionProps) {
    const [expanded, setExpanded] = useState(false);
    const descriptionId = useId();
    const { caption, description, credit } = image;
    const isLongDescription = (description?.length ?? 0) > DESCRIPTION_TOGGLE_THRESHOLD;

    return (
        <figcaption className={styles.lightboxCaption}>
            {caption && <span className={styles.lightboxCaptionTitle}>{caption}</span>}
            {description && (
                <>
                    <p
                        id={descriptionId}
                        className={styles.lightboxDescription}
                        data-expanded={expanded ? 'true' : 'false'}
                    >
                        {description}
                    </p>
                    {isLongDescription && (
                        <button
                            type="button"
                            className={styles.lightboxDescriptionToggle}
                            aria-expanded={expanded}
                            aria-controls={descriptionId}
                            onClick={() => setExpanded((v) => !v)}
                        >
                            {expanded
                                ? t('ui.filter.showLess', 'Ver menos')
                                : t('ui.filter.showMore', 'Ver más')}
                        </button>
                    )}
                </>
            )}
            {credit && (
                <span className={styles.lightboxCredit}>
                    {credit.byline}{' '}
                    {credit.url ? (
                        <a
                            href={credit.url}
                            className={styles.lightboxCreditLink}
                            target="_blank"
                            rel="nofollow noopener noreferrer"
                            aria-label={credit.ariaLabel}
                        >
                            {credit.photographer}
                        </a>
                    ) : (
                        credit.photographer
                    )}{' '}
                    {credit.providerSuffix}
                </span>
            )}
        </figcaption>
    );
}
