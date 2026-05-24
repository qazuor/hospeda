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
                        src={current?.url}
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
                                    src={img.url}
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

interface DetailVariantProps {
    readonly images: ReadonlyArray<GalleryImage>;
    readonly onOpen: (index: number) => void;
    readonly t: (key: string, fallback?: string) => string;
}

function DetailVariant({ images, onOpen, t }: DetailVariantProps) {
    const [featured, ...thumbs] = images;
    const visibleThumbs = thumbs.slice(0, 3);

    if (!featured) return null;

    return (
        <div
            className={`${styles.mosaic} ${visibleThumbs.length > 0 ? styles.mosaicWithThumbs : ''}`}
        >
            {/* Featured image */}
            <button
                type="button"
                className={styles.featuredBtn}
                aria-label={t('ui.accessibility.openFullscreen', 'Ver en pantalla completa')}
                onClick={() => onOpen(0)}
            >
                <img
                    src={featured.url}
                    alt={featured.alt}
                    className={styles.featuredImg}
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

            {/* Thumbnails */}
            {visibleThumbs.length > 0 && (
                <div className={styles.thumbGrid}>
                    {visibleThumbs.map((img, i) => (
                        <button
                            key={img.url}
                            type="button"
                            className={styles.thumbBtn}
                            aria-label={t(
                                'ui.accessibility.openFullscreen',
                                'Ver en pantalla completa'
                            )}
                            onClick={() => onOpen(i + 1)}
                        >
                            <img
                                src={img.url}
                                alt={img.alt}
                                className={styles.thumbImg}
                                loading="lazy"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Cover-plus-grid variant ─────────────────────────────────────────────────

interface CoverPlusGridVariantProps {
    readonly images: ReadonlyArray<GalleryImage>;
    readonly onOpen: (index: number) => void;
    readonly t: (key: string, fallback?: string) => string;
}

function CoverPlusGridVariant({ images, onOpen, t }: CoverPlusGridVariantProps) {
    const [cover, ...rest] = images;

    if (!cover) return null;

    return (
        <div className={styles.coverPlusGrid}>
            {/* Cover image */}
            <button
                type="button"
                className={styles.coverBtn}
                aria-label={t('ui.accessibility.openFullscreen', 'Ver en pantalla completa')}
                onClick={() => onOpen(0)}
            >
                <img
                    src={cover.url}
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

            {/* Inline grid */}
            {rest.length > 0 && (
                <div className={styles.inlineGrid}>
                    {rest.slice(0, 6).map((img, i) => (
                        <button
                            key={img.url}
                            type="button"
                            className={styles.inlineGridBtn}
                            aria-label={t(
                                'ui.accessibility.openFullscreen',
                                'Ver en pantalla completa'
                            )}
                            onClick={() => onOpen(i + 1)}
                        >
                            <img
                                src={img.url}
                                alt={img.alt}
                                className={styles.inlineGridImg}
                                loading="lazy"
                            />
                        </button>
                    ))}
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
