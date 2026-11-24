/**
 * @file ImageGallery.tap-feedback.source.test.ts
 * @description A tap on a gallery photo answers at once, before hydration too
 * (owner smoke, HOS-2520). jsdom applies no `:active` and no pseudo-elements, so this
 * guards the CSS structure: a pressed state on every photo button, a spinner overlay
 * for the `data-gallery-loading` state the inline bridge sets, the fixed lightbox
 * stage that keeps the placeholder swap from moving anything, and the strip's
 * off-screen skipping. It also pins where the bridge is mounted.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(resolve(__dirname, '../../src', path), 'utf8');
const GALLERY_CSS = read('components/ImageGallery.module.css');
const TRACK_CSS = read('components/ImageGalleryMobileTrack.module.css');
const LIGHTBOX_CSS = read('components/gallery/GalleryLightbox.module.css');

/** Body of the first rule whose selector list contains `selector`. */
function ruleFor({ css, selector }: { readonly css: string; readonly selector: string }): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return css.match(new RegExp(`${escaped}[^{]*\\{([^}]*)\\}`))?.[1] ?? '';
}

describe('gallery tap feedback CSS', () => {
    it.each([
        '.cellFeatured:active .cellImg',
        '.thumbBtn:active .cellImg',
        '.coverBtn:active .coverImg',
        '.inlineGridBtn:active .cellImg'
    ])('has a pressed state for %s', (selector) => {
        expect(ruleFor({ css: GALLERY_CSS, selector })).toMatch(/filter:\s*brightness/);
    });

    it('marks the «see all photos» button busy while the bridge holds the tap', () => {
        expect(
            ruleFor({
                css: GALLERY_CSS,
                selector: '.seeAllPhotos :global(.btn-gradient[data-gallery-loading])'
            })
        ).toMatch(/cursor:\s*progress/);
    });

    it('has a pressed state for the mobile track slides', () => {
        expect(ruleFor({ css: TRACK_CSS, selector: '.slide:active img' })).toMatch(
            /filter:\s*brightness/
        );
    });

    it.each([
        '.cellFeatured',
        '.thumbBtn',
        '.coverBtn',
        '.inlineGridBtn',
        '.moreOverlayBtn'
    ])('shows a spinner overlay on a loading %s', (button) => {
        const spinner = ruleFor({
            css: GALLERY_CSS,
            selector: `${button}[data-gallery-loading]::after`
        });
        expect(spinner).toMatch(/border-radius:\s*50%/);
        expect(spinner).toMatch(/animation:\s*gallery-tap-spin/);
    });

    it('shows a spinner overlay on a loading slide', () => {
        const spinner = ruleFor({
            css: TRACK_CSS,
            selector: '.slide[data-gallery-loading]::after'
        });
        expect(spinner).toMatch(/animation:\s*gallery-slide-tap-spin/);
    });

    it('stops the spinners for reduced motion', () => {
        for (const css of [GALLERY_CSS, TRACK_CSS]) {
            expect(css).toMatch(
                /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\[data-gallery-loading\]::after[^}]*\{\s*animation:\s*none/
            );
        }
    });
});

describe('lightbox open cost CSS', () => {
    it('gives the photo a fixed-size stage and lays the placeholder over it', () => {
        expect(LIGHTBOX_CSS).toMatch(/\.lightboxStage \{[^}]*height:\s*70vh/);
        expect(LIGHTBOX_CSS).toMatch(/\.lightboxPlaceholder \{[^}]*position:\s*absolute/);
        expect(LIGHTBOX_CSS).toMatch(/\.lightboxPlaceholder \{[^}]*object-fit:\s*contain/);
    });

    it('skips rendering off-screen strip thumbnails', () => {
        expect(LIGHTBOX_CSS).toMatch(/\.lightboxThumbs > li \{[^}]*content-visibility:\s*auto/);
    });
});

describe('GalleryTapBridge mounting', () => {
    it.each([
        'pages/[lang]/alojamientos/[slug].astro',
        'pages/[lang]/comer-y-salir/[slug].astro',
        'pages/[lang]/experiencias/[slug].astro'
    ])('%s renders the bridge once, next to its client:load gallery', (page) => {
        const source = read(page);
        expect(source).toContain(
            "import GalleryTapBridge from '@/components/gallery/GalleryTapBridge.astro';"
        );
        expect(source.match(/<GalleryTapBridge \/>/g)).toHaveLength(1);
    });
});
