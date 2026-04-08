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
