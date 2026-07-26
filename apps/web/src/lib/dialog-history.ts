/**
 * @file dialog-history.ts
 * @description Back-button integration for modal surfaces (HOS-310). A modal
 * that opts in claims one history entry, so the system back button closes it
 * instead of leaving the page.
 *
 * The entry carries a `#hospeda-dialog-N` fragment and is claimed through
 * Astro's own `navigate()`. Both details are load-bearing: they are what reach
 * `<ClientRouter />`'s no-swap fast path in BOTH traversal directions, instead
 * of letting a back press refetch and swap the whole document — which would
 * destroy every island on the page, half-filled forms included.
 *
 * Claiming is CONDITIONAL. The router's fast path is gated on its private
 * `originalLocation` still matching the document, and this app moves its own
 * URL with raw `pushState`/`replaceState` in several places. When this module
 * cannot vouch for that, it declines to claim: the surface keeps the
 * pre-feature back behaviour, and never risks a swap. Fail-safe, not
 * fail-broken.
 *
 * Full rationale, the list of URL-mutating sites, known limitations, and the
 * surfaces deliberately left uncovered: `apps/web/docs/dialog-history.md`.
 *
 * @module dialog-history
 */

import {
    attachRouterSyncListeners,
    markRouterAgrees,
    navigationInFlight,
    resetRouterSyncForTests,
    routerViewIsCurrent,
    transitionsEnabled
} from './dialog-history.router-sync';

/** Marker written into the claimed entry's history state. */
const DIALOG_STATE_KEY = '__hospedaDialog';

/** Fragment prefix identifying an entry claimed here. */
const DIALOG_HASH_PREFIX = 'hospeda-dialog-';

/** Companion marker distinguishing this document's entries from a prior load's. */
const DIALOG_SESSION_KEY = '__hospedaDialogSession';

/** Unique per document load. See {@link currentEntryId}. */
let SESSION_STAMP = crypto.randomUUID();

type NavigateFn = (
    href: string,
    options?: { readonly state?: Record<string, unknown> }
) => Promise<void>;

interface DialogHistoryEntry {
    readonly id: number;
    /** Invoked when the user pops this entry with the back button/gesture. */
    readonly onPopped: () => void;
    /** `false` until the history entry actually exists. */
    pushed: boolean;
    /** Set when released before the claim landed, so the claim self-cancels. */
    cancelled: boolean;
}

interface AcquireParams {
    /**
     * Called when the user dismisses the modal with the back gesture. Never
     * called when the modal closes through its own UI.
     *
     * The entry is spent by the time this runs. A consumer that declines to
     * close (an in-flight mutation, say) is therefore left unprotected, which
     * is why `useDialogHistoryBack` re-claims whenever the surface is still
     * open on the render after this fires.
     */
    readonly onPopped: () => void;
}

interface AcquireResult {
    /**
     * Call when the modal closes on its own terms (Esc, overlay click, close
     * button, unmount). Unwinds the claimed entry so the back button does not
     * need two presses to leave the page. Safe to call more than once, and
     * safe when the claim was skipped or has not landed yet.
     */
    readonly release: () => void;
}

/**
 * Entries currently owned by open modals, innermost last. Module-level on
 * purpose: it has to outlive individual React trees, because a ClientRouter
 * soft-navigation replaces the DOM without ever unmounting them.
 */
const stack: DialogHistoryEntry[] = [];

let nextId = 1;
let listenersAttached = false;

/**
 * Entries released but not yet unwound. Coalesced into a single `history.go()`
 * so that closing nested modals in one action does not queue two independent
 * traversals — the second would race the first and land somewhere unintended.
 */
let pendingBackSteps = 0;
let backScheduled = false;

/**
 * Ids released into the current unwind batch. They have left `stack` but the
 * traversal has not run yet, so they still count as ours when deciding whether
 * walking back is safe.
 */
const unwinding = new Set<number>();

/** Resolved once, so claims after the first are synchronous. */
let cachedNavigate: NavigateFn | null = null;

const NO_ENTRY: AcquireResult = { release: () => undefined };

