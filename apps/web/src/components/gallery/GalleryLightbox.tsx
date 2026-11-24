/**
 * @file GalleryLightbox.tsx
 * @description Full-screen photo viewer of `ImageGallery`, extracted from
 * `ImageGallery.client.tsx` (HOS-2520) so that file stays under 500 lines.
 *
 * Opening is cheap on purpose (owner smoke, HOS-2520):
 * - the photo the page already painted (mosaic cell or mobile slide) shows at once as
 *   a placeholder while the full-size image loads, with the spinner on top;
 * - the thumbnail strip mounts after the dialog's first paint (`GalleryLightboxThumbs`).
 */

import { ChevronLeftIcon, ChevronRightIcon } from '@repo/icons';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/components/shared/feedback/Spinner';
import {
    Dialog,
    DialogBody,
    DialogFloatingCloseButton
} from '@/components/shared/ui/Dialog.client';
import { useSwipe } from '@/hooks/useSwipe';
import type { GalleryImage } from '../ImageGallery.client';
import mobileStyles from '../ImageGalleryMobileTrack.module.css';
import { GalleryCounter } from './GalleryCounter';
import styles from './GalleryLightbox.module.css';
import { LightboxCaption } from './GalleryLightboxCaption';
import { GalleryLightboxThumbs } from './GalleryLightboxThumbs';
import { buildLightboxUrl } from './gallery-image-sources';
import { readPreloadAllowed, resolveLightboxPreloadIndices, warmImage } from './gallery-preload';

/** Props of {@link GalleryLightbox}. */
export interface GalleryLightboxProps {
    readonly images: ReadonlyArray<GalleryImage>;
    readonly initialIndex: number;
    readonly onClose: () => void;
    readonly t: (key: string, fallback?: string, params?: Record<string, unknown>) => string;
    /**
     * URL of an already-painted version of photo `index`, shown while its full-size
     * image loads. `undefined` when the page has none loaded.
     */
    readonly resolvePlaceholder?: (index: number) => string | undefined;
}

function noop() {}

/** Full-screen viewer with arrows, swipe, keyboard, counter, caption and strip. */
export function GalleryLightbox({
    images,
    initialIndex,
    onClose,
    t,
    resolvePlaceholder
}: GalleryLightboxProps) {
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

    const goTo = useCallback((position: number) => {
        setIsImgLoading(true);
        setIndex(position);
    }, []);

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
    // Read once per photo: the page's cells do not change while the dialog is open.
    const placeholder = useMemo(() => resolvePlaceholder?.(index), [resolvePlaceholder, index]);

    // Warm the browser cache so sequential navigation usually resolves from cache:
    // the next two photos and the previous one (HOS-2520 smoke), the same URL the
    // viewer's <img> requests. Nothing is preloaded on data saver or 2G. The
    // visitor is navigating, so these go at normal priority; a URL the idle
    // warm-up already requested is not requested twice.
    useEffect(() => {
        const { allowed } = readPreloadAllowed({ nav: navigator });
        const { indices } = resolveLightboxPreloadIndices({
            index,
            count: images.length,
            saveData: !allowed
        });
        for (const position of indices) {
            const img = images[position];
            if (img) warmImage({ url: buildLightboxUrl({ url: img.url }).src, priority: 'auto' });
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
                    {/* Fixed-size stage: the placeholder (a cropped cell) and the
                        full photo have different ratios, and the stage keeps the
                        swap from moving the caption or the controls. */}
                    <div
                        className={`${styles.lightboxStage} ${mobileStyles.swipeSurface}`}
                        {...swipe}
                    >
                        {isImgLoading && placeholder && (
                            <img
                                src={placeholder}
                                alt=""
                                aria-hidden="true"
                                data-lightbox-placeholder=""
                                className={styles.lightboxPlaceholder}
                            />
                        )}
                        <img
                            key={current?.url}
                            ref={imgRef}
                            src={current ? buildLightboxUrl({ url: current.url }).src : undefined}
                            alt={current?.alt ?? ''}
                            className={`${styles.lightboxImg} ${styles.lightboxImgFade}${isImgLoading ? ` ${styles.lightboxImgLoading}` : ''}`}
                            onLoad={() => setIsImgLoading(false)}
                            onError={() => setIsImgLoading(false)}
                        />
                    </div>
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

            <GalleryLightboxThumbs
                images={images}
                index={index}
                onSelect={goTo}
                t={t}
            />
        </Dialog>
    );
}
