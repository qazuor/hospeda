/**
 * @file HeroImageRotator.test.tsx
 * @description Unit tests for HeroImageRotator.client.tsx island component.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroImageRotator } from '../../../src/components/sections/HeroImageRotator.client';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/sections/HeroImageRotator.client.tsx'),
    'utf8'
);

vi.mock('@/hooks/use-reduced-motion', () => ({
    useReducedMotion: () => false
}));

const IMAGES = [
    { src: '/a.jpg', alt: 'A' },
    { src: '/b.jpg', alt: 'B' },
    { src: '/c.jpg', alt: 'C' }
] as const;

/** Index of the image currently at full opacity. */
const activeIndexOf = (container: HTMLElement): number =>
    [...container.querySelectorAll('img')].findIndex((im) => im.style.opacity === '1');

describe('HeroImageRotator.client.tsx', () => {
    describe('accessibility', () => {
        it('should use role="img" on the container', () => {
            expect(src).toContain('role="img"');
        });

        it('should have aria-label on the container derived from active image alt', () => {
            expect(src).toContain('aria-label={activeAlt}');
        });

        it('should have aria-live="polite" for transition announcements', () => {
            expect(src).toContain('aria-live="polite"');
        });

        it('should have aria-atomic="true" on the container', () => {
            expect(src).toContain('aria-atomic="true"');
        });

        it('should mark individual images as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });

        it('should use empty alt on individual images', () => {
            expect(src).toContain('alt=""');
        });
    });

    describe('image dimensions', () => {
        it('should set explicit width on images', () => {
            expect(src).toContain('width="480"');
        });

        it('should set explicit height on images', () => {
            expect(src).toContain('height="540"');
        });
    });

    // SPEC-157 REQ-3: the home hero LCP image must be server-rendered with a
    // high fetch-priority hint so the browser prioritises it. The rotator is an
    // island, so this markup ships in the initial SSR HTML.
    describe('LCP priority (SPEC-157 REQ-3)', () => {
        it("should mark the first hero image fetchPriority='high'", () => {
            expect(src).toContain("fetchPriority={index === 0 ? 'high' : 'auto'}");
        });
    });

    describe('behavior', () => {
        it('should track active image index in state', () => {
            expect(src).toContain('activeIndex');
        });

        it('should derive activeAlt from active image', () => {
            expect(src).toContain('activeAlt');
            expect(src).toContain('images[activeIndex]');
        });

        it('should clean up interval on unmount', () => {
            expect(src).toContain('clearInterval');
        });

        it('should use interval prop with default value', () => {
            expect(src).toContain('interval = 5000');
        });

        it('should load first image eagerly', () => {
            expect(src).toContain("loading={index === 0 ? 'eager' : 'lazy'}");
        });
    });

    // HOS-369. These render the component instead of reading its source,
    // because what matters here is behaviour under timers, and a source
    // assertion cannot tell a working gate from a deleted one.
    describe('LCP gate: rotation waits for the first interaction (HOS-369)', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
            cleanup();
        });

        it('must NOT rotate before any user interaction, however long it waits', () => {
            const { container } = render(
                <HeroImageRotator
                    images={IMAGES}
                    interval={1000}
                />
            );
            expect(activeIndexOf(container)).toBe(0);

            // 10 ticks of a 3-image cycle. Deliberately NOT a multiple of
            // images.length: at 60 ticks the index would wrap back to 0 and this
            // assertion would pass even with the gate deleted.
            act(() => {
                vi.advanceTimersByTime(10_000);
            });

            expect(
                activeIndexOf(container),
                'The rotator advanced without any user interaction. Each crossfade paints a ' +
                    'new element and produces a fresh LCP candidate, which is what took the ' +
                    'staging home from 1,032 ms to 9,294 ms of LCP.'
            ).toBe(0);
        });

        it('must rotate once the user has interacted', () => {
            const { container } = render(
                <HeroImageRotator
                    images={IMAGES}
                    interval={1000}
                />
            );

            act(() => {
                window.dispatchEvent(new Event('pointerdown'));
            });
            act(() => {
                vi.advanceTimersByTime(1000);
            });

            expect(
                activeIndexOf(container),
                'After an interaction the LCP is sealed, so the rotator must resume its ' +
                    'normal crossfade. It stayed frozen instead.'
            ).toBe(1);
        });

        it('keeps cycling through every image after the gate opens', () => {
            const { container } = render(
                <HeroImageRotator
                    images={IMAGES}
                    interval={1000}
                />
            );

            act(() => {
                window.dispatchEvent(new Event('keydown'));
            });
            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(activeIndexOf(container)).toBe(1);
            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(activeIndexOf(container)).toBe(2);
            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(activeIndexOf(container), 'should wrap back to the first image').toBe(0);
        });
    });

    // HOS-369. `loading="lazy"` does not defer these: the browser's lazy
    // loading keys off viewport intersection, and an `opacity: 0` image stacked
    // over the visible one is still inside the viewport. Rendered, not asserted
    // on the source, for the same reason as the rotation gate above.
    describe('LCP gate: off-screen images are not fetched before interaction (HOS-369)', () => {
        afterEach(() => {
            cleanup();
        });

        it('must give the first image a src, and the off-screen ones none', () => {
            const { container } = render(<HeroImageRotator images={IMAGES} />);
            const srcs = [...container.querySelectorAll('img')].map((im) => im.getAttribute('src'));

            expect(srcs[0], 'the LCP image must always be fetched immediately').toBe('/a.jpg');
            expect(
                srcs.slice(1),
                'Off-screen hero images were given a src before any interaction. They are ' +
                    'inside the viewport at opacity 0, so the browser fetches them at once and ' +
                    'they compete for bandwidth with the LCP image — 158 KB against its 48 KB, ' +
                    'which is what pushed the cold staging LCP to 5,518 ms.'
            ).toEqual([null, null]);
        });

        it('must not emit a srcSet for the off-screen images either', () => {
            const withSrcSet = [
                { src: '/a.jpg', alt: 'A', srcset: '/a-480.jpg 480w' },
                { src: '/b.jpg', alt: 'B', srcset: '/b-480.jpg 480w' }
            ] as const;
            const { container } = render(<HeroImageRotator images={withSrcSet} />);
            const srcSets = [...container.querySelectorAll('img')].map((im) =>
                im.getAttribute('srcset')
            );

            expect(srcSets[0]).toBe('/a-480.jpg 480w');
            expect(
                srcSets[1],
                'A bare srcset is enough for the browser to fetch the image, so gating src ' +
                    'alone would defer nothing.'
            ).toBeNull();
        });

        it('must fetch every image once the user has interacted', () => {
            const { container } = render(<HeroImageRotator images={IMAGES} />);

            act(() => {
                window.dispatchEvent(new Event('pointerdown'));
            });

            const srcs = [...container.querySelectorAll('img')].map((im) => im.getAttribute('src'));
            expect(
                srcs,
                'Once the gate opens the rotator needs the images loaded before the first ' +
                    'crossfade, which is one full interval away.'
            ).toEqual(['/a.jpg', '/b.jpg', '/c.jpg']);
        });
    });

    // HOS-369: AVIF is ~40% lighter than WebP on the hero (17,9 kB vs 29,0 kB at
    // 800w), but Safari before 16.4 cannot decode it — and this is the LCP
    // element, so an AVIF-only hero would leave those visitors with no hero at
    // all. AVIF is therefore offered through <source type="image/avif"> with the
    // WebP candidates kept on the <img>.
    describe('AVIF with WebP fallback (HOS-369)', () => {
        const withAvif = [
            {
                src: '/a.webp',
                alt: 'A',
                srcset: '/a-800.webp 800w',
                avifSrcset: '/a-800.avif 800w'
            },
            { src: '/b.webp', alt: 'B', srcset: '/b-800.webp 800w', avifSrcset: '/b-800.avif 800w' }
        ] as const;

        afterEach(() => {
            cleanup();
        });

        it('wraps each slide in <picture> and offers AVIF first', () => {
            const { container } = render(<HeroImageRotator images={withAvif} />);
            const pictures = [...container.querySelectorAll('picture')];

            expect(pictures).toHaveLength(2);
            const firstSource = pictures[0]?.querySelector('source');
            expect(firstSource?.getAttribute('type')).toBe('image/avif');
            expect(firstSource?.getAttribute('srcset')).toBe('/a-800.avif 800w');
        });

        it('keeps the WebP candidates on the <img> so non-AVIF browsers still paint', () => {
            const { container } = render(<HeroImageRotator images={withAvif} />);
            const img = container.querySelector('img');

            expect(
                img?.getAttribute('srcset'),
                'The <img> inside <picture> is the fallback Safari < 16.4 uses. If it ever ' +
                    'carries AVIF, or nothing, those visitors lose the LCP element entirely.'
            ).toBe('/a-800.webp 800w');
            expect(img?.getAttribute('src')).toBe('/a.webp');
        });

        it('applies the off-screen fetch gate to <source> as well as <img>', () => {
            const { container } = render(<HeroImageRotator images={withAvif} />);
            const sourceSrcSets = [...container.querySelectorAll('source')].map((el) =>
                el.getAttribute('srcset')
            );

            expect(sourceSrcSets[0]).toBe('/a-800.avif 800w');
            expect(
                sourceSrcSets[1],
                'A <source srcset> inside <picture> is enough on its own for the browser to ' +
                    'start the download. Gating only the <img> would silently restore the eager ' +
                    'off-screen fetch that the LCP gate exists to prevent.'
            ).toBeNull();
        });

        it('opens the <source> gate together with the <img> gate on interaction', () => {
            const { container } = render(<HeroImageRotator images={withAvif} />);

            act(() => {
                window.dispatchEvent(new Event('pointerdown'));
            });

            const sourceSrcSets = [...container.querySelectorAll('source')].map((el) =>
                el.getAttribute('srcset')
            );
            expect(sourceSrcSets).toEqual(['/a-800.avif 800w', '/b-800.avif 800w']);
        });

        it('emits no <source> when a slide has no AVIF candidates', () => {
            const { container } = render(
                <HeroImageRotator images={[{ src: '/a.webp', alt: 'A' }] as const} />
            );

            expect(container.querySelectorAll('source')).toHaveLength(0);
            expect(container.querySelector('img')?.getAttribute('src')).toBe('/a.webp');
        });
    });

    describe('named export', () => {
        it('should export HeroImageRotator as named export', () => {
            expect(src).toContain('export function HeroImageRotator');
        });
    });
});
