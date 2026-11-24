/**
 * @file ImageGallery.client.tsx
 * @description Generalized image gallery React island.
 *
 * Supports two variants:
 * - `detail`:          Mosaic grid (1 large + thumbnails) with full-screen lightbox.
 * - `cover-plus-grid`: Featured cover image with optional inline grid below.
 *
 * Includes keyboard navigation (arrows, Escape) and a lightweight focus trap
 * when the lightbox is open. No new external dependencies.
 *
 * Hydrate with `client:visible` (caller's responsibility).
 */

import { ArrowRightIcon, FullscreenIcon, GridIcon } from '@repo/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import type { PluralTranslationFn, SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { PhotoCreditParts } from '@/lib/photo-credit.types';
import { CoverPlusGridVariant } from './gallery/CoverPlusGridVariant';
import { GalleryCellImage } from './gallery/GalleryCellImage';
import { GalleryHeroPreload } from './gallery/GalleryHeroPreload';
import { GalleryLightbox } from './gallery/GalleryLightbox';
import { consumePendingGalleryTap, findLoadedCellSrc } from './gallery/gallery-hydration-bridge';
import { buildCellSources, DESKTOP_GALLERY_MEDIA } from './gallery/gallery-image-sources';
import { warmGalleryOnIdle } from './gallery/gallery-preload';
import styles from './ImageGallery.module.css';
import type { MobileGalleryOptions } from './ImageGalleryMobileTrack.client';
import { ImageGalleryMobileTrack } from './ImageGalleryMobileTrack.client';
import mobileStyles from './ImageGalleryMobileTrack.module.css';

// Moved to ./gallery/CoverPlusGridVariant (HOS-2520); re-exported for existing callers.
export { getCoverExtrasCountKey, getVisibleExtrasCount } from './gallery/CoverPlusGridVariant';

/**
 * A single image entry for the gallery.
 */
export interface GalleryImage {
    /** Absolute or relative URL of the full-size image */
    readonly url: string;
    /** Alt text for accessibility */
    readonly alt: string;
    /** Optional caption shown in lightbox */
    readonly caption?: string;
    /**
     * Longer free-text description shown under the caption in the lightbox
     * (HOS-2125). Plain text only (rendered as a React text node). On mobile it
     * is clamped with a "ver más" toggle when long.
     */
    readonly description?: string;
    /**
     * Photo credit shown under the caption in the lightbox (H-125).
     *
     * Pre-composed by `formatPhotoCredit` on the server rather than built here:
     * the credit's wording is shared with the SSR photo page, and `url` has
     * already passed the http/https check that keeps a `javascript:` value the
     * write side accepts out of this `href`.
     */
    readonly credit?: PhotoCreditParts;
}

/**
 * Props for the ImageGallery component.
 */
interface ImageGalleryProps {
    /** Opts the detail variant into the mobile track with a caller-provided back destination. */
    readonly mobile?: MobileGalleryOptions;
    /** List of images to display */
    readonly images: ReadonlyArray<GalleryImage>;
    /**
     * Display variant.
     * - `detail` (default): mosaic grid with thumbnails + full-screen lightbox.
     * - `cover-plus-grid`: featured cover image, optional inline grid below.
     */
    readonly variant?: 'detail' | 'cover-plus-grid';
    /** Locale for i18n strings */
    readonly locale: SupportedLocale;
    /** Optional CSS class override on the root element */
    readonly className?: string;
    /**
     * Optional href for the "Ver todas las fotos" CTA link shown below the
     * detail-variant grid when total images exceed the visible inline count
     * (count >= 5). Only used by the `detail` variant — accommodations pass
     * the locale-prefixed URL to the /fotos sub-page.
     *
     * When omitted (or when count < 5) the CTA is not rendered.
     *
     * @example
     * viewAllHref={`/${locale}/alojamientos/${slug}/fotos/`}
     */
    readonly viewAllHref?: string;
}

