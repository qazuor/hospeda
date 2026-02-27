import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/destination/DestinationPreview.astro'
);
const content = readFileSync(componentPath, 'utf8');

describe('DestinationPreview.astro', () => {
    describe('Content', () => {
        it('should display summary text', () => {
            expect(content).toContain('dest.summary');
            expect(content).toContain('line-clamp-3');
        });

        it('should render gallery thumbnails', () => {
            expect(content).toContain('galleryImages');
            expect(content).toContain('slice(0, 3)');
        });

        it('should render rating dimensions with progress bars', () => {
            expect(content).toContain('topRatings');
            expect(content).toContain('bg-primary');
        });

        it('should have CTA button linking to destination', () => {
            expect(content).toContain('detailUrl');
            expect(content).toContain('featured.preview.viewAccommodations');
        });
    });

    describe('Visibility', () => {
        it('should be hidden on mobile/tablet', () => {
            expect(content).toContain('hidden lg:block');
        });
    });

    describe('Interactivity', () => {
        it('should trigger on mouseenter with 300ms delay', () => {
            expect(content).toContain('mouseenter');
            expect(content).toContain('300');
        });

        it('should dismiss on mouseleave', () => {
            expect(content).toContain('mouseleave');
        });

        it('should support keyboard focus', () => {
            expect(content).toContain('focusin');
            expect(content).toContain('focusout');
        });

        it('should respect prefers-reduced-motion', () => {
            expect(content).toContain('prefers-reduced-motion');
        });

        it('should hide on scroll', () => {
            expect(content).toContain("addEventListener('scroll'");
        });
    });

    describe('Positioning', () => {
        it('should use fixed positioning', () => {
            expect(content).toContain('position: fixed');
        });

        it('should prevent off-screen overflow', () => {
            expect(content).toContain('window.innerWidth');
        });
    });

    describe('Accessibility', () => {
        it('should have focus-visible styles on CTA button', () => {
            expect(content).toContain('focus-visible:outline');
        });

        it('should use inert attribute on preview container', () => {
            expect(content).toContain('inert');
            expect(content).not.toContain('aria-hidden="true"');
        });
    });

    describe('Cleanup', () => {
        it('should use AbortController for listener cleanup', () => {
            expect(content).toContain('AbortController');
            expect(content).toContain('signal');
        });

        it('should clean up on astro:before-swap', () => {
            expect(content).toContain('astro:before-swap');
        });

        it('should check bottom-edge overflow', () => {
            expect(content).toContain('offsetHeight');
            expect(content).toContain('viewportHeight');
        });
    });
});
