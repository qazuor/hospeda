/**
 * @file use-scroll-into-view-when.test.ts
 * @description Unit tests for `useScrollIntoViewWhen`.
 *
 * The behaviour under test is easy to get subtly wrong in two directions, and
 * both are asserted here:
 *
 *  - Firing on every render instead of on the TRANSITION. A form that re-renders
 *    while the confirmation is on screen would yank the page back each time.
 *  - Scrolling without moving focus. The element that held focus (the submit
 *    button) no longer exists after the swap, so focus falls to `<body>` and a
 *    keyboard or screen-reader user is left at the top of the document with no
 *    idea the submission succeeded.
 */

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollIntoViewWhen } from '../../../src/lib/forms/use-scroll-into-view-when';

/** Attaches a real element to the hook's ref and returns it. */
function attach(result: { current: { ref: { current: HTMLElement | null } } }): HTMLElement {
    const el = document.createElement('div');
    document.body.appendChild(el);
    result.current.ref.current = el;
    return el;
}

let scrollSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
    // jsdom does not implement scrollIntoView at all.
    scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy as unknown as Element['scrollIntoView'];
});

afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('useScrollIntoViewWhen', () => {
    it('does nothing while inactive', () => {
        const { result } = renderHook(() => useScrollIntoViewWhen({ active: false }));
        attach(result);

        expect(scrollSpy).not.toHaveBeenCalled();
    });

    it('scrolls and focuses when it becomes active', () => {
        const { result, rerender } = renderHook(({ active }) => useScrollIntoViewWhen({ active }), {
            initialProps: { active: false }
        });
        const el = attach(result);

        rerender({ active: true });

        expect(scrollSpy).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(el);
    });

    it('makes the target focusable, since a div is not by default', () => {
        const { result, rerender } = renderHook(({ active }) => useScrollIntoViewWhen({ active }), {
            initialProps: { active: false }
        });
        const el = attach(result);

        rerender({ active: true });

        // Without this a plain <div> silently refuses focus and the assertion
        // above would be the only thing standing between us and a focus trap
        // at the top of the document.
        expect(el.getAttribute('tabindex')).toBe('-1');
    });

    // Guaranteed by the effect's `[active]` dependency, not by bookkeeping inside
    // it. Do not "harden" this with a `wasActive` ref: one was written and
    // removed, because deleting it left this test green.
    it('fires once per activation, not on every render while active', () => {
        const { result, rerender } = renderHook(({ active }) => useScrollIntoViewWhen({ active }), {
            initialProps: { active: false }
        });
        attach(result);

        rerender({ active: true });
        rerender({ active: true });
        rerender({ active: true });

        expect(scrollSpy).toHaveBeenCalledTimes(1);
    });

    it('fires again when it goes inactive and active once more', () => {
        const { result, rerender } = renderHook(({ active }) => useScrollIntoViewWhen({ active }), {
            initialProps: { active: false }
        });
        attach(result);

        rerender({ active: true });
        rerender({ active: false });
        rerender({ active: true });

        expect(scrollSpy).toHaveBeenCalledTimes(2);
    });

    it('does not throw when it activates with no element attached', () => {
        const { rerender } = renderHook(({ active }) => useScrollIntoViewWhen({ active }), {
            initialProps: { active: false }
        });

        expect(() => rerender({ active: true })).not.toThrow();
        expect(scrollSpy).not.toHaveBeenCalled();
    });

    it('still focuses when the environment has no scrollIntoView', () => {
        // Not hypothetical: jsdom does not implement `scrollIntoView`, so the
        // unguarded first version of this hook threw inside an effect and took
        // seven pre-existing AllianceLead tests down with it. Focus is the
        // accessible half and must survive a viewport that cannot be moved.
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView');

        const { result, rerender } = renderHook(({ active }) => useScrollIntoViewWhen({ active }), {
            initialProps: { active: false }
        });
        const el = attach(result);

        expect(() => rerender({ active: true })).not.toThrow();
        expect(document.activeElement).toBe(el);
    });

    it('animates by default', () => {
        const { result, rerender } = renderHook(({ active }) => useScrollIntoViewWhen({ active }), {
            initialProps: { active: false }
        });
        attach(result);

        rerender({ active: true });

        expect(scrollSpy).toHaveBeenCalledWith(
            expect.objectContaining({ behavior: 'smooth', block: 'start' })
        );
    });

    it('jumps instead of animating when the visitor asked for reduced motion', () => {
        vi.spyOn(window, 'matchMedia').mockImplementation(
            (query: string) =>
                ({
                    matches: query.includes('prefers-reduced-motion'),
                    media: query,
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn()
                }) as unknown as MediaQueryList
        );

        const { result, rerender } = renderHook(({ active }) => useScrollIntoViewWhen({ active }), {
            initialProps: { active: false }
        });
        attach(result);

        rerender({ active: true });

        expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    });
});
