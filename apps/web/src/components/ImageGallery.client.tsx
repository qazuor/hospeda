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

import {
    Dialog,
    DialogBody,
    DialogFloatingCloseButton
} from '@/components/shared/ui/Dialog.client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { ChevronLeftIcon, ChevronRightIcon, FullscreenIcon } from '@repo/icons';
import { getMediaUrl, stripCloudinaryTransform } from '@repo/media';
import type { MediaPreset } from '@repo/media';
import { useCallback, useEffect, useState } from 'react';
import styles from './ImageGallery.module.css';

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
}

/**
 * Props for the ImageGallery component.
 */
interface ImageGalleryProps {
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
}

// ─── Per-cell URL builder ─────────────────────────────────────────────────────

/**
 * Returns `true` when `url` is a Cloudinary delivery URL.
 *
 * This mirrors the internal check inside `getMediaUrl` and
 * `stripCloudinaryTransform` so callers can decide whether it is worth
 * building a `srcset` (non-Cloudinary URLs pass through width-override
 * calls unchanged, producing identical candidates — emitting a srcset
 * in that case wastes bytes and confuses the browser).
 *
 * @param url - Any image URL.
 */
function isCloudinaryUrl(url: string): boolean {
    return url.includes('res.cloudinary.com');
}

/**
 * Builds a Cloudinary-optimized URL for a specific gallery cell role.
 *
 * For Cloudinary URLs that have already been transformed with a generic preset
 * (e.g. `gallery`: `w_800,q_auto,f_auto,dpr_auto`) at extraction time, this
 * function first strips the existing transform segment via
 * `stripCloudinaryTransform` and then re-applies the correct per-cell preset
 * via `getMediaUrl`. This ensures the CDN returns an asset that is pre-cropped
 * to the cell's fixed aspect-ratio (SPEC-186 FR-3 / §7), eliminating
 * client-side crop and zeroing CLS.
 *
 * Non-Cloudinary URLs (placeholders, external hosts) are returned unchanged —
 * `getMediaUrl` pass-through semantics apply.
 *
 * @param url - Original image URL (may already carry a Cloudinary transform).
 * @param preset - Named preset matching the cell's role and fixed aspect-ratio.
 * @returns Optimized Cloudinary URL with `c_fill` + `ar_` matching the cell,
 *   or the original URL if it is not a Cloudinary upload URL.
 */
function buildCellUrl(url: string, preset: MediaPreset): string {
    const baseUrl = stripCloudinaryTransform(url);
    return getMediaUrl(baseUrl, { preset });
}

/**
 * Candidate widths (in pixels) for each gallery cell preset's `srcset`.
 *
 * Values are taken from the spec §7 annotation on each preset.
 * The order (ascending) matches the `srcset` convention so browsers can
 * parse them efficiently.
 *
 * Lightbox (`full`) and thumb strip (`galleryThumb`) are intentionally absent:
 * the lightbox main image uses a single `src` (no crop applied, FR-4 scope),
 * and the 120px thumb strip is already at its final pixel size.
 */
const SRCSET_WIDTHS: Readonly<
    Record<'galleryFeatured' | 'galleryHalf' | 'galleryQuarter', readonly number[]>
> = Object.freeze({
    galleryFeatured: [640, 1000, 1400],
    galleryHalf: [400, 640, 900],
    galleryQuarter: [200, 400, 600]
});

