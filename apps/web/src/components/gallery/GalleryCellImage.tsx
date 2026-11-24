/**
 * @file GalleryCellImage.tsx
 * @description Grid/cover cell image with a loading skeleton (BETA-147), extracted
 * from `ImageGallery.client.tsx` to keep that file under 500 lines (HOS-2520).
 */

import { useLayoutEffect, useRef, useState } from 'react';
import styles from '../ImageGallery.module.css';
import mobileStyles from '../ImageGalleryMobileTrack.module.css';

/**
 * Props for {@link GalleryCellImage} — the subset of native `<img>` attributes
 * the gallery grid/cover cells use.
 */
export interface GalleryCellImageProps {
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
export function GalleryCellImage({
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
