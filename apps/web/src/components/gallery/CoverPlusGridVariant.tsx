/**
 * @file CoverPlusGridVariant.tsx
 * @description The `cover-plus-grid` variant of `ImageGallery`, extracted from
 * `ImageGallery.client.tsx` to keep that file under 500 lines (HOS-2520).
 */

import { FullscreenIcon } from '@repo/icons';
import type { GalleryImage } from '../ImageGallery.client';
import styles from '../ImageGallery.module.css';
import { GalleryCellImage } from './GalleryCellImage';
import { buildCellSources } from './gallery-image-sources';

/**
 * Derives the data-extras-count attribute value from the total image count in
 * the cover-plus-grid variant. The cover image is always rendered separately;
 * this key represents the number of "extras" slots to render in the inline grid.
 *
 * | Total | Extras shown | data-extras-count |
 * |-------|-------------|-------------------|
 * | 1     | 0 (no grid) | "0"               |
 * | 2     | 1 half cell | "1"               |
 * | 3     | 2 half cells | "2"              |
 * | 4     | 3 quarter cells | "3"           |
 * | 5+    | 3 quarter cells (last = overlay) | "3plus" |
 */
export function getCoverExtrasCountKey(totalCount: number): string {
    if (totalCount <= 1) return '0';
    if (totalCount === 2) return '1';
    if (totalCount === 3) return '2';
    if (totalCount === 4) return '3';
    return '3plus'; // 5+
}

/**
 * Returns the number of extras cells to render (excluding the cover) for a
 * given total image count in the cover-plus-grid variant, per the §5 matrix.
 *
 * | Total | Visible extras |
 * |-------|---------------|
 * | 1     | 0 (cover only) |
 * | 2     | 1 (1 half cell) |
 * | 3     | 2 (2 half cells) |
 * | 4     | 3 (3 quarter cells) |
 * | 5+    | 3 (3 quarter cells; last = overlay) |
 */
export function getVisibleExtrasCount(totalCount: number): number {
    if (totalCount <= 1) return 0;
    if (totalCount === 2) return 1;
    if (totalCount === 3) return 2;
    return 3; // 4 and 5+
}

/** Props of {@link CoverPlusGridVariant}. */
export interface CoverPlusGridVariantProps {
    readonly images: ReadonlyArray<GalleryImage>;
    readonly onOpen: (index: number) => void;
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
}

/** Featured cover image with an optional inline grid below (posts, destinations). */
export function CoverPlusGridVariant({ images, onOpen, t }: CoverPlusGridVariantProps) {
    const [cover, ...rest] = images;
    const totalCount = images.length;
    const visibleExtrasCount = getVisibleExtrasCount(totalCount);
    const visibleExtras = rest.slice(0, visibleExtrasCount);
    // N in "+N más" = total images minus the cover minus the visible extras.
    const moreCount = totalCount >= 5 ? totalCount - 4 : 0;
    const extrasCountKey = getCoverExtrasCountKey(totalCount);

    if (!cover) return null;

    return (
        <div className={styles.coverPlusGrid}>
            {/* Cover image — 16:9, eager load.
                Uses galleryFeatured preset (w_1000, ar_16:10, c_fill, g_auto).
                The spec §5 maps both the detail "featured" and cover-plus-grid "cover"
                to the galleryFeatured preset family (closest available to 16:9 — §7
                defines no dedicated 16:9 preset; 16:10 is the locked choice per §7).
                srcset candidates: 640w / 1000w / 1400w (Cloudinary only).
                sizes: 100vw at all viewports (cover spans full container width). */}
            <button
                type="button"
                className={styles.coverBtn}
                aria-label={t('ui.accessibility.openFullscreen', 'Ver en pantalla completa')}
                data-gallery-index={0}
                suppressHydrationWarning
                onClick={() => onOpen(0)}
            >
                <GalleryCellImage
                    {...buildCellSources({ url: cover.url, preset: 'galleryFeatured' })}
                    alt={cover.alt}
                    className={styles.coverImg}
                    loading="eager"
                />
                <span
                    className={styles.expandIcon}
                    aria-hidden="true"
                >
                    <FullscreenIcon size={20} />
                </span>
            </button>

            {/* Inline extras grid — count-aware columns, only when extras exist */}
            {visibleExtras.length > 0 && (
                <div
                    className={styles.inlineGrid}
                    data-extras-count={extrasCountKey}
                >
                    {visibleExtras.map((img, i) => {
                        // Last extras cell at count >= 5 becomes the "+N más" overlay.
                        const isOverlayCell = moreCount > 0 && i === visibleExtras.length - 1;
                        // Lightbox opens at index i+1 (cover is index 0).
                        // Overlay opens at the first hidden image = cover + visibleExtras = index 4.
                        const lightboxIndex = i + 1;

                        // counts 2-3: half cells (4:3). counts 4-5+: quarter cells (1:1).
                        const cellClass = totalCount <= 3 ? styles.cellHalf : styles.cellQuarter;
                        // Use the preset that matches the cell's fixed aspect-ratio (SPEC-186 FR-3 §7).
                        const extrasPreset: 'galleryHalf' | 'galleryQuarter' =
                            totalCount <= 3 ? 'galleryHalf' : 'galleryQuarter';

                        if (isOverlayCell) {
                            return (
                                <div
                                    key={img.url}
                                    className={`${cellClass} ${styles.moreOverlay}`}
                                >
                                    <GalleryCellImage
                                        {...buildCellSources({
                                            url: img.url,
                                            preset: extrasPreset
                                        })}
                                        alt={img.alt}
                                        className={styles.cellImg}
                                        loading="lazy"
                                        ariaHidden
                                    />
                                    {/* Keyboard-accessible overlay — opens lightbox at first hidden image */}
                                    <button
                                        type="button"
                                        className={styles.moreOverlayBtn}
                                        aria-label={t(
                                            'accommodations.detail.gallery.moreOverlay',
                                            `+${moreCount} más`,
                                            { count: moreCount }
                                        )}
                                        data-gallery-index={lightboxIndex + 1}
                                        suppressHydrationWarning
                                        onClick={() => onOpen(lightboxIndex + 1)}
                                    >
                                        {t(
                                            'accommodations.detail.gallery.moreOverlay',
                                            `+${moreCount} más`,
                                            { count: moreCount }
                                        )}
                                    </button>
                                </div>
                            );
                        }

                        return (
                            <button
                                key={img.url}
                                type="button"
                                className={`${cellClass} ${styles.inlineGridBtn}`}
                                aria-label={t(
                                    'ui.accessibility.openFullscreen',
                                    'Ver en pantalla completa'
                                )}
                                data-gallery-index={lightboxIndex}
                                suppressHydrationWarning
                                onClick={() => onOpen(lightboxIndex)}
                            >
                                <GalleryCellImage
                                    {...buildCellSources({ url: img.url, preset: extrasPreset })}
                                    alt={img.alt}
                                    className={styles.cellImg}
                                    loading="lazy"
                                />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
