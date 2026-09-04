/**
 * @file use-photo-alt-warning-guard.test.ts
 * @description Unit tests for the HOS-1018 "photos without alt text" leave
 * nudge.
 *
 * Follows the same assertion style as
 * `test/lib/forms/use-unsaved-changes-guard.test.ts`: assert on the click
 * event's `defaultPrevented` and on the router stub, never on jsdom
 * navigation (which does not exist).
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoAltWarningGuard } from '@/components/host/editor/use-photo-alt-warning-guard';
import type { AccommodationMediaItem } from '@/lib/api/types';
import { __setNavigateImpl } from '../../../stubs/astro-transitions-client';

const ACCOMMODATION_ID = 'acc-hos-1018-a';

const { showConfirmationDialogMock } = vi.hoisted(() => ({
    showConfirmationDialogMock: vi.fn<
        [
            {
                readonly message: string;
                readonly title: string;
                readonly confirmLabel: string;
                readonly cancelLabel: string;
            }
        ],
        Promise<boolean>
    >()
}));

vi.mock('@/lib/forms/show-confirmation-dialog', () => ({
    showConfirmationDialog: showConfirmationDialogMock
}));

// Mirrors VideoSection.test.tsx's approach: a deterministic i18n stub so
// assertions target exact, computed strings instead of real locale copy.
vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw = fallback ?? key;
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
                raw
            );
        },
        tPlural: (key: string, count: number, params?: Record<string, unknown>) => {
            const raw = `${key}::count=${count}`;
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
                raw
            );
        }
    })
}));

/** Builds a minimal `AccommodationMediaItem` fixture. */
function buildItem(
    overrides: Partial<AccommodationMediaItem> & { readonly id: string }
): AccommodationMediaItem {
    return {
        url: `https://example.com/${overrides.id}.jpg`,
        publicId: overrides.id,
        isFeatured: false,
        ...overrides
    };
}

/** Appends an anchor to the document so `closest('a')` can find it. */
function addAnchor(href: string): HTMLAnchorElement {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', href);
    anchor.textContent = 'link';
    document.body.appendChild(anchor);
    return anchor;
}

/** Dispatches a left click that bubbles, as a real user click would. */
function clickAnchor(anchor: HTMLAnchorElement): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(event);
    return event;
}

