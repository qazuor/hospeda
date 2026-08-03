/**
 * @file use-unsaved-changes-guard.ts
 * @description Warns before leaving a form that holds unsaved edits (HOS-373
 * phase 1). Covers two exit paths: hard exits (tab close, reload, external
 * URL) via `beforeunload`, and internal link clicks via a capture-phase
 * `click` listener on `document`.
 *
 * ## Why the click, and not `astro:before-preparation`
 *
 * Every page under `BaseLayout.astro` mounts `<ClientRouter />`, so internal
 * navigation is soft and never fires `beforeunload`. The obvious hook looks
 * like `astro:before-preparation`, which really is dispatched with
 * `{ cancelable: true }` — but cancelling it does NOT stop the navigation.
 * Astro's router responds to a cancelled preparation by running
 * `location.href = to.href` (`astro/dist/transitions/router.js:250-256`): in
 * its design `preventDefault()` there means "do this navigation as a full page
 * load", not "do not navigate". Using it as a guard makes things strictly
 * worse — the user leaves anyway AND the SPA state is destroyed.
 *
 * Astro's own click handler, by contrast, bails out when the click already
 * carries `defaultPrevented` (`ClientRouter.astro:92`). A capture-phase
 * listener on `document` runs before it, so calling `preventDefault()` there
 * stops the router AND the anchor's native navigation. Nothing has started at
 * that point, which is also what makes an async confirmation possible.
 *
 * Measurements behind this are in
 * `.specs/HOS-373-unsaved-changes-guard-and-invalid-field-focus/docs/r1-probe-findings.md`.
 *
 * ## Not covered
 *
 * Back/forward navigation. By the time any event fires the browser has already
 * committed the history entry, so only a history trap could catch it — see the
 * spec's NG-6. A user who presses back still loses unsaved edits.
 */

import { useEffect, useRef } from 'react';

/** Shape of the router's `navigate`, kept local to avoid a static virtual-module import. */
type NavigateFn = (href: string) => void;

/** Options accepted by {@link useUnsavedChangesGuard}. */
export interface UseUnsavedChangesGuardOptions {
    /**
     * Whether the form currently holds unsaved edits. While `false`, no
     * listeners are registered at all and navigation is untouched.
     */
    readonly isDirty: boolean;
    /**
     * Localized confirmation text shown when leaving via an internal link.
     * Not used for hard exits — browsers render their own non-customizable
     * string there and ignore anything we pass.
     */
    readonly message: string;
}

/**
 * Returns true when a click should be left alone: anything the router itself
 * would ignore, plus in-page hash links. Mirrors the bail-out conditions in
 * `ClientRouter.astro` so the guard never intercepts a navigation the router
 * was not going to handle either.
 */
function shouldIgnoreClick(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
    if (event.defaultPrevented) return true;
    // Left button only. `button` is 0 for the primary button.
    if (event.button !== 0) return true;
    // Modifier keys open a new tab/window or download instead of navigating.
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return true;
    if (anchor.hasAttribute('download')) return true;
    if (anchor.target && anchor.target !== '_self') return true;
    if (anchor.dataset.astroReload !== undefined) return true;

    const href = anchor.getAttribute('href');
    if (!href) return true;

    let target: URL;
    try {
        target = new URL(anchor.href, window.location.href);
    } catch {
        return true;
    }

    // Another origin leaves the app entirely — `beforeunload` covers that one.
    if (target.origin !== window.location.origin) return true;

    // A pure hash change stays on the same page, so nothing is lost.
    if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search &&
        target.hash !== window.location.hash
    ) {
        return true;
    }

    return false;
}

/**
 * Warns the user before they leave a form holding unsaved edits.
 *
 * Registers nothing while `isDirty` is `false`, and removes every listener on
 * unmount or as soon as the form goes clean again — so a saved form never
 * prompts.
 *
 * @example
 * ```tsx
 * const isDirty = useMemo(
 *   () => Object.keys(buildPatchPayload(formData)).length > 0,
 *   [formData]
 * );
 *
 * useUnsavedChangesGuard({
 *   isDirty,
 *   message: t('editor.unsavedChanges.confirm')
 * });
 * ```
 */
export function useUnsavedChangesGuard({ isDirty, message }: UseUnsavedChangesGuardOptions): void {
    // Resolved up front, mirroring `dialog-history.ts`'s `warmRouter()`: the
    // click handler must decide synchronously, so awaiting the import there
    // would let the navigation slip. If it never resolves we fall back to a
    // full load — the user already accepted losing the edits.
    const navigateRef = useRef<NavigateFn | null>(null);

    useEffect(() => {
        if (!isDirty) {
            return;
        }

        if (!navigateRef.current) {
            void (import('astro:transitions/client') as Promise<{ navigate: NavigateFn }>)
                .then(({ navigate }) => {
                    navigateRef.current = navigate;
                })
                .catch(() => {
                    // Leave it null; the click handler falls back to location.
                });
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
            // Calling preventDefault() is the whole API. The message is chosen
            // by the browser; anything assigned to returnValue is ignored by
            // every current engine, but assigning it is still required by some
            // older ones to trigger the dialog at all.
            event.preventDefault();
            event.returnValue = '';
        };

        const handleClickCapture = (event: MouseEvent): void => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            const anchor = target.closest('a');
            if (!(anchor instanceof HTMLAnchorElement)) return;
            if (shouldIgnoreClick(event, anchor)) return;

            // Stops both the router (it bails on defaultPrevented) and the
            // anchor's own navigation. Nothing has been fetched or swapped yet.
            event.preventDefault();

            if (!window.confirm(message)) {
                return;
            }

            const routerNavigate = navigateRef.current;
            if (routerNavigate) {
                routerNavigate(anchor.href);
            } else {
                window.location.href = anchor.href;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        // Capture phase is load-bearing: the router listens in the bubble
        // phase, so this must run first for `defaultPrevented` to reach it.
        document.addEventListener('click', handleClickCapture, true);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('click', handleClickCapture, true);
        };
    }, [isDirty, message]);
}
