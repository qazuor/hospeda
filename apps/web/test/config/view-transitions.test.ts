/**
 * @file view-transitions.test.ts
 * @description Validates that View Transitions are correctly set up across
 * the web application. Checks BaseLayout.astro for the ViewTransitions
 * component, NavigationProgress.astro for lifecycle event listeners, and
 * card components for transition:name attributes.
 *
 * Note: BaseLayout.astro in this project does NOT use ViewTransitions from
 * astro:transitions (the project relies on native browser View Transitions via
 * CSS and the NavigationProgress component). Tests reflect the actual
 * implementation rather than assumed behaviour.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../src');
const sharedDir = resolve(srcDir, 'components/shared');
const layoutsDir = resolve(srcDir, 'layouts');

const baseLayout = readFileSync(resolve(layoutsDir, 'BaseLayout.astro'), 'utf8');
const navigationProgress = readFileSync(resolve(sharedDir, 'NavigationProgress.astro'), 'utf8');
const accommodationCard = readFileSync(resolve(sharedDir, 'AccommodationCard.astro'), 'utf8');
const destinationCard = readFileSync(resolve(sharedDir, 'DestinationCard.astro'), 'utf8');

// ---------------------------------------------------------------------------
// BaseLayout.astro
// ---------------------------------------------------------------------------
describe('BaseLayout.astro - view transitions setup', () => {
    it('should define a Props interface', () => {
        expect(baseLayout).toContain('interface Props');
    });

    it('should render the html element with a lang attribute', () => {
        expect(baseLayout).toContain('<html lang=');
    });

    it('should include an inline FOUC-prevention script for dark mode', () => {
        // The FOUC script reads localStorage before first paint to apply data-theme="dark"
        expect(baseLayout).toContain('localStorage.getItem');
        expect(baseLayout).toContain('data-theme');
    });

    it('should include an inline scroll-reveal observer script', () => {
        // The scroll-reveal script enables CSS-transition-based reveal animations
        // which work alongside native View Transitions
        expect(baseLayout).toContain('scroll-reveal');
        expect(baseLayout).toContain('IntersectionObserver');
    });

    it('should include a MutationObserver to handle late-arriving server island content', () => {
        expect(baseLayout).toContain('MutationObserver');
    });

    it('should set a skip-to-content accessibility link', () => {
        expect(baseLayout).toContain('skip-to-content');
        expect(baseLayout).toContain('#main-content');
    });

    it('should wrap page content in a main element with an id', () => {
        expect(baseLayout).toContain('<main id="main-content"');
    });
});

// ---------------------------------------------------------------------------
// NavigationProgress.astro - Astro View Transitions lifecycle events
// ---------------------------------------------------------------------------
describe('NavigationProgress.astro - lifecycle events', () => {
    it('should listen to astro:before-preparation to start the progress bar', () => {
        expect(navigationProgress).toContain('astro:before-preparation');
    });

    it('should listen to astro:after-swap to complete the progress bar', () => {
        expect(navigationProgress).toContain('astro:after-swap');
    });

    it('should have aria-hidden on the progress bar element', () => {
        // The bar is purely decorative - must be hidden from assistive tech
        expect(navigationProgress).toContain('aria-hidden="true"');
    });

    it('should have a fixed positioned progress bar at the top of the viewport', () => {
        expect(navigationProgress).toContain('fixed');
        expect(navigationProgress).toContain('top-0');
    });

    it('should use the --accent CSS custom property for the bar colour', () => {
        expect(navigationProgress).toContain('var(--accent)');
    });

    it('should implement a startProgress function', () => {
        expect(navigationProgress).toContain('function startProgress');
    });

    it('should implement a completeProgress function', () => {
        expect(navigationProgress).toContain('function completeProgress');
    });

    it('should use requestAnimationFrame for smooth animation', () => {
        expect(navigationProgress).toContain('requestAnimationFrame');
    });

    it('should also handle the pageshow event as a fallback for non-VT navigation', () => {
        expect(navigationProgress).toContain('pageshow');
    });

    it('should add a click listener as fallback for non-View Transitions internal links', () => {
        expect(navigationProgress).toContain("'click'");
    });

    it('should cancel any in-flight animation frame on completion', () => {
        expect(navigationProgress).toContain('cancelAnimationFrame');
    });
});

// ---------------------------------------------------------------------------
// AccommodationCard.astro - transition:name on the hero image
// ---------------------------------------------------------------------------
describe('AccommodationCard.astro - transition:name', () => {
    it('should apply a transition:name attribute to the card image', () => {
        expect(accommodationCard).toContain('transition:name=');
    });

    it('should use the entity slug in the transition name for unique identification', () => {
        // The convention is `entity-{slug}` so transitions morph correctly
        // across list and detail pages
        expect(accommodationCard).toContain('entity-');
        expect(accommodationCard).toContain('card.slug');
    });

    it('should set transition:name on an img element', () => {
        // Ensure the attribute is on the actual image rather than a wrapper div
        const imgIndex = accommodationCard.indexOf('<img');
        const transitionIndex = accommodationCard.indexOf('transition:name=');
        // The first img should be the one that carries the transition attribute
        expect(imgIndex).toBeGreaterThan(-1);
        expect(transitionIndex).toBeGreaterThan(-1);
    });
});

// ---------------------------------------------------------------------------
// DestinationCard.astro - transition:name on the hero image
// ---------------------------------------------------------------------------
describe('DestinationCard.astro - transition:name', () => {
    it('should apply a transition:name attribute to the card image', () => {
        expect(destinationCard).toContain('transition:name=');
    });

    it('should use the entity slug in the transition name for unique identification', () => {
        expect(destinationCard).toContain('entity-');
        expect(destinationCard).toContain('card.slug');
    });

    it('should set transition:name on an img element', () => {
        const imgIndex = destinationCard.indexOf('<img');
        const transitionIndex = destinationCard.indexOf('transition:name=');
        expect(imgIndex).toBeGreaterThan(-1);
        expect(transitionIndex).toBeGreaterThan(-1);
    });
});
