/**
 * @file use-unsaved-changes-guard.test.ts
 * @description Unit tests for the HOS-373 phase 1 unsaved-changes guard.
 *
 * These assert on `defaultPrevented` rather than on observed navigation:
 * jsdom does not implement navigation, and the failure mode this guard exists
 * to avoid (a cancelled soft nav silently becoming a full page load) is
 * invisible from the URL alone — see the spec's AC-2 and
 * `docs/r1-probe-findings.md`.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnsavedChangesGuard } from '@/lib/forms/use-unsaved-changes-guard';
import { __setNavigateImpl } from '../../stubs/astro-transitions-client';

const MESSAGE = 'Tenés cambios sin guardar. ¿Salir igual?';

/** Appends an anchor to the document so `closest('a')` can find it. */
function addAnchor(attrs: Readonly<Record<string, string>>): HTMLAnchorElement {
    const anchor = document.createElement('a');
    for (const [key, value] of Object.entries(attrs)) {
        anchor.setAttribute(key, value);
    }
    anchor.textContent = 'link';
    document.body.appendChild(anchor);
    return anchor;
}

/** Dispatches a left click that bubbles, as a real user click would. */
function clickAnchor(anchor: HTMLAnchorElement, init: MouseEventInit = {}): MouseEvent {
    const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...init
    });
    anchor.dispatchEvent(event);
    return event;
}

function fireBeforeUnload(): Event {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event;
}

