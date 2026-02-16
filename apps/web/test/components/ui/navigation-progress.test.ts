import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * NavigationProgress Component Tests
 * Tests by reading and validating the component source code structure.
 */
describe('NavigationProgress Component', () => {
    const componentPath = join(__dirname, '../../../src/components/ui/NavigationProgress.astro');
    const source = readFileSync(componentPath, 'utf-8');

    it('has the progress bar div with id="nav-progress"', () => {
        expect(source).toMatch(/id="nav-progress"/);
    });

    it('has aria-hidden="true" for accessibility', () => {
        expect(source).toMatch(/aria-hidden="true"/);
    });

    it('has position: fixed (via "fixed" class) at top', () => {
        expect(source).toMatch(/class="[^"]*fixed[^"]*"/);
        expect(source).toMatch(/top-0/);
    });

    it('has z-50 for highest z-index', () => {
        expect(source).toMatch(/z-50/);
    });

    it('uses bg-primary color', () => {
        expect(source).toMatch(/bg-primary/);
    });

    it('has inline script for animation logic', () => {
        expect(source).toMatch(/<script>/);
        expect(source).toMatch(/<\/script>/);
    });

    it('listens for astro:before-preparation event', () => {
        expect(source).toMatch(/astro:before-preparation/);
        expect(source).toMatch(/addEventListener\(['"]astro:before-preparation['"]/);
    });

    it('listens for astro:after-swap event', () => {
        expect(source).toMatch(/astro:after-swap/);
        expect(source).toMatch(/addEventListener\(['"]astro:after-swap['"]/);
    });

    it('has fallback click listener for anchor navigation', () => {
        expect(source).toMatch(/addEventListener\(['"]click['"]/);
        expect(source).toMatch(/closest\(['"]a['"]\)/);
    });

    it('has pageshow listener for completion', () => {
        expect(source).toMatch(/addEventListener\(['"]pageshow['"]/);
    });

    it('uses requestAnimationFrame for smooth animation', () => {
        expect(source).toMatch(/requestAnimationFrame/);
    });

    it('progress bar starts at width 0%', () => {
        expect(source).toMatch(/width:\s*0%/);
    });

    it('has opacity transitions', () => {
        expect(source).toMatch(/opacity/);
        expect(source).toMatch(/transition/);
    });

    it('initial state is hidden (opacity: 0)', () => {
        expect(source).toMatch(/opacity[:\s]*0/);
    });

    it('defines startProgress function', () => {
        expect(source).toMatch(/function\s+startProgress/);
    });

    it('defines completeProgress function', () => {
        expect(source).toMatch(/function\s+completeProgress/);
    });

    it('cancels animation frame on complete', () => {
        expect(source).toMatch(/cancelAnimationFrame/);
    });

    it('uses setTimeout for fade out transition', () => {
        expect(source).toMatch(/setTimeout/);
    });

    it('checks for same origin navigation', () => {
        expect(source).toMatch(/origin/);
    });

    it('ignores hash-only links', () => {
        expect(source).toMatch(/startsWith\(['"]#['"]\)/);
    });
});
