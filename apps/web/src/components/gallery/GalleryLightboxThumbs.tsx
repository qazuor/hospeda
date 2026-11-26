/**
 * @file GalleryLightboxThumbs.tsx
 * @description The lightbox thumbnail strip, mounted AFTER the dialog's first paint
 * (owner smoke, HOS-2520). Opening the lightbox used to mount the full-size photo and
 * every thumbnail (25 `<img>` on a big listing) in one commit, costing 0.2s to 1.3s of
 * main thread on a phone. The strip is absolutely positioned, so mounting it a frame
 * later moves nothing; each item also skips rendering off-screen
 * (`content-visibility: auto`).
 */

import { useEffect, useState } from 'react';
import { syncTabScrollFade } from '@/lib/ui/tab-scroll-fade';
import type { GalleryImage } from '../ImageGallery.client';
import styles from './GalleryLightbox.module.css';
import { buildLightboxThumbUrl } from './gallery-image-sources';

/**
 * True once the browser has painted the frame this component first committed in:
 * two animation frames (the first runs before that paint, the second after it), or a
 * zero timeout where `requestAnimationFrame` does not exist.
 *
 * @returns `{ painted }`.
 */
export function useAfterFirstPaint(): { readonly painted: boolean } {
    const [painted, setPainted] = useState(false);

    useEffect(() => {
        if (typeof requestAnimationFrame !== 'function') {
            const timeout = setTimeout(() => setPainted(true), 0);
            return () => clearTimeout(timeout);
        }
        let second = 0;
        const first = requestAnimationFrame(() => {
            second = requestAnimationFrame(() => setPainted(true));
        });
        return () => {
            cancelAnimationFrame(first);
            cancelAnimationFrame(second);
        };
    }, []);

    return { painted };
}

/** Props of {@link GalleryLightboxThumbs}. */
export interface GalleryLightboxThumbsProps {
    readonly images: ReadonlyArray<GalleryImage>;
    /** Index of the photo on screen. */
    readonly index: number;
    /** Called with the thumbnail's index; not called for the current photo. */
    readonly onSelect: (index: number) => void;
    readonly t: (key: string, fallback?: string) => string;
}

/**
 * Thumbnail buttons under the lightbox photo. Renders nothing in the dialog's first
 * commit, nor with a single photo.
 */
export function GalleryLightboxThumbs({ images, index, onSelect, t }: GalleryLightboxThumbsProps) {
    const { painted } = useAfterFirstPaint();
    if (!painted || images.length <= 1) return null;

    return (
        <ul
            className={styles.lightboxThumbs}
            onScroll={(event) => syncTabScrollFade({ bar: event.currentTarget })}
            ref={(bar) => {
                if (!bar) return;
                const sync = () => syncTabScrollFade({ bar });
                sync();
                if (typeof ResizeObserver === 'undefined') return;
                const observer = new ResizeObserver(sync);
                observer.observe(bar);
                return () => observer.disconnect();
            }}
        >
            {images.map((img, i) => (
                <li key={img.url}>
                    <button
                        type="button"
                        aria-label={t('ui.accessibility.goToImage', `Ir a imagen ${i + 1}`).replace(
                            '{{number}}',
                            String(i + 1)
                        )}
                        aria-current={i === index ? 'true' : undefined}
                        className={`${styles.lightboxThumb} ${i === index ? styles.lightboxThumbActive : ''}`}
                        onClick={() => {
                            if (i !== index) onSelect(i);
                        }}
                    >
                        <img
                            {...buildLightboxThumbUrl({ url: img.url })}
                            alt={img.alt}
                            className={styles.lightboxThumbImg}
                            loading="lazy"
                        />
                    </button>
                </li>
            ))}
        </ul>
    );
}
