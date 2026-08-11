/**
 * @file hero-images.test.ts
 * @description Guards for the hero image ladder and `sizes` contract (HOS-369).
 *
 * `HERO_IMAGE_SIZES` under-declares the mobile rendered width on purpose, as an
 * effective-DPR cap. It looks like a bug, which is exactly why it needs a test:
 * "correcting" 70vw back to 100vw would silently push every phone from the 800w
 * candidate to the 1200w one (+12 kB in AVIF) on the LCP element, with nothing
 * failing anywhere.
 *
 * `buildHeroVariants` is exercised for real against the `astro:assets` stub
 * aliased in `vitest.config.ts`, so the generated candidate strings — and in
 * particular the fact that BOTH an AVIF and a WebP set come out — are asserted
 * rather than assumed. The `sizes` assertions are necessarily on the constant,
 * since candidate selection happens in the browser and not in jsdom; they model
 * the selection algorithm explicitly instead.
 */

import { describe, expect, it } from 'vitest';
import {
    buildHeroVariants,
    HERO_IMAGE_SIZES,
    HERO_IMAGE_WIDTHS
} from '@/components/sections/hero-images';

/** Stand-in for the `ImageMetadata` Astro produces for an imported JPG. */
const RAW_IMAGE = {
    src: '/_astro/hero-playa.hash.jpg',
    width: 2400,
    height: 1670,
    format: 'jpg'
} as unknown as ImageMetadata;

/** Parse the `(max-width: 768px) <N>vw` branch out of the sizes string. */
function mobileVwBranch(sizes: string): number | null {
    const match = sizes.match(/\(max-width:\s*768px\)\s*(\d+(?:\.\d+)?)vw/);
    return match ? Number(match[1]) : null;
}

/** Device pixels the browser will ask for, given a viewport and DPR. */
function requiredDevicePixels(cssWidth: number, dpr: number, vw: number): number {
    return cssWidth * (vw / 100) * dpr;
}

/** The candidate a browser picks: smallest width >= required, else the largest. */
function selectedCandidate(required: number): number {
    return HERO_IMAGE_WIDTHS.find((w) => w >= required) ?? HERO_IMAGE_WIDTHS.at(-1) ?? 0;
}

describe('hero image ladder', () => {
    it('is sorted ascending and has no duplicates', () => {
        const widths = [...HERO_IMAGE_WIDTHS];
        expect(widths).toEqual([...new Set(widths)].sort((a, b) => a - b));
    });

    it('still contains 800w, which buildHeroVariants uses as the default src', () => {
        expect(
            HERO_IMAGE_WIDTHS,
            'buildHeroVariants indexes the ladder by 800 to pick the fallback <img src>. ' +
                'Removing 800w makes that lookup return undefined.'
        ).toContain(800);
    });

    it('has no gap wider than 400px, so a device never overshoots by a full rung', () => {
        // The old 480/800/1200 ladder jumped 400px from 800 to 1200, which is why
        // every modern phone landed on the heaviest candidate.
        const gaps = HERO_IMAGE_WIDTHS.slice(1).map((w, i) => w - HERO_IMAGE_WIDTHS[i]);
        expect(Math.max(...gaps)).toBeLessThanOrEqual(400);
    });
});

describe('buildHeroVariants', () => {
    it('emits an AVIF candidate for every width', async () => {
        const { avifSrcset } = await buildHeroVariants({ rawImage: RAW_IMAGE });
        const entries = avifSrcset.split(', ');

        expect(entries).toHaveLength(HERO_IMAGE_WIDTHS.length);
        for (const [index, width] of HERO_IMAGE_WIDTHS.entries()) {
            expect(entries[index]).toContain('f=avif');
            expect(entries[index]).toContain(`w=${width}`);
            expect(entries[index].endsWith(` ${width}w`)).toBe(true);
        }
    });

    it('keeps a full WebP srcset as the fallback, never AVIF-only', async () => {
        const { srcset, src } = await buildHeroVariants({ rawImage: RAW_IMAGE });
        const entries = srcset.split(', ');

        expect(entries).toHaveLength(HERO_IMAGE_WIDTHS.length);
        expect(
            srcset,
            'The <img> fallback inside <picture> is what Safari < 16.4 paints. AVIF there ' +
                'means no hero at all for those visitors, on the LCP element.'
        ).not.toContain('f=avif');
        for (const entry of entries) {
            expect(entry).toContain('f=webp');
        }
        expect(src).toContain('f=webp');
    });

    it('uses the 800w WebP variant as the default src', async () => {
        const { src } = await buildHeroVariants({ rawImage: RAW_IMAGE });
        expect(src).toContain('w=800');
    });
});

describe('hero image sizes — effective DPR cap', () => {
    it('under-declares the mobile branch below 100vw ON PURPOSE', () => {
        const vw = mobileVwBranch(HERO_IMAGE_SIZES);

        expect(vw, 'the sizes string must keep a (max-width: 768px) <N>vw branch').not.toBeNull();
        expect(
            vw,
            'The mobile branch is an effective-DPR cap, not a mistake. At 100vw a 412px/2.625 ' +
                'device asks for 1081 device pixels and takes the 1200w candidate; the cap makes ' +
                'it take 800w instead (17,9 kB vs 29,9 kB in AVIF) on the LCP element. Do not ' +
                '"fix" this back to 100vw — read the comment in hero-images.ts first.'
        ).toBeLessThan(100);
    });

    it('keeps the desktop branch truthful at 50vw', () => {
        expect(HERO_IMAGE_SIZES).toMatch(/,\s*50vw$/);
    });

    it.each([
        { device: 'Pixel-class 412px @2.625', css: 412, dpr: 2.625, expected: 800 },
        { device: 'small Android 360px @3', css: 360, dpr: 3, expected: 800 },
        { device: 'large phone 430px @3', css: 430, dpr: 3, expected: 1000 }
    ])('resolves $device to the $expected"w candidate', ({ css, dpr, expected }) => {
        const vw = mobileVwBranch(HERO_IMAGE_SIZES);
        expect(vw).not.toBeNull();
        const required = requiredDevicePixels(css, dpr, vw as number);
        expect(selectedCandidate(required)).toBe(expected);
    });

    it('never resolves a phone to the heaviest 1200w candidate', () => {
        const vw = mobileVwBranch(HERO_IMAGE_SIZES) as number;
        const phones = [
            [360, 3],
            [390, 3],
            [412, 2.625],
            [414, 2],
            [430, 3]
        ] as const;

        const overshooting = phones.filter(
            ([css, dpr]) => selectedCandidate(requiredDevicePixels(css, dpr, vw)) === 1200
        );

        expect(
            overshooting,
            'A phone resolving to 1200w defeats the DPR cap: that is the desktop-retina rung.'
        ).toEqual([]);
    });
});