/**
 * `sizes` attribute values for each gallery cell role.
 *
 * Derived from the locked §5 layout matrix and CSS breakpoints:
 *
 * - `galleryFeatured`:
 *   Mobile (≤640px): single-column full-width → `100vw`.
 *   Tablet + Desktop (>640px): `2fr` in a `2fr 1fr` grid →
 *   approximately `66vw` (two-thirds of the viewport).
 *   At a typical 1280px desktop `66vw ≈ 845px`, so the browser selects the
 *   `1000w` candidate — matching the previous single `w_1000` URL. No LCP
 *   regression: the candidate chosen at desktop is identical in weight to the
 *   pre-srcset baseline.
 *
 * - `galleryHalf`:
 *   Mobile: stacks to full width (detail count=2 single-col; cover extras single-col) → `100vw`.
 *   Tablet + Desktop: half of the container width → `50vw`.
 *
 * - `galleryQuarter`:
 *   Mobile: thumb strip in detail variant uses 2–3 equal columns → `50vw`
 *   (safest upper bound; narrows further at 3-up but 50vw avoids under-fetching).
 *   Tablet + Desktop: `1fr` column in `2fr 1fr` or `repeat(3,1fr)` grid → `33vw`.
 */
const CELL_SIZES: Readonly<Record<'galleryFeatured' | 'galleryHalf' | 'galleryQuarter', string>> =
    Object.freeze({
        galleryFeatured: '(max-width: 640px) 100vw, 66vw',
        galleryHalf: '(max-width: 640px) 100vw, 50vw',
        galleryQuarter: '(max-width: 640px) 50vw, 33vw'
    });

/**
 * Builds a `srcset` attribute string for a gallery cell.
 *
 * Generates width candidates by overriding the preset's `w_` token via
 * `getMediaUrl({ preset, width })`. Each candidate is formatted as
 * `<url> <width>w` per the HTML specification.
 *
 * Returns `undefined` for non-Cloudinary URLs (placeholders, YouTube poster
 * frames, mock URLs in tests) because `getMediaUrl` is a pass-through for
 * those — all candidates would be identical strings, which wastes bandwidth
 * and produces a confusing srcset that the browser cannot use for selection.
 *
 * @param url - Original image URL (may carry an existing Cloudinary transform).
 * @param preset - Cell role preset; must be one of the srcset-capable presets.
 * @returns Comma-separated `srcset` string, or `undefined` if the URL is not
 *   a Cloudinary URL.
 */
function buildCellSrcset(
    url: string,
    preset: 'galleryFeatured' | 'galleryHalf' | 'galleryQuarter'
): string | undefined {
    if (!isCloudinaryUrl(url)) {
        // Non-Cloudinary URLs pass through width-override calls unchanged.
        // Emitting a srcset with identical candidates would waste bytes and
        // give the browser no useful density information. Return undefined so
        // the caller falls back to a plain `src`.
        return undefined;
    }

    const baseUrl = stripCloudinaryTransform(url);
    const widths = SRCSET_WIDTHS[preset];

    return widths.map((w) => `${getMediaUrl(baseUrl, { preset, width: w })} ${w}w`).join(', ');
}

/**
 * Builds a large, non-cropped URL for the lightbox viewer.
 *
 * The lightbox should display the full image without a forced aspect-ratio
 * crop so the subject is never clipped to a square or 4:3 frame. Uses the
 * `full` preset (`q_auto,f_auto,dpr_auto`) which applies quality / format
 * negotiation but no dimensional crop.
 *
 * Non-Cloudinary URLs pass through unchanged.
 *
 * @param url - Original image URL (may already carry a Cloudinary transform).
 * @returns URL optimized for full-size lightbox display.
 */