// ─── Detail variant ──────────────────────────────────────────────────────────

/**
 * Derives the data-count attribute value from the total image count.
 * Maps to CSS selectors that control the grid template per §5.
 */
function getDetailCountKey(count: number): string {
    if (count <= 0) return '0';
    if (count >= 5) return '5plus';
    return String(count);
}

/**
 * Returns the number of thumbnail slots to render for a given image count
 * in the detail variant, per the §5 layout matrix.
 *
 * | Count | Visible thumbs |
 * |-------|---------------|
 * | 1     | 0 (featured only, full-width) |
 * | 2     | 1 (half-width pair) |
 * | 3     | 2 (featured 2fr + 2 quarters) |
 * | 4     | 3 (featured 2fr + 3 quarters) |
 * | 5+    | 3 (featured 2fr + 3 quarters; last = overlay) |
 */
function getVisibleThumbCount(imageCount: number): number {
    if (imageCount <= 1) return 0;
    if (imageCount === 2) return 1;
    if (imageCount === 3) return 2;
    return 3; // 4 and 5+
}

interface DetailVariantProps {
    readonly images: ReadonlyArray<GalleryImage>;
    readonly locale: SupportedLocale;
    readonly mobile?: MobileGalleryOptions;
    readonly onOpen: (index: number) => void;
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
    readonly tPlural: PluralTranslationFn;
    /**
     * When provided AND total images exceed the visible inline count (count >= 5),
     * a "Ver todas las fotos" link is rendered below the mosaic grid.
     */
    readonly viewAllHref?: string;
}

