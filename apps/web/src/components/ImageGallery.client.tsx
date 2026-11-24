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
    ArrowRightIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    FullscreenIcon,
    GridIcon
} from '@repo/icons';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/shared/feedback/Spinner';
import {
    Dialog,
    DialogBody,
    DialogFloatingCloseButton
} from '@/components/shared/ui/Dialog.client';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { useSwipe } from '@/hooks/useSwipe';
import type { PluralTranslationFn, SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { PhotoCreditParts } from '@/lib/photo-credit.types';
import { GalleryCounter } from './gallery/GalleryCounter';
import { GalleryHeroPreload } from './gallery/GalleryHeroPreload';
import {
    buildCellSources,
    buildCellUrl,
    DESKTOP_GALLERY_MEDIA
} from './gallery/gallery-image-sources';
import { readSaveData, resolveLightboxPreloadIndices } from './gallery/gallery-preload';
import styles from './ImageGallery.module.css';
import type { MobileGalleryOptions } from './ImageGalleryMobileTrack.client';
import { ImageGalleryMobileTrack } from './ImageGalleryMobileTrack.client';
import mobileStyles from './ImageGalleryMobileTrack.module.css';

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
    return buildCellUrl({ url, preset: 'full' }).src;
}

// ─── Cell image with loading skeleton ─────────────────────────────────────────

/**
 * Props for {@link GalleryCellImage} — the subset of native `<img>` attributes
 * the gallery grid/cover cells use.
 */
interface GalleryCellImageProps {
    readonly src: string;
    readonly srcSet?: string;
    readonly sizes?: string;
    readonly media?: string;
    readonly alt: string;
    /** Base cell image class (`styles.cellImg` or `styles.coverImg`). */
    readonly className: string;
    readonly loading: 'eager' | 'lazy';
    readonly fetchPriority?: 'high' | 'low' | 'auto';
    readonly width?: number;
    readonly height?: number;
    /** Mirrors the native `aria-hidden` attribute for decorative overlay cells. */
    readonly ariaHidden?: boolean;
}

/**
 * A gallery grid/cover `<img>` that renders an animated skeleton placeholder
 * while the image is still loading, then clears it once the image paints (or
 * fails to). Fixes the blank cells shown by the `detail` and `cover-plus-grid`
 * variants before their images arrive — previously only the lightbox surfaced a
 * loading indicator (BETA-147).
 *
 * The skeleton is a shimmer background applied to the `<img>` element itself.
 * Because every cell image is `object-fit: cover` and fills its fixed-ratio
 * cell, the loaded image paints over the background with zero layout shift.
 *
 * SSR/cache safety: the island markup is server-rendered, so an image may
 * already be decoded before React attaches `onLoad`. A layout effect checks
 * `img.complete` after mount and clears the skeleton synchronously in that case
 * (mirrors the lightbox's belt-and-suspenders load handling).
 */