/** The dialog id stamped on the current history entry, if any. */
function currentEntryId(): number | undefined {
    const state = window.history.state as Record<string, unknown> | null;
    // Ids restart at 1 on every document load while history state survives, so
    // an entry abandoned by a previous load can carry an id this one is about
    // to reuse. The session stamp is what keeps the two apart.
    if (state?.[DIALOG_SESSION_KEY] !== SESSION_STAMP) return undefined;
    const id = state[DIALOG_STATE_KEY];
    return typeof id === 'number' ? id : undefined;
}

/**
 * Handles the back gesture.
 *
 * The stamped id — not the fragment string — identifies an entry, so an
 * ordinary `#anchor` link inside a modal cannot be mistaken for the modal's
 * own. Traversals this module issued need no special casing: it removes its
 * entries from the stack before unwinding, so they fall out through the two
 * guards below rather than through a flag that could desynchronise.
 */
function handlePopState(): void {
    const top = stack[stack.length - 1];
    if (!top) return;

    const currentId = currentEntryId();
    // Still sitting on the innermost modal's own entry: nothing was dismissed.
    if (currentId === top.id) return;
    // Ids are monotonic within a document, so a HIGHER id is necessarily an
    // entry claimed after this one — i.e. the user moved forward, into an entry
    // already dismissed or abandoned. That must not close anything. A lower id
    // is a genuine back traversal, even when it belongs to an entry this module
    // abandoned earlier (which sits directly below the current claim after the
    // user navigates away from an open modal and returns).
    if (currentId !== undefined && currentId > top.id) return;

    stack.pop();
    // A claim still resolving has no entry to own any more; letting it land
    // would strand a fragment in the URL that nothing will ever unwind.
    if (!top.pushed) top.cancelled = true;
    top.onPopped();
}

/**
 * A page swap tears down the React trees that own these entries without ever
 * running their effect cleanups, so the entries are abandoned: their callbacks
 * must not fire into a dead tree, and — more importantly — the cleanup that
 * eventually does run must not walk history backwards *into* the navigation
 * that is already under way. Any queued unwind is dropped for the same reason.
 *
 * The cost is the documented limitation: the abandoned entry survives, so
 * returning to it costs one inert back press.
 *
 * Only `astro:before-swap` is listened to. `ListingLayout.astro`'s partial
 * swap dispatches `astro:after-swap` WITHOUT it, and that case must not
 * abandon anything: the partial swap deliberately preserves the sidebar's
 * React tree, so its modals are still alive afterwards.
 */
function abandonAll(): void {
    // Cancel anything still resolving, or it would push an entry into the
    // middle of the swap and never be unwound.
    for (const entry of stack) {
        entry.cancelled = true;
    }
    stack.length = 0;
    pendingBackSteps = 0;
}

function attachListeners(): void {
    // Not short-circuited by the flag below: `attachRouterSyncListeners` keeps
    // its own, and letting one flag gate both means clearing only the other
    // wedges re-attachment forever — silently, since the baseline then never
    // re-syncs and every claim is refused for the life of the realm.
    attachRouterSyncListeners({ onSwapStart: abandonAll });
    if (listenersAttached) return;
    listenersAttached = true;
    window.addEventListener('popstate', handlePopState);
}

/**
 * Warms the router module so claims are synchronous.
 *
 * Ordering, not performance, is the point: `release()` unwinds on a
 * microtask, and a microtask always beats a dynamic import's continuation —
 * even for an already-loaded module. An async claim therefore lets a fast
 * close walk history back over an entry that was never pushed, sending the
 * user off the page. Resolving `navigate` up front closes that window; the
 * `cancelled` flag below covers the first-open-before-warm case.
 */
function warmRouter(): void {
    if (cachedNavigate || !transitionsEnabled()) return;
    void (import('astro:transitions/client') as Promise<{ navigate: NavigateFn }>)
        .then(({ navigate }) => {
            cachedNavigate = navigate;
        })
        .catch(() => {
            // Leave `cachedNavigate` null; claims stay skipped rather than
            // falling back to an unrouted entry, which would swap on back.
        });
}