/** Lets the guard's dynamic import of the router settle. */
async function flushRouterImport(): Promise<void> {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe('usePhotoAltWarningGuard', () => {
    let navigateSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        navigateSpy = vi.fn();
        __setNavigateImpl(navigateSpy);
        showConfirmationDialogMock.mockReset();
        window.sessionStorage.clear();
    });

    afterEach(() => {
        __setNavigateImpl(null);
        document.body.replaceChildren();
        window.sessionStorage.clear();
        vi.restoreAllMocks();
    });

    describe('with photos missing alt text', () => {
        it('shows the dialog with the correct missing-alt count on leave', async () => {
            const featuredItem = buildItem({ id: 'featured', alt: undefined, isFeatured: true });
            const galleryItems = [
                buildItem({ id: 'g1', alt: '' }),
                buildItem({ id: 'g2', alt: 'Living con sofá' }),
                buildItem({ id: 'g3', alt: '   ' })
            ];
            // Missing: featured (undefined), g1 (''), g3 (whitespace-only) = 3.
            showConfirmationDialogMock.mockResolvedValue(false);

            renderHook(() =>
                usePhotoAltWarningGuard({
                    locale: 'es',
                    accommodationId: ACCOMMODATION_ID,
                    featuredItem,
                    galleryItems
                })
            );
            const anchor = addAnchor('/es/mi-cuenta/propiedades/');

            const event = clickAnchor(anchor);
            await flushRouterImport();

            expect(event.defaultPrevented).toBe(true);
            expect(showConfirmationDialogMock).toHaveBeenCalledTimes(1);
            const call = showConfirmationDialogMock.mock.calls[0]?.[0];
            expect(call?.message).toBe('host.properties.editor.photo.altWarningMessage::count=3');
            expect(call?.title).toBe('Fotos sin texto alternativo');
            expect(call?.confirmLabel).toBe('Continuar sin completarlos');
            expect(call?.cancelLabel).toBe('Volver y completarlos');
        });

        it('proceeds with navigation when the host chooses "continue"', async () => {
            const galleryItems = [buildItem({ id: 'g1', alt: '' })];
            showConfirmationDialogMock.mockResolvedValue(true);

            renderHook(() =>
                usePhotoAltWarningGuard({
                    locale: 'es',
                    accommodationId: ACCOMMODATION_ID,
                    featuredItem: null,
                    galleryItems
                })
            );
            await flushRouterImport();
            const anchor = addAnchor('/es/mi-cuenta/propiedades/');

            const event = clickAnchor(anchor);
            await flushRouterImport();

            expect(event.defaultPrevented).toBe(true);
            expect(navigateSpy).toHaveBeenCalledTimes(1);
            expect(navigateSpy.mock.calls[0]?.[0]).toContain('/es/mi-cuenta/propiedades/');
        });

        it('does NOT navigate when the host chooses "go back and complete"', async () => {
            const galleryItems = [buildItem({ id: 'g1', alt: '' })];
            showConfirmationDialogMock.mockResolvedValue(false);

            renderHook(() =>
                usePhotoAltWarningGuard({
                    locale: 'es',
                    accommodationId: ACCOMMODATION_ID,
                    featuredItem: null,
                    galleryItems
                })
            );
            await flushRouterImport();
            const anchor = addAnchor('/es/mi-cuenta/propiedades/');

            const event = clickAnchor(anchor);
            await flushRouterImport();

            expect(event.defaultPrevented).toBe(true);
            expect(navigateSpy).not.toHaveBeenCalled();
        });

        it('does not reappear within the session once the host already chose to continue', async () => {
            const galleryItems = [buildItem({ id: 'g1', alt: '' })];
            showConfirmationDialogMock.mockResolvedValue(true);

            const { unmount } = renderHook(() =>
                usePhotoAltWarningGuard({
                    locale: 'es',
                    accommodationId: ACCOMMODATION_ID,
                    featuredItem: null,
                    galleryItems
                })
            );
            await flushRouterImport();
            const firstAnchor = addAnchor('/es/mi-cuenta/propiedades/');
            clickAnchor(firstAnchor);
            await flushRouterImport();
            expect(showConfirmationDialogMock).toHaveBeenCalledTimes(1);
            unmount();

            showConfirmationDialogMock.mockClear();
            renderHook(() =>
                usePhotoAltWarningGuard({
                    locale: 'es',
                    accommodationId: ACCOMMODATION_ID,
                    // Still missing alt — the host never actually completed it,
                    // they just chose to continue past the nudge once.
                    featuredItem: null,
                    galleryItems
                })
            );
            const secondAnchor = addAnchor('/es/mi-cuenta/propiedades/');

            const event = clickAnchor(secondAnchor);

            expect(event.defaultPrevented).toBe(false);
            expect(showConfirmationDialogMock).not.toHaveBeenCalled();
        });
    });

    describe('with every photo already having alt text', () => {
        it('does not show the dialog and lets navigation proceed directly', () => {
            const featuredItem = buildItem({ id: 'featured', alt: 'Portada', isFeatured: true });
            const galleryItems = [
                buildItem({ id: 'g1', alt: 'Foto 1' }),
                buildItem({ id: 'g2', alt: 'Foto 2' })
            ];

            renderHook(() =>
                usePhotoAltWarningGuard({
                    locale: 'es',
                    accommodationId: ACCOMMODATION_ID,
                    featuredItem,
                    galleryItems
                })
            );
            const anchor = addAnchor('/es/mi-cuenta/propiedades/');

            const event = clickAnchor(anchor);

            expect(event.defaultPrevented).toBe(false);
            expect(showConfirmationDialogMock).not.toHaveBeenCalled();
        });
    });
});
