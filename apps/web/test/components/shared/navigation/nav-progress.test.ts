/**
 * @file nav-progress.test.ts
 * @description Unit tests for the global navigation-progress controller
 * (bar + threshold overlay + cursor) used by NavigationProgress.astro.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNavigationProgress } from '../../../../src/components/shared/navigation/nav-progress';

const THRESHOLD = 450;

/** Insert a fresh bar node, mirroring what the .astro component renders. */
function mountBar(label = 'Cargando...'): HTMLElement {
    const bar = document.createElement('div');
    bar.id = 'nav-progress';
    bar.className = 'nav-progress';
    bar.dataset.loadingLabel = label;
    document.body.appendChild(bar);
    return bar;
}

describe('nav-progress controller', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Keep the rAF-driven width animation from advancing so the initial
        // width is deterministic; the animation itself is not under test.
        vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1 as unknown as number);
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
        document.body.replaceChildren();
        document.documentElement.style.cursor = '';
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.replaceChildren();
        document.documentElement.style.cursor = '';
    });

    it('starts the bar instantly and the cursor, but not the overlay (before threshold)', () => {
        const bar = mountBar();
        const ctl = createNavigationProgress();

        ctl.onNavStart();

        expect(bar.classList.contains('is-active')).toBe(true);
        expect(bar.style.width).toBe('12%');
        expect(document.documentElement.style.cursor).toBe('progress');
        // Overlay is threshold-gated — not yet present.
        expect(document.querySelector('[data-nav-overlay]')).toBeNull();
    });

    it('shows the content overlay only after the threshold elapses', () => {
        mountBar('Cargando…');
        const ctl = createNavigationProgress({ thresholdMs: THRESHOLD });

        ctl.onNavStart();
        vi.advanceTimersByTime(THRESHOLD - 1);
        expect(document.querySelector('[data-nav-overlay]')).toBeNull();

        vi.advanceTimersByTime(1);
        const overlay = document.querySelector<HTMLElement>('[data-nav-overlay="global"]');
        expect(overlay).not.toBeNull();
        expect(overlay?.getAttribute('role')).toBe('status');
        // Label is sourced from the bar's data attribute (i18n-driven).
        expect(overlay?.getAttribute('aria-label')).toBe('Cargando…');
        expect(overlay?.querySelector('.nav-overlay__ring')).not.toBeNull();
    });

    it('a fast navigation never shows the overlay and cleans up', () => {
        const bar = mountBar();
        const ctl = createNavigationProgress({ thresholdMs: THRESHOLD });

        ctl.onNavStart();
        // Document fetch lands before the threshold: complete + cleanup.
        vi.advanceTimersByTime(THRESHOLD - 100);
        ctl.onNavComplete(); // astro:before-swap
        ctl.onNavCleanup(); // astro:after-swap
        // Advancing past the original threshold must NOT spawn a late overlay.
        vi.advanceTimersByTime(500);

        expect(document.querySelector('[data-nav-overlay]')).toBeNull();
        expect(document.documentElement.style.cursor).toBe('');
        expect(bar.classList.contains('is-active')).toBe(false);
        // Bar completed and settled back to its reset width.
        expect(bar.style.width).toBe('0%');
    });

    it('removes the overlay on cleanup (after-swap)', () => {
        mountBar();
        const ctl = createNavigationProgress({ thresholdMs: THRESHOLD });

        ctl.onNavStart();
        vi.advanceTimersByTime(THRESHOLD);
        expect(document.querySelector('[data-nav-overlay="global"]')).not.toBeNull();

        ctl.onNavCleanup();
        expect(document.querySelector('[data-nav-overlay]')).toBeNull();
        expect(document.documentElement.style.cursor).toBe('');
    });

    it('does not stack a second overlay when one is already shown (PaginationLoading)', () => {
        mountBar();
        // Simulate PaginationLoading's immediate overlay.
        const pag = document.createElement('div');
        pag.dataset.navOverlay = 'pagination';
        document.body.appendChild(pag);

        const ctl = createNavigationProgress({ thresholdMs: THRESHOLD });
        ctl.onNavStart();
        vi.advanceTimersByTime(THRESHOLD);

        // Only the pagination overlay exists — no global one was added.
        expect(document.querySelectorAll('[data-nav-overlay]')).toHaveLength(1);
        expect(document.querySelector('[data-nav-overlay="global"]')).toBeNull();
    });

    it('completes the OLD bar on before-swap and drives the NEW bar after a swap', () => {
        const firstBar = mountBar();
        const ctl = createNavigationProgress();
        const detach = ctl.attach();

        // First navigation activates the original node.
        document.dispatchEvent(new Event('astro:before-preparation'));
        expect(firstBar.classList.contains('is-active')).toBe(true);

        // before-swap runs while the OLD bar is still mounted: completion must
        // land on it (not on the next page's fresh, invisible bar).
        document.dispatchEvent(new Event('astro:before-swap'));
        expect(firstBar.style.width).toBe('100%');
        expect(firstBar.classList.contains('is-active')).toBe(false);

        // Real swap order: the OLD bar is replaced by a NEW one BEFORE after-swap.
        firstBar.remove();
        const secondBar = mountBar();
        document.dispatchEvent(new Event('astro:after-swap'));

        // Second navigation must affect the NEW node, not the detached old one.
        document.dispatchEvent(new Event('astro:before-preparation'));
        expect(secondBar.classList.contains('is-active')).toBe(true);
        expect(secondBar.style.width).toBe('12%');

        detach();
    });

    it('recovers only on a bfcache restore via pageshow (not on initial load)', () => {
        const bar = mountBar();
        const ctl = createNavigationProgress();
        const detach = ctl.attach();

        ctl.onNavStart();
        expect(bar.classList.contains('is-active')).toBe(true);

        // Initial-load pageshow (persisted=false) must be a no-op.
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
        expect(bar.classList.contains('is-active')).toBe(true);
        expect(document.documentElement.style.cursor).toBe('progress');

        // bfcache restore (persisted=true) tears everything down.
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        expect(bar.classList.contains('is-active')).toBe(false);
        expect(document.documentElement.style.cursor).toBe('');

        detach();
    });
});
