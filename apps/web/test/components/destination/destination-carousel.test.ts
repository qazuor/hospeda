import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/destination/DestinationCarousel.astro'
);
const content = readFileSync(componentPath, 'utf8');

describe('DestinationCarousel.astro', () => {
    describe('Accessibility', () => {
        it('should have role=region on container', () => {
            expect(content).toContain('role="region"');
        });

        it('should have aria-roledescription=carousel', () => {
            expect(content).toContain('aria-roledescription="carousel"');
        });

        it('should have aria-label from i18n', () => {
            expect(content).toContain('aria-label={carouselLabel}');
        });

        it('should use role=progressbar for progress indicator', () => {
            expect(content).toContain('role="progressbar"');
        });

        it('should have aria-label on progress bar', () => {
            expect(content).toContain('aria-label={progressLabel}');
        });

        it('should have aria-valuemin and aria-valuemax on progress bar', () => {
            expect(content).toContain('aria-valuemin={0}');
            expect(content).toContain('aria-valuemax={100}');
        });
    });

    describe('CSS Scroll Snap', () => {
        it('should use snap-x snap-mandatory on track', () => {
            expect(content).toContain('snap-x');
            expect(content).toContain('snap-mandatory');
        });

        it('should use scroll-snap-align start on children', () => {
            expect(content).toContain('scroll-snap-align: start');
        });
    });

    describe('Peek effect', () => {
        it('should set card width to ~85% for peek', () => {
            expect(content).toContain('flex: 0 0 85%');
        });
    });

    describe('Edge fades', () => {
        it('should have left edge fade gradient', () => {
            expect(content).toContain('bg-gradient-to-r from-bg-warm to-transparent');
        });

        it('should have right edge fade gradient', () => {
            expect(content).toContain('bg-gradient-to-l from-bg-warm to-transparent');
        });

        it('should make edge fades non-interactive', () => {
            expect(content).toContain('pointer-events-none');
        });
    });

    describe('Progress bar', () => {
        it('should render progress bar when count > 1', () => {
            expect(content).toContain('count > 1');
        });

        it('should have progress fill element', () => {
            expect(content).toContain('data-carousel-progress');
        });

        it('should use primary color for progress fill', () => {
            expect(content).toContain('bg-primary');
        });

        it('should use border color for progress track', () => {
            expect(content).toContain('bg-border');
        });

        it('should calculate initial width based on count', () => {
            expect(content).toContain('100 / count');
        });
    });

    describe('Interactivity script', () => {
        it('should have scroll event listener for progress updates', () => {
            expect(content).toContain("addEventListener('scroll'");
        });

        it('should update progress fill width on scroll', () => {
            expect(content).toContain('updateProgress');
            expect(content).toContain('progressFill.style.width');
        });

        it('should re-init on Astro page-load', () => {
            expect(content).toContain('astro:page-load');
        });
    });

    describe('Keyboard navigation', () => {
        it('should support keyboard navigation with resolveKeyboardNavigation', () => {
            expect(content).toContain('resolveKeyboardNavigation');
        });

        it('should scroll to target on keyboard navigation', () => {
            expect(content).toContain('scrollIntoView');
        });
    });

    describe('Scrollbar', () => {
        it('should hide scrollbar', () => {
            expect(content).toContain('scrollbar-none');
        });
    });
});