function buildLightboxUrl(url: string): string {
    return buildCellUrl(url, 'full');
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

interface LightboxProps {
    readonly images: ReadonlyArray<GalleryImage>;
    readonly initialIndex: number;
    readonly onClose: () => void;
    readonly t: (key: string, fallback?: string) => string;
}

function Lightbox({ images, initialIndex, onClose, t }: LightboxProps) {
    const [index, setIndex] = useState(initialIndex);

    const prev = useCallback(() => {
        setIndex((i) => (i - 1 + images.length) % images.length);
    }, [images.length]);

    const next = useCallback(() => {
        setIndex((i) => (i + 1) % images.length);
    }, [images.length]);

    // Arrow-key navigation. Esc + scroll-lock + focus-trap are owned by Dialog.
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'ArrowLeft') {
                prev();
                return;
            }
            if (event.key === 'ArrowRight') {
                next();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [prev, next]);

    const current = images[index];

    return (
        <Dialog
            isOpen={true}
            onClose={onClose}
            size="full"
            variant="transparent"
            ariaLabel={t('ui.accessibility.openFullscreen', 'Visor de imágenes')}
        >
            <DialogFloatingCloseButton
                onClose={onClose}
                closeLabel={t('ui.accessibility.closeLightbox', 'Cerrar visor')}
            />

            {/* Counter */}
            <div
                className={styles.lightboxCounter}
                aria-live="polite"
                aria-atomic="true"
            >
                {index + 1} / {images.length}
            </div>

            {/* Prev */}
            {images.length > 1 && (
                <button
                    type="button"
                    className={`${styles.lightboxNav} ${styles.lightboxNavPrev}`}
                    aria-label={t('ui.accessibility.previousImage', 'Imagen anterior')}
                    onClick={prev}
                >
                    <ChevronLeftIcon
                        size={28}
                        aria-hidden="true"
                    />
                </button>
            )}

            <DialogBody bare>
                <figure className={styles.lightboxFigure}>
                    <img
                        key={current?.url}
                        src={current ? buildLightboxUrl(current.url) : undefined}
                        alt={current?.alt ?? ''}
                        className={styles.lightboxImg}
                    />
                    {current?.caption && (
                        <figcaption className={styles.lightboxCaption}>
                            {current.caption}
                        </figcaption>
                    )}
                </figure>
            </DialogBody>

            {/* Next */}
            {images.length > 1 && (
                <button
                    type="button"
                    className={`${styles.lightboxNav} ${styles.lightboxNavNext}`}
                    aria-label={t('ui.accessibility.nextImage', 'Imagen siguiente')}
                    onClick={next}
                >
                    <ChevronRightIcon
                        size={28}
                        aria-hidden="true"
                    />
                </button>
            )}

            {/* Thumbnail strip */}
            {images.length > 1 && (
                <ul className={styles.lightboxThumbs}>
                    {images.map((img, i) => (
                        <li key={img.url}>
                            <button
                                type="button"
                                aria-label={t(
                                    'ui.accessibility.goToImage',
                                    `Ir a imagen ${i + 1}`
                                ).replace('{{number}}', String(i + 1))}
                                aria-current={i === index ? 'true' : undefined}
                                className={`${styles.lightboxThumb} ${i === index ? styles.lightboxThumbActive : ''}`}
                                onClick={() => setIndex(i)}
                            >
                                <img
                                    src={buildCellUrl(img.url, 'galleryThumb')}
                                    alt={img.alt}
                                    className={styles.lightboxThumbImg}
                                    loading="lazy"
                                />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Dialog>
    );
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
    readonly onOpen: (index: number) => void;
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
}

function DetailVariant({ images, onOpen, t }: DetailVariantProps) {
    const [featured, ...rest] = images;
    const count = images.length;
    const visibleThumbCount = getVisibleThumbCount(count);
    const visibleThumbs = rest.slice(0, visibleThumbCount);
    // N in "+N más" = total images minus visible inline images (featured + visible thumbs).
    const moreCount = count >= 5 ? count - 4 : 0;
    const countKey = getDetailCountKey(count);

    if (!featured) return null;

    return (
        <div
            className={styles.grid}
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
                type="button"
                className={styles.cellFeatured}
                aria-label={t('ui.accessibility.openFullscreen', 'Ver en pantalla completa')}
                onClick={() => onOpen(0)}
            >
                <img
                    src={buildCellUrl(featured.url, 'galleryFeatured')}
                    srcSet={buildCellSrcset(featured.url, 'galleryFeatured')}
                    sizes={isCloudinaryUrl(featured.url) ? CELL_SIZES.galleryFeatured : undefined}
                    alt={featured.alt}
                    className={styles.cellImg}
                    loading="eager"
                    // SPEC-157 REQ-3: this is the LCP candidate on the
                    // accommodation detail page. The gallery is an island, so
                    // this markup is server-rendered into the initial HTML —
                    // fetchPriority + explicit dimensions let the browser
                    // prioritise the fetch and reserve layout (no CLS). The
                    // intrinsic ratio mirrors the .mosaic max-height (480px);
                    // object-fit: cover keeps remote images undistorted.
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
                                    <img
                                        src={buildCellUrl(img.url, thumbPreset)}
                                        srcSet={buildCellSrcset(img.url, thumbPreset)}
                                        sizes={
                                            isCloudinaryUrl(img.url)
                                                ? CELL_SIZES[thumbPreset]
                                                : undefined
                                        }
                                        alt={img.alt}
                                        className={styles.cellImg}
                                        loading="lazy"
                                        aria-hidden="true"
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
                                onClick={() => onOpen(lightboxIndex)}
                            >
                                <img
                                    src={buildCellUrl(img.url, thumbPreset)}
                                    srcSet={buildCellSrcset(img.url, thumbPreset)}
                                    sizes={
                                        isCloudinaryUrl(img.url)
                                            ? CELL_SIZES[thumbPreset]
                                            : undefined
                                    }
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

// ─── Cover-plus-grid variant ─────────────────────────────────────────────────

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

interface CoverPlusGridVariantProps {
    readonly images: ReadonlyArray<GalleryImage>;
    readonly onOpen: (index: number) => void;
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
}

function CoverPlusGridVariant({ images, onOpen, t }: CoverPlusGridVariantProps) {
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
                onClick={() => onOpen(0)}
            >
                <img
                    src={buildCellUrl(cover.url, 'galleryFeatured')}
                    srcSet={buildCellSrcset(cover.url, 'galleryFeatured')}
                    sizes={isCloudinaryUrl(cover.url) ? CELL_SIZES.galleryFeatured : undefined}
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
                                    <img
                                        src={buildCellUrl(img.url, extrasPreset)}
                                        srcSet={buildCellSrcset(img.url, extrasPreset)}
                                        sizes={
                                            isCloudinaryUrl(img.url)
                                                ? CELL_SIZES[extrasPreset]
                                                : undefined
                                        }
                                        alt={img.alt}
                                        className={styles.cellImg}
                                        loading="lazy"
                                        aria-hidden="true"
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
                                onClick={() => onOpen(lightboxIndex)}
                            >
                                <img
                                    src={buildCellUrl(img.url, extrasPreset)}
                                    srcSet={buildCellSrcset(img.url, extrasPreset)}
                                    sizes={
                                        isCloudinaryUrl(img.url)
                                            ? CELL_SIZES[extrasPreset]
                                            : undefined
                                    }
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
export function ImageGallery({ images, variant = 'detail', locale, className }: ImageGalleryProps) {
    const { t } = createTranslations(locale);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    const openLightbox = useCallback((index: number): void => {
        setLightboxIndex(index);
    }, []);

    const closeLightbox = useCallback((): void => {
        setLightboxIndex(null);
    }, []);

    if (images.length === 0) return null;

    return (
        <div className={`${styles.root}${className ? ` ${className}` : ''}`}>
            {variant === 'detail' ? (
                <DetailVariant
                    images={images}
                    onOpen={openLightbox}
                    t={t}
                />
            ) : (
                <CoverPlusGridVariant
                    images={images}
                    onOpen={openLightbox}
                    t={t}
                />
            )}

            {lightboxIndex !== null && (
                <Lightbox
                    images={images}
                    initialIndex={lightboxIndex}
                    onClose={closeLightbox}
                    t={t}
                />
            )}
        </div>
    );
}