/**
 * Takes ownership of a history entry on behalf of a modal that just opened.
 *
 * Claiming is best-effort by design. It runs inside a React passive effect, so
 * letting a `SecurityError` (Safari throttles `pushState`) or an unparseable
 * document URL escape would unmount the whole island — a far worse outcome
 * than a modal that simply keeps the old back-button behaviour. The same
 * reasoning covers every "skip the claim" branch below.
 */
export function acquireDialogHistoryEntry({ onPopped }: AcquireParams): AcquireResult {
    if (typeof window === 'undefined') return NO_ENTRY;

    attachListeners();
    warmRouter();

    // Without the router there is nothing to appease, but also no cheap path:
    // a plain entry would make the back press swap the document on any page
    // that does have the router. Only claim where we can route the entry.
    if (!transitionsEnabled()) return NO_ENTRY;
    // Claiming calls `navigate()`, whose first act is to abort whatever
    // navigation is already in flight. Opening a modal must never cancel the
    // link the user just tapped.
    if (navigationInFlight()) return NO_ENTRY;
    if (!routerViewIsCurrent()) return NO_ENTRY;

    const entry: DialogHistoryEntry = {
        id: nextId++,
        onPopped,
        pushed: false,
        cancelled: false
    };
    stack.push(entry);

    const navigateNow = cachedNavigate;
    if (navigateNow) {
        if (!claim(navigateNow, entry)) return NO_ENTRY;
    } else {
        // First open on this page beat the warm-up. Land the claim when the
        // module resolves, unless it was released in the meantime — and
        // re-check the preconditions, because the URL may have moved during
        // the gap (the `?calendarSync=` and post-login strips both run in
        // island effects).
        void (import('astro:transitions/client') as Promise<{ navigate: NavigateFn }>)
            .then(({ navigate }) => {
                cachedNavigate = navigate;
                if (entry.cancelled) return;
                if (navigationInFlight() || !routerViewIsCurrent()) {
                    dropEntry(entry);
                    return;
                }
                claim(navigate, entry);
            })
            .catch(() => {
                dropEntry(entry);
            });
    }

    return { release: () => releaseDialogHistoryEntry(entry) };
}

/** The URL of the entry this module would claim, or `null` if it cannot. */
function dialogEntryHref(id: number): string | null {
    try {
        const url = new URL(window.location.href);
        url.hash = `${DIALOG_HASH_PREFIX}${id}`;
        return url.href;
    } catch {
        return null;
    }
}

/**
 * Performs the routed push. Returns whether the entry now exists.
 *
 * The URL is resolved here, not at acquire time, so a deferred claim cannot
 * navigate back to a URL the app has since rewritten.
 */
function claim(navigateFn: NavigateFn, entry: DialogHistoryEntry): boolean {
    const href = dialogEntryHref(entry.id);
    if (href === null) {
        dropEntry(entry);
        return false;
    }

    // `navigate` is async, so a failure inside it — Safari throttling
    // `pushState`, say — arrives as a rejection rather than a throw. Both
    // shapes are absorbed: an unhandled rejection would surface as noise in
    // Sentry for something this module is designed to shrug off.
    try {
        Promise.resolve(
            navigateFn(href, {
                state: { [DIALOG_STATE_KEY]: entry.id, [DIALOG_SESSION_KEY]: SESSION_STAMP }
            })
        ).catch(() => {
            // Only disown an entry that never landed. A rejection arriving
            // after a successful push (scroll bookkeeping, a future stage)
            // would otherwise drop a live entry out of the stack, leaving
            // the modal un-closable by back and the entry un-unwindable.
            if (!entry.pushed) dropEntry(entry);
        });
    } catch {
        dropEntry(entry);
        return false;
    }

    // Verify rather than assume. If the router took a different path than the
    // one predicted — the guard above mispredicted, or a future Astro version
    // changed the fast path — no entry exists, and believing otherwise would
    // later walk history back over somebody else's entry. Note this DETECTS a
    // mispredicted claim, it cannot prevent the swap that one already
    // dispatched; the guard above is the only real defence.
    if (currentEntryId() !== entry.id) {
        dropEntry(entry);
        return false;
    }

    entry.pushed = true;
    // `moveToLocation` just set the router's `originalLocation` to `href`,
    // whose pathname and search are the document's own.
    markRouterAgrees();
    return true;
}

