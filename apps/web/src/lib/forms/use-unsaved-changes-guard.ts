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
 * ## Where the click listener actually lives (HOS-1018)
 *
 * Not here. This hook registers its warning into
 * `leave-warning-registry.ts`, which owns the ONE capture-phase listener for
 * the whole page. Two listeners of this kind cannot coexist: the first to run
 * calls `preventDefault()` and the second bails on `defaultPrevented`, so a
 * page with two guards could only ever show one of the two dialogs. See that
 * module's header for the failure it was extracted to fix.
 *
 * With a single active warning the registry shows this hook's `message` /
 * `title` / `confirmLabel` / `cancelLabel` verbatim, so nothing changes for a
 * page that mounts one guard — which is every page except the accommodation
 * editor's Fotos section.
 *
 * `beforeunload` stays here, per-consumer: the browser renders its own
 * non-customizable string, so overlapping listeners produce one prompt anyway,
 * and `includeBeforeUnload: false` has to keep meaning "this condition does
 * not raise the native prompt".
 *
 * ## Not covered
 *
 * Back/forward navigation. By the time any event fires the browser has already
 * committed the history entry, so only a history trap could catch it — see the
 * spec's NG-6. A user who presses back still loses unsaved edits.
 */

import { useEffect } from 'react';
import type { LeaveWarningKind } from '@/lib/forms/leave-warning-registry';
import { registerLeaveWarning } from '@/lib/forms/leave-warning-registry';
import type { SupportedLocale } from '@/lib/i18n';

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
    /** Dialog title for internal-navigation confirms. */
    readonly title: string;
    /** Confirm CTA label for internal-navigation confirms. */
    readonly confirmLabel: string;
    /** Cancel CTA label for internal-navigation confirms. */
    readonly cancelLabel: string;
    /**
     * Whether to also warn on hard exits (tab close / reload) via
     * `beforeunload`. Defaults to `true`, matching every existing consumer's
     * expectation of a truly unsaved form. Set to `false` for a "dirty"
     * condition that is not about lost data (e.g. a soft nudge with no
     * customizable-text equivalent on the native dialog) — a `beforeunload`
     * prompt renders the browser's own non-customizable string, which is
     * exactly what such a nudge cannot use to explain itself.
     */
    readonly includeBeforeUnload?: boolean;
    /**
     * Called synchronously right after the user confirms leaving, before the
     * navigation itself runs. Lets a caller persist a "handled" flag (e.g. in
     * `sessionStorage`) without reaching into the navigation flow.
     *
     * When several warnings are active at once, EVERY active one's `onConfirm`
     * runs — the host was shown, and answered, all of them in a single dialog.
     */
    readonly onConfirm?: () => void;
    /**
     * What this warning is about. Defaults to `'unsaved-changes'`, which is
     * what every consumer of this hook meant before kinds existed. Only used to
     * pick the combined copy when another guard is active on the same page.
     */
    readonly kind?: LeaveWarningKind;
    /**
     * How many items the warning is about, for kinds whose combined copy is
     * pluralized. Ignored when this warning is the only active one — `message`
     * already carries its own count in that case.
     */
    readonly count?: number;
    /**
     * Locale used to build the COMBINED copy when this warning shares a page
     * with another one. Optional, and irrelevant while this is the only guard
     * on the page: that path shows `message` verbatim and never translates
     * anything.
     */
    readonly locale?: SupportedLocale;
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
export function useUnsavedChangesGuard({
    isDirty,
    message,
    title,
    confirmLabel,
    cancelLabel,
    includeBeforeUnload = true,
    onConfirm,
    kind = 'unsaved-changes',
    count,
    locale
}: UseUnsavedChangesGuardOptions): void {
    useEffect(() => {
        if (!isDirty) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
            // Calling preventDefault() is the whole API. The message is chosen
            // by the browser; anything assigned to returnValue is ignored by
            // every current engine, but assigning it is still required by some
            // older ones to trigger the dialog at all.
            event.preventDefault();
            event.returnValue = '';
        };

        if (includeBeforeUnload) {
            window.addEventListener('beforeunload', handleBeforeUnload);
        }

        // The internal-link half lives in the registry so that a page holding
        // more than one guard asks ONE question instead of silently dropping
        // all but the first — see this file's header and HOS-1018.
        const unregister = registerLeaveWarning({
            kind,
            count,
            locale,
            copy: { message, title, confirmLabel, cancelLabel },
            onConfirm
        });

        return () => {
            if (includeBeforeUnload) {
                window.removeEventListener('beforeunload', handleBeforeUnload);
            }
            unregister();
        };
    }, [
        isDirty,
        message,
        title,
        confirmLabel,
        cancelLabel,
        includeBeforeUnload,
        onConfirm,
        kind,
        count,
        locale
    ]);
}
