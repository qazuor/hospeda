/**
 * @file navigation-progress.test.ts
 * @description Tests for NavigationProgress.astro component.
 *
 * NavigationProgress renders a thin top-of-page progress bar that integrates
 * with Astro View Transitions events. It is purely decorative and hidden from
 * assistive technologies.
 *
 * Strategy: read the source file and assert on its textual content, since
 * Astro components cannot be rendered in a Vitest/jsdom environment.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/NavigationProgress.astro');
const src = readFileSync(componentPath, 'utf8');

describe('NavigationProgress.astro', () => {
    describe('DOM structure', () => {
        it('should render a div with id nav-progress', () => {
            // Arrange / Act: source is already loaded
            // Assert
            expect(src).toContain('id="nav-progress"');
        });

        it('should mark the progress bar element as aria-hidden', () => {
            // The bar is purely decorative; screen readers must not announce it.
            expect(src).toContain('aria-hidden="true"');
        });

        it('should position the bar fixed at the top-left of the viewport', () => {
            expect(src).toContain('fixed top-0 left-0');
        });

        it('should place the bar above page content via z-50', () => {
            expect(src).toContain('z-50');
        });

        it('should use the CSS accent custom property for the bar color', () => {
            expect(src).toContain('var(--accent)');
        });

        it('should start with zero width and zero opacity', () => {
            // Initial state so the bar is invisible before navigation begins.
            expect(src).toContain('width: 0%');
            expect(src).toContain('opacity: 0');
        });
    });

    describe('CSS transition / animation', () => {
        it('should apply a CSS transition for smooth animation', () => {
            expect(src).toContain('transition-all');
        });

        it('should apply ease-out timing for the transition', () => {
            expect(src).toContain('ease-out');
        });

        it('should use a 300ms transition duration', () => {
            expect(src).toContain('duration-300');
        });
    });

    describe('Astro View Transitions events', () => {
        it('should listen to astro:before-preparation to start the bar', () => {
            // This event fires when Astro begins a client-side navigation.
            expect(src).toContain('astro:before-preparation');
        });

        it('should listen to astro:after-swap to complete the bar', () => {
            // This event fires after Astro swaps the new page content into the DOM.
            expect(src).toContain('astro:after-swap');
        });

        it('should bind startProgress to astro:before-preparation', () => {
            expect(src).toContain("addEventListener('astro:before-preparation', startProgress)");
        });

        it('should bind completeProgress to astro:after-swap', () => {
            expect(src).toContain("addEventListener('astro:after-swap', completeProgress)");
        });
    });

    describe('Click fallback for standard navigation', () => {
        it('should listen to document click events', () => {
            // Fallback for links that bypass View Transitions.
            expect(src).toContain("addEventListener('click'");
        });

        it('should start progress on internal anchor clicks', () => {
            // The handler uses target.closest('a') to resolve the clicked anchor.
            expect(src).toContain("target.closest('a')");
            expect(src).toContain('startProgress()');
        });

        it('should skip anchors that point to fragments on the same page', () => {
            // Hash-only links must not trigger the bar.
            expect(src).toContain("anchor.href.startsWith('#')");
        });

        it('should skip anchors targeting external origins', () => {
            expect(src).toContain('anchor.origin === window.location.origin');
        });
    });

    describe('pageshow fallback', () => {
        it('should complete the bar on the window pageshow event', () => {
            // Covers non-View-Transitions navigation completing.
            expect(src).toContain("addEventListener('pageshow', completeProgress)");
        });
    });

    describe('Animation logic', () => {
        it('should define a startProgress function', () => {
            expect(src).toContain('function startProgress()');
        });

        it('should define a completeProgress function', () => {
            expect(src).toContain('function completeProgress()');
        });

        it('should use requestAnimationFrame for the animation loop', () => {
            expect(src).toContain('requestAnimationFrame');
        });

        it('should cancel any in-flight animation frame when completing', () => {
            expect(src).toContain('cancelAnimationFrame');
        });

        it('should set width to 100% when completing', () => {
            expect(src).toContain("style.width = '100%'");
        });

        it('should fade out by setting opacity to 0 after completion', () => {
            expect(src).toContain("style.opacity = '0'");
        });

        it('should cap progress animation at 90% to avoid premature completion', () => {
            // The bar deliberately stops short of 100% until the swap event fires.
            expect(src).toContain('width < 90');
        });

        it('should guard all DOM access behind an element existence check', () => {
            // Prevents runtime errors if the element is not present.
            expect(src).toContain('if (progressBar)');
        });
    });
});