function GalleryCellImage({
    className,
    ariaHidden,
    src,
    srcSet,
    sizes,
    media,
    ...imgProps
}: GalleryCellImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const ref = useRef<HTMLImageElement>(null);

    useLayoutEffect(() => {
        if (ref.current?.complete) {
            setIsLoaded(true);
        }
    }, []);

    const image = (
        <img
            ref={ref}
            src={media ? undefined : src}
            srcSet={media ? undefined : srcSet}
            sizes={media ? undefined : sizes}
            {...imgProps}
            aria-hidden={ariaHidden}
            className={isLoaded ? className : `${className} ${styles.cellImgSkeleton}`}
            onLoad={() => setIsLoaded(true)}
            onError={() => setIsLoaded(true)}
        />
    );
    // A CSS-hidden eager img can still fetch (or be preloaded during SSR).
    if (!media) return image;
    return (
        <picture className={mobileStyles.desktopPicture}>
            <source
                media={media}
                srcSet={srcSet ?? src}
                sizes={sizes}
            />
            {image}
        </picture>
    );
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

interface LightboxProps {
    readonly images: ReadonlyArray<GalleryImage>;
    readonly initialIndex: number;
    readonly onClose: () => void;
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
}

/** Description length above which the mobile "ver más" toggle is offered. */
const DESCRIPTION_TOGGLE_THRESHOLD = 90;

interface LightboxCaptionProps {
    readonly image: GalleryImage;
    readonly t: (key: string, fallback?: string) => string;
}

/**
 * Caption bar under the lightbox photo (HOS-2125): caption prominent,
 * description below it, credit small. The description is clamped on mobile
 * (CSS) and expanded through a real toggle button. Remounted per photo (via
 * `key`) so the expanded state never leaks between photos.
 */
function LightboxCaption({ image, t }: LightboxCaptionProps) {
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

function noop() {}

function Lightbox({ images, initialIndex, onClose, t }: LightboxProps) {
    const [index, setIndex] = useState(initialIndex);
    // Tracks whether the displayed image has finished loading, so a spinner can
    // show while navigating between photos. Set true in the nav handlers (same
    // update as the index change) rather than in an effect: `onLoad` then
    // reliably clears it, including for cached images where an effect-based
    // reset would race the load event and leave the spinner stuck.
    const [isImgLoading, setIsImgLoading] = useState(true);
    const imgRef = useRef<HTMLImageElement>(null);

    // Belt-and-suspenders for the loading flag. `onLoad` can be missed when the
    // image is already decoded: `img.complete` may be true before React attaches
    // the handler (synchronous load in some WebKit cache paths), and `onLoad`
    // never fires at all when navigating between two entries that share the same
    // URL (the `key` is unchanged, so the <img> is not remounted). This layout
    // effect runs synchronously after each commit and clears the flag if the
    // image is already complete. Re-clearing via `onLoad` later is a no-op.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `index` is the re-run trigger — the effect must re-check the freshly-mounted image's `complete` flag after each navigation; it intentionally does not read `index` in its body.
    useLayoutEffect(() => {
        if (imgRef.current?.complete) {
            setIsImgLoading(false);
        }
    }, [index]);

    const prev = useCallback(() => {
        setIsImgLoading(true);
        setIndex((i) => (i - 1 + images.length) % images.length);
    }, [images.length]);

    const next = useCallback(() => {
        setIsImgLoading(true);
        setIndex((i) => (i + 1) % images.length);
    }, [images.length]);
    const swipe = useSwipe({
        onLeft: images.length > 1 ? next : noop,
        onRight: images.length > 1 ? prev : noop
    });

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

    // Warm the browser cache so sequential navigation usually resolves from cache:
    // the next two photos and the previous one (HOS-2520 smoke), the same URL the
    // viewer's <img> requests. Nothing is preloaded with data saver on.
    useEffect(() => {
        const { saveData } = readSaveData({ nav: navigator });
        const { indices } = resolveLightboxPreloadIndices({
            index,
            count: images.length,
            saveData
        });
        for (const position of indices) {
            const img = images[position];
            if (!img) continue;
            const preloader = new Image();
            preloader.src = buildLightboxUrl(img.url);
        }
    }, [index, images]);

    return (
        <Dialog
            isOpen={true}
            onClose={onClose}
            size="full"
            variant="transparent"
            overlayClassName={styles.lightboxOverlay}
            ariaLabel={t('ui.accessibility.openFullscreen', 'Visor de imágenes')}
        >
            <DialogFloatingCloseButton
                onClose={onClose}
                closeLabel={t('ui.accessibility.closeLightbox', 'Cerrar visor')}
            />

            {/* Counter */}
            <GalleryCounter
                className={styles.lightboxCounter}
                label={t('ui.accessibility.galleryCounter', '{{current}}/{{total}}', {
                    current: index + 1,
                    total: images.length
                })}
            />

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
                    {isImgLoading && (
                        <Spinner
                            size="lg"
                            label={t('common.loading', 'Cargando…')}
                            className={styles.lightboxSpinner}
                        />
                    )}
                    <img
                        key={current?.url}
                        ref={imgRef}
                        src={current ? buildLightboxUrl(current.url) : undefined}
                        alt={current?.alt ?? ''}
                        className={`${styles.lightboxImg} ${styles.lightboxImgFade} ${mobileStyles.swipeSurface}${isImgLoading ? ` ${styles.lightboxImgLoading}` : ''}`}
                        {...swipe}
                        onLoad={() => setIsImgLoading(false)}
                        onError={() => setIsImgLoading(false)}
                    />
                    {current && (current.caption || current.description || current.credit) && (
                        <LightboxCaption
                            key={index}
                            image={current}
                            t={t}
                        />
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
                                onClick={() => {
                                    if (i === index) return;
                                    setIsImgLoading(true);
                                    setIndex(i);
                                }}
                            >
                                <img
                                    {...buildCellUrl({ url: img.url, preset: 'galleryThumb' })}
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
