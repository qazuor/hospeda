/**
 * @file leave-warning-registry.ts
 * @description The single place that decides what to ask before an internal
 * link click leaves the current page (HOS-1018).
 *
 * ## Why this exists at all
 *
 * `useUnsavedChangesGuard` (HOS-373) used to register its own capture-phase
 * `click` listener on `document`, one per hook instance. That is fine while a
 * page mounts exactly one guard, and every page did — until the Fotos editor
 * page grew a second island: `PhotoSection` (the HOS-1018 alt-text nudge) next
 * to `VideoSection` (a real unsaved-changes guard).
 *
 * Two independent capture listeners on the same event do NOT both get to
 * speak. The first one to run calls `preventDefault()`, and the second one
 * bails out on `event.defaultPrevented` — a condition the guard needs, because
 * a click another guard already claimed must not be claimed twice. So at most
 * one of the two dialogs could ever appear, and which one won depended on DOM
 * order. On the Fotos page `PhotoSection` mounts first, so a host with an
 * unsaved video caption AND photos without alt text saw only the alt nudge,
 * chose "continue", and lost the caption with no warning at all.
 *
 * The fix is not to order the listeners. It is to have ONE listener, fed by a
 * registry every guard writes into, so the decision is made once with the full
 * picture: when several warnings are active the host sees a SINGLE dialog that
 * states all of them, instead of a queue of dialogs or a silent winner.
 *
 * ## Shape of the guarantee
 *
 * - Exactly ONE capture-phase `click` listener on `document`, installed when
 *   the first entry registers and removed when the last one leaves.
 * - With exactly one active entry the dialog is that entry's own copy,
 *   verbatim. This is what keeps the five pre-existing consumers of
 *   `useUnsavedChangesGuard` behaving byte-for-byte as they did before.
 * - With several active entries the copy comes from a combiner keyed by the
 *   exact SET of active kinds (see `leave-warning-copy.ts`). If no combiner
 *   knows that set — a future third kind, say — it degrades to the
 *   highest-severity entry's own copy, which is the old behaviour, rather than
 *   showing a combined message that would be describing warnings it cannot
 *   actually see.
 * - Confirming runs `onConfirm` for EVERY active entry, because the host was
 *   shown, and answered, every one of them.
 *
 * `beforeunload` is deliberately NOT centralized here: it stays per-consumer in
 * `useUnsavedChangesGuard`. Browsers render their own non-customizable string,
 * so several listeners do not conflict — one prompt appears either way — and
 * `includeBeforeUnload: false` has to keep meaning "this particular condition
 * does not raise the native prompt".
 *
 * @module lib/forms/leave-warning-registry
 */

import { showConfirmationDialog } from '@/lib/forms/show-confirmation-dialog';
import type { SupportedLocale } from '@/lib/i18n';
import { buildCombinedLeaveWarningCopy } from './leave-warning-copy';

/** Shape of the router's `navigate`, kept local to avoid a static virtual-module import. */
type NavigateFn = (href: string) => void;

/**
 * What kind of thing a warning is about. Drives both the severity order and
 * which combined copy applies when more than one is active.
 */
export type LeaveWarningKind = 'unsaved-changes' | 'photo-alt';

/** The four strings one confirmation dialog needs. */
export interface LeaveWarningCopy {
    readonly title: string;
    readonly message: string;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
}

/** One active warning, as registered by a guard hook. */
export interface LeaveWarningEntry {
    /** Which warning this is. See {@link LeaveWarningKind}. */
    readonly kind: LeaveWarningKind;
    /** Copy shown when this is the ONLY active warning. */
    readonly copy: LeaveWarningCopy;
    /**
     * How many items the warning is about, for kinds whose combined copy is
     * pluralized (`photo-alt`). Ignored for kinds that do not count anything.
     */
    readonly count?: number;
    /**
     * Locale used to build the COMBINED copy. Optional: a consumer that never
     * shares a page with another guard has no reason to pass it, and its
     * absence simply means this entry cannot contribute a combined message.
     */
    readonly locale?: SupportedLocale;
    /**
     * Run synchronously right after the host confirms leaving, before the
     * navigation itself. Every active entry's `onConfirm` runs, not just the
     * one whose copy happened to be displayed.
     */
    readonly onConfirm?: () => void;
}

/**
 * Severity order for the dialog. Data loss outranks a nudge: when no combiner
 * matches, the warning that can destroy work is the one that gets shown.
 */
const KIND_SEVERITY: Readonly<Record<LeaveWarningKind, number>> = {
    'unsaved-changes': 100,
    'photo-alt': 50
};

/** Active warnings, keyed by an opaque token handed back as the unregister fn. */
const registrations = new Map<symbol, LeaveWarningEntry>();

let listenerInstalled = false;
let dialogOpen = false;
let navigate: NavigateFn | null = null;

