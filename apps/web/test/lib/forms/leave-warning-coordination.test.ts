/**
 * @file leave-warning-coordination.test.ts
 * @description The regression suite for HOS-1018's blocker: two leave guards
 * mounted on the same page must produce ONE dialog stating BOTH warnings, not
 * a race in which the first-registered listener silently wins.
 *
 * This reproduces the accommodation editor's Fotos page, which mounts two
 * `client:load` islands: `PhotoSection` (the alt-text nudge) and
 * `VideoSection` (a real unsaved-changes guard). `PhotoSection` comes first in
 * the DOM, so its guard registers first — which, before the leave-warning
 * registry existed, meant the host editing a video caption saw only the alt
 * nudge, chose "continue", and lost the caption with no warning at all.
 *
 * Deliberately does NOT mock `@/lib/i18n`. The combined copy is the point of
 * the fix, and the repo's i18n guards only check that a key EXISTS in the three
 * locales — never that it says anything. Asserting on the real Spanish strings
 * is what proves the dialog actually states both warnings.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoAltWarningGuard } from '@/components/host/editor/use-photo-alt-warning-guard';
import type { AccommodationMediaItem } from '@/lib/api/types';
import { buildCombinedLeaveWarningCopy } from '@/lib/forms/leave-warning-copy';
import { __resetLeaveWarningRegistry } from '@/lib/forms/leave-warning-registry';
import { useUnsavedChangesGuard } from '@/lib/forms/use-unsaved-changes-guard';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { __setNavigateImpl } from '../../stubs/astro-transitions-client';

const ACCOMMODATION_ID = 'acc-hos-1018-combined';

const { showConfirmationDialogMock } = vi.hoisted(() => ({
    showConfirmationDialogMock:
        vi.fn<
            (options: {
                readonly message: string;
                readonly title: string;
                readonly confirmLabel: string;
                readonly cancelLabel: string;
            }) => Promise<boolean>
        >()
}));

vi.mock('@/lib/forms/show-confirmation-dialog', () => ({
    showConfirmationDialog: showConfirmationDialogMock
}));

const { t } = createTranslations('es');

/** The exact copy `use-video-section.ts` hands the guard, resolved for real. */
const VIDEO_COPY = {
    title: t('common.confirmations.unsavedChanges.title', 'Cambios sin guardar'),
    confirmLabel: t('common.confirmations.unsavedChanges.confirm', 'Sí, descartar'),
    cancelLabel: t('common.confirmations.unsavedChanges.cancel', 'Seguir editando'),
    message: t(
        'host.properties.editor.unsavedChanges',
        'Tenés cambios sin guardar. Si salís ahora se pierden. ¿Querés salir igual?'
    )
} as const;

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

/** `n` gallery photos with no alt text at all. */
function photosWithoutAlt(n: number): readonly AccommodationMediaItem[] {
    return Array.from({ length: n }, (_, i) => buildItem({ id: `missing-${i}`, alt: '' }));
}

/** `n` gallery photos that all carry alt text. */
function photosWithAlt(n: number): readonly AccommodationMediaItem[] {
    return Array.from({ length: n }, (_, i) =>
        buildItem({ id: `filled-${i}`, alt: `Foto número ${i}` })
    );
}

function addAnchor(href: string): HTMLAnchorElement {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', href);
    anchor.textContent = 'link';
    document.body.appendChild(anchor);
    return anchor;
}

function clickAnchor(anchor: HTMLAnchorElement): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    anchor.dispatchEvent(event);
    return event;
}