function dropEntry(entry: DialogHistoryEntry): void {
    const index = stack.indexOf(entry);
    if (index !== -1) stack.splice(index, 1);
}

/**
 * Gives back an entry claimed by {@link acquireDialogHistoryEntry}. The entry
 * leaves the stack synchronously so that a sibling releasing in the same tick
 * sees an accurate top — otherwise the outer of two simultaneously-closing
 * modals would skip its own unwind and leak its entry.
 */
function releaseDialogHistoryEntry(entry: DialogHistoryEntry): void {
    // Already gone means the back gesture consumed it, or a page swap
    // abandoned it — nothing owed either way.
    if (stack.indexOf(entry) === -1) return;
    dropEntry(entry);

    if (!entry.pushed) {
        // The claim is still in flight. Cancelling it is the whole fix for
        // unwinding an entry that does not exist yet.
        entry.cancelled = true;
        return;
    }

    unwinding.add(entry.id);
    scheduleUnwind();
}

function scheduleUnwind(): void {
    pendingBackSteps++;
    if (backScheduled) return;
    backScheduled = true;
    // Deferred so that a burst of releases in one React commit becomes a
    // single traversal.
    queueMicrotask(() => {
        const steps = pendingBackSteps;
        const batch = new Set(unwinding);
        pendingBackSteps = 0;
        backScheduled = false;
        unwinding.clear();
        if (steps <= 0) return;

        // Whether walking back is safe can only be decided once the batch is
        // complete. React destroys sibling effects in declaration order, so
        // when two nested modals close in one commit the OUTER one releases
        // first — at which point the current position still belongs to the
        // inner one and a per-release check would wrongly abandon it.
        //
        // Landing outside the batch means something else pushed on top since
        // the claim (`ListingLayout` re-pushes on a 500ms filter debounce) or
        // a traversal moved below these entries. Either way `go(-n)` would
        // take the user somewhere they did not ask for, so the entries are
        // abandoned: one inert back press, never a surprise navigation.
        const currentId = currentEntryId();
        if (currentId === undefined || !batch.has(currentId)) return;

        try {
            window.history.go(-steps);
        } catch {
            // Same reasoning as the claim path: a rejected traversal leaves an
            // extra entry behind, which is survivable.
        }
    });
}

if (typeof window !== 'undefined') {
    // As early as possible: the further this is from page load, the more
    // chance some island has already moved the URL behind the router's back.
    markRouterAgrees();
    warmRouter();
    // Listeners MUST be live from module evaluation, not from the first claim.
    // `astro:before-swap`/`astro:page-load` are the only production re-sync of
    // `routerAgreesOn`, and the JS realm survives soft navigations — attaching
    // them lazily meant every swap before the session's first modal went
    // unobserved, leaving the baseline stale and every later claim refused.
    attachListeners();
}

/**
 * Test-only reset of the module-level state and listener registration.
 *
 * @internal
 */
export function resetDialogHistoryForTests(): void {
    stack.length = 0;
    nextId = 1;
    pendingBackSteps = 0;
    backScheduled = false;
    unwinding.clear();
    // Rotated with `nextId`, or a leftover entry from an earlier test would
    // carry the same (id, stamp) pair as a fresh one — recreating exactly the
    // impersonation the stamp exists to prevent, inside the suite.
    SESSION_STAMP = crypto.randomUUID();
    // `cachedNavigate` deliberately survives: it is a resolved module, not
    // state, and clearing it would push every following claim back onto the
    // async path that production never takes.
    resetRouterSyncForTests();
    if (listenersAttached) {
        window.removeEventListener('popstate', handlePopState);
        listenersAttached = false;
    }
}
