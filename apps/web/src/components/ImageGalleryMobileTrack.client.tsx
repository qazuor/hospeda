import type { ShareCampaign } from '@repo/analytics';
import type { KeyboardEvent, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { FavoriteButtonProps } from '@/components/shared/favorite/FavoriteButton.client';
import { FavoriteButton } from '@/components/shared/favorite/FavoriteButton.client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { GalleryCounter } from './gallery/GalleryCounter';
import { buildCellSources, MOBILE_GALLERY_MEDIA } from './gallery/gallery-image-sources';
import { readSaveData, resolveEagerThrough, whenPageIdle } from './gallery/gallery-preload';
import type { GalleryImage } from './ImageGallery.client';
import styles from './ImageGalleryMobileTrack.module.css';
import { ShareButtons } from './ShareButtons.client';

/**
 * Caller-supplied public action metadata for the mobile gallery. There is no back
 * control: the owner removed it from the photo (HOS-2520 smoke) because an arrow over
 * a photo did not read as "go back"; the browser's own back covers it.
 */
export interface MobileGalleryOptions {
    readonly share?: {
        readonly url: string;
        readonly title: string;
        /** Entity type shared, used as `utm_campaign` (HOS-2359). */
        readonly campaign: ShareCampaign;
    };
    readonly favorite?: Pick<FavoriteButtonProps, 'entityId' | 'entityType' | 'variant'>;
}

interface Props extends MobileGalleryOptions {
    readonly images: readonly GalleryImage[];
    readonly locale: SupportedLocale;
    readonly onOpen: (index: number) => void;
    readonly mosaicTriggerRef: RefObject<HTMLButtonElement | null>;
}

const ACTIVE_THRESHOLD = 0.6;
const MAX_DOTS = 8;

/** Server-rendered, native scroll-snap gallery for the detail variant's mobile layout. */
export function ImageGalleryMobileTrack({
    images,
    locale,
    onOpen,
    mosaicTriggerRef,
    share,
    favorite
}: Props) {
    const { t } = createTranslations(locale);
    const [index, setIndex] = useState(0);
    const trackRef = useRef<HTMLElement>(null);
    const count = images.length;
    const current = Math.min(index, count - 1);
    // Progressive preload (HOS-2520 smoke): slides up to this index load eagerly.
    const [eagerThrough, setEagerThrough] = useState(0);
    const [pageReady, setPageReady] = useState(false);

    useEffect(() => whenPageIdle({ win: window, onReady: () => setPageReady(true) }).cleanup, []);

    useEffect(() => {
        const { saveData } = readSaveData({ nav: navigator });
        setEagerThrough(
            (previous) =>
                resolveEagerThrough({ current, count, ready: pageReady, saveData, previous })
                    .eagerThrough
        );
    }, [current, count, pageReady]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: replaced images can replace the observed nodes even when the count is unchanged.
    useEffect(() => {
        const track = trackRef.current;
        if (!track || typeof IntersectionObserver === 'undefined') return;

        const slides = Array.from(track.children);
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.find(
                    (entry) => entry.isIntersecting && entry.intersectionRatio >= ACTIVE_THRESHOLD
                );
                if (!visible || track.clientWidth === 0) return;
                const active = slides.indexOf(visible.target);
                if (active !== -1) setIndex(active);
            },
            { root: track, threshold: ACTIVE_THRESHOLD }
        );
        for (const slide of slides) observer.observe(slide);
        return () => observer.disconnect();
    }, [images]);

    function handleTrackKey(event: KeyboardEvent<HTMLElement>) {
        const track = event.currentTarget;
        const fromTrack = event.target === track;
        const fromSlide =
            event.target instanceof HTMLButtonElement && event.target.parentElement === track;
        if (!fromTrack && !fromSlide) return;
        // Use the scroll position for repeat key presses before the observer runs.
        const position =
            track.clientWidth > 0 ? Math.round(track.scrollLeft / track.clientWidth) : current;
        if (fromTrack && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onOpen(Math.max(0, Math.min(position, count - 1)));
            return;
        }
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

        event.preventDefault();
        const next = position + (event.key === 'ArrowRight' ? 1 : -1);
        if (next < 0 || next >= count) return;
        // After a dialog returns focus to a clicked slide, don't leave it on a slide scrolling away.
        if (fromSlide) track.focus({ preventScroll: true });
        track.scrollTo({ left: next * track.clientWidth });
    }

    if (count === 0) return null;

    const firstDot = Math.max(0, Math.min(current - Math.floor(MAX_DOTS / 2), count - MAX_DOTS));
    const dots = images.slice(firstDot, firstDot + MAX_DOTS);

    return (
        <div className={styles.mobile}>
            <section
                className={styles.track}
                ref={trackRef}
                aria-label={t('ui.accessibility.imageGallery')}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: the gallery accepts keyboard scrolling and activation.
                tabIndex={0}
                onKeyDown={handleTrackKey}
            >
                {images.map(({ url, alt }, slide) => {
                    // Reuse the featured candidates, but each slide fills the viewport.
                    const { src, srcSet, sizes } = buildCellSources({
                        url,
                        preset: 'galleryFeatured',
                        sizesOverride: '100vw'
                    });
                    return (
                        <button
                            // biome-ignore lint/suspicious/noArrayIndexKey: a listing can contain the same image URL more than once.
                            key={`${slide}:${url}`}
                            className={styles.slide}
                            type="button"
                            tabIndex={-1}
                            aria-label={t('ui.accessibility.openGalleryImage', undefined, { alt })}
                            onClick={() => onOpen(slide)}
                        >
                            <picture>
                                {/* A CSS-hidden eager img can still fetch. Gate the actual source by media. */}
                                <source
                                    media={MOBILE_GALLERY_MEDIA}
                                    srcSet={srcSet ?? src}
                                    sizes={sizes}
                                />
                                <img
                                    alt={alt}
                                    width={800}
                                    height={600}
                                    loading={slide <= eagerThrough ? 'eager' : 'lazy'}
                                    fetchPriority={slide === 0 ? 'high' : undefined}
                                    draggable={false}
                                />
                            </picture>
                        </button>
                    );
                })}
            </section>
            {(share || favorite) && (
                <div className={styles.actions}>
                    {share && (
                        <ShareButtons
                            {...share}
                            locale={locale}
                            appearance="icon-overlay"
                        />
                    )}
                    {favorite && (
                        <FavoriteButton
                            {...favorite}
                            className={styles.favorite}
                            locale={locale}
                            focusGuestPrompt
                            guestPromptFallbackRef={mosaicTriggerRef}
                        />
                    )}
                </div>
            )}
            <GalleryCounter
                className={styles.counter}
                label={t('ui.accessibility.galleryCounter', '{{current}}/{{total}}', {
                    current: current + 1,
                    total: count
                })}
            />
            {count > 1 && (
                <div
                    className={styles.dots}
                    aria-hidden="true"
                >
                    {dots.map((image, offset) => (
                        <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: each decorative dot represents a position, even for duplicate URLs.
                            key={`${firstDot + offset}:${image.url}`}
                            data-active={firstDot + offset === current}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
