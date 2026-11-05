/**
 * @file use-photo-alt-warning-guard.ts
 * @description Registers the HOS-1018 photo-alt warning for internal links and
 * guarded saves while persisted photos still have an empty `alt` text.
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

import { useCallback, useMemo, useState } from 'react';
import type { AccommodationMediaItem } from '@/lib/api/types';
import { useUnsavedChangesGuard } from '@/lib/forms/use-unsaved-changes-guard';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { isPhotoAltIncomplete } from './photo-section-helpers';

/** Params accepted by {@link usePhotoAltWarningGuard}. */
export interface UsePhotoAltWarningGuardParams {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly featuredItem: AccommodationMediaItem | null;
    readonly galleryItems: readonly AccommodationMediaItem[];
    /** False until listMedia replaces SSR placeholders with persisted rows. */
    readonly opsReady?: boolean;
}

/** Counts featured + gallery items whose `alt` is empty or whitespace-only. */
function countMissingAlt(
    featuredItem: AccommodationMediaItem | null,
    galleryItems: readonly AccommodationMediaItem[]
): number {
    const all: readonly AccommodationMediaItem[] = featuredItem
        ? [featuredItem, ...galleryItems]
        : galleryItems;
    return all.filter(isPhotoAltIncomplete).length;
}

/**
 * `sessionStorage` key for "already chose to continue" — scoped per listing.
 *
 * Colon-separated (`hospeda:...`), NOT dot-separated starting with `host` —
 * the i18n client-namespaces guard (`test/lib/i18n-client-namespaces.guard.test.ts`)
 * scans every reachable module for dotted string literals whose head matches a
 * real i18n namespace, and `host` is one. A dotted `host.photoAltWarning...`
 * storage key was indistinguishable from an i18n key reference and got flagged
 * as an undeclared namespace prefix, even though nothing here ever calls `t()`
 * with it.
 */
function dismissedStorageKey(accommodationId: string): string {
    return `hospeda:photoAltWarning:dismissed:${accommodationId}`;
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

/** Opens and focuses the first photo whose required alt text is incomplete. */
function focusFirstIncompletePhoto(): void {
    const first = document.querySelector<HTMLElement>('[data-photo-metadata-missing="true"]');
    if (!first) return;

    const toggle = first.querySelector<HTMLButtonElement>('button[aria-expanded]');
    if (!toggle) return;
    if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();

    window.setTimeout(() => {
        first.querySelector<HTMLTextAreaElement>('textarea[id^="photo-alt-"]')?.focus();
    }, 0);
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
    galleryItems,
    opsReady = true
}: UsePhotoAltWarningGuardParams): void {
    const { t, tPlural } = createTranslations(locale);

    const missingAltCount = useMemo(
        () => (opsReady ? countMissingAlt(featuredItem, galleryItems) : 0),
        [featuredItem, galleryItems, opsReady]
    );

    // Re-read only when the listing id changes. Confirmation updates local
    // state too, so a save can dismiss the prompt without unmounting this hook.
    const [isDismissed, setIsDismissed] = useState(() => readDismissed(accommodationId));

    const shouldWarn = missingAltCount > 0 && !isDismissed;

    // Memoized because it sits in the base hook's effect dependency array, and
    // `PhotoSection` re-renders on every `uploadProgress` / `isCompressing`
    // tick during an upload. An inline closure would unregister and re-register
    // the leave warning on each of those renders for no reason.
    const handleConfirm = useCallback(() => {
        writeDismissed(accommodationId);
        setIsDismissed(true);
    }, [accommodationId]);
    const handleCancel = useCallback(focusFirstIncompletePhoto, []);

    useUnsavedChangesGuard({
        isDirty: shouldWarn,
        includeBeforeUnload: false,
        // Lets the registry recognize this warning when the Fotos page's other
        // island (`VideoSection`) is guarding real unsaved edits at the same
        // time, and build one dialog that states both — see
        // `lib/forms/leave-warning-copy.ts`.
        kind: 'photo-alt',
        count: missingAltCount,
        locale,
        title: t('host.properties.editor.photo.altWarningTitle', 'Fotos sin texto alternativo'),
        message: tPlural('host.properties.editor.photo.altWarningMessage', missingAltCount, {
            count: missingAltCount
        }),
        confirmLabel: t('host.properties.editor.photo.altWarningContinue', 'Seguir igual'),
        cancelLabel: t('host.properties.editor.photo.altWarningGoBack', 'Completar ahora'),
        onConfirm: handleConfirm,
        onCancel: handleCancel
    });
}
