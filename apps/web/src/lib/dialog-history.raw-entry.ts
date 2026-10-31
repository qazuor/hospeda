/**
 * @file dialog-history.raw-entry.ts
 * @description Helpers for the "raw" history claim used by surfaces that sit on
 * top of a page that rewrites its own URL (HOS-1927: the mobile filters drawer
 * over a listing).
 *
 * The routed claim in `dialog-history` rides Astro's hash fast path, which is
 * gated on the router's private `originalLocation` still matching the document.
 * A listing's partial swap moves the URL behind the router's back, so after the
 * first filter tap that gate never opens again. A raw claim does not need it:
 * it pushes an entry at the SAME URL and `dialog-history` swallows the
 * `popstate` it produces (capture phase, `stopImmediatePropagation`) so the
 * router never sees a traversal it would answer with a refetch-and-swap.
 *
 * @module dialog-history.raw-entry
 */

/** Marker written into the history state of a raw-claimed entry. */
export const RAW_STATE_KEY = '__hospedaDialogRaw';

/** Fragment prefix a routed claim writes (stripped when an entry is settled). */
export const CLAIM_HASH_PREFIX = '#hospeda-dialog-';

/** Whether a history state belongs to a raw-claimed entry (any document load). */
export function isRawEntryState(state: unknown): boolean {
    return (
        typeof state === 'object' &&
        state !== null &&
        (state as Record<string, unknown>)[RAW_STATE_KEY] === true
    );
}

/**
 * Pushes a raw entry at the current URL, carrying the current state's router
 * bookkeeping (`index`, scroll) so a forward traversal onto it is never read as
 * an unknown position.
 *
 * @returns Whether the entry now exists (`pushState` can throw on Safari).
 */
export function pushRawEntry({ state }: { readonly state: Record<string, unknown> }): boolean {
    try {
        const current = (window.history.state ?? {}) as Record<string, unknown>;
        window.history.pushState(
            { ...current, ...state, [RAW_STATE_KEY]: true },
            '',
            location.href
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Turns the current entry into an ordinary history entry: drops the claim
 * markers and any claim fragment, keeps everything else (including a rewritten
 * query string).
 */
export function settleClaimedEntry({ keys }: { readonly keys: readonly string[] }): void {
    try {
        const state = { ...((window.history.state ?? {}) as Record<string, unknown>) };
        for (const key of keys) delete state[key];
        delete state[RAW_STATE_KEY];
        const url = new URL(window.location.href);
        if (url.hash.startsWith(CLAIM_HASH_PREFIX)) url.hash = '';
        window.history.replaceState(state, '', url.href);
    } catch {
        // Survivable: the entry stays marked and is inert.
    }
}

/**
 * Replaces the current entry's URL, keeping its state and its fragment.
 *
 * @returns The new URL without fragment, or `null` when it was refused.
 */
export function rewriteClaimedUrl({ url }: { readonly url: string }): string | null {
    try {
        const next = new URL(url, window.location.href);
        if (next.origin !== window.location.origin) return null;
        const bare = new URL(next.href);
        bare.hash = '';
        next.hash = window.location.hash;
        window.history.replaceState(window.history.state, '', next.href);
        return bare.href;
    } catch {
        return null;
    }
}
