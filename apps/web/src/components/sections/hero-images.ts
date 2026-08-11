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
 *
 * 640 and 1000 were added in HOS-369. The old 480/800/1200 ladder jumped
 * straight from 800 to 1200, so any device needing 801-1199 device pixels — the
 * common case on modern phones — had to take the 1200w candidate. Measured
 * AVIF weights: 480w 7,4 kB · 640w 12,1 kB · 800w 17,9 kB · 1000w 23,8 kB ·
 * 1200w 29,9 kB. A finer ladder lets the browser land near what it needs
 * instead of overshooting to the top rung.
 */
export const HERO_IMAGE_WIDTHS = [480, 640, 800, 1000, 1200] as const;

/**
 * `sizes` attribute shared by the rotator imgs and the preload hint.
 *
 * The mobile branch DELIBERATELY under-declares the rendered width (70vw for an
 * image that actually spans ~100vw). This is an effective-DPR cap, not a bug —
 * do NOT "fix" it back to 100vw.
 *
 * Why: `sizes` only feeds `srcset` candidate selection; it has zero effect on
 * how the image is laid out or painted. On a 412 px viewport at DPR 2.625 a
 * truthful 100vw asks for 1081 device pixels, so the browser takes the 1200w
 * candidate. Declaring 70vw asks for 757 and it takes 800w instead — 17,9 kB
 * against 29,9 kB in AVIF. That serves the hero at roughly 1.8x rather than
 * 2.6x, which on a large photographic image is not perceptible, and this image
 * IS the LCP element on a connection where the LCP is bandwidth-bound.
 *
 * The desktop branch is left truthful at 50vw: desktop is not where the budget
 * is under pressure, and retina desktops still resolve to the 1200w candidate.
 */
export const HERO_IMAGE_SIZES = '(max-width: 768px) 70vw, 50vw';

/**
 * Ordered raw hero slides. Index 0 is the LCP candidate: it is the first frame
 * painted, the one preloaded in the head, and the one the rotator starts on.
 */
export const HERO_RAW_SLIDES = [heroPlayaRaw, heroAtardecerRaw, heroIslaRaw] as const;

/** Default `src` + responsive `srcset`s for a single optimized hero slide. */
export interface HeroVariant {
    /** WebP `src` (800w) — the universally-supported fallback. */
    readonly src: string;
    /** WebP `srcset`, used by the `<img>` fallback inside `<picture>`. */
    readonly srcset: string;
    /** AVIF `srcset`, offered first via `<source type="image/avif">`. */
    readonly avifSrcset: string;
}

/**
 * Build a `srcset` candidate string from one variant per entry in
 * {@link HERO_IMAGE_WIDTHS}.
 */
function toSrcset(variants: ReadonlyArray<{ readonly src: string }>): string {
    return variants
        .map((variant, index) => `${variant.src} ${HERO_IMAGE_WIDTHS[index]}w`)
        .join(', ');
}

/**
 * Generate the responsive AVIF + WebP variants for one hero slide.
 *
 * BOTH formats are generated on purpose (HOS-369). AVIF is ~40% lighter than
 * WebP at every width on this image, but it is unsupported by Safari before
 * 16.4 — and this image is the LCP element, so a naked format swap would leave
 * those visitors with no hero at all. Consumers must therefore offer the AVIF
 * `srcset` through `<source type="image/avif">` and keep the WebP `srcset` on
 * the `<img>` fallback; `HeroImageRotator` does exactly that.
 *
 * @param params.rawImage - The imported `ImageMetadata` for the raw hero JPG.
 * @returns The default WebP `src` (800w) plus the AVIF and WebP candidate strings.
 */
export async function buildHeroVariants({
    rawImage
}: {
    rawImage: ImageMetadata;
}): Promise<HeroVariant> {
    const [webpVariants, avifVariants] = await Promise.all([
        Promise.all(
            HERO_IMAGE_WIDTHS.map((width) => getImage({ src: rawImage, width, format: 'webp' }))
        ),
        Promise.all(
            HERO_IMAGE_WIDTHS.map((width) => getImage({ src: rawImage, width, format: 'avif' }))
        )
    ]);
    const defaultIndex = HERO_IMAGE_WIDTHS.indexOf(800);
    return {
        src: webpVariants[defaultIndex].src,
        srcset: toSrcset(webpVariants),
        avifSrcset: toSrcset(avifVariants)
    };
}