async function flushRouterImport(): Promise<void> {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

interface BothGuardsProps {
    readonly videoIsDirty: boolean;
    readonly galleryItems: readonly AccommodationMediaItem[];
    readonly videoOnConfirm?: () => void;
    /** Mirrors the four base-hook consumers that pass no locale at all. */
    readonly videoPassesLocale?: boolean;
}

/**
 * Mounts both guards in the order the Fotos page mounts them: the photo alt
 * nudge first (it is the first island in the DOM), the video's unsaved-changes
 * guard second. That order is what made the old, listener-per-hook design lose
 * the video warning.
 */
function renderBothGuards(initialProps: BothGuardsProps) {
    return renderHook(
        ({
            videoIsDirty,
            galleryItems,
            videoOnConfirm,
            videoPassesLocale = true
        }: BothGuardsProps) => {
            usePhotoAltWarningGuard({
                locale: 'es',
                accommodationId: ACCOMMODATION_ID,
                featuredItem: null,
                galleryItems
            });
            useUnsavedChangesGuard({
                isDirty: videoIsDirty,
                ...VIDEO_COPY,
                ...(videoPassesLocale ? { locale: 'es' as SupportedLocale } : {}),
                onConfirm: videoOnConfirm
            });
        },
        { initialProps }
    );
}

describe('leave warnings on a page that mounts two guards', () => {
    let navigateSpy: ReturnType<typeof vi.fn<(href: string) => void>>;

    beforeEach(() => {
        navigateSpy = vi.fn<(href: string) => void>();
        __setNavigateImpl(navigateSpy);
        showConfirmationDialogMock.mockReset();
        window.sessionStorage.clear();
        __resetLeaveWarningRegistry();
    });

    afterEach(() => {
        __setNavigateImpl(null);
        document.body.replaceChildren();
        window.sessionStorage.clear();
        __resetLeaveWarningRegistry();
        vi.restoreAllMocks();
    });

    describe('when BOTH conditions hold at once', () => {
        it('opens exactly ONE dialog whose message carries BOTH warnings', async () => {
            showConfirmationDialogMock.mockResolvedValue(false);
            renderBothGuards({ videoIsDirty: true, galleryItems: photosWithoutAlt(3) });
            await flushRouterImport();
            const anchor = addAnchor('/es/mi-cuenta/propiedades/');

            const event = clickAnchor(anchor);
            await flushRouterImport();

            expect(event.defaultPrevented).toBe(true);
            // ONE dialog. Not two chained, not one silently dropped.
            expect(showConfirmationDialogMock).toHaveBeenCalledTimes(1);

            const call = showConfirmationDialogMock.mock.calls[0]?.[0];
            expect(call?.title).toBe('Cambios sin guardar y fotos sin texto alternativo');
            // The unsaved-changes half.
            expect(call?.message).toContain('cambios sin guardar');
            expect(call?.message).toContain('se pierden');
            // The alt-text half, pluralized on the real count.
            expect(call?.message).toContain('3 fotos siguen sin texto alternativo');
            // And it is neither standalone message wearing the other's hat.
            expect(call?.message).not.toBe(VIDEO_COPY.message);
            expect(call?.confirmLabel).toBe('Salir y descartar los cambios');
            expect(call?.cancelLabel).toBe('Seguir editando');
        });

        it('pluralizes the photo count in the singular', async () => {
            showConfirmationDialogMock.mockResolvedValue(false);
            renderBothGuards({ videoIsDirty: true, galleryItems: photosWithoutAlt(1) });
            await flushRouterImport();

            clickAnchor(addAnchor('/es/mi-cuenta/propiedades/'));
            await flushRouterImport();

            const call = showConfirmationDialogMock.mock.calls[0]?.[0];
            expect(call?.message).toContain('1 foto sigue sin texto alternativo');
            expect(call?.message).not.toContain('fotos siguen');
        });

        it('runs EVERY active guard’s onConfirm, then navigates once', async () => {
            showConfirmationDialogMock.mockResolvedValue(true);
            const videoOnConfirm = vi.fn();
            renderBothGuards({
                videoIsDirty: true,
                galleryItems: photosWithoutAlt(2),
                videoOnConfirm
            });
            await flushRouterImport();

            clickAnchor(addAnchor('/es/mi-cuenta/propiedades/'));
            await flushRouterImport();

            expect(videoOnConfirm).toHaveBeenCalledTimes(1);
            // The photo guard's own onConfirm: the per-listing session flag.
            expect(
                window.sessionStorage.getItem(`host.photoAltWarning.dismissed.${ACCOMMODATION_ID}`)
            ).toBe('1');
            expect(navigateSpy).toHaveBeenCalledTimes(1);
        });

        it('still combines when the unsaved-changes guard passes no locale', async () => {
            // Four of the five base-hook consumers pass no locale. The combined
            // copy must still resolve, from the photo guard's locale.
            showConfirmationDialogMock.mockResolvedValue(false);
            renderBothGuards({
                videoIsDirty: true,
                galleryItems: photosWithoutAlt(2),
                videoPassesLocale: false
            });
            await flushRouterImport();

            clickAnchor(addAnchor('/es/mi-cuenta/propiedades/'));
            await flushRouterImport();

            const call = showConfirmationDialogMock.mock.calls[0]?.[0];
            expect(call?.title).toBe('Cambios sin guardar y fotos sin texto alternativo');
            expect(call?.message).toContain('2 fotos siguen sin texto alternativo');
        });
    });

    describe('when only ONE condition holds', () => {
        it('shows the plain unsaved-changes dialog, with no mention of photos', async () => {
            showConfirmationDialogMock.mockResolvedValue(false);
            renderBothGuards({ videoIsDirty: true, galleryItems: photosWithAlt(3) });
            await flushRouterImport();

            clickAnchor(addAnchor('/es/mi-cuenta/propiedades/'));
            await flushRouterImport();

            expect(showConfirmationDialogMock).toHaveBeenCalledTimes(1);
            expect(showConfirmationDialogMock).toHaveBeenCalledWith({
                message: VIDEO_COPY.message,
                title: VIDEO_COPY.title,
                confirmLabel: VIDEO_COPY.confirmLabel,
                cancelLabel: VIDEO_COPY.cancelLabel
            });
            expect(showConfirmationDialogMock.mock.calls[0]?.[0].message).not.toContain(
                'texto alternativo'
            );
        });

        it('shows the plain alt-text dialog, with no mention of unsaved changes', async () => {
            showConfirmationDialogMock.mockResolvedValue(false);
            renderBothGuards({ videoIsDirty: false, galleryItems: photosWithoutAlt(4) });
            await flushRouterImport();

            clickAnchor(addAnchor('/es/mi-cuenta/propiedades/'));
            await flushRouterImport();

            expect(showConfirmationDialogMock).toHaveBeenCalledTimes(1);
            const call = showConfirmationDialogMock.mock.calls[0]?.[0];
            expect(call?.title).toBe('Fotos sin texto alternativo');
            expect(call?.confirmLabel).toBe('Continuar sin completarlos');
            expect(call?.cancelLabel).toBe('Volver y completarlos');
            expect(call?.message).toContain('4 fotos');
            expect(call?.message).not.toContain('cambios sin guardar');
        });

        it('leaves the click alone when neither condition holds', async () => {
            renderBothGuards({ videoIsDirty: false, galleryItems: photosWithAlt(2) });
            await flushRouterImport();

            const event = clickAnchor(addAnchor('/es/mi-cuenta/propiedades/'));
            await flushRouterImport();

            expect(event.defaultPrevented).toBe(false);
            expect(showConfirmationDialogMock).not.toHaveBeenCalled();
        });
    });

    describe('combined copy across locales', () => {
        const cases: ReadonlyArray<{
            readonly locale: SupportedLocale;
            readonly title: string;
            readonly needle: string;
            readonly confirmLabel: string;
        }> = [
            {
                locale: 'es',
                title: 'Cambios sin guardar y fotos sin texto alternativo',
                needle: '5 fotos siguen sin texto alternativo',
                confirmLabel: 'Salir y descartar los cambios'
            },
            {
                locale: 'en',
                title: 'Unsaved changes and photos without alt text',
                needle: '5 photos still have no alt text',
                confirmLabel: 'Leave and discard the changes'
            },
            {
                locale: 'pt',
                title: 'Alterações não salvas e fotos sem texto alternativo',
                needle: '5 fotos continuam sem texto alternativo',
                confirmLabel: 'Sair e descartar as alterações'
            }
        ];

        for (const { locale, title, needle, confirmLabel } of cases) {
            it(`is really translated in ${locale}, not just present`, () => {
                const copy = buildCombinedLeaveWarningCopy([
                    { kind: 'unsaved-changes', copy: VIDEO_COPY },
                    { kind: 'photo-alt', count: 5, locale, copy: VIDEO_COPY }
                ]);

                expect(copy).not.toBeNull();
                expect(copy?.title).toBe(title);
                expect(copy?.message).toContain(needle);
                expect(copy?.confirmLabel).toBe(confirmLabel);
                // A missing key degrades to the raw dotted key; a real
                // translation never contains one.
                expect(copy?.message).not.toContain('common.confirmations');
            });
        }

        it('returns null for a set of kinds no combiner covers', () => {
            expect(
                buildCombinedLeaveWarningCopy([{ kind: 'unsaved-changes', copy: VIDEO_COPY }])
            ).toBeNull();
        });

        it('returns null when no active entry carries a locale', () => {
            expect(
                buildCombinedLeaveWarningCopy([
                    { kind: 'unsaved-changes', copy: VIDEO_COPY },
                    { kind: 'photo-alt', count: 2, copy: VIDEO_COPY }
                ])
            ).toBeNull();
        });
    });
});
