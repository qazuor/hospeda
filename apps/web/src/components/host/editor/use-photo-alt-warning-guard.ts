/**
 * @file use-photo-alt-warning-guard.ts
 * @description Warns the host before they leave the Fotos section while some
 * photos still have an empty `alt` text (HOS-1018).
 *
 * On the sample listing that motivated this, all fifteen photos had an empty
 * `alt`, caption, and description — nothing on the page asks for or explains
 * that text, so nobody writes it. This is a nudge, not a gate: the host can
 * always leave, because a mandatory field here just produces throwaway text
 * written to satisfy the form rather than describe the photo.
 *
 * Built on top of `useUnsavedChangesGuard` (HOS-373) for the same click-
 * capture navigation intercept every other section-leave guard in the editor
 * uses — see that hook's file header for why a capture-phase `click`
 * listener is the only reliable hook into Astro's soft navigation.
 *
 * Two differences from a normal "unsaved changes" use of that hook:
 *
 * 1. `includeBeforeUnload: false` — this is not data loss, so there is no
 *    reason to also raise the browser's own non-customizable tab-close/reload
 *    prompt. Back/forward navigation and tab close are a known, accepted gap
 *    (see the base hook's "Not covered" section); adding `beforeunload` here
 *    would not close that gap anyway, since its text cannot be customized and
 *    would not carry this feature's explanation.
 * 2. `onConfirm` persists a per-accommodation `sessionStorage` flag so the
 *    prompt does not reappear for the rest of the session once the host has
 *    chosen to continue without finishing the alt texts. Choosing to go back
 *    and complete them does NOT set the flag — the host will be asked again
 *    if they try to leave again with photos still missing alt text.
 */

import { useMemo } from 'react';
import type { AccommodationMediaItem } from '@/lib/api/types';
import { useUnsavedChangesGuard } from '@/lib/forms/use-unsaved-changes-guard';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

/** Params accepted by {@link usePhotoAltWarningGuard}. */
export interface UsePhotoAltWarningGuardParams {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly featuredItem: AccommodationMediaItem | null;
    readonly galleryItems: readonly AccommodationMediaItem[];
}

/** Whether an item's `alt` is meaningfully filled in (not empty/whitespace). */
function hasAlt(item: Pick<AccommodationMediaItem, 'alt'>): boolean {
    return Boolean(item.alt && item.alt.trim().length > 0);
}

/** Counts featured + gallery items whose `alt` is empty or whitespace-only. */
function countMissingAlt(
    featuredItem: AccommodationMediaItem | null,
    galleryItems: readonly AccommodationMediaItem[]
): number {
    const all: readonly AccommodationMediaItem[] = featuredItem
        ? [featuredItem, ...galleryItems]
        : galleryItems;
    return all.filter((item) => !hasAlt(item)).length;
}

/** `sessionStorage` key for "already chose to continue" — scoped per listing. */
function dismissedStorageKey(accommodationId: string): string {
    return `host.photoAltWarning.dismissed.${accommodationId}`;
}

/**
 * Reads the "already dismissed this session" flag.
 *
 * Wrapped in `try/catch`: in private browsing or with storage blocked,
 * `sessionStorage` access can throw. Failing to read must never crash the
 * editor — it just means the guard behaves as if nothing was dismissed yet.
 */
function readDismissed(accommodationId: string): boolean {
    try {
        return window.sessionStorage.getItem(dismissedStorageKey(accommodationId)) === '1';
    } catch {
        return false;
    }
}

/**
 * Persists the "already dismissed this session" flag. Wrapped in `try/catch`
 * for the same reason as {@link readDismissed} — a failed write should
 * silently no-op (the dialog simply re-asks next time), never throw.
 */
function writeDismissed(accommodationId: string): void {
    try {
        window.sessionStorage.setItem(dismissedStorageKey(accommodationId), '1');
    } catch {
        // Nothing to do — see the JSDoc note above.
    }
}

/**
 * Warns the host before they leave the Fotos section while photos still have
 * an empty `alt` text.
 *
 * @param params - Locale, accommodation id, and the current featured/gallery
 * items (already loaded by `usePhotoSection` — this hook does not fetch
 * anything of its own).
 *
 * @example
 * ```tsx
 * usePhotoAltWarningGuard({ locale, accommodationId, featuredItem, galleryItems });
 * ```
 */
export function usePhotoAltWarningGuard({
    locale,
    accommodationId,
    featuredItem,
    galleryItems
}: UsePhotoAltWarningGuardParams): void {
    const { t, tPlural } = createTranslations(locale);

    const missingAltCount = useMemo(
        () => countMissingAlt(featuredItem, galleryItems),
        [featuredItem, galleryItems]
    );

    // Re-read only when the listing id changes (a fresh mount, in practice —
    // this page is per-accommodation). Not re-read on every render: nothing
    // in this render path writes the flag, only `onConfirm` below does, right
    // before the navigation that unmounts this hook.
    const isDismissed = useMemo(() => readDismissed(accommodationId), [accommodationId]);

    const shouldWarn = missingAltCount > 0 && !isDismissed;

    useUnsavedChangesGuard({
        isDirty: shouldWarn,
        includeBeforeUnload: false,
        title: t('host.properties.editor.photo.altWarningTitle', 'Fotos sin texto alternativo'),
        message: tPlural('host.properties.editor.photo.altWarningMessage', missingAltCount, {
            count: missingAltCount
        }),
        confirmLabel: t(
            'host.properties.editor.photo.altWarningContinue',
            'Continuar sin completarlos'
        ),
        cancelLabel: t('host.properties.editor.photo.altWarningGoBack', 'Volver y completarlos'),
        onConfirm: () => writeDismissed(accommodationId)
    });
}