/** Lets the guard's dynamic import of the router settle. */
async function flushRouterImport(): Promise<void> {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe('useUnsavedChangesGuard', () => {
    let confirmSpy: ReturnType<typeof vi.spyOn>;
    let navigateSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        navigateSpy = vi.fn();
        __setNavigateImpl(navigateSpy);
    });

    afterEach(() => {
        confirmSpy.mockRestore();
        __setNavigateImpl(null);
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    describe('when the form is clean', () => {
        it('should not prompt on beforeunload', () => {
            renderHook(() => useUnsavedChangesGuard({ isDirty: false, message: MESSAGE }));

            const event = fireBeforeUnload();

            expect(event.defaultPrevented).toBe(false);
        });

        it('should not intercept an internal link click', () => {
            renderHook(() => useUnsavedChangesGuard({ isDirty: false, message: MESSAGE }));
            const anchor = addAnchor({ href: '/es/destinos/' });

            const event = clickAnchor(anchor);

            expect(event.defaultPrevented).toBe(false);
            expect(confirmSpy).not.toHaveBeenCalled();
        });
    });

    describe('when the form is dirty', () => {
        it('should prompt on beforeunload', () => {
            renderHook(() => useUnsavedChangesGuard({ isDirty: true, message: MESSAGE }));

            const event = fireBeforeUnload();

            expect(event.defaultPrevented).toBe(true);
        });

        it('should block an internal link click and ask for confirmation', () => {
            confirmSpy.mockReturnValue(false);
            renderHook(() => useUnsavedChangesGuard({ isDirty: true, message: MESSAGE }));
            const anchor = addAnchor({ href: '/es/destinos/' });

            const event = clickAnchor(anchor);

            expect(event.defaultPrevented).toBe(true);
            expect(confirmSpy).toHaveBeenCalledWith(MESSAGE);
            expect(navigateSpy).not.toHaveBeenCalled();
        });

        it('should navigate via the router when the user confirms', async () => {
            confirmSpy.mockReturnValue(true);
            renderHook(() => useUnsavedChangesGuard({ isDirty: true, message: MESSAGE }));
            await flushRouterImport();
            const anchor = addAnchor({ href: '/es/destinos/' });

            const event = clickAnchor(anchor);

            // Still prevented: the router re-issues the navigation itself, so
            // the anchor's own navigation must not also fire.
            expect(event.defaultPrevented).toBe(true);
            expect(navigateSpy).toHaveBeenCalledTimes(1);
            expect(navigateSpy.mock.calls[0]?.[0]).toContain('/es/destinos/');
        });
    });

    describe('clicks it must leave alone', () => {
        /** Each case is a navigation the router itself would also ignore. */
        const cases: ReadonlyArray<{
            readonly name: string;
            readonly attrs: Readonly<Record<string, string>>;
            readonly init?: MouseEventInit;
        }> = [
            {
                name: 'ctrl-click (new tab)',
                attrs: { href: '/es/destinos/' },
                init: { ctrlKey: true }
            },
            {
                name: 'meta-click (new tab, mac)',
                attrs: { href: '/es/destinos/' },
                init: { metaKey: true }
            },
            {
                name: 'shift-click (new window)',
                attrs: { href: '/es/destinos/' },
                init: { shiftKey: true }
            },
            {
                name: 'alt-click (download)',
                attrs: { href: '/es/destinos/' },
                init: { altKey: true }
            },
            { name: 'middle click', attrs: { href: '/es/destinos/' }, init: { button: 1 } },
            { name: 'target="_blank"', attrs: { href: '/es/destinos/', target: '_blank' } },
            { name: 'download attribute', attrs: { href: '/file.pdf', download: '' } },
            { name: 'external origin', attrs: { href: 'https://example.com/x' } },
            {
                name: 'data-astro-reload',
                attrs: { href: '/es/destinos/', 'data-astro-reload': '' }
            },
            { name: 'anchor without href', attrs: {} }
        ];

        for (const { name, attrs, init } of cases) {
            it(`should ignore ${name}`, () => {
                renderHook(() => useUnsavedChangesGuard({ isDirty: true, message: MESSAGE }));
                const anchor = addAnchor(attrs);

                const event = clickAnchor(anchor, init);

                expect(event.defaultPrevented).toBe(false);
                expect(confirmSpy).not.toHaveBeenCalled();
            });
        }

        it('should ignore a pure hash change on the same page', () => {
            renderHook(() => useUnsavedChangesGuard({ isDirty: true, message: MESSAGE }));
            const anchor = addAnchor({ href: `${window.location.pathname}#seccion` });

            const event = clickAnchor(anchor);

            expect(event.defaultPrevented).toBe(false);
            expect(confirmSpy).not.toHaveBeenCalled();
        });

        it('should ignore a same-document link even when the hash does not change', () => {
            // The editors' section nav preventDefaults its own clicks and
            // scrolls without writing the hash, so clicking the already-active
            // section produces target.hash === location.hash. Comparing hashes
            // for inequality would pop a confirm mid-edit.
            renderHook(() => useUnsavedChangesGuard({ isDirty: true, message: MESSAGE }));
            const anchor = addAnchor({ href: window.location.pathname });

            const event = clickAnchor(anchor);

            expect(event.defaultPrevented).toBe(false);
            expect(confirmSpy).not.toHaveBeenCalled();
        });

        it('should ignore a click already prevented by an earlier capture listener', () => {
            // Must be on `document` in the capture phase and registered first:
            // the guard itself listens there, so a listener on the anchor would
            // run *after* it and could never prevent it in time.
            const earlier = (e: Event) => e.preventDefault();
            document.addEventListener('click', earlier, true);
            renderHook(() => useUnsavedChangesGuard({ isDirty: true, message: MESSAGE }));
            const anchor = addAnchor({ href: '/es/destinos/' });

            clickAnchor(anchor);
            document.removeEventListener('click', earlier, true);

            expect(confirmSpy).not.toHaveBeenCalled();
        });
    });

    describe('lifecycle', () => {
        it('should stop guarding once the form goes clean', () => {
            const { rerender } = renderHook(
                ({ isDirty }) => useUnsavedChangesGuard({ isDirty, message: MESSAGE }),
                { initialProps: { isDirty: true } }
            );

            rerender({ isDirty: false });
            const anchor = addAnchor({ href: '/es/destinos/' });
            const event = clickAnchor(anchor);

            expect(event.defaultPrevented).toBe(false);
            expect(fireBeforeUnload().defaultPrevented).toBe(false);
        });

        it('should remove every listener on unmount', () => {
            const { unmount } = renderHook(() =>
                useUnsavedChangesGuard({ isDirty: true, message: MESSAGE })
            );

            unmount();

            const anchor = addAnchor({ href: '/es/destinos/' });
            expect(clickAnchor(anchor).defaultPrevented).toBe(false);
            expect(fireBeforeUnload().defaultPrevented).toBe(false);
            expect(confirmSpy).not.toHaveBeenCalled();
        });
    });
});