/**
 * Returns true when a click should be left alone: anything the router itself
 * would ignore, plus any link that stays on the current document. Mirrors the
 * bail-out conditions in `ClientRouter.astro` so the guard never intercepts a
 * navigation the router was not going to handle either.
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

    // Same document: an in-page anchor, or a link back to the page we are
    // already on. Nothing is discarded either way, so never prompt. Deliberately
    // does NOT require the hash to differ — the editors' own section nav
    // preventDefaults its clicks and scrolls without writing the hash, so a
    // second click on the already-active section would otherwise compare equal
    // hashes and pop a confirm in the middle of editing.
    if (target.pathname === window.location.pathname && target.search === window.location.search) {
        return true;
    }

    return false;
}

/**
 * Active entries ordered by severity, highest first. `Array.prototype.sort` is
 * stable, so entries of equal severity keep their registration order.
 */
function activeEntries(): readonly LeaveWarningEntry[] {
    return [...registrations.values()].sort(
        (a, b) => KIND_SEVERITY[b.kind] - KIND_SEVERITY[a.kind]
    );
}

/**
 * Picks the copy for the dialog about to be shown.
 *
 * One entry means "behave exactly as before this registry existed": its own
 * copy, untouched. Several entries get the combiner for that exact set of
 * kinds, and fall back to the highest-severity entry's copy when no combiner
 * covers them — never a combined message that omits an active warning.
 */
function resolveCopy(entries: readonly LeaveWarningEntry[]): LeaveWarningCopy {
    const first = entries[0];
    if (!first) {
        throw new Error('resolveCopy called with no active leave warnings');
    }
    if (entries.length === 1) {
        return first.copy;
    }
    return buildCombinedLeaveWarningCopy(entries) ?? first.copy;
}

/**
 * Resolves the router's `navigate` up front, mirroring `dialog-history.ts`'s
 * `warmRouter()`: the click handler must decide synchronously, so awaiting the
 * import there would let the navigation slip. If it never resolves we fall back
 * to a full load — the host already accepted leaving.
 */
function warmRouter(): void {
    if (navigate) return;
    void (import('astro:transitions/client') as Promise<{ navigate: NavigateFn }>)
        .then((mod) => {
            navigate = mod.navigate;
        })
        .catch(() => {
            // Leave it null; the click handler falls back to location.
        });
}

/** The one and only capture-phase click listener. */
function handleClickCapture(event: MouseEvent): void {
    if (registrations.size === 0) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest('a');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (shouldIgnoreClick(event, anchor)) return;

    // Stops both the router (it bails on defaultPrevented) and the anchor's own
    // navigation. Nothing has been fetched or swapped yet.
    event.preventDefault();

    if (dialogOpen) return;

    const entries = activeEntries();
    dialogOpen = true;
    const href = anchor.href;

    void showConfirmationDialog(resolveCopy(entries))
        .then((confirmed) => {
            if (!confirmed) return;

            for (const entry of entries) {
                entry.onConfirm?.();
            }

            if (navigate) {
                navigate(href);
            } else {
                window.location.href = href;
            }
        })
        .finally(() => {
            dialogOpen = false;
        });
}

/**
 * Registers an active leave warning and returns its unregister function.
 *
 * The listener on `document` is installed on the first registration and
 * removed with the last one, so a page with no active warning is untouched.
 *
 * @param entry - The warning to add. See {@link LeaveWarningEntry}.
 * @returns A function that removes this warning again. Safe to call twice.
 *
 * @example
 * ```ts
 * useEffect(() => {
 *     if (!isDirty) return;
 *     return registerLeaveWarning({ kind: 'unsaved-changes', copy });
 * }, [isDirty, copy]);
 * ```
 */
export function registerLeaveWarning(entry: LeaveWarningEntry): () => void {
    const token = Symbol('leave-warning');
    registrations.set(token, entry);

    if (!listenerInstalled) {
        // Capture phase is load-bearing: the router listens in the bubble
        // phase, so this must run first for `defaultPrevented` to reach it.
        document.addEventListener('click', handleClickCapture, true);
        listenerInstalled = true;
    }
    warmRouter();

    return () => {
        registrations.delete(token);
        if (listenerInstalled && registrations.size === 0) {
            document.removeEventListener('click', handleClickCapture, true);
            listenerInstalled = false;
        }
    };
}

/**
 * Drops every registration and uninstalls the listener.
 *
 * @internal test-only. Module state outlives a `renderHook` unmount only when
 * a test leaks a registration; this makes that impossible to carry across
 * cases.
 */
export function __resetLeaveWarningRegistry(): void {
    registrations.clear();
    if (listenerInstalled) {
        document.removeEventListener('click', handleClickCapture, true);
        listenerInstalled = false;
    }
    dialogOpen = false;
    navigate = null;
}
