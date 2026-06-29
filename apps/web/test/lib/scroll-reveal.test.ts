/**
 * @file scroll-reveal.test.ts
 * @description Unit tests for scroll reveal system.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroyScrollReveal, initScrollReveal } from '../../src/lib/scroll-reveal';

describe('scroll-reveal', () => {
    beforeEach(() => {
        // Safe test DOM setup with controlled content
        const el = document.createElement('div');
        el.setAttribute('data-reveal', 'up');
        document.body.appendChild(el);
        destroyScrollReveal();
    });

    afterEach(() => {
        destroyScrollReveal();
        document.body.replaceChildren();
    });

    it('should add revealed class when prefers-reduced-motion is enabled', () => {
        vi.spyOn(window, 'matchMedia').mockReturnValue({
            matches: true,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        });

        initScrollReveal();

        const el = document.querySelector('[data-reveal]');
        expect(el?.classList.contains('revealed')).toBe(true);
    });

    it('should create IntersectionObserver when motion is not reduced', () => {
        vi.spyOn(window, 'matchMedia').mockReturnValue({
            matches: false,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        });

        const observeSpy = vi.fn();
        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn(() => ({
                observe: observeSpy,
                unobserve: vi.fn(),
                disconnect: vi.fn()
            }))
        );

        initScrollReveal();

        expect(observeSpy).toHaveBeenCalledTimes(1);
    });

    it('observes with a pre-firing positive rootMargin (BETA-28)', () => {
        vi.spyOn(window, 'matchMedia').mockReturnValue({
            matches: false,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        });

        let capturedOptions: IntersectionObserverInit | undefined;
        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn((_cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) => {
                capturedOptions = opts;
                return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
            })
        );

        initScrollReveal();

        // Reveal must pre-fire BEFORE the element enters the viewport so the
        // transition completes smoothly — a negative bottom margin fired late
        // and caused the abrupt mid-screen pop (BETA-28).
        expect(capturedOptions?.rootMargin).toBe('0px 0px 15% 0px');
        expect(capturedOptions?.rootMargin).not.toContain('-');
    });

    it('should disconnect previous observer on re-init', () => {
        vi.spyOn(window, 'matchMedia').mockReturnValue({
            matches: false,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        });

        const disconnectSpy = vi.fn();
        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn(() => ({
                observe: vi.fn(),
                unobserve: vi.fn(),
                disconnect: disconnectSpy
            }))
        );

        initScrollReveal();
        initScrollReveal();

        expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    const motionNotReduced = () =>
        vi.spyOn(window, 'matchMedia').mockReturnValue({
            matches: false,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        } as MediaQueryList);

    // Lets the jsdom MutationObserver flush its (microtask-scheduled) callback.
    const flushMutations = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

    it('observes a [data-reveal] element inserted after init (Bug B5 — Server Island late content)', async () => {
        motionNotReduced();
        const observeSpy = vi.fn();
        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn(() => ({ observe: observeSpy, unobserve: vi.fn(), disconnect: vi.fn() }))
        );

        initScrollReveal();
        observeSpy.mockClear(); // ignore the element added in beforeEach

        // Simulate a Server Island injecting its content after astro:page-load.
        const late = document.createElement('div');
        late.setAttribute('data-reveal', 'up');
        document.body.appendChild(late);
        await flushMutations();

        expect(observeSpy).toHaveBeenCalledWith(late);
    });

    it('observes [data-reveal] descendants of an inserted subtree (Bug B5)', async () => {
        motionNotReduced();
        const observeSpy = vi.fn();
        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn(() => ({ observe: observeSpy, unobserve: vi.fn(), disconnect: vi.fn() }))
        );

        initScrollReveal();
        observeSpy.mockClear();

        // A Server Island inserts a wrapper containing the [data-reveal] cards.
        const wrapper = document.createElement('section');
        const card = document.createElement('div');
        card.setAttribute('data-reveal', 'left');
        wrapper.appendChild(card);
        document.body.appendChild(wrapper);
        await flushMutations();

        expect(observeSpy).toHaveBeenCalledWith(card);
    });

    it('stops observing late content after destroyScrollReveal (no leak)', async () => {
        // Run in reduced-motion: handleElement adds .revealed immediately,
        // BEFORE touching activeObserver. So a still-live (not disconnected)
        // MutationObserver would betray itself by revealing the late element —
        // this proves the disconnect independently of activeObserver being null.
        vi.spyOn(window, 'matchMedia').mockReturnValue({
            matches: true,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        } as MediaQueryList);

        initScrollReveal();
        destroyScrollReveal();

        const late = document.createElement('div');
        late.setAttribute('data-reveal', 'up');
        document.body.appendChild(late);
        await flushMutations();

        // If lateContentObserver was NOT disconnected, the reduced-motion path
        // would have added .revealed via the MutationObserver callback.
        expect(late.classList.contains('revealed')).toBe(false);
    });

    it('destroyScrollReveal should disconnect observer', () => {
        vi.spyOn(window, 'matchMedia').mockReturnValue({
            matches: false,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        });

        const disconnectSpy = vi.fn();
        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn(() => ({
                observe: vi.fn(),
                unobserve: vi.fn(),
                disconnect: disconnectSpy
            }))
        );

        initScrollReveal();
        destroyScrollReveal();

        expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
});
