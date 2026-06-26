/**
 * @file hero-images.ts
 * @description Single source of truth for the homepage hero slideshow images.
 *
 * Shared by `HeroSection.astro` (which renders the rotator) and the home page
 * `<head>` (which emits the LCP `<link rel="preload" as="image">` hint for the
 * first slide). Keeping the widths, sizes and slide order in one place
 * guarantees the preload hint always matches the `srcset` the rotator renders,
 * so the browser fetches exactly the resource it ends up painting (no wasted
 * preload, no duplicate download).
 */

import { getImage } from 'astro:assets';
import heroAtardecerRaw from '@/assets/images/hero/hero-atardecer.jpg';
import heroIslaRaw from '@/assets/images/hero/hero-isla.jpg';
import heroPlayaRaw from '@/assets/images/hero/hero-playa.jpg';

/**
 * Responsive widths generated for each hero slide. The browser picks the right
 * one per viewport via the `srcset`/`sizes` pair. The 800w variant is the
 * default `src` for backwards compatibility.
 */
export const HERO_IMAGE_WIDTHS = [480, 800, 1200] as const;

/** `sizes` attribute shared by the rotator imgs and the preload hint. */
export const HERO_IMAGE_SIZES = '(max-width: 768px) 100vw, 50vw';

/**
 * Ordered raw hero slides. Index 0 is the LCP candidate: it is the first frame
 * painted, the one preloaded in the head, and the one the rotator starts on.
 */
export const HERO_RAW_SLIDES = [heroPlayaRaw, heroAtardecerRaw, heroIslaRaw] as const;

/** Default `src` + responsive `srcset` for a single optimized hero slide. */
export interface HeroVariant {
    readonly src: string;
    readonly srcset: string;
}

/**
 * Generate the responsive WebP variants for one hero slide.
 *
 * @param params.rawImage - The imported `ImageMetadata` for the raw hero JPG.
 * @returns The default `src` (800w) plus the full `srcset` candidate string.
 */
export async function buildHeroVariants({
    rawImage
}: {
    rawImage: ImageMetadata;
}): Promise<HeroVariant> {
    const variants = await Promise.all(
        HERO_IMAGE_WIDTHS.map((width) => getImage({ src: rawImage, width, format: 'webp' }))
    );
    const srcset = variants
        .map((variant, index) => `${variant.src} ${HERO_IMAGE_WIDTHS[index]}w`)
        .join(', ');
    const defaultIndex = HERO_IMAGE_WIDTHS.indexOf(800);
    return { src: variants[defaultIndex].src, srcset };
}