function DetailVariant({
    images,
    onOpen,
    t,
    tPlural,
    viewAllHref,
    locale,
    mobile
}: DetailVariantProps) {
    const [featured, ...rest] = images;
    const count = images.length;
    const visibleThumbCount = getVisibleThumbCount(count);
    const visibleThumbs = rest.slice(0, visibleThumbCount);
    // N in "+N más" = total images minus visible inline images (featured + visible thumbs).
    const moreCount = count >= 5 ? count - 4 : 0;
    const countKey = getDetailCountKey(count);
    const mosaicMedia = mobile ? DESKTOP_GALLERY_MEDIA : undefined;
    const mosaicTriggerRef = useRef<HTMLButtonElement>(null);

    if (!featured) return null;
    const heroSources = buildCellSources({ url: featured.url, preset: 'galleryFeatured' });

    // The "Ver todas las fotos" CTA is shown only when a href is provided AND
    // total images exceed the 4 visible inline slots (count >= 5). At count < 5
    // all images are already visible in the grid, so the link adds no value.
    const showViewAll = Boolean(viewAllHref) && count >= 5;

    return (
        <>
            {mosaicMedia && (
                <GalleryHeroPreload
                    {...heroSources}
                    media={mosaicMedia}
                />
            )}
            {mobile && (
                <ImageGalleryMobileTrack
                    images={images}
                    locale={locale}
                    onOpen={onOpen}
                    mosaicTriggerRef={mosaicTriggerRef}
                    {...mobile}
                />
            )}
            <div
                className={`${styles.grid}${mobile ? ` ${mobileStyles.mosaic}` : ''}`}
                data-count={countKey}
            >
                {/* Featured image — LCP candidate, eager load, full priority.
                Uses galleryFeatured preset (w_1000, ar_16:10, c_fill, g_auto)
                so the CDN crops server-side to the fixed 16:10 ratio — zero CLS,
                no client-side crop, right-sized payload (SPEC-186 FR-3 §7).
                srcset candidates: 640w / 1000w / 1400w (Cloudinary only).
                sizes: 100vw mobile, 66vw tablet/desktop (2fr in 2fr+1fr grid).
                At a typical 1280px desktop, 66vw ≈ 845px → browser selects 1000w,
                identical to the previous single-URL w_1000 baseline. No LCP
                regression (SPEC-186 FR-4 §8 step 10). */}
                <button
                    ref={mosaicTriggerRef}
                    type="button"
                    className={styles.cellFeatured}
                    aria-label={t('ui.accessibility.openFullscreen', 'Ver en pantalla completa')}
                    data-gallery-index={0}
                    suppressHydrationWarning
                    onClick={() => onOpen(0)}
                >
                    {/* SPEC-157 REQ-3: this is the LCP candidate on the
                        accommodation detail page. The gallery is an island, so
                        this markup is server-rendered into the initial HTML —
                        fetchPriority + explicit dimensions let the browser
                        prioritise the fetch and reserve layout (no CLS). The
                        intrinsic ratio mirrors the .mosaic max-height (480px);
                        object-fit: cover keeps remote images undistorted. */}
                    <GalleryCellImage
                        {...heroSources}
                        media={mosaicMedia}
                        alt={featured.alt}
                        className={styles.cellImg}
                        loading="eager"
                        fetchPriority="high"
                        width={800}
                        height={480}
                    />
                    <span
                        className={styles.expandIcon}
                        aria-hidden="true"
                    >
                        <FullscreenIcon size={20} />
                    </span>
                </button>

                {/* Thumbnail column — rendered only when count >= 2.
                count=2: half cells (4:3) via galleryHalf preset.
                count>=3: quarter cells (1:1) via galleryQuarter preset.
                The CDN crops server-side to the cell's fixed ratio (SPEC-186 FR-3). */}
                {visibleThumbs.length > 0 && (
                    <div className={styles.thumbGrid}>
                        {visibleThumbs.map((img, i) => {
                            // The last thumb at count >= 5 becomes the "+N más" overlay cell.
                            const isOverlayCell = moreCount > 0 && i === visibleThumbs.length - 1;
                            // Lightbox opens at the first hidden image (index = 1 + i + 1).
                            // For the overlay, that is the image right after the last visible thumb
                            // (index 4, which is images[4] — the 5th image, 0-based).
                            const lightboxIndex = i + 1;

                            const cellClass = count === 2 ? styles.cellHalf : styles.cellQuarter;
                            // count=2 uses half cells (4:3 ratio); count>=3 uses quarter cells (1:1).
                            const thumbPreset: 'galleryHalf' | 'galleryQuarter' =
                                count === 2 ? 'galleryHalf' : 'galleryQuarter';

                            if (isOverlayCell) {
                                return (
                                    <div
                                        key={img.url}
                                        className={`${cellClass} ${styles.moreOverlay}`}
                                    >
                                        <GalleryCellImage
                                            {...buildCellSources({
                                                url: img.url,
                                                preset: thumbPreset
                                            })}
                                            media={mosaicMedia}
                                            alt={img.alt}
                                            className={styles.cellImg}
                                            loading="lazy"
                                            ariaHidden
                                        />
                                        {/* Keyboard-accessible overlay button — opens lightbox at the first hidden image */}
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
                                    className={`${cellClass} ${styles.thumbBtn}`}
                                    aria-label={t(
                                        'ui.accessibility.openFullscreen',
                                        'Ver en pantalla completa'
                                    )}
                                    data-gallery-index={lightboxIndex}
                                    suppressHydrationWarning
                                    onClick={() => onOpen(lightboxIndex)}
                                >
                                    <GalleryCellImage
                                        {...buildCellSources({ url: img.url, preset: thumbPreset })}
                                        media={mosaicMedia}
                                        alt={img.alt}
                                        className={styles.cellImg}
                                        loading="lazy"
                                    />
                                </button>
                            );
                        })}
                    </div>
                )}
                {/* HOS-2531: desktop "see all N photos" button. It lives inside the
                mosaic so it disappears with it on mobile, where the swipe track
                already carries its own counter. */}
                {count >= 2 && (
                    <div className={styles.seeAllPhotos}>
                        <GradientButton
                            as="button"
                            variant="outline-primary"
                            size="sm"
                            label={tPlural('accommodations.detail.gallery.viewAllCount', count)}
                            leadingIcon={
                                <FullscreenIcon
                                    size={16}
                                    aria-hidden="true"
                                />
                            }
                            onClick={() => onOpen(0)}
                        />
                    </div>
                )}
            </div>
            {showViewAll && (
                /* data-astro-reload forces a full page load across the /fotos
                boundary. The ClientRouter head swap drops the island's injected
                stylesheet and the module-cached island JS never re-injects it on
                back navigation, leaving the gallery unstyled (T-018 smoke bug).
                A hard navigation also guarantees GLightbox initialisation.
                Owner decision (HOS-2520 smoke): visible at every width. It reads
                as a page link (grid icon + arrow, text link) so it is not
                mistaken for the «Ver las N fotos» lightbox button. */
                <a
                    href={viewAllHref}
                    className={styles.viewAllLink}
                    data-astro-reload
                >
                    <GridIcon
                        size={16}
                        aria-hidden="true"
                    />
                    <span>
                        {t('accommodations.detail.gallery.viewAll', 'Ver las fotos en una página')}
                    </span>
                    <ArrowRightIcon
                        size={14}
                        aria-hidden="true"
                    />
                </a>
            )}
        </>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * Generalized image gallery with lightbox support.
 *
 * @example
 * // Detail variant (accommodation — default)
 * <ImageGallery
 *   images={[{ url: '/img.jpg', alt: 'Room', caption: 'Suite' }]}
 *   variant="detail"
 *   locale="es"
 *   client:visible
 * />
 *
 * @example
 * // Cover-plus-grid (posts, destinations)
 * <ImageGallery
 *   images={postImages}
 *   variant="cover-plus-grid"
 *   locale={locale}
 *   client:visible
 * />
 */
export function ImageGallery({
    images,
    variant = 'detail',
    locale,
    className,
    viewAllHref,
    mobile
}: ImageGalleryProps) {
    const { t, tPlural } = createTranslations(locale);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const openLightbox = useCallback((index: number): void => {
        setLightboxIndex(index);
    }, []);

    const closeLightbox = useCallback((): void => {
        setLightboxIndex(null);
    }, []);

    // HOS-2520: a photo tapped before hydration opens now, once. See
    // gallery/GalleryTapBridge.astro for the inline half of the bridge.
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per mount; a later change of `images` must not replay a tap that is already consumed.
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const { index } = consumePendingGalleryTap({ root, count: images.length });
        if (index !== null) setLightboxIndex(index);
    }, []);

    // HOS-2520: warm the lightbox once the page is idle (first photos + thumbnails).
    useEffect(
        () => warmGalleryOnIdle({ win: window, imageUrls: images.map((img) => img.url) }).cleanup,
        [images]
    );

    const resolvePlaceholder = useCallback((index: number): string | undefined => {
        const root = rootRef.current;
        return root ? findLoadedCellSrc({ root, index }).src : undefined;
    }, []);

    if (images.length === 0) return null;

    return (
        <div
            ref={rootRef}
            data-gallery-root=""
            className={`${styles.root}${className ? ` ${className}` : ''}`}
            // The inline tap bridge may stamp `data-gallery-pending` before hydration.
            suppressHydrationWarning
        >
            {variant === 'detail' ? (
                <DetailVariant
                    images={images}
                    onOpen={openLightbox}
                    t={t}
                    tPlural={tPlural}
                    viewAllHref={viewAllHref}
                    locale={locale}
                    mobile={mobile}
                />
            ) : (
                <CoverPlusGridVariant
                    images={images}
                    onOpen={openLightbox}
                    t={t}
                />
            )}

            {lightboxIndex !== null && (
                <GalleryLightbox
                    images={images}
                    initialIndex={lightboxIndex}
                    onClose={closeLightbox}
                    t={t}
                    resolvePlaceholder={resolvePlaceholder}
                />
            )}
        </div>
    );
}
